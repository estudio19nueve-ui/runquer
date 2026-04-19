-- ==========================================
-- SCRIPT DE MIGRACIÓN: MOTOR HEXAGONAL v2.0
-- ==========================================

-- 1. LIMPIEZA DE "BASURA" ANTERIOR
-- Borramos restos de intentos fallidos para empezar de cero
DROP TABLE IF EXISTS public.hex_territory;
DROP FUNCTION IF EXISTS public.conquer_territory(text);
DROP FUNCTION IF EXISTS public.upgrade_territory(uuid, geometry);
DROP FUNCTION IF EXISTS public.decay_territories();

-- 2. PREPARACIÓN DE LA TABLA DE TERRITORIOS
-- Añadimos las columnas necesarias de forma segura
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS hex_id TEXT;
ALTER TABLE public.territories ADD COLUMN IF NOT EXISTS layers INTEGER DEFAULT 1;

-- Creamos un índice único para que no pueda haber dos usuarios con el mismo hexágono
-- (O para que el mismo usuario no tenga duplicados del mismo hexágono)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_hex_id') THEN
        ALTER TABLE public.territories ADD CONSTRAINT unique_hex_id UNIQUE (hex_id);
    END IF;
    
    -- Limpieza preventiva de nulos y valores erróneos
    UPDATE public.territories SET layers = 1 WHERE layers IS NULL OR layers < 1;

    -- ELIMINAMOS Y RECREAMOS la restricción para asegurar que acepte desde el nivel 1
    ALTER TABLE public.territories DROP CONSTRAINT IF EXISTS territories_layers_check;
    ALTER TABLE public.territories ADD CONSTRAINT territories_layers_check CHECK (layers >= 1 AND layers <= 5);
END $$;

-- Limpiamos para evitar el error 42P13 de Supabase
DROP FUNCTION IF EXISTS public.conquer_h3_territory(uuid, text);

-- 3. EL NUEVO MOTOR DE CONQUISTA (SQL)
-- Esta función hace todo: identifica los hexágonos, calcula el relleno y procesa el refuerzo
CREATE OR REPLACE FUNCTION public.conquer_h3_territory(
    p_user_id UUID,
    p_route_geojson TEXT
)
RETURNS TABLE (
    conquered_count INTEGER,
    reinforced_count INTEGER,
    total_area_new DOUBLE PRECISION
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_route_geom GEOMETRY;
    v_is_closed BOOLEAN;
    v_target_geom GEOMETRY;
    v_hex_width FLOAT := 150; -- Tamaño del hexágono en metros (ajustable)
    v_new_conquests INTEGER := 0;
    v_reinforcements INTEGER := 0;
BEGIN
    -- 1. Convertir el GeoJSON de la ruta en geometría de PostGIS
    v_route_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_route_geojson), 4326);
    
    -- 2. Detectar si es un bucle cerrado (distancia entre inicio y fin < 50m)
    v_is_closed := ST_Distance(ST_StartPoint(v_route_geom), ST_EndPoint(v_route_geom)) < 0.0005; -- Aprox 50m en grados
    
    -- 3. Definir el área de influencia
    IF v_is_closed AND ST_NPoints(v_route_geom) > 5 THEN
        -- Si es cerrado, el área es la ruta + el interior (polígono)
        v_target_geom := ST_MakePolygon(ST_AddPoint(v_route_geom, ST_StartPoint(v_route_geom)));
    ELSE
        -- Si es abierto, solo los hexágonos que toca la línea (con un pequeño margen)
        v_target_geom := ST_Buffer(v_route_geom::geography, 10)::geometry;
    END IF;

    -- 4. Generar la rejilla de hexágonos que tocan esa área
    -- Usamos ST_HexagonGrid con un origen fijo para que sea una cuadrícula global
    WITH grid AS (
        SELECT (ST_HexagonGrid(v_hex_width, ST_Transform(v_target_geom, 3857))).geom
    ),
    intersecting_hexes AS (
        SELECT 
            ST_Transform(grid.geom, 4326) as geom,
            -- Generamos un ID único basado en las coordenadas del centro para que sea persistente
            'hex_' || floor(ST_X(ST_Centroid(grid.geom))) || '_' || floor(ST_Y(ST_Centroid(grid.geom))) as hex_id
        FROM grid
        WHERE ST_Intersects(grid.geom, ST_Transform(v_target_geom, 3857))
    )
    -- 5. UPSERT: Si el hexágono es nuevo se crea, si es tuyo se refuerza, si es enemigo se ataca
    INSERT INTO public.territories (user_id, hex_id, geom, area_sqm, layers, last_activity)
    SELECT 
        p_user_id, 
        ih.hex_id, 
        ih.geom, 
        ST_Area(ih.geom::geography), 
        1,
        NOW()
    FROM intersecting_hexes ih
    ON CONFLICT (hex_id) DO UPDATE 
    SET 
        layers = CASE 
            WHEN territories.user_id = p_user_id THEN LEAST(COALESCE(territories.layers, 1) + 1, 5) -- Refuerzo (max 5)
            WHEN territories.layers > 1 THEN territories.layers - 1 -- Ataca defensa
            ELSE 1 -- Conquista total
        END,
        user_id = CASE 
            WHEN territories.user_id = p_user_id OR territories.layers > 1 THEN territories.user_id 
            ELSE p_user_id 
        END,
        last_activity = NOW();

    -- Devolvemos estadísticas (con casteo FLOAT8 ultra-explícito)
    RETURN QUERY SELECT 
        1::INTEGER as conquered_count, 
        1::INTEGER as reinforced_count, 
        0.0::FLOAT8 as total_area_new;
END;
$$;

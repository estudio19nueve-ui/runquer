-- =================================================================
-- CORRECCIÓN DEL MOTOR DE CONQUISTA: ALINEACIÓN Y CELDAS ESTABLES
-- Pega este código en el SQL Editor de Supabase y ejecútalo
-- =================================================================

-- 1. LIMPIAR LA FUNCIÓN ANTERIOR
DROP FUNCTION IF EXISTS public.conquer_h3_territory(uuid, text);

-- 2. CREAR LA FUNCIÓN CON IDENTIFICADORES DE CELDA ESTABLES (i, j)
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
    v_hex_width FLOAT := 150; -- Tamaño del hexágono en metros
    v_new_conquests INTEGER := 0;
    v_reinforcements INTEGER := 0;
    v_affected_users UUID[];
BEGIN
    -- 1. Convertir el GeoJSON de la ruta en geometría de PostGIS
    v_route_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_route_geojson), 4326);
    
    -- 2. Detectar si es un bucle cerrado (distancia entre inicio y fin < 50m)
    v_is_closed := ST_Distance(ST_StartPoint(v_route_geom), ST_EndPoint(v_route_geom)) < 0.0005;
    
    -- 3. Definir el área de influencia (bucle o búfer de 10m)
    IF v_is_closed AND ST_NPoints(v_route_geom) > 5 THEN
        v_target_geom := ST_MakePolygon(ST_AddPoint(v_route_geom, ST_StartPoint(v_route_geom)));
    ELSE
        v_target_geom := ST_Buffer(v_route_geom::geography, 10)::geometry;
    END IF;

    -- 4. Registrar defensores que poseen actualmente los hexágonos solapados (excluyendo al atacante)
    SELECT ARRAY_AGG(DISTINCT user_id) INTO v_affected_users
    FROM public.territories 
    WHERE geom && v_target_geom AND ST_Intersects(geom, v_target_geom) 
      AND user_id != p_user_id;

    -- 5. Generar la cuadrícula de hexágonos usando los índices estables (i, j) de ST_HexagonGrid
    WITH grid AS (
        SELECT * FROM ST_HexagonGrid(v_hex_width, ST_Transform(v_target_geom, 3857))
    ),
    intersecting_hexes AS (
        SELECT 
            ST_Transform(grid.geom, 4326) as geom,
            'hex_' || grid.i || '_' || grid.j as hex_id
        FROM grid
        WHERE ST_Intersects(grid.geom, ST_Transform(v_target_geom, 3857))
    ),
    conquest AS (
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
                WHEN territories.user_id = p_user_id THEN LEAST(COALESCE(territories.layers, 1) + 1, 5)
                WHEN territories.layers > 1 THEN territories.layers - 1 
                ELSE 1 
            END,
            user_id = CASE 
                WHEN territories.user_id = p_user_id OR territories.layers > 1 THEN territories.user_id 
                ELSE p_user_id 
            END,
            last_activity = NOW()
        RETURNING user_id, area_sqm, (CASE WHEN xmax = 0 THEN TRUE ELSE FALSE END) as is_new
    )
    SELECT 
        (SELECT count(*)::INTEGER FROM conquest WHERE is_new = TRUE), 
        (SELECT count(*)::INTEGER FROM conquest WHERE is_new = FALSE), 
        (SELECT COALESCE(SUM(area_sqm), 0)::FLOAT8 FROM conquest WHERE is_new = TRUE)
    INTO v_new_conquests, v_reinforcements, total_area_new;

    -- 6. Actualizar el perfil del atacante con la suma real de sus territorios actuales
    UPDATE public.profiles
    SET total_area = COALESCE((SELECT SUM(area_sqm) FROM public.territories WHERE user_id = p_user_id), 0)
    WHERE id = p_user_id;

    -- 7. Actualizar el perfil de los defensores afectados
    IF v_affected_users IS NOT NULL AND cardinality(v_affected_users) > 0 THEN
        UPDATE public.profiles
        SET total_area = COALESCE((SELECT SUM(area_sqm) FROM public.territories WHERE user_id = profiles.id), 0)
        WHERE id = ANY(v_affected_users);
    END IF;

    RETURN QUERY SELECT v_new_conquests, v_reinforcements, total_area_new;
END;
$$;


-- =================================================================
-- 3. RECONSTRUCCIÓN RETROACTIVA DE LA CUADRÍCULA (RESET Y REAJUSTE)
-- =================================================================
DO $$
DECLARE
    r RECORD;
    v_stats RECORD;
BEGIN
    -- 1. Vaciar territorios desalineados (borra los de tamaño 130 y 150 mezclados)
    TRUNCATE TABLE public.territories CASCADE;

    -- 2. Procesar cronológicamente cada carrera guardada para reconstruir el mapa de forma perfecta
    FOR r IN 
        SELECT id, user_id, ST_AsGeoJSON(path) as geojson, created_at 
        FROM public.runs 
        ORDER BY created_at ASC 
    LOOP
        -- Ejecutar la conquista usando la nueva lógica para la carrera histórica
        SELECT * INTO v_stats FROM public.conquer_h3_territory(r.user_id, r.geojson);
        
        -- Vincular los nuevos hexágonos resultantes con la carrera y su fecha correcta
        UPDATE public.territories 
        SET run_id = r.id,
            created_at = r.created_at,
            last_activity = r.created_at
        WHERE user_id = r.user_id AND run_id IS NULL;
    END LOOP;
    
    -- 3. Recalcular las áreas totales de todos los perfiles de usuario
    UPDATE public.profiles p
    SET total_area = COALESCE((SELECT SUM(area_sqm) FROM public.territories WHERE user_id = p.id), 0);
END;
$$;

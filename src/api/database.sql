-- ==========================================
-- RUNQUER APP: CONFIGURACIÓN MAESTRA DE BASE DE DATOS
-- Pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. HABILITAR EXTENSIONES SPATIAL
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. TABLA DE TERRITORIOS
CREATE TABLE IF NOT EXISTS public.territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    geom GEOMETRY(Polygon, 4326) NOT NULL, 
    area_sqm DOUBLE PRECISION NOT NULL,
    layers INTEGER DEFAULT 1 CHECK (layers >= 1 AND layers <= 3),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice GIST para que las consultas de mapa sean instantáneas
CREATE INDEX IF NOT EXISTS territories_geom_idx ON public.territories USING GIST (geom);

-- 3. SEGURIDAD (RLS)
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de territorios" ON public.territories FOR SELECT USING (true);
CREATE POLICY "Usuarios gestionan sus propios territorios" ON public.territories FOR ALL USING (auth.uid() = user_id);

-- 4. FUNCIÓN MAESTRA DE CONQUISTA (IMPLEMENTA PUNTO 3 DEL PROMPT)
-- Esta función maneja el solapamiento, daño de capas y robo de territorio automáticamente.
CREATE OR REPLACE FUNCTION public.conquer_territory(p_new_geom_geojson TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_new_geom GEOMETRY;
    v_attacker_geom GEOMETRY;
    v_victim RECORD;
    v_area_sqm DOUBLE PRECISION;
    v_stolen_geom GEOMETRY;
BEGIN
    -- Validar usuario
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autenticado');
    END IF;

    -- Convertir GeoJSON a Geometry
    v_new_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_new_geom_geojson), 4326);
    v_attacker_geom := v_new_geom;
    v_area_sqm := ST_Area(v_new_geom::geography);

    -- 1. Buscar territorios enemigos que se solapen (&& usa el índice espacial)
    FOR v_victim IN 
        SELECT id, user_id, geom, layers 
        FROM public.territories 
        WHERE geom && v_attacker_geom AND ST_Intersects(geom, v_attacker_geom)
          AND user_id != v_user_id
    LOOP
        -- Regla del Bucle: Mecánica de Robo
        IF v_victim.layers > 1 THEN
            -- Daño de escudo: Restar 1 capa
            UPDATE public.territories SET layers = layers - 1 WHERE id = v_victim.id;
        ELSE
            -- Robo: Recortar defensor y sumar al atacante
            v_stolen_geom := ST_Intersection(v_victim.geom, v_attacker_geom);
            
            -- Actualizar defensor (si el área resultante es vacía o insignificante, se borra)
            UPDATE public.territories 
            SET geom = ST_Difference(geom, v_attacker_geom),
                area_sqm = ST_Area(ST_Difference(geom, v_attacker_geom)::geography)
            WHERE id = v_victim.id;

            -- Sumar territorio al atacante (v_attacker_geom crece)
            v_attacker_geom := ST_Union(v_attacker_geom, v_stolen_geom);
        END IF;
    END LOOP;

    -- 2. Insertar el nuevo territorio (o actualizar área final si hubo robos)
    INSERT INTO public.territories (user_id, geom, area_sqm, layers)
    VALUES (v_user_id, v_attacker_geom, ST_Area(v_attacker_geom::geography), 1);

    RETURN jsonb_build_object(
        'success', true, 
        'final_area', ST_Area(v_attacker_geom::geography),
        'msg', 'Conquista procesada correctamente'
    );
END;
$$;

-- 5. FUNCIÓN DE DECAIMIENTO (DECAY)
-- Resta 1 capa cada 72h de inactividad
CREATE OR REPLACE FUNCTION public.decay_territories() 
RETURNS void AS $$
BEGIN
    -- Restar capa
    UPDATE public.territories 
    SET layers = layers - 1 
    WHERE last_activity < (NOW() - INTERVAL '72 hours') AND layers > 0;

    -- Borrar si no quedan capas
    DELETE FROM public.territories WHERE layers = 0;
END;
$$ LANGUAGE plpgsql;

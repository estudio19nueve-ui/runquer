-- =================================================================
-- MIGRACIÓN: CORRECCIÓN DE DUPLICACIÓN, BORRADO Y CAPAS DE PROTECCIÓN
-- Pega este código en el SQL Editor de Supabase y ejecútalo
-- =================================================================

-- 1. CAMBIAR LA RELACIÓN DE CLAVE FORÁNEA A 'ON DELETE SET NULL'
-- Esto evita que al borrar una carrera se elimine directamente el territorio
-- (ya que si lo corrimos en otra carrera queremos conservarlo, sólo bajar sus capas)
ALTER TABLE public.territories 
DROP CONSTRAINT IF EXISTS fk_territories_run,
DROP CONSTRAINT IF EXISTS fk_territories_run_id;

ALTER TABLE public.territories
ADD CONSTRAINT fk_territories_run
FOREIGN KEY (run_id) REFERENCES public.runs(id) ON DELETE SET NULL;


-- 2. CREAR FUNCIÓN Y TRIGGER ANTES DE BORRAR UNA CARRERA (BEFORE DELETE ON runs)
-- Al borrar una carrera, el trigger:
-- a) Identifica todos los territorios del usuario que coinciden espacialmente con la carrera.
-- b) Resta 1 capa (layer) de protección a dichos territorios.
-- c) Elimina los territorios que queden con 0 o menos capas.
-- d) Sincroniza la superficie acumulada del perfil.
CREATE OR REPLACE FUNCTION public.handle_run_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_target_geom GEOMETRY;
    v_is_closed BOOLEAN;
    v_hex_width FLOAT := 150;
BEGIN
    -- Si la carrera no tiene path, no hay territorios que procesar
    IF OLD.path IS NULL THEN
        RETURN OLD;
    END IF;

    -- 1. Determinar el área de influencia de la carrera eliminada (bucle o búfer de 10m)
    v_is_closed := ST_Distance(ST_StartPoint(OLD.path), ST_EndPoint(OLD.path)) < 0.0005;
    IF v_is_closed AND ST_NPoints(OLD.path) > 5 THEN
        v_target_geom := ST_MakePolygon(ST_AddPoint(OLD.path, ST_StartPoint(OLD.path)));
    ELSE
        v_target_geom := ST_Buffer(OLD.path::geography, 10)::geometry;
    END IF;

    -- 2. Restar 1 capa a los territorios que se solapan
    UPDATE public.territories
    SET layers = layers - 1
    WHERE user_id = OLD.user_id
      AND geom && v_target_geom 
      AND ST_Intersects(geom, v_target_geom);

    -- 3. Eliminar territorios que quedaron sin capas (layers <= 0)
    DELETE FROM public.territories
    WHERE user_id = OLD.user_id
      AND layers <= 0;

    -- 4. Actualizar el perfil del usuario afectado
    UPDATE public.profiles
    SET total_area = COALESCE((SELECT SUM(area_sqm) FROM public.territories WHERE user_id = OLD.user_id), 0)
    WHERE id = OLD.user_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_run_deleted ON public.runs;
CREATE TRIGGER on_run_deleted
BEFORE DELETE ON public.runs
FOR EACH ROW EXECUTE FUNCTION public.handle_run_delete();


-- 3. INTEGRAR LAS CARRERAS NATIVAS EXISTENTES EN EL SISTEMA DE DE-DUPLICACIÓN
-- Esto registra todos los runs locales en la tabla external_activities como 'native_gps'
-- para que al importar entrenos de Apple Health o Strava se detecten automáticamente
-- como duplicadas y se omitan en el sync.
INSERT INTO public.external_activities (
    run_id, 
    user_id, 
    source_provider, 
    external_activity_id, 
    raw_start_time, 
    raw_end_time, 
    raw_distance, 
    raw_duration, 
    raw_gps_line
)
SELECT 
    r.id,
    r.user_id,
    'native_gps',
    'native_' || r.id,
    r.created_at - (COALESCE(r.duration, 0) * INTERVAL '1 second'),
    r.created_at,
    r.distance_meters,
    COALESCE(r.duration, 0),
    r.path
FROM public.runs r
ON CONFLICT (user_id, source_provider, external_activity_id) DO NOTHING;


-- 4. RECONSTRUCCIÓN SANADORA DEL MAPA Y RANKINGS
-- Esto vacía la tabla temporalmente y vuelve a procesar de forma cronológica todas las carreras.
-- Resolverá todos los problemas de capas extra del pasado y reconstruirá el mapa perfectamente.
DO $$
DECLARE
    r RECORD;
    v_stats RECORD;
BEGIN
    -- 1. Vaciar los territorios para evitar duplicados o inconsistencias
    TRUNCATE TABLE public.territories CASCADE;

    -- 2. Procesar cronológicamente cada carrera guardada que tenga trazado GPS
    FOR r IN 
        SELECT id, user_id, ST_AsGeoJSON(path) as geojson, created_at 
        FROM public.runs 
        WHERE path IS NOT NULL
        ORDER BY created_at ASC 
    LOOP
        -- Ejecutar la conquista usando la lógica hexagonal para cada carrera
        SELECT * INTO v_stats FROM public.conquer_h3_territory(r.user_id, r.geojson);
        
        -- Vincular los hexágonos creados a su carrera y aplicar la fecha original
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

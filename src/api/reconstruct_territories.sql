-- =================================================================
-- RECONSTRUCCIÓN DEL MAPA Y RANKING DE RUNQUER
-- Pega este código en el SQL Editor de Supabase y ejecútalo.
-- Esto regenerará todos los territorios y el ranking basándose en
-- las carreras guardadas con GPS en el historial.
-- =================================================================

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

-- =================================================================
-- FIX: CORRECCIÓN DE TRIGGER DE BORRADO DE CARRERAS Y POLÍTICAS RLS
-- Pega este código en el SQL Editor de Supabase y ejecútalo
-- =================================================================

-- 1. CORREGIR EL TRIGGER DE BORRADO
-- Evita violar la restricción CHECK (layers >= 1) eliminando primero 
-- los territorios con 1 capa y luego decrementando los de más de 1 capa.
-- También añade salvaguardas para rutas de prueba cortas (menos de 2 puntos).
CREATE OR REPLACE FUNCTION public.handle_run_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_target_geom GEOMETRY;
    v_is_closed BOOLEAN;
BEGIN
    -- Si la carrera no tiene path o tiene menos de 2 puntos (carreras de prueba/vacías), no hay territorios que procesar
    IF OLD.path IS NULL OR ST_NPoints(OLD.path) < 2 THEN
        RETURN OLD;
    END IF;

    -- 1. Determinar el área de influencia de la carrera eliminada (bucle o búfer de 10m)
    v_is_closed := ST_Distance(ST_StartPoint(OLD.path), ST_EndPoint(OLD.path)) < 0.0005;
    IF v_is_closed AND ST_NPoints(OLD.path) > 5 THEN
        v_target_geom := ST_MakePolygon(ST_AddPoint(OLD.path, ST_StartPoint(OLD.path)));
    ELSE
        v_target_geom := ST_Buffer(OLD.path::geography, 10)::geometry;
    END IF;

    -- 2. Eliminar directamente los territorios que tienen sólo 1 capa
    -- (Evita que al hacer layers - 1 queden en 0 y violen la restricción CHECK de la tabla)
    DELETE FROM public.territories
    WHERE user_id = OLD.user_id
      AND geom && v_target_geom 
      AND ST_Intersects(geom, v_target_geom)
      AND layers <= 1;

    -- 3. Restar 1 capa a los territorios que tienen más de 1 capa
    UPDATE public.territories
    SET layers = layers - 1
    WHERE user_id = OLD.user_id
      AND geom && v_target_geom 
      AND ST_Intersects(geom, v_target_geom)
      AND layers > 1;

    -- 4. Actualizar el perfil del usuario afectado
    UPDATE public.profiles
    SET total_area = COALESCE((SELECT SUM(area_sqm) FROM public.territories WHERE user_id = OLD.user_id), 0)
    WHERE id = OLD.user_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ASEGURAR POLÍTICA DE BORRADO PARA LA TABLA RUNS
-- Permite que los usuarios borren sus propias carreras desde el cliente Supabase
DROP POLICY IF EXISTS "Usuarios pueden borrar sus propias carreras" ON public.runs;
CREATE POLICY "Usuarios pueden borrar sus propias carreras" 
ON public.runs 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

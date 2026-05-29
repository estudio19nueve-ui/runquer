-- =======================================================
-- RUNQUER APP: REFACTORIZACIÓN DE GAMIFICACIÓN (XP Y NIVELES)
-- Pega este código en el SQL Editor de Supabase y ejecútalo
-- =======================================================

-- 1. AGREGAR COLUMNAS DE LOGRO Y XP A LA TABLA DE RUNS
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS xp_earned INTEGER DEFAULT 0;
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS is_record BOOLEAN DEFAULT FALSE;

-- 2. FUNCIÓN DE TRIGGER PARA CALCULAR XP Y ACTUALIZAR NIVEL
CREATE OR REPLACE FUNCTION public.process_run_xp_and_level()
RETURNS TRIGGER AS $$
DECLARE
    v_base_xp INTEGER := 0;
    v_bonus_xp INTEGER := 0;
    v_lower DOUBLE PRECISION;
    v_upper DOUBLE PRECISION;
    v_better_runs INTEGER;
    v_total_xp INTEGER;
    v_new_level INTEGER;
BEGIN
    -- Determinar XP Base por distancia y sus límites de categoría
    IF NEW.distance_meters < 5000 THEN
        v_base_xp := 100;
        v_lower := 0;
        v_upper := 5000;
    ELSIF NEW.distance_meters >= 5000 AND NEW.distance_meters < 10000 THEN
        v_base_xp := 250;
        v_lower := 5000;
        v_upper := 10000;
    ELSIF NEW.distance_meters >= 10000 AND NEW.distance_meters < 21000 THEN
        v_base_xp := 500;
        v_lower := 10000;
        v_upper := 21000;
    ELSIF NEW.distance_meters >= 21000 AND NEW.distance_meters < 42195 THEN
        v_base_xp := 1000;
        v_lower := 21000;
        v_upper := 42195;
    ELSE
        v_base_xp := 1000;
        v_lower := 42195;
        v_upper := 99999999;
    END IF;

    -- Verificar si es Récord Personal en esa categoría (ritmo segundos/metro, menor es mejor)
    IF NEW.duration > 0 AND NEW.distance_meters > 0 THEN
        SELECT COUNT(*) INTO v_better_runs FROM public.runs
        WHERE user_id = NEW.user_id
          AND id != NEW.id
          AND distance_meters >= v_lower AND distance_meters < v_upper
          AND duration > 0 AND distance_meters > 0
          AND (duration / distance_meters) <= (NEW.duration / NEW.distance_meters);
          
        IF v_better_runs = 0 THEN
            NEW.is_record := TRUE;
            v_bonus_xp := 250;
        ELSE
            NEW.is_record := FALSE;
        END IF;
    ELSE
        NEW.is_record := FALSE;
    END IF;

    -- Asignar XP obtenido a la fila insertada
    NEW.xp_earned := v_base_xp + v_bonus_xp;

    -- Actualizar la experiencia acumulada del perfil
    UPDATE public.profiles 
    SET experience = experience + NEW.xp_earned
    WHERE id = NEW.user_id
    RETURNING experience INTO v_total_xp;

    -- Calcular y actualizar el nivel basado en 1000 XP por nivel
    v_new_level := floor(v_total_xp / 1000) + 1;
    UPDATE public.profiles
    SET level = v_new_level
    WHERE id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REGISTRAR TRIGGER BEFORE INSERT ON RUNS
DROP TRIGGER IF EXISTS on_run_inserted ON public.runs;
CREATE TRIGGER on_run_inserted
  BEFORE INSERT ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.process_run_xp_and_level();

-- 4. RECALCULAR CRONOLÓGICAMENTE LAS CARRERAS EXISTENTES Y REINICIAR PERFILES
DO $$
DECLARE
    r RECORD;
    v_base_xp INTEGER;
    v_bonus_xp INTEGER;
    v_lower DOUBLE PRECISION;
    v_upper DOUBLE PRECISION;
    v_better_runs INTEGER;
    v_xp_earned INTEGER;
    v_is_record BOOLEAN;
BEGIN
    -- Reiniciar experiencia de todos los perfiles
    UPDATE public.profiles SET experience = 0, level = 1;

    -- Iterar sobre las carreras en orden de creación ascendente
    FOR r IN SELECT * FROM public.runs ORDER BY created_at ASC LOOP
        -- Asignar categoría y base
        IF r.distance_meters < 5000 THEN
            v_base_xp := 100; v_lower := 0; v_upper := 5000;
        ELSIF r.distance_meters >= 5000 AND r.distance_meters < 10000 THEN
            v_base_xp := 250; v_lower := 5000; v_upper := 10000;
        ELSIF r.distance_meters >= 10000 AND r.distance_meters < 21000 THEN
            v_base_xp := 500; v_lower := 10000; v_upper := 21000;
        ELSIF r.distance_meters >= 21000 AND r.distance_meters < 42195 THEN
            v_base_xp := 1000; v_lower := 21000; v_upper := 42195;
        ELSE
            v_base_xp := 1000; v_lower := 42195; v_upper := 99999999;
        END IF;

        -- Buscar si había carreras más veloces creadas antes
        IF r.duration > 0 AND r.distance_meters > 0 THEN
            SELECT COUNT(*) INTO v_better_runs FROM public.runs
            WHERE user_id = r.user_id
              AND created_at < r.created_at
              AND distance_meters >= v_lower AND distance_meters < v_upper
              AND duration > 0 AND distance_meters > 0
              AND (duration / distance_meters) <= (r.duration / r.distance_meters);
              
            IF v_better_runs = 0 THEN
                v_is_record := TRUE;
                v_bonus_xp := 250;
            ELSE
                v_is_record := FALSE;
                v_bonus_xp := 0;
            END IF;
        ELSE
            v_is_record := FALSE;
            v_bonus_xp := 0;
        END IF;

        v_xp_earned := v_base_xp + v_bonus_xp;

        -- Actualizar columnas en la carrera
        UPDATE public.runs 
        SET xp_earned = v_xp_earned, is_record = v_is_record 
        WHERE id = r.id;

        -- Acumular XP en el perfil
        UPDATE public.profiles 
        SET experience = experience + v_xp_earned
        WHERE id = r.user_id;
    END LOOP;

    -- Ajustar nivel final
    UPDATE public.profiles 
    SET level = floor(experience / 1000) + 1;
END;
$$;

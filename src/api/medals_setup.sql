-- =========================================================================
-- RUNQUER APP: SISTEMA DE MEDALLAS Y CONQUISTAS (SQL MIGRATION)
-- Pega este código en el SQL Editor de Supabase y ejecútalo
-- =========================================================================

-- 1. CREAR TABLA DE MEDALLAS
CREATE TABLE IF NOT EXISTS public.user_medals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    medal_type TEXT NOT NULL CHECK (medal_type IN ('gold', 'silver', 'bronze')),
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'yearly')),
    period_start DATE NOT NULL,
    area_sqm DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices de unicidad
-- Evita que un usuario tenga dos medallas para el mismo periodo
CREATE UNIQUE INDEX IF NOT EXISTS user_medals_user_period_unique_idx 
ON public.user_medals (user_id, period_type, period_start);

-- Evita que haya dos oros, platas o bronces en el mismo periodo
CREATE UNIQUE INDEX IF NOT EXISTS user_medals_period_medal_unique_idx 
ON public.user_medals (period_type, period_start, medal_type);

-- Habilitar RLS
ALTER TABLE public.user_medals ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
DROP POLICY IF EXISTS "Lectura pública de medallas" ON public.user_medals;
CREATE POLICY "Lectura pública de medallas" ON public.user_medals 
    FOR SELECT USING (true);

-- Permisos
GRANT SELECT ON public.user_medals TO anon, authenticated;

-- =========================================================================
-- 2. FUNCIÓN PARA CALCULAR Y ENTREGAR MEDALLAS DE PERIODOS CERRADOS
-- =========================================================================
CREATE OR REPLACE FUNCTION public.check_and_award_medals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Permite ejecutar con permisos de administrador e ignorar RLS en escritura
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    
    -- Semanal
    v_this_week_monday DATE;
    v_prev_week_monday DATE;
    
    -- Mensual
    v_this_month_first DATE;
    v_prev_month_first DATE;
    
    -- Anual
    v_this_year_first DATE;
    v_prev_year_first DATE;
    
    -- Variables para bucles
    v_rec RECORD;
    v_rank INTEGER;
    v_medal TEXT;
BEGIN
    -- Calcular fechas de inicio de periodos cerrados y actuales
    v_this_week_monday := date_trunc('week', v_now)::date;
    v_prev_week_monday := (v_this_week_monday - INTERVAL '1 week')::date;
    
    v_this_month_first := date_trunc('month', v_now)::date;
    v_prev_month_first := (v_this_month_first - INTERVAL '1 month')::date;
    
    v_this_year_first := date_trunc('year', v_now)::date;
    v_prev_year_first := (v_this_year_first - INTERVAL '1 year')::date;

    -- A) PROCESAR MEDALLAS SEMANALES (Semana pasada)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_medals 
        WHERE period_type = 'weekly' AND period_start = v_prev_week_monday
    ) THEN
        v_rank := 1;
        FOR v_rec IN 
            SELECT user_id, SUM(area_sqm) as total_area_sqm
            FROM public.territories
            WHERE last_activity >= v_prev_week_monday::timestamp AND last_activity < v_this_week_monday::timestamp
            GROUP BY user_id
            ORDER BY total_area_sqm DESC
            LIMIT 3
        LOOP
            IF v_rank = 1 THEN v_medal := 'gold';
            ELSIF v_rank = 2 THEN v_medal := 'silver';
            ELSE v_medal := 'bronze';
            END IF;
            
            INSERT INTO public.user_medals (user_id, medal_type, period_type, period_start, area_sqm)
            VALUES (v_rec.user_id, v_medal, 'weekly', v_prev_week_monday, v_rec.total_area_sqm)
            ON CONFLICT ON CONSTRAINT user_medals_period_type_period_start_medal_type_key DO NOTHING; -- redundancia de seguridad
            
            v_rank := v_rank + 1;
        END LOOP;
    END IF;

    -- B) PROCESAR MEDALLAS MENSUALES (Mes pasado)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_medals 
        WHERE period_type = 'monthly' AND period_start = v_prev_month_first
    ) THEN
        v_rank := 1;
        FOR v_rec IN 
            SELECT user_id, SUM(area_sqm) as total_area_sqm
            FROM public.territories
            WHERE last_activity >= v_prev_month_first::timestamp AND last_activity < v_this_month_first::timestamp
            GROUP BY user_id
            ORDER BY total_area_sqm DESC
            LIMIT 3
        LOOP
            IF v_rank = 1 THEN v_medal := 'gold';
            ELSIF v_rank = 2 THEN v_medal := 'silver';
            ELSE v_medal := 'bronze';
            END IF;
            
            INSERT INTO public.user_medals (user_id, medal_type, period_type, period_start, area_sqm)
            VALUES (v_rec.user_id, v_medal, 'monthly', v_prev_month_first, v_rec.total_area_sqm)
            ON CONFLICT ON CONSTRAINT user_medals_period_type_period_start_medal_type_key DO NOTHING;
            
            v_rank := v_rank + 1;
        END LOOP;
    END IF;

    -- C) PROCESAR MEDALLAS ANUALES (Año pasado)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_medals 
        WHERE period_type = 'yearly' AND period_start = v_prev_year_first
    ) THEN
        v_rank := 1;
        FOR v_rec IN 
            SELECT user_id, SUM(area_sqm) as total_area_sqm
            FROM public.territories
            WHERE last_activity >= v_prev_year_first::timestamp AND last_activity < v_this_year_first::timestamp
            GROUP BY user_id
            ORDER BY total_area_sqm DESC
            LIMIT 3
        LOOP
            IF v_rank = 1 THEN v_medal := 'gold';
            ELSIF v_rank = 2 THEN v_medal := 'silver';
            ELSE v_medal := 'bronze';
            END IF;
            
            INSERT INTO public.user_medals (user_id, medal_type, period_type, period_start, area_sqm)
            VALUES (v_rec.user_id, v_medal, 'yearly', v_prev_year_first, v_rec.total_area_sqm)
            ON CONFLICT ON CONSTRAINT user_medals_period_type_period_start_medal_type_key DO NOTHING;
            
            v_rank := v_rank + 1;
        END LOOP;
    END IF;
END;
$$;

-- Otorgar permiso de ejecución para la llamada fail-safe desde el cliente
GRANT EXECUTE ON FUNCTION public.check_and_award_medals() TO authenticated;

-- =========================================================================
-- 3. PLANIFICACIÓN DIARIA AUTOMÁTICA (pg_cron) - FAILSAFE SEGURO
-- =========================================================================
DO $$
BEGIN
    -- Intentar cargar pg_cron
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    
    -- Desprogramar si ya existía para evitar duplicados
    PERFORM cron.unschedule('award-medals-daily');
    
    -- Programar diariamente a las 00:05 (servidor)
    PERFORM cron.schedule(
        'award-medals-daily',
        '5 0 * * *',
        'SELECT public.check_and_award_medals();'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no disponible o sin privilegios de Superuser. El sistema operará de forma transparente mediante el mecanismo rpc fail-safe en el inicio de la app.';
END;
$$;

-- ==========================================
-- OPEN-RUNQUER: MIGRACIÓN DE IMPORTACIÓN EXTERNA
-- Pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. CREACIÓN DE LA TABLA DE ACTIVIDADES EXTERNAS
CREATE TABLE IF NOT EXISTS public.external_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_provider TEXT NOT NULL CHECK (source_provider IN ('native_gps', 'apple_health', 'strava', 'garmin')),
    external_activity_id TEXT NOT NULL,
    raw_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_distance DOUBLE PRECISION DEFAULT 0, -- en metros
    raw_duration INTEGER DEFAULT 0,          -- en segundos
    raw_gps_line GEOMETRY(LineString, 4326),  -- la ruta GPS cruda
    metadata JSONB DEFAULT '{}'::jsonb,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_provider_activity UNIQUE (user_id, source_provider, external_activity_id)
);

-- 2. ÍNDICES ESPACIALES Y DE BÚSQUEDA
CREATE INDEX IF NOT EXISTS external_activities_geom_idx ON public.external_activities USING GIST (raw_gps_line);
CREATE INDEX IF NOT EXISTS external_activities_user_provider_idx ON public.external_activities (user_id, source_provider);

-- 3. HABILITAR SEGURIDAD A NIVEL DE FILA (RLS)
ALTER TABLE public.external_activities ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE ACCESO
DROP POLICY IF EXISTS "Usuarios ven sus propias actividades externas" ON public.external_activities;
CREATE POLICY "Usuarios ven sus propias actividades externas" 
ON public.external_activities 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios insertan sus propias actividades externas" ON public.external_activities;
CREATE POLICY "Usuarios insertan sus propias actividades externas" 
ON public.external_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios actualizan sus propias actividades externas" ON public.external_activities;
CREATE POLICY "Usuarios actualizan sus propias actividades externas" 
ON public.external_activities 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

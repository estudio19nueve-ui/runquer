-- ==========================================
-- OPEN-RUNQUER: MIGRACIÓN DE CREDENCIALES DE USUARIO
-- Pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. CREACIÓN DE LA TABLA DE INTEGRACIONES DE USUARIO
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('strava', 'garmin')),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    provider_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- 2. HABILITAR SEGURIDAD A NIVEL DE FILA (RLS)
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE ACCESO
DROP POLICY IF EXISTS "Usuarios gestionan sus propias credenciales" ON public.user_integrations;
CREATE POLICY "Usuarios gestionan sus propias credenciales" 
ON public.user_integrations 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

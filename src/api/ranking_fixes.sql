-- =================================================================
-- CORRECCIÓN DE RANKING Y HISTORIAL: PERMISOS Y CARRERAS SIN GPS
-- Pega este código en el SQL Editor de Supabase y ejecútalo
-- =================================================================

-- 1. Permitir que el campo de ruta (path) sea nulo
-- Esto soluciona los fallos al guardar carreras sin GPS (ej. cintas de correr o importados sin mapa)
ALTER TABLE public.runs ALTER COLUMN path DROP NOT NULL;

-- 2. Corregir políticas de seguridad en la tabla de carreras (runs)
-- Permite que los usuarios puedan ver las carreras de otros en el feed y perfiles (vital para la experiencia social y ranking)
DROP POLICY IF EXISTS "Usuarios ven sus propias carreras" ON public.runs;
DROP POLICY IF EXISTS "Lectura pública de carreras" ON public.runs;

CREATE POLICY "Lectura pública de carreras" 
ON public.runs 
FOR SELECT 
USING (true);

-- 3. Reparar perfiles de usuario huérfanos
-- Si un usuario se registró antes de tener el trigger de perfiles, no tendrá fila en 'profiles'
-- y quedará excluido del ranking. Este comando los repara de forma segura.
INSERT INTO public.profiles (id, username)
SELECT 
    id, 
    split_part(email, '@', 1) || '_' || floor(random() * 1000)::text
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Asegurar que las columnas del ranking tienen permisos correctos
GRANT SELECT ON public.runs TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

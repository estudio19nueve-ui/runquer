-- ==========================================
-- RUNQUER APP: SISTEMA DE PERFILES Y RANKING
-- Pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. CREAR TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar RLS en perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Perfiles visibles para todos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Cada usuario edita su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. TRIGGER PARA CREAR PERFIL AL REGISTRARSE
-- Esto automatiza que cada nuevo usuario tenga una fila en 'profiles'
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name)
    VALUES (
        new.id, 
        split_part(new.email, '@', 1) || '_' || floor(random() * 1000)::text, -- Username por defecto basado en email
        new.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Borrar trigger si existe y crearlo de nuevo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. VISTA DE LÍDERES (LEADERBOARD)
-- Resume el área total conquistada por cada usuario
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
    p.id as user_id,
    p.username,
    COALESCE(SUM(t.area_sqm), 0) as total_area_sqm,
    COUNT(t.id) as total_territories,
    MAX(t.last_activity) as last_conquest
FROM public.profiles p
LEFT JOIN public.territories t ON p.id = t.user_id
GROUP BY p.id, p.username
ORDER BY total_area_sqm DESC;

-- Dar permiso de lectura a la vista
GRANT SELECT ON public.leaderboard TO anon, authenticated;

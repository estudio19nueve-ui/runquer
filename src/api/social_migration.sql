-- ===========================================
-- MIGRACIÓN SOCIAL Y FIX DE RENOMBRADO v3.0
-- ===========================================

-- 1. POLÍTICAS DE RENOMBRADO (RUNS)
-- Permitir que el dueño de una carrera pueda actualizar su nombre
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can update their own runs" ON public.runs;
    CREATE POLICY "Users can update their own runs" 
    ON public.runs FOR UPDATE 
    USING (auth.uid() = user_id);
END $$;

-- 2. POLÍTICAS DE PERFIL (PROFILES)
-- Permitir que el dueño del perfil actualice su username y territory_color
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);
END $$;

-- 3. TABLA DE SEGUIDORES (FOLLOWS)
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    followed_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, followed_id)
);

-- RLS para Follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Anyone can see follows" ON public.follows;
    CREATE POLICY "Anyone can see follows" ON public.follows FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Users can follow/unfollow" ON public.follows;
    CREATE POLICY "Users can follow/unfollow" ON public.follows FOR ALL USING (auth.uid() = follower_id);
END $$;

-- 4. ACTUALIZACIÓN DE CONTADORES EN PERFIL
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Trigger para auto-actualizar contadores (Opcional pero recomendado para performance)
CREATE OR REPLACE FUNCTION public.handle_follow_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.followed_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.profiles SET following_count = following_count - 1 WHERE id = OLD.follower_id;
        UPDATE public.profiles SET followers_count = followers_count - 1 WHERE id = OLD.followed_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
BEGIN
    DROP TRIGGER IF EXISTS on_follow_change ON public.follows;
    CREATE TRIGGER on_follow_change
    AFTER INSERT OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.handle_follow_stats();
END $$;

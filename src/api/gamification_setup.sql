-- ==========================================
-- RUNQUER APP: GAMIFICACIÓN Y SOCIAL
-- Pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. EXTENSIÓN DE PERFILES (XP, Nivel y Color)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS territory_color TEXT DEFAULT '#FF0000';

-- 2. SISTEMA DE LOGROS
CREATE TABLE IF NOT EXISTS public.achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    exp_reward INTEGER DEFAULT 100
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id TEXT REFERENCES public.achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Insertar logros iniciales
INSERT INTO public.achievements (id, name, description, icon_name, exp_reward) VALUES
('first_conquest', 'Primeros Pasos', 'Conquista tu primer territorio', 'MapPin', 100),
('explorer', 'Explorador', 'Llega a 5 territorios conquistados', 'Globe', 500),
('guardian', 'Guardián', 'Refuerza un escudo por primera vez', 'Shield', 200)
ON CONFLICT (id) DO NOTHING;

-- 3. FEED DE ACTIVIDAD GLOBAL
CREATE TABLE IF NOT EXISTS public.activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'CONQUEST', 'ATTACK', 'UPGRADE'
    content TEXT NOT NULL,
    location GEOMETRY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_feed_created_at_idx ON public.activity_feed (created_at DESC);

-- 4. TRIGGER PARA FEED DE CONQUISTA
-- Crea automáticamente un evento en el feed al conquistar
CREATE OR REPLACE FUNCTION public.on_conquest_feed_event()
RETURNS TRIGGER AS $$
DECLARE
    v_username TEXT;
BEGIN
    SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;
    
    INSERT INTO public.activity_feed (user_id, event_type, content, location)
    VALUES (
        NEW.user_id, 
        'CONQUEST', 
        v_username || ' ha reclamado ' || floor(NEW.area_sqm) || ' m² de territorio.',
        ST_Centroid(NEW.geom)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_conquest_created
  AFTER INSERT ON public.territories
  FOR EACH ROW EXECUTE FUNCTION public.on_conquest_feed_event();

-- 5. FUNCIÓN PARA GANAR EXPERIENCIA Y SUBIR NIVEL
CREATE OR REPLACE FUNCTION public.add_experience(p_user_id UUID, p_amount INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_current_exp INTEGER;
    v_new_level INTEGER;
BEGIN
    UPDATE public.profiles 
    SET experience = experience + p_amount
    WHERE id = p_user_id
    RETURNING experience INTO v_current_exp;

    v_new_level := floor(v_current_exp / 1000) + 1; -- 1000 XP por nivel

    UPDATE public.profiles 
    SET level = v_new_level
    WHERE id = p_user_id;

    RETURN jsonb_build_object('new_exp', v_current_exp, 'new_level', v_new_level);
END;
$$;

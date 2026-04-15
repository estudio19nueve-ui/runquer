-- ==========================================
-- RUNQUER APP: HISTORIAL, CHAT Y ESCUDOS
-- Pega este código en el SQL Editor de Supabase
-- ==========================================

-- 1. TABLA DE HISTORIAL DE CARRERAS
CREATE TABLE IF NOT EXISTS public.runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    path GEOMETRY(LineString, 4326) NOT NULL, -- La ruta dibujada
    area_sqm DOUBLE PRECISION NOT NULL,
    distance_meters DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus propias carreras" ON public.runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios insertan sus propias carreras" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. TABLA DE CHAT LOCAL
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL, -- Ubicación desde donde se envió
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_location_idx ON public.messages USING GIST (location);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de mensajes" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Usuarios insertan sus propios mensajes" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. FUNCIÓN PARA REFORZAR ESCUDOS (UPGRADE LAYERS)
CREATE OR REPLACE FUNCTION public.upgrade_territory(p_territory_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Verificar que el territorio pertenezca al usuario
    IF NOT EXISTS (SELECT 1 FROM public.territories WHERE id = p_territory_id AND user_id = auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso o el territorio no existe');
    END IF;

    -- Subir capa si es < 3
    UPDATE public.territories 
    SET layers = LEAST(layers + 1, 3),
        last_activity = NOW() -- Reforzar también renueva la vida del territorio
    WHERE id = p_territory_id AND user_id = auth.uid() AND layers < 3;

    RETURN jsonb_build_object('success', true, 'msg', 'Escudo reforzado');
END;
$$;

-- 4. VISTA DE CHAT CON PERFILES
-- Para ver el username al leer mensajes
CREATE OR REPLACE VIEW public.local_chat AS
SELECT 
    m.id,
    m.content,
    m.location,
    m.created_at,
    p.username
FROM public.messages m
JOIN public.profiles p ON m.user_id = p.id;

-- 5. FUNCIÓN PARA BUSCAR MENSAJES CERCANOS (CHAT LOCAL)
CREATE OR REPLACE FUNCTION public.get_local_messages(p_lng DOUBLE PRECISION, p_lat DOUBLE PRECISION, p_radius DOUBLE PRECISION)
RETURNS TABLE (
    id UUID,
    content TEXT,
    username TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        p.username,
        m.created_at
    FROM public.messages m
    JOIN public.profiles p ON m.user_id = p.id
    WHERE ST_DWithin(
        m.location, 
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 
        p_radius
    )
    ORDER BY m.created_at DESC
    LIMIT 50;
END;
$$;

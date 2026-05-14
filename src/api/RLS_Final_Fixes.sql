-- ==========================================
-- REPARACIÓN DE POLÍTICAS DE SEGURIDAD (RLS)
-- ==========================================

-- 1. PERMITIR QUE LOS USUARIOS CREEN Y ACTUALICEN SU PROPIO PERFIL
-- (Corrige el error de que el nombre no se guarda o vuelve a 'Atleta Runquer')
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. PERMITIR SEGUIR A OTROS USUARIOS
-- (Corrige el error al pulsar "Seguir" en Ranking o Chat)
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others" 
ON public.follows FOR INSERT 
WITH CHECK (auth.uid() = follower_id);

-- 3. PERMITIR DEJAR DE SEGUIR
DROP POLICY IF EXISTS "Users can unfollow others" ON public.follows;
CREATE POLICY "Users can unfollow others" 
ON public.follows FOR DELETE 
USING (auth.uid() = follower_id);

-- 4. ASEGURAR LECTURA PÚBLICA DE SEGUIDORES
DROP POLICY IF EXISTS "Follows are public" ON public.follows;
CREATE POLICY "Follows are public" 
ON public.follows FOR SELECT 
USING (true);

-- 5. ASEGURAR LECTURA PÚBLICA DE TERRITORIOS
-- (Para que todos vean lo que otros conquistan)
DROP POLICY IF EXISTS "Territories are public" ON public.territories;
CREATE POLICY "Territories are public" 
ON public.territories FOR SELECT 
USING (true);

-- Ajuste adicional: Asegurar que las columnas existen y son accesibles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

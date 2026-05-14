-- FIX: Permitir renombrado de actividades y asegurar columnas
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS name TEXT;

-- Asegurar que el usuario pueda editar sus propias carreras
CREATE POLICY IF NOT EXISTS "Usuarios pueden actualizar sus propias carreras" 
ON public.runs 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Sincronizar el nombre inicial si está vacío
UPDATE public.runs SET name = 'Carrera Matinal' WHERE name IS NULL;

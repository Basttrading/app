-- SCRIPT DE MISE À JOUR POUR LE PORTAIL COACH / ADMIN
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. MISE À JOUR DE LA TABLE PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student',
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS discord_username TEXT;

-- 2. CRÉATION DE LA TABLE DES NOTES DE COACHING
CREATE TABLE IF NOT EXISTS public.coach_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. CRÉATION DE LA TABLE DES ANALYSES ÉLÈVES (Si pas déjà présente)
CREATE TABLE IF NOT EXISTS public.student_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. POLICIES RLS (SÉCURITÉ AVANCÉE)

-- On s'assure que le RLS est activé partout
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

-- SÉCURITÉ DES PROFILS
DROP POLICY IF EXISTS "Admins see everything" ON public.profiles;
CREATE POLICY "Admins see everything" ON public.profiles
FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Coaches see their students" ON public.profiles;
CREATE POLICY "Coaches see their students" ON public.profiles
FOR SELECT USING (
  coach_id = auth.uid() OR id = auth.uid()
);

-- SÉCURITÉ DES TRADES (Lecture par le coach)
DROP POLICY IF EXISTS "Coaches can read student trades" ON public.trades;
CREATE POLICY "Coaches can read student trades" ON public.trades
FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE coach_id = auth.uid()) 
  OR user_id = auth.uid()
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- SÉCURITÉ DE LA PROGRESSION (Lecture par le coach)
DROP POLICY IF EXISTS "Coaches can read student progress" ON public.user_lesson_progress;
CREATE POLICY "Coaches can read student progress" ON public.user_lesson_progress
FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE coach_id = auth.uid()) 
  OR user_id = auth.uid()
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- SÉCURITÉ DES NOTES DE COACHING (Privé entre coach et admin)
CREATE POLICY "Only coaches and admins see notes" ON public.coach_notes
FOR ALL USING (
  coach_id = auth.uid() 
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 5. INITIALISATION DE VOTRE COMPTE EN TANT QU'ADMIN
-- ATTENTION : Remplacez l'ID ci-dessous par votre propre ID Supabase (trouvable dans Auth > Users)
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'VOTRE_ID_ICI';

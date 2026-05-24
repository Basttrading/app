-- ==========================================
-- 1. TABLES DE FORMATION
-- ==========================================

-- Table des Formations
CREATE TABLE IF NOT EXISTS public.formations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des Chapitres
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    formation_id UUID REFERENCES public.formations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    position INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des Leçons
CREATE TABLE IF NOT EXISTS public.lessons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    youtube_url TEXT,
    youtube_video_id TEXT,
    position INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. SÉCURITÉ ET RLS
-- ==========================================

ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- POLICIES POUR LES FORMATIONS
DROP POLICY IF EXISTS "Coaches can manage their own formations" ON public.formations;
CREATE POLICY "Coaches can manage their own formations" ON public.formations
FOR ALL USING (auth.uid() = coach_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Students can see formations from their coach" ON public.formations;
CREATE POLICY "Students can see formations from their coach" ON public.formations
FOR SELECT USING (
    coach_id = (SELECT coach_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- POLICIES POUR LES CHAPITRES
DROP POLICY IF EXISTS "Coaches can manage their own chapters" ON public.chapters;
CREATE POLICY "Coaches can manage their own chapters" ON public.chapters
FOR ALL USING (
    formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Students can see chapters from their coach" ON public.chapters;
CREATE POLICY "Students can see chapters from their coach" ON public.chapters
FOR SELECT USING (
    formation_id IN (SELECT id FROM formations WHERE coach_id = (SELECT coach_id FROM profiles WHERE id = auth.uid()))
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- POLICIES POUR LES LEÇONS
DROP POLICY IF EXISTS "Coaches can manage their own lessons" ON public.lessons;
CREATE POLICY "Coaches can manage their own lessons" ON public.lessons
FOR ALL USING (
    chapter_id IN (SELECT id FROM chapters WHERE formation_id IN (SELECT id FROM formations WHERE coach_id = auth.uid()))
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Students can see lessons from their coach" ON public.lessons;
CREATE POLICY "Students can see lessons from their coach" ON public.lessons
FOR SELECT USING (
    chapter_id IN (SELECT id FROM chapters WHERE formation_id IN (SELECT id FROM formations WHERE coach_id = (SELECT coach_id FROM profiles WHERE id = auth.uid())))
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- ==========================================
-- 3. LOGIQUE D'INSCRIPTION (Désactivation publique)
-- ==========================================
-- Note : La désactivation réelle se fait dans l'interface Supabase :
-- Authentication > Settings > Disable "Allow new users to sign up"
-- Mais ces policies renforcent la sécurité.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are private" ON public.profiles
FOR SELECT USING (auth.uid() = id OR coach_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

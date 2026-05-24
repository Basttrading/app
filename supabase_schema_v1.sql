-- 1. Table des Profils (utilisateurs)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'student',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Profils
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir leur propre profil" ON public.profiles;
CREATE POLICY "Les utilisateurs peuvent voir leur propre profil" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles;
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Table des Trades (V1 complète)
CREATE TABLE IF NOT EXISTS public.trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  trade_date DATE DEFAULT CURRENT_DATE NOT NULL,
  symbol TEXT NOT NULL,
  market TEXT, -- ES, NQ, BTC, EURUSD...
  direction TEXT, -- Long / Short
  session TEXT, -- Asia / London / NY / Other
  setup TEXT,
  entry_price DECIMAL,
  stop_loss DECIMAL,
  take_profit DECIMAL,
  exit_price DECIMAL,
  size DECIMAL,
  risk_percent DECIMAL,
  pnl_points DECIMAL,
  pnl_r DECIMAL,
  pnl_amount DECIMAL,
  status TEXT DEFAULT 'Win', -- Win / Loss / BE
  notes TEXT,
  confidence INTEGER CHECK (confidence >= 1 AND confidence <= 5),
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Les utilisateurs voient leurs propres trades" ON public.trades;
CREATE POLICY "Les utilisateurs voient leurs propres trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Les utilisateurs ajoutent leurs propres trades" ON public.trades;
CREATE POLICY "Les utilisateurs ajoutent leurs propres trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Les utilisateurs modifient leurs propres trades" ON public.trades;
CREATE POLICY "Les utilisateurs modifient leurs propres trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Les utilisateurs suppriment leurs propres trades" ON public.trades;
CREATE POLICY "Les utilisateurs suppriment leurs propres trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- 3. Trigger automatique pour créer le profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Trigger updated_at pour la table trades
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_trades_updated_at ON public.trades;
CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- RÉINITIALISATION FINALE (Strictement basée sur vos captures)
DROP TABLE IF EXISTS public.trades;

CREATE TABLE public.trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  asset TEXT NOT NULL, -- Valeurs : sp500, nasdaq, dow_jones, gold, bitcoin, ethereum
  order_side TEXT NOT NULL, -- Valeurs : Buy, Sell
  session TEXT NOT NULL, -- Valeurs : Asia, London, NY, Other
  account_type TEXT NOT NULL, -- Valeurs : Personal, Funded, Demo
  tradingview_link TEXT,
  bias_4h TEXT NOT NULL, -- Valeurs : Bullish, Bearish, Neutral
  bias_1h TEXT NOT NULL, -- Valeurs : Bullish, Bearish, Neutral
  fibonacci_retest TEXT NOT NULL, -- Valeurs : 0.5, 0.71, jusqu_a_la_bougie
  internal_liquidity BOOLEAN NOT NULL DEFAULT false,
  tr_liquidity_x2 BOOLEAN NOT NULL DEFAULT false,
  bos BOOLEAN NOT NULL DEFAULT false,
  trendline BOOLEAN NOT NULL DEFAULT false,
  rr_realized NUMERIC NOT NULL,
  result TEXT NOT NULL, -- Valeurs : Win, Loss, BE
  plan_respected BOOLEAN NOT NULL DEFAULT false,
  trade_quality INTEGER, -- 1 à 5
  emotion TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS & SÉCURITÉ
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voir ses propres trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Ajouter ses propres trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Modifier ses propres trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Supprimer ses propres trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

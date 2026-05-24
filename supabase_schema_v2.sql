-- SUPPRESSION ET RÉINITIALISATION PROPRE
DROP TABLE IF EXISTS public.trades;

-- CRÉATION DE LA TABLE TRADES V2 (ANALYTIQUE)
CREATE TABLE public.trades (
  -- Identité & Système
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- A. IDENTITÉ DU TRADE
  trade_date DATE DEFAULT CURRENT_DATE NOT NULL,
  symbol TEXT NOT NULL, -- ex: BTCUSDT, EURUSD, NQ
  market TEXT NOT NULL, -- ex: ES, Crypto, Forex, Indices
  direction TEXT NOT NULL, -- Long, Short
  session TEXT, -- Asia, London, NY, Other

  -- B. CONTEXTE / ANALYSE PRÉ-TRADE
  htf_bias TEXT, -- Bullish, Bearish, Neutral
  execution_tf TEXT, -- 1m, 5m, 15m, 1h, etc.
  setup_name TEXT, -- ex: Silver Bullet, Breaker Block
  setup_category TEXT, -- ex: Trend Following, Reversal
  market_condition TEXT, -- Trend, Range, Reversal, Breakout, News
  key_level TEXT, -- ex: Daily PDH, H4 Orderblock
  confluence_1 TEXT,
  confluence_2 TEXT,
  confluence_3 TEXT,
  entry_reason TEXT,
  pre_trade_plan_respected BOOLEAN DEFAULT true,

  -- C. EXÉCUTION & CHIFFRES
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  exit_price NUMERIC,
  position_size NUMERIC,
  risk_amount NUMERIC,
  risk_percent NUMERIC,
  planned_rr NUMERIC,
  realized_rr NUMERIC,
  pnl_amount NUMERIC NOT NULL,
  pnl_points NUMERIC,
  pnl_percent NUMERIC,
  status TEXT NOT NULL, -- Win, Loss, BE
  fees NUMERIC DEFAULT 0,

  -- D. GESTION DU TRADE
  partial_taken BOOLEAN DEFAULT false,
  moved_to_be BOOLEAN DEFAULT false,
  mgt_quality INTEGER CHECK (mgt_quality >= 1 AND mgt_quality <= 5),
  did_follow_plan BOOLEAN DEFAULT true,
  exec_quality INTEGER CHECK (exec_quality >= 1 AND exec_quality <= 5),
  slippage_note TEXT,

  -- E. PSYCHOLOGIE & DISCIPLINE
  emo_before TEXT, -- Calm, Anxious, Focused, etc.
  emo_during TEXT, -- Calm, Greedy, Fearful, etc.
  confidence_level INTEGER CHECK (confidence_level >= 1 AND confidence_level <= 5),
  mistake_tag_1 TEXT,
  mistake_tag_2 TEXT,
  mistake_tag_3 TEXT,
  did_break_rules BOOLEAN DEFAULT false,
  rule_break_description TEXT,
  lesson_learned TEXT,

  -- F. REVIEW POST-TRADE
  review_well TEXT,
  review_wrong TEXT,
  review_improvement TEXT,
  setup_grade INTEGER CHECK (setup_grade >= 1 AND setup_grade <= 5),
  exec_grade INTEGER CHECK (exec_grade >= 1 AND exec_grade <= 5),
  discipline_grade INTEGER CHECK (discipline_grade >= 1 AND discipline_grade <= 5),
  screenshot_url TEXT,
  notes TEXT
);

-- INDEX POUR LES PERFORMANCES
CREATE INDEX idx_trades_user_date ON public.trades(user_id, trade_date DESC);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);
CREATE INDEX idx_trades_status ON public.trades(status);

-- RLS POLICIES
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trades" 
ON public.trades FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" 
ON public.trades FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" 
ON public.trades FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades" 
ON public.trades FOR DELETE 
USING (auth.uid() = user_id);

-- TRIGGER UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

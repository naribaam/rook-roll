ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'timeout';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'abandoned';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'time_control') THEN
    ALTER TABLE public.games ADD COLUMN time_control text DEFAULT 'unlimited' CHECK (time_control IN ('bullet','blitz','rapid','classical','unlimited'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'time_limit_seconds') THEN
    ALTER TABLE public.games ADD COLUMN time_limit_seconds integer DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'increment_seconds') THEN
    ALTER TABLE public.games ADD COLUMN increment_seconds integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'white_time_ms') THEN
    ALTER TABLE public.games ADD COLUMN white_time_ms bigint DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'black_time_ms') THEN
    ALTER TABLE public.games ADD COLUMN black_time_ms bigint DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'last_move_at') THEN
    ALTER TABLE public.games ADD COLUMN last_move_at timestamptz DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'draw_offered_by') THEN
    ALTER TABLE public.games ADD COLUMN draw_offered_by text DEFAULT NULL CHECK (draw_offered_by IN ('white', 'black'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = 'games' AND column_name = 'draw_offer_at') THEN
    ALTER TABLE public.games ADD COLUMN draw_offer_at timestamptz DEFAULT NULL;
  END IF;
END $$;
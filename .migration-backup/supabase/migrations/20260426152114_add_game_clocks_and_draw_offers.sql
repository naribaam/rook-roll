/*
  # Add Game Clocks, Draw Offers, and Abandonment Support

  ## Summary
  Extends the games table to support:
  1. Time controls (white/black clock times in seconds)
  2. Draw offer tracking (who offered, when offered)
  3. Abandonment detection (last_activity timestamp)
  4. Time control type (bullet/blitz/rapid/classical/unlimited)

  ## New Columns on games table
  - `time_control` (text): 'bullet' | 'blitz' | 'rapid' | 'classical' | 'unlimited'
  - `time_limit_seconds` (integer): total time per player in seconds (null = unlimited)
  - `increment_seconds` (integer): time added per move in seconds (default 0)
  - `white_time_ms` (bigint): white's remaining time in milliseconds
  - `black_time_ms` (bigint): black's remaining time in milliseconds
  - `last_move_at` (timestamptz): timestamp of last move (for clock calculation)
  - `draw_offered_by` (text): 'white' | 'black' | null
  - `draw_offer_at` (timestamptz): when the draw was offered

  ## New tx_type values
  - 'timeout': added to tx_type enum for game loss by timeout

  ## Security
  - RLS unchanged (players can update own games)
*/

-- Add timeout to tx_type enum
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'timeout';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'abandoned';

-- Add clock and draw offer columns to games
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'time_control') THEN
    ALTER TABLE public.games ADD COLUMN time_control text DEFAULT 'unlimited' CHECK (time_control IN ('bullet','blitz','rapid','classical','unlimited'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'time_limit_seconds') THEN
    ALTER TABLE public.games ADD COLUMN time_limit_seconds integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'increment_seconds') THEN
    ALTER TABLE public.games ADD COLUMN increment_seconds integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'white_time_ms') THEN
    ALTER TABLE public.games ADD COLUMN white_time_ms bigint DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'black_time_ms') THEN
    ALTER TABLE public.games ADD COLUMN black_time_ms bigint DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'last_move_at') THEN
    ALTER TABLE public.games ADD COLUMN last_move_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'draw_offered_by') THEN
    ALTER TABLE public.games ADD COLUMN draw_offered_by text DEFAULT NULL CHECK (draw_offered_by IN ('white', 'black'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'draw_offer_at') THEN
    ALTER TABLE public.games ADD COLUMN draw_offer_at timestamptz DEFAULT NULL;
  END IF;
END $$;

/*
  # Create moves table

  ## Summary
  Creates a dedicated `moves` table to store individual chess moves as rows
  instead of a JSONB array on the games table. This enables:
  1. Realtime subscriptions on individual moves (so both players see moves instantly)
  2. Efficient move history queries
  3. Proper normalization of game data

  ## New Table: `moves`
  - `id` (uuid, primary key): unique move identifier
  - `game_id` (uuid, FK to games): which game this move belongs to
  - `move_number` (integer): sequential move number (1-based)
  - `san` (text): move in Standard Algebraic Notation (e.g. "e4", "Nf3")
  - `from_sq` (text): starting square (e.g. "e2")
  - `to_sq` (text): ending square (e.g. "e4")
  - `promotion` (text): promotion piece if any (q/r/b/n), nullable
  - `fen` (text): FEN string AFTER this move was applied
  - `played_by` (text): 'white' or 'black'
  - `played_at` (timestamptz): when the move was made

  ## Indexes
  - `moves_game_id_idx` on (game_id, move_number) for efficient move ordering
  - `moves_game_id_created_idx` on (game_id, played_at) for realtime queries

  ## Security
  - RLS enabled on moves table
  - SELECT: players who are participants in the game can view moves
  - INSERT: players who are participants in the game can insert moves
  - No UPDATE or DELETE: moves are immutable once written

  ## Important Notes
  1. The `moves` column (jsonb) on the games table is kept for backward
     compatibility but will no longer be the source of truth for move data.
  2. The `fen` and `pgn` columns on the games table remain as the current
     board state summary, updated after each move.
*/

CREATE TABLE IF NOT EXISTS public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  move_number integer NOT NULL,
  san text NOT NULL,
  from_sq text NOT NULL,
  to_sq text NOT NULL,
  promotion text,
  fen text NOT NULL,
  played_by text NOT NULL CHECK (played_by IN ('white', 'black')),
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moves_game_id_idx ON public.moves(game_id, move_number);
CREATE INDEX IF NOT EXISTS moves_game_id_created_idx ON public.moves(game_id, played_at);

ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;

-- Players can view moves for games they participate in
CREATE POLICY "Players can view moves of own games"
  ON public.moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = moves.game_id
      AND (games.white_player = auth.uid() OR games.black_player = auth.uid())
    )
  );

-- Players can insert moves for games they participate in
CREATE POLICY "Players can insert moves for own games"
  ON public.moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = moves.game_id
      AND (games.white_player = auth.uid() OR games.black_player = auth.uid())
    )
  );

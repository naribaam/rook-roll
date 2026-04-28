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

ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;
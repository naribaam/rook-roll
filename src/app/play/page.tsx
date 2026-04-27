"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { ChessBoardView } from "@/components/ChessBoardView";
import { MoveHistory } from "@/components/MoveHistory";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngine } from "@/lib/stockfish";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const DIFFICULTY_PRESETS = [
  { skill: 0, depth: 4, label: "Beginner", elo: 600 },
  { skill: 5, depth: 6, label: "Easy", elo: 1000 },
  { skill: 10, depth: 10, label: "Intermediate", elo: 1400 },
  { skill: 15, depth: 14, label: "Advanced", elo: 1800 },
  { skill: 20, depth: 18, label: "Master", elo: 2400 },
];

type MoveItem = {
  san: string;
  fen: string;
};

export default function PlayPage() {
  return (
    <Layout>
      <AuthGate>
        <PlayInner />
      </AuthGate>
    </Layout>
  );
}

function PlayInner() {
  const { user } = useAuth();
  const router = useRouter();

  const gameRef = useRef(new Chess());

  const [fen, setFen] = useState(() => gameRef.current.fen());
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState(2);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);

  const preset = DIFFICULTY_PRESETS[difficulty];
  const aiColor = playerColor === "white" ? "b" : "w";

  useEffect(() => {
    const eng = getEngine();
    eng.init(preset.skill).catch(console.error);
  }, [preset.skill]);

  const startGame = useCallback(async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    const startFen = g.fen();
    setFen(startFen);
    setMoves([]);

    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: "ai",
        status: "active",
        white_player: playerColor === "white" ? user.id : null,
        black_player: playerColor === "black" ? user.id : null,
        created_by: user.id,
        fen: startFen,
        pgn: "",
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Game creation failed");
      return;
    }

    setGameId(data.id);
    setGameStarted(true);
  }, [user, playerColor]);

  const playAi = useCallback(async () => {
    const game = gameRef.current;

    const eng = getEngine();
    const res = await eng.analyze(game.fen(), preset.depth);

    if (!res.bestMove) return;

    const move = game.move({
      from: res.bestMove.slice(0, 2),
      to: res.bestMove.slice(2, 4),
      promotion: res.bestMove[4],
    });

    if (!move) return;

    const newFen = game.fen();
    setFen(newFen);

    setMoves((m) => [...m, { san: move.san, fen: newFen }]);

    if (gameId) {
      await supabase
        .from("games")
        .update({ fen: newFen, pgn: game.pgn() })
        .eq("id", gameId);
    }
  }, [preset.depth, gameId]);

  const onDrop = useCallback(
    async (from: string, to: string) => {
      if (!gameStarted) return false;
      if (gameRef.current.turn() === aiColor) return false;

      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;

      const newFen = gameRef.current.fen();
      setFen(newFen);

      setMoves((m) => [...m, { san: move.san, fen: newFen }]);

      await playAi();
      return true;
    },
    [gameStarted, aiColor, playAi]
  );

  const lastMoveHighlight = useMemo(() => {
    const hist = gameRef.current.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (!last) return {};

    return {
      [last.from]: { background: "#fff3" },
      [last.to]: { background: "#fff3" },
    };
  }, [fen]);

  if (!gameStarted) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex gap-2">
          <Button onClick={() => setPlayerColor("white")}>White</Button>
          <Button onClick={() => setPlayerColor("black")}>Black</Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {DIFFICULTY_PRESETS.map((p, i) => (
            <Button
              key={p.label}
              variant={difficulty === i ? "default" : "outline"}
              onClick={() => setDifficulty(i)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Button onClick={startGame}>Start game</Button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 p-6">
      
      {/* BOARD */}
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-[600px]">
          <ChessBoardView
            position={fen}
            orientation={playerColor}
            onPieceDrop={onDrop}
            squareStyles={lastMoveHighlight}
          />
        </div>

        {/* difficulty */}
        <div className="flex gap-2 flex-wrap justify-center">
          {DIFFICULTY_PRESETS.map((p, i) => (
            <Button
              key={p.label}
              variant={difficulty === i ? "default" : "outline"}
              onClick={() => setDifficulty(i)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Button onClick={startGame}>Restart</Button>
      </div>

      {/* MOVES */}
      <div>
        <MoveHistory moves={moves} />
      </div>
    </div>
  );
}

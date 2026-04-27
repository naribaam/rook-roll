"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { ChessBoardView } from "@/components/ChessBoardView";
import { MoveHistory } from "@/components/MoveHistory";
import { GameResultCard } from "@/components/GameResultCard";
import { EvalBar } from "@/components/EvalBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getEngine } from "@/lib/stockfish";
import { useRouter } from "next/navigation";
import { Bot, Flag, RotateCw } from "lucide-react";
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
  quality?: "best" | "great" | "good" | "inaccuracy" | "mistake" | "blunder";
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

  const [fen, setFen] = useState(gameRef.current.fen());
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState(2);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const preset = DIFFICULTY_PRESETS[difficulty];
  const aiColor = playerColor === "white" ? "b" : "w";

  useEffect(() => {
    const eng = getEngine();
    eng.init(preset.skill);
    setFen(gameRef.current.fen());
  }, []);

  useEffect(() => {
    getEngine().setSkill(preset.skill);
  }, [preset.skill]);

  const startGame = useCallback(async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    setFen(g.fen());
    setMoves([]);
    setGameStarted(true);

    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: "ai",
        status: "active",
        white_player: playerColor === "white" ? user.id : null,
        black_player: playerColor === "black" ? user.id : null,
        created_by: user.id,
        fen: g.fen(),
        pgn: "",
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Game creation failed");
      return;
    }

    setGameId(data.id);

    if (playerColor === "black") {
      setTimeout(() => playAi(data.id), 500);
    }
  }, [user, playerColor]);

  const playAi = useCallback(async (id: string) => {
    const game = gameRef.current;

    setAiThinking(true);

    const eng = getEngine();
    const res = await eng.analyze(game.fen(), preset.depth);

    const uci = res.bestMove;
    if (!uci) return;

    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: "q",
    });

    if (!move) return;

    const newFen = game.fen();
    setFen(newFen);

    setMoves((m) => [...m, { san: move.san, fen: newFen }]);

    setAiThinking(false);
  }, [preset.depth]);

  const onDrop = useCallback(
    (from: string, to: string) => {
      if (aiThinking) return false;

      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;

      const newFen = gameRef.current.fen();
      setFen(newFen);

      setMoves((m) => [...m, { san: move.san, fen: newFen }]);

      if (gameId) playAi(gameId);

      return true;
    },
    [aiThinking, gameId, playAi]
  );

  const lastMoveHighlight = useMemo(() => {
    const hist = gameRef.current.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (!last) return {};

    return {
      [last.from]: { background: "#fff2" },
      [last.to]: { background: "#fff2" },
    };
  }, [fen]);

  if (!gameStarted) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Play vs AI</h1>

        <div className="flex gap-2">
          <Button onClick={() => setPlayerColor("white")}>White</Button>
          <Button onClick={() => setPlayerColor("black")}>Black</Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {DIFFICULTY_PRESETS.map((p, i) => (
            <Button key={p.label} onClick={() => setDifficulty(i)}>
              {p.label}
            </Button>
          ))}
        </div>

        <Button onClick={startGame} className="w-full">
          Start Game
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6 p-6 w-full">
      
      {/* BOARD */}
      <div className="flex justify-center">
        <ChessBoardView
          position={fen}
          orientation={playerColor}
          onPieceDrop={onDrop}
          squareStyles={lastMoveHighlight}
        />
      </div>

      {/* SIDE PANEL */}
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {aiThinking ? "AI thinking..." : "Your move"}
        </div>

        <MoveHistory moves={moves} />

        <Button onClick={() => router.push("/")}>
          Home
        </Button>
      </div>
    </div>
  );
}

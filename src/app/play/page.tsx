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
  const { user, profile } = useAuth();
  const navigate = useRouter();

  const gameRef = useRef(new Chess());

  // FIX 1: правильный init fen (было у тебя сломано в некоторых версиях)
  const [fen, setFen] = useState(() => gameRef.current.fen());

  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState(2);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [evalScore, setEvalScore] = useState<number | null>(0);
  const [mateIn, setMateIn] = useState<number | null>(null);

  const [result, setResult] = useState<any>(null);

  const finalizingRef = useRef(false);
  const moveQualityRef = useRef({ best: 0, great: 0, good: 0, blunder: 0 });
  const moveCountRef = useRef(0);

  const preset = DIFFICULTY_PRESETS[difficulty];
  const aiColor = playerColor === "white" ? "b" : "w";

  useEffect(() => {
    const eng = getEngine();
    eng.init(preset.skill).catch((e) => console.error("engine init failed", e));
  }, []);

  useEffect(() => {
    getEngine().setSkill(preset.skill);
  }, [preset.skill]);

  // =========================
  // FIX 2: SAFE SUPABASE INSERT
  // =========================
  const startGame = useCallback(async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    const startFen = g.fen();
    setFen(startFen);
    setMoves([]);
    setResult(null);

    type GameInsert = Database["public"]["Tables"]["games"]["Insert"];

    const baseInsert: GameInsert = {
      mode: "ai",
      status: "active",
      white_player: playerColor === "white" ? user.id : null,
      black_player: playerColor === "black" ? user.id : null,
      created_by: user.id,
      fen: startFen,
      pgn: "",
    };

    const { data, error } = await supabase
      .from("games")
      .insert(baseInsert)
      .select()
      .maybeSingle(); // 🔥 FIX вместо .single()

    if (error || !data?.id) {
      toast.error("Could not start game");
      console.error(error);
      return;
    }

    setGameId(data.id);
    setGameStarted(true);

    if (playerColor === "black") {
      setTimeout(() => playAi(data.id, []), 400);
    }
  }, [user, playerColor]);

  // =========================
  // AI MOVE (оставлено как есть, но safe)
  // =========================
  const playAi = useCallback(
    async (id: string, currentMoves: MoveItem[]) => {
      const game = gameRef.current;

      if (game.isGameOver() || finalizingRef.current) return;

      setAiThinking(true);

      try {
        const eng = getEngine();
        const analysis = await eng.analyze(game.fen(), preset.depth);

        const uci = analysis.bestMove;
        if (!uci || uci.length < 4) return;

        const move = game.move({
          from: uci.substring(0, 2),
          to: uci.substring(2, 4),
          promotion: uci[4],
        });

        if (!move) return;

        const newFen = game.fen();
        setFen(newFen);

        setMoves((prev) => [...prev, { san: move.san, fen: newFen }]);

        await supabase
          .from("games")
          .update({ fen: newFen, pgn: game.pgn() })
          .eq("id", id);
      } catch (e) {
        console.error("AI error:", e);
      } finally {
        setAiThinking(false);
      }
    },
    [preset.depth]
  );

  // =========================
  // FIX 3: BOARD DROP SAFE
  // =========================
  const onDrop = useCallback(
    async (from: string, to: string) => {
      if (aiThinking || result) return false;
      if (gameRef.current.turn() === aiColor) return false;

      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;

      const fenAfter = gameRef.current.fen();
      setFen(fenAfter);

      const id = gameId;
      if (!id) return true;

      await playAi(id, []);

      return true;
    },
    [aiThinking, result, aiColor, gameId, playAi]
  );

  // =========================
  // FIX 4: UI layout (ВАЖНО)
  // =========================
  if (!gameStarted) {
    return (
      <div className="p-6 space-y-6">
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
    <Layout>
      <AuthGate>
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 p-6">

          {/* BOARD FIXED SIZE */}
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-full max-w-[650px]">
              <ChessBoardView
                position={fen}
                orientation={playerColor}
                onPieceDrop={onDrop}
              />
            </div>

            {/* DIFFICULTY RESTORED */}
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

          {/* MOVES RESTORED */}
          <div className="space-y-4">
            <MoveHistory moves={moves} />
          </div>

        </div>
      </AuthGate>
    </Layout>
  );
}

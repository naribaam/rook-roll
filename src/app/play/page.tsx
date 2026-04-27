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
  const router = useRouter();

  const gameRef = useRef(new Chess());

  const [mode, setMode] = useState<"ai" | "mp">("ai");
  const [fen, setFen] = useState(gameRef.current.fen());
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState(2);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const preset = DIFFICULTY_PRESETS[difficulty];
  const aiColor = playerColor === "white" ? "b" : "w";

  // INIT ENGINE
  useEffect(() => {
    const eng = getEngine();
    eng.init(preset.skill).catch(console.error);
  }, [preset.skill]);

  useEffect(() => {
    getEngine().setSkill(preset.skill);
  }, [preset.skill]);

  // START AI GAME
  const startGame = async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    setFen(g.fen());
    setMoves([]);
    setResult(null);

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
    setGameStarted(true);

    if (playerColor === "black") {
      setTimeout(() => playAi(data.id), 400);
    }
  };

  // MULTIPLAYER START
  const startMultiplayer = async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    setFen(g.fen());
    setMoves([]);
    setResult(null);

    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: "mp",
        status: "active",
        white_player: user.id,
        fen: g.fen(),
        pgn: "",
      })
      .select()
      .single();

    if (!data || error) {
      toast.error("MP game failed");
      return;
    }

    setGameId(data.id);
    setGameStarted(true);

    // realtime sync
    supabase
      .channel(`game:${data.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `id=eq.${data.id}`,
        },
        (payload) => {
          const newFen = payload.new.fen;
          setFen(newFen);
          gameRef.current.load(newFen);
        }
      )
      .subscribe();
  };

  // AI MOVE (OPTIMIZED)
  const playAi = async (id: string) => {
    const game = gameRef.current;

    if (game.isGameOver() || aiThinking) return;

    setAiThinking(true);

    try {
      const eng = getEngine();
      const res = await eng.analyze(game.fen(), Math.min(preset.depth, 10));

      const uci = res.bestMove;
      if (!uci) return;

      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });

      if (!move) return;

      const newFen = game.fen();
      setFen(newFen);

      setMoves((m) => [...m, { san: move.san, fen: newFen }]);

      await supabase
        .from("games")
        .update({ fen: newFen })
        .eq("id", id);
    } catch (e) {
      console.error(e);
    } finally {
      setAiThinking(false);
    }
  };

  // MOVE HANDLER (FIXED - NO ASYNC RETURN)
  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      const game = gameRef.current;

      if (aiThinking || result) return false;
      if (mode === "ai" && game.turn() === aiColor) return false;

      const move = game.move({ from, to, promotion: "q" });
      if (!move) return false;

      const fenAfter = game.fen();
      setFen(fenAfter);

      setMoves((m) => [...m, { san: move.san, fen: fenAfter }]);

      const id = gameId;

      if (id) {
        if (mode === "mp") {
          supabase.from("games").update({ fen: fenAfter }).eq("id", id);
        }

        if (mode === "ai") {
          setTimeout(() => playAi(id), 300);
        }
      }

      return true;
    },
    [aiThinking, result, mode, aiColor, gameId]
  );

  // UI
  if (!gameStarted) {
    return (
      <Layout>
        <AuthGate>
          <div className="mx-auto max-w-3xl p-6 space-y-6">

            <h1 className="text-3xl font-bold">Play Chess</h1>

            <div className="flex gap-2">
              <Button onClick={() => setMode("ai")} variant={mode === "ai" ? "default" : "outline"}>
                vs AI
              </Button>

              <Button onClick={() => setMode("mp")} variant={mode === "mp" ? "default" : "outline"}>
                Multiplayer
              </Button>
            </div>

            {mode === "ai" && (
              <div className="space-y-4">
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

                <div className="flex gap-2">
                  <Button onClick={() => setPlayerColor("white")}>White</Button>
                  <Button onClick={() => setPlayerColor("black")}>Black</Button>
                </div>

                <Button onClick={startGame}>Start AI</Button>
              </div>
            )}

            {mode === "mp" && (
              <Button onClick={startMultiplayer}>
                Create Multiplayer Game
              </Button>
            )}

          </div>
        </AuthGate>
      </Layout>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      <ChessBoardView
        position={fen}
        orientation={playerColor}
        onPieceDrop={onDrop}
      />

      <MoveHistory moves={moves} />
      <EvalBar scoreCp={0} mateIn={null} />
    </div>
  );
}

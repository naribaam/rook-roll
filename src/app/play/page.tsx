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

  const [fen, setFen] = useState("");
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
  const moveCountRef = useRef(0);
  const moveQualityRef = useRef({ best: 0, great: 0, good: 0, blunder: 0 });

  const preset = DIFFICULTY_PRESETS[difficulty];
  const aiColor = playerColor === "white" ? "b" : "w";

  // ✅ FIX: safe init (only client)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const eng = getEngine();
    eng.init(preset.skill).catch(console.error);

    setFen(gameRef.current.fen());
  }, []);

  useEffect(() => {
    getEngine().setSkill(preset.skill);
  }, [preset.skill]);

  const persistMove = useCallback(async (
    id: string,
    move: any,
    fenAfter: string,
    playedBy: "white" | "black"
  ) => {
    moveCountRef.current++;

    await supabase.from("moves").insert({
      game_id: id,
      move_number: moveCountRef.current,
      san: move.san,
      from_sq: move.from,
      to_sq: move.to,
      promotion: move.promotion ?? null,
      fen: fenAfter,
      played_by: playedBy,
    });

    await supabase
      .from("games")
      .update({
        fen: fenAfter,
        pgn: gameRef.current.pgn(),
      })
      .eq("id", id);
  }, []);

  const checkGameOver = useCallback(() => {
    const g = gameRef.current;

    if (!g.isGameOver()) return null;

    if (g.isCheckmate()) {
      const loser = g.turn();
      return {
        result: loser === "w" ? "black_win" : "white_win",
        reason: "Checkmate",
      };
    }

    if (g.isStalemate()) return { result: "draw", reason: "Stalemate" };
    if (g.isThreefoldRepetition()) return { result: "draw", reason: "Repetition" };
    if (g.isInsufficientMaterial()) return { result: "draw", reason: "Material" };

    return { result: "draw", reason: "Draw" };
  }, []);

  const playAi = useCallback(
    async (id: string, currentMoves: MoveItem[]) => {
      const game = gameRef.current;

      if (game.isGameOver() || finalizingRef.current) return;

      setAiThinking(true);

      try {
        const eng = getEngine();
        const res = await eng.analyze(game.fen(), preset.depth);

        const uci = res.bestMove;
        if (!uci || uci.length < 4) return;

        const move = game.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4],
        });

        if (!move) return;

        const newFen = game.fen();
        setFen(newFen);

        setMoves((p) => [...p, { san: move.san, fen: newFen }]);

        const over = checkGameOver();
        if (over) {
          setResult(over);
          return;
        }

        await persistMove(id, move, newFen, playerColor === "white" ? "black" : "white");
      } catch (e) {
        console.error(e);
      } finally {
        setAiThinking(false);
      }
    },
    [preset.depth, playerColor, checkGameOver, persistMove]
  );

  const startGame = useCallback(async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    setFen(g.fen());
    setMoves([]);
    setResult(null);

    const { data } = await supabase
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

    if (!data) {
  toast.error("Game not created");
  return;
}

setGameId(data.id);
setGameStarted(true);
    setGameStarted(true);

    if (playerColor === "black") {
      setTimeout(() => playAi(data.id, []), 500);
    }
  }, [user, playerColor, playAi]);

  const onDrop = useCallback(
    async (from: string, to: string) => {
      if (aiThinking || result) return false;
      if (gameRef.current.turn() === aiColor) return false;

      const move = gameRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;

      const fenAfter = gameRef.current.fen();
      setFen(fenAfter);

      const currentId = gameId;
      if (!currentId) return true;

      await persistMove(currentId, move, fenAfter, playerColor);

      const over = checkGameOver();
      if (over) setResult(over);

      await playAi(currentId, []);
      return true;
    },
    [aiThinking, result, aiColor, gameId, persistMove, checkGameOver, playAi, playerColor]
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
      <div className="p-6">
        <Button onClick={startGame}>Start game</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <ChessBoardView
        position={fen}
        orientation={playerColor}
        onPieceDrop={onDrop}
        squareStyles={lastMoveHighlight}
      />
    </div>
  );
}

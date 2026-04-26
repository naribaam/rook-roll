import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { getEngine } from "@/lib/stockfish";
import { Bot, Flag, RotateCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play vs AI — Gambit" },
      { name: "description", content: "Train against Stockfish at 20 difficulty levels." },
    ],
  }),
  component: PlayPage,
});

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

function PlayPage() {
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
  const navigate = useNavigate();

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [aiThinking, setAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState(2);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [evalScore, setEvalScore] = useState<number | null>(0);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [result, setResult] = useState<null | {
    outcome: "win" | "loss" | "draw";
    reason: string;
    elo_delta: number;
    new_elo: number;
    coins_earned: number;
    new_coins: number;
    move_bonus: number;
  }>(null);
  const finalizingRef = useRef(false);
  const moveQualityRef = useRef({ best: 0, great: 0, good: 0, blunder: 0 });

  const preset = DIFFICULTY_PRESETS[difficulty];
  // aiColor is the chess.js turn letter ('w' or 'b') for the AI
  const aiColor = playerColor === "white" ? "b" : "w";

  useEffect(() => {
    const eng = getEngine();
    eng.init(preset.skill).catch((e) => console.error("engine init failed", e));
  }, []);

  useEffect(() => {
    getEngine().setSkill(preset.skill);
  }, [preset.skill]);

  const persistGame = useCallback(async (id: string, currentFen: string, allMoves: MoveItem[]) => {
    await supabase
      .from("games")
      .update({
        fen: currentFen,
        pgn: gameRef.current.pgn(),
        moves: allMoves as unknown as never,
      })
      .eq("id", id);
  }, []);

  const checkGameOver = useCallback((): { result: "white_win" | "black_win" | "draw"; reason: string } | null => {
    const game = gameRef.current;
    if (!game.isGameOver()) return null;
    if (game.isCheckmate()) {
      const loser = game.turn();
      return { result: loser === "w" ? "black_win" : "white_win", reason: "Checkmate" };
    }
    if (game.isStalemate()) return { result: "draw", reason: "Stalemate" };
    if (game.isThreefoldRepetition()) return { result: "draw", reason: "Threefold repetition" };
    if (game.isInsufficientMaterial()) return { result: "draw", reason: "Insufficient material" };
    if (game.isDraw()) return { result: "draw", reason: "50-move rule" };
    return null;
  }, []);

  const finalize = useCallback(
    async (id: string, res: { result: "white_win" | "black_win" | "draw"; reason: string }) => {
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      try {
        const { data, error } = await supabase.functions.invoke("finalize-game", {
          body: {
            game_id: id,
            result: res.result,
            reason: res.reason,
            move_quality: moveQualityRef.current,
          },
        });
        if (error) throw error;
        const userIsWhite = playerColor === "white";
        const outcome =
          res.result === "draw"
            ? "draw"
            : (userIsWhite && res.result === "white_win") || (!userIsWhite && res.result === "black_win")
              ? "win"
              : "loss";
        setResult({
          outcome,
          reason: data?.reason ?? res.reason,
          elo_delta: data?.elo_delta ?? 0,
          new_elo: data?.new_elo ?? profile?.elo ?? 1200,
          coins_earned: data?.coins_earned ?? 0,
          new_coins: data?.new_coins ?? profile?.coins ?? 0,
          move_bonus: data?.move_bonus ?? 0,
        });
      } catch (e) {
        console.error("finalize failed", e);
        toast.error("Could not finalize game");
        finalizingRef.current = false;
      }
    },
    [playerColor, profile],
  );

  const classifyMove = useCallback(
    async (fenBefore: string, fenAfter: string): Promise<MoveItem["quality"]> => {
      try {
        const eng = getEngine();
        const before = await eng.analyze(fenBefore, 10);
        const after = await eng.analyze(fenAfter, 10);
        const beforeSign = fenBefore.split(" ")[1] === "w" ? 1 : -1;
        const afterSign = fenAfter.split(" ")[1] === "w" ? 1 : -1;
        const scoreBefore = (before.scoreCp ?? 0) * beforeSign;
        const scoreAfter = (after.scoreCp ?? 0) * afterSign;
        setEvalScore(scoreAfter);
        setMateIn(after.mateIn);
        // Loss from the player's perspective
        const playerSign = playerColor === "white" ? 1 : -1;
        const playerLoss = (scoreBefore - scoreAfter) * playerSign;
        if (playerLoss <= 10) { moveQualityRef.current.best++; return "best"; }
        if (playerLoss <= 50) { moveQualityRef.current.great++; return "great"; }
        if (playerLoss <= 100) { moveQualityRef.current.good++; return "good"; }
        if (playerLoss <= 200) return "inaccuracy";
        if (playerLoss <= 350) return "mistake";
        moveQualityRef.current.blunder++;
        return "blunder";
      } catch {
        return "good";
      }
    },
    [playerColor],
  );

  const playAi = useCallback(
    async (id: string, currentMoves: MoveItem[]) => {
      const game = gameRef.current;
      if (game.isGameOver() || finalizingRef.current) return;
      setAiThinking(true);
      try {
        const eng = getEngine();
        const analysisResult = await eng.analyze(game.fen(), preset.depth);
        if (!analysisResult.bestMove) return;
        const from = analysisResult.bestMove.slice(0, 2);
        const to = analysisResult.bestMove.slice(2, 4);
        const promotion = analysisResult.bestMove.length === 5 ? analysisResult.bestMove[4] : undefined;
        const move = game.move({ from, to, promotion });
        if (!move) return;
        const newFen = game.fen();
        setFen(newFen);
        const turnSign = newFen.split(" ")[1] === "w" ? 1 : -1;
        setEvalScore((analysisResult.scoreCp ?? 0) * turnSign);
        setMateIn(analysisResult.mateIn);
        const item: MoveItem = { san: move.san, fen: newFen };
        const next = [...currentMoves, item];
        setMoves(next);
        await persistGame(id, newFen, next);
        const over = checkGameOver();
        if (over) await finalize(id, over);
      } finally {
        setAiThinking(false);
      }
    },
    [preset.depth, persistGame, checkGameOver, finalize],
  );

  const startGame = useCallback(async () => {
    if (!user) return;
    const game = gameRef.current;
    game.reset();
    setFen(game.fen());
    setMoves([]);
    setResult(null);
    moveQualityRef.current = { best: 0, great: 0, good: 0, blunder: 0 };
    setEvalScore(0);
    setMateIn(null);
    finalizingRef.current = false;

    const { data, error } = await supabase
      .from("games")
      .insert({
        mode: "ai",
        status: "active",
        white_player: playerColor === "white" ? user.id : null,
        black_player: playerColor === "black" ? user.id : null,
        ai_difficulty: preset.skill,
        ai_color: playerColor === "white" ? "black" : "white",
        created_by: user.id,
        fen: game.fen(),
        pgn: "",
        moves: [],
        white_elo_before: playerColor === "white" ? (profile?.elo ?? 1200) : preset.elo,
        black_elo_before: playerColor === "black" ? (profile?.elo ?? 1200) : preset.elo,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Could not start game");
      console.error(error);
      return;
    }
    setGameId(data.id);
    setGameStarted(true);

    // If player chose black, AI (white) goes first
    if (playerColor === "black") {
      setTimeout(() => playAi(data.id, []), 400);
    }
  }, [user, playerColor, preset, profile, playAi]);

  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      const game = gameRef.current;
      if (aiThinking || result) return false;
      if (game.turn() === aiColor) return false;
      const fenBefore = game.fen();
      let move;
      try {
        move = game.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;
      const fenAfter = game.fen();
      setFen(fenAfter);
      const placeholder: MoveItem = { san: move.san, fen: fenAfter };

      setMoves((prev) => {
        const next = [...prev, placeholder];
        const currentId = gameId;
        if (currentId) persistGame(currentId, fenAfter, next);

        (async () => {
          const quality = await classifyMove(fenBefore, fenAfter);
          setMoves((m) => {
            const copy = [...m];
            const idx = copy.findIndex((x) => x.fen === fenAfter && !x.quality);
            if (idx !== -1) copy[idx] = { ...copy[idx], quality };
            return copy;
          });
          const over = checkGameOver();
          if (over) {
            if (currentId) await finalize(currentId, over);
            return;
          }
          if (currentId) {
            const withQuality = [...prev, { ...placeholder, quality }];
            await playAi(currentId, withQuality);
          }
        })();

        return next;
      });

      return true;
    },
    [aiThinking, result, aiColor, gameId, persistGame, classifyMove, checkGameOver, finalize, playAi],
  );

  const onResign = async () => {
    if (!gameStarted || result || !gameId) return;
    await finalize(gameId, {
      result: playerColor === "white" ? "black_win" : "white_win",
      reason: "Resignation",
    });
  };

  const onRematch = async () => {
    setGameStarted(false);
    setGameId(null);
    finalizingRef.current = false;
    await startGame();
  };

  const lastMoveHighlight = useMemo(() => {
    const history = gameRef.current.history({ verbose: true });
    const last = history[history.length - 1];
    if (!last) return {};
    return {
      [last.from]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
      [last.to]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
    };
  }, [fen]);

  if (!gameStarted) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-elegant)]">
        <div className="mb-6 text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
            <Bot className="h-3.5 w-3.5" /> AI Training
          </span>
          <h1 className="text-3xl font-bold">Play vs Stockfish</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick your color and difficulty. Win to earn coins and ELO.
          </p>
        </div>

        {/* Color picker */}
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Play as
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(["white", "black"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setPlayerColor(c)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-semibold transition-all ${
                  playerColor === c
                    ? "border-primary bg-primary/10 shadow-[var(--shadow-glow)]"
                    : "border-border bg-secondary/30 hover:border-primary/40"
                }`}
              >
                <span className="text-2xl">{c === "white" ? "♔" : "♚"}</span>
                <span className="capitalize">{c}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Difficulty
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {DIFFICULTY_PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setDifficulty(i)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  difficulty === i
                    ? "border-primary bg-primary/10 shadow-[var(--shadow-glow)]"
                    : "border-border bg-secondary/30 hover:border-primary/40"
                }`}
              >
                <div className="text-xs font-semibold text-muted-foreground">Lvl {p.skill}</div>
                <div className="font-bold">{p.label}</div>
                <div className="font-mono text-xs text-muted-foreground">~{p.elo}</div>
              </button>
            ))}
          </div>
        </div>

        <Button variant="hero" size="xl" className="w-full" onClick={startGame}>
          Start game
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr_320px]">
      <div className="hidden lg:block">
        <EvalBar scoreCp={evalScore} mateIn={mateIn} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Stockfish — {preset.label}
            </p>
            <p className="text-sm">
              {aiThinking ? "Thinking…" : result ? "Game over" : "Your move"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onResign} disabled={!!result}>
              <Flag className="h-4 w-4" /> Resign
            </Button>
            <Button variant="ghost" size="sm" onClick={onRematch}>
              <RotateCw className="h-4 w-4" /> New
            </Button>
          </div>
        </div>

        <ChessBoardView
          position={fen}
          orientation={playerColor}
          onPieceDrop={onDrop}
          squareStyles={lastMoveHighlight}
          boardSkin={profile?.active_board_skin ?? "classic"}
          allowDragging={!aiThinking && !result}
        />

        {result && (
          <GameResultCard
            outcome={result.outcome}
            reason={result.reason}
            eloDelta={result.elo_delta}
            newElo={result.new_elo}
            coinsEarned={result.coins_earned}
            newCoins={result.new_coins}
            moveBonus={result.move_bonus}
            onRematch={onRematch}
            analyzeHref={gameId ? `/game/${gameId}` : undefined}
          />
        )}
      </div>

      <div className="space-y-4">
        <MoveHistory moves={moves} />
        <button
          onClick={() => navigate({ to: "/" })}
          className="text-xs text-muted-foreground hover:underline"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

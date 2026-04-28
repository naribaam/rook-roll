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
import { getEngine } from "@/lib/stockfish";
import { useRouter } from "next/navigation";
import { Bot, Crown, Sparkles, Trophy, ChevronRight, Users, Flag } from "lucide-react";
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

type GameMode = "ai" | "local";

type GameResult = {
  outcome: "win" | "loss" | "draw";
  reason: string;
  elo_delta: number;
  new_elo: number;
  coins_earned: number;
  new_coins: number;
  move_bonus: number;
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
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const gameRef = useRef(new Chess());

  const [fen, setFen] = useState(gameRef.current.fen());
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState(2);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("ai");
  const [gameId, setGameId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [evalScore, setEvalScore] = useState<number | null>(0);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const finalizingRef = useRef(false);

  const preset = DIFFICULTY_PRESETS[difficulty];
  const aiColor = playerColor === "white" ? "b" : "w";

  // Initialize engine
  useEffect(() => {
    if (gameMode === "ai") {
      const eng = getEngine();
      eng.init(preset.skill);
    }
    setFen(gameRef.current.fen());
  }, [gameMode, preset.skill]);

  // Update engine skill when difficulty changes
  useEffect(() => {
    if (gameMode === "ai") {
      getEngine().setSkill(preset.skill);
    }
  }, [preset.skill, gameMode]);

  // Check if game is over using chess.js
  const checkGameOver = useCallback((): { result: "white_win" | "black_win" | "draw"; reason: string } | null => {
    const chess = gameRef.current;
    if (!chess.isGameOver()) return null;

    if (chess.isCheckmate()) {
      const loser = chess.turn();
      return { result: loser === "w" ? "black_win" : "white_win", reason: "Checkmate" };
    }
    if (chess.isStalemate()) return { result: "draw", reason: "Stalemate" };
    if (chess.isThreefoldRepetition()) return { result: "draw", reason: "Threefold repetition" };
    if (chess.isInsufficientMaterial()) return { result: "draw", reason: "Insufficient material" };
    if (chess.isDraw()) return { result: "draw", reason: "50-move rule" };
    return null;
  }, []);

  // Finalize game and update database
  const finalizeGame = useCallback(async (res: { result: "white_win" | "black_win" | "draw"; reason: string }) => {
    if (finalizingRef.current || !gameId) return;
    finalizingRef.current = true;

    const isWhite = playerColor === "white";
    const outcome = res.result === "draw"
      ? "draw"
      : (isWhite && res.result === "white_win") || (!isWhite && res.result === "black_win")
        ? "win"
        : "loss";

    // Calculate simple rewards for AI games
    const coinsEarned = outcome === "win" ? 100 : outcome === "draw" ? 50 : 0;

    try {
      // Update game in database
      await supabase
        .from("games")
        .update({
          status: "finished",
          result: res.result,
          result_reason: res.reason,
          pgn: gameRef.current.pgn(),
          fen: gameRef.current.fen(),
          finished_at: new Date().toISOString(),
        })
        .eq("id", gameId);

      // Award coins if earned
      if (coinsEarned > 0 && user) {
        await supabase.rpc("award_coins", {
          _user_id: user.id,
          _amount: coinsEarned,
          _type: outcome === "win" ? "win" : "draw",
          _description: `AI game ${outcome}`,
          _game_id: gameId,
        });
      }

      await refreshProfile();

      setResult({
        outcome,
        reason: res.reason,
        elo_delta: 0, // AI games don't affect ELO
        new_elo: profile?.elo ?? 1200,
        coins_earned: coinsEarned,
        new_coins: (profile?.coins ?? 0) + coinsEarned,
        move_bonus: 0,
      });
    } catch (e) {
      console.error("Failed to finalize game:", e);
      finalizingRef.current = false;
      // Still show result even if DB update fails
      setResult({
        outcome,
        reason: res.reason,
        elo_delta: 0,
        new_elo: profile?.elo ?? 1200,
        coins_earned: 0,
        new_coins: profile?.coins ?? 0,
        move_bonus: 0,
      });
    }
  }, [gameId, playerColor, user, profile, refreshProfile]);

  // Finalize local game (no database)
  const finalizeLocalGame = useCallback((res: { result: "white_win" | "black_win" | "draw"; reason: string }) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    const whiteWins = res.result === "white_win";
    const blackWins = res.result === "black_win";

    setResult({
      outcome: res.result === "draw" ? "draw" : whiteWins ? "win" : "loss",
      reason: res.reason + (res.result !== "draw" ? ` - ${whiteWins ? "White" : "Black"} wins!` : ""),
      elo_delta: 0,
      new_elo: profile?.elo ?? 1200,
      coins_earned: 0,
      new_coins: profile?.coins ?? 0,
      move_bonus: 0,
    });
  }, [profile]);

  // Run AI analysis for evaluation bar
  const runEvaluation = useCallback(async (position: string) => {
    if (gameMode !== "ai" || result) return;
    try {
      const eng = getEngine();
      const analysis = await eng.analyze(position, 8);
      // Score is from engine's perspective, convert to white's perspective
      const turn = position.split(" ")[1];
      const scoreCp = analysis.scoreCp !== null
        ? (turn === "w" ? analysis.scoreCp : -analysis.scoreCp)
        : null;
      setEvalScore(scoreCp);
      setMateIn(analysis.mateIn);
    } catch {
      // Ignore eval errors
    }
  }, [gameMode, result]);

  // Play AI move
  const playAi = useCallback(async (id: string) => {
    const game = gameRef.current;

    // Check if game is already over
    const gameOver = checkGameOver();
    if (gameOver) {
      finalizeGame(gameOver);
      return;
    }

    setAiThinking(true);

    try {
      const eng = getEngine();
      const res = await eng.analyze(game.fen(), preset.depth);

      const uci = res.bestMove;
      if (!uci) {
        setAiThinking(false);
        return;
      }

      // Validate and make the move
      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : "q",
      });

      if (!move) {
        setAiThinking(false);
        return;
      }

      const newFen = game.fen();
      setFen(newFen);
      setMoves((m) => [...m, { san: move.san, fen: newFen }]);

      // Update database
      await supabase
        .from("games")
        .update({
          fen: newFen,
          pgn: game.pgn(),
        })
        .eq("id", id);

      // Check if game is over after AI move
      const afterMove = checkGameOver();
      if (afterMove) {
        finalizeGame(afterMove);
      } else {
        // Run evaluation for the new position
        runEvaluation(newFen);
      }
    } catch (e) {
      console.error("AI move error:", e);
    } finally {
      setAiThinking(false);
    }
  }, [preset.depth, checkGameOver, finalizeGame, runEvaluation]);

  // Start a new game
  const startGame = useCallback(async () => {
    if (!user) return;

    const g = gameRef.current;
    g.reset();

    setFen(g.fen());
    setMoves([]);
    setResult(null);
    setEvalScore(0);
    setMateIn(null);
    finalizingRef.current = false;
    setGameStarted(true);

    if (gameMode === "local") {
      // Local mode doesn't need database
      setGameId("local");
      return;
    }

    // AI mode - create game in database
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
        ai_color: playerColor === "white" ? "b" : "w",
        ai_difficulty: difficulty,
      })
      .select()
      .single();

    if (error || !data) {
      toast.error("Game creation failed");
      setGameStarted(false);
      return;
    }

    setGameId(data.id);

    // If player is black, AI moves first
    if (playerColor === "black") {
      setTimeout(() => playAi(data.id), 500);
    }
  }, [user, playerColor, gameMode, difficulty, playAi]);

  // Handle piece drop
  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      // Don't allow moves if game is over
      if (result) return false;

      // Don't allow moves while AI is thinking (in AI mode)
      if (gameMode === "ai" && aiThinking) return false;

      const game = gameRef.current;

      // In AI mode, only allow moves on player's turn
      if (gameMode === "ai") {
        const isPlayerTurn = (playerColor === "white" && game.turn() === "w") ||
                            (playerColor === "black" && game.turn() === "b");
        if (!isPlayerTurn) return false;
      }

      // Try to make the move
      let move;
      try {
        move = game.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const newFen = game.fen();
      setFen(newFen);
      setMoves((m) => [...m, { san: move.san, fen: newFen }]);

      // Check if game is over after player's move
      const gameOver = checkGameOver();
      if (gameOver) {
        if (gameMode === "ai" && gameId) {
          finalizeGame(gameOver);
        } else if (gameMode === "local") {
          finalizeLocalGame(gameOver);
        }
        return true;
      }

      // In AI mode, trigger AI move
      if (gameMode === "ai" && gameId) {
        // Update database first
        supabase
          .from("games")
          .update({
            fen: newFen,
            pgn: game.pgn(),
          })
          .eq("id", gameId)
          .then(() => {
            // Small delay before AI responds
            setTimeout(() => playAi(gameId), 300);
          });

        // Update evaluation
        runEvaluation(newFen);
      }

      return true;
    },
    [aiThinking, gameId, result, gameMode, playerColor, playAi, checkGameOver, finalizeGame, finalizeLocalGame, runEvaluation]
  );

  // Handle resignation
  const handleResign = useCallback(() => {
    if (!gameStarted || result) return;

    const isWhite = playerColor === "white";
    const resignResult: { result: "white_win" | "black_win" | "draw"; reason: string } = {
      result: isWhite ? "black_win" : "white_win",
      reason: "Resignation"
    };

    if (gameMode === "ai" && gameId) {
      finalizeGame(resignResult);
    } else if (gameMode === "local") {
      // In local mode, whoever's turn it is resigns
      const turn = gameRef.current.turn();
      const localResult: { result: "white_win" | "black_win" | "draw"; reason: string } = {
        result: turn === "w" ? "black_win" : "white_win",
        reason: "Resignation"
      };
      finalizeLocalGame(localResult);
    }
  }, [gameStarted, result, playerColor, gameMode, gameId, finalizeGame, finalizeLocalGame]);

  // Rematch function
  const handleRematch = useCallback(() => {
    setResult(null);
    setGameStarted(false);
    finalizingRef.current = false;
    gameRef.current.reset();
    setFen(gameRef.current.fen());
    setMoves([]);
    setEvalScore(0);
    setMateIn(null);
  }, []);

  // Last move highlight
  const lastMoveHighlight = useMemo(() => {
    const hist = gameRef.current.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (!last) return {};

    return {
      [last.from]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
      [last.to]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
    };
  }, [fen]);

  // Determine whose turn it is (for local mode display)
  const currentTurn = gameRef.current.turn() === "w" ? "White" : "Black";

  // Game mode selection screen
  if (!gameStarted) {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-3xl bg-[image:var(--gradient-hero)] px-6 py-10 text-primary-foreground shadow-[var(--shadow-elegant)] md:px-10">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Bot className="h-3.5 w-3.5" /> Local Play
          </span>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Play Chess</h1>
          <p className="mt-2 max-w-lg text-sm text-primary-foreground/85">
            Challenge the AI or play against a friend on the same device.
          </p>
        </div>

        {/* Game Mode Selection */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Game Mode</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setGameMode("ai")}
              className={`group relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                gameMode === "ai"
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-elegant)]"
                  : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40"
              }`}
            >
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <Bot className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Play vs AI</p>
                <p className="text-xs text-muted-foreground">
                  Challenge Stockfish at various difficulty levels
                </p>
              </div>
              {gameMode === "ai" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </button>

            <button
              type="button"
              onClick={() => setGameMode("local")}
              className={`group relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                gameMode === "local"
                  ? "border-primary bg-primary/5 shadow-[var(--shadow-elegant)]"
                  : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40"
              }`}
            >
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Play with Friend</p>
                <p className="text-xs text-muted-foreground">
                  Two players on the same device, take turns
                </p>
              </div>
              {gameMode === "local" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </button>
          </div>
        </section>

        {/* Color Selection (only for AI mode) */}
        {gameMode === "ai" && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Your color</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["white", "black"] as const).map((c) => {
                const active = playerColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPlayerColor(c)}
                    className={`group relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-[var(--shadow-elegant)]"
                        : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40"
                    }`}
                  >
                    <div
                      className={`grid h-14 w-14 place-items-center rounded-xl text-3xl shadow-inner ${
                        c === "white"
                          ? "bg-gradient-to-br from-neutral-100 to-neutral-300 text-neutral-800"
                          : "bg-gradient-to-br from-neutral-800 to-black text-neutral-100"
                      }`}
                    >
                      ♚
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold capitalize">{c}</p>
                      <p className="text-xs text-muted-foreground">
                        {c === "white" ? "Move first" : "Move second"}
                      </p>
                    </div>
                    {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Difficulty Selection (only for AI mode) */}
        {gameMode === "ai" && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Difficulty</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {DIFFICULTY_PRESETS.map((p, i) => {
                const active = difficulty === i;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDifficulty(i)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      active
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{p.label}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Trophy className="h-3 w-3" /> {p.elo}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <Button onClick={startGame} variant="hero" size="xl" className="w-full">
          Start game <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Game board screen
  return (
    <div className="grid w-full gap-6 lg:grid-cols-[auto_minmax(0,1fr)_320px]">
      {/* Evaluation Bar (AI mode only) */}
      {gameMode === "ai" && (
        <div className="hidden lg:block">
          <EvalBar scoreCp={evalScore} mateIn={mateIn} />
        </div>
      )}

      {/* Chess Board */}
      <div className="mx-auto w-full max-w-[640px]">
        <ChessBoardView
          position={fen}
          orientation={gameMode === "ai" ? playerColor : "white"}
          onPieceDrop={result ? undefined : onDrop}
          squareStyles={lastMoveHighlight}
          boardSkin={profile?.active_board_skin ?? "classic"}
          pieceSkin={profile?.active_piece_skin ?? "classic"}
          allowDragging={!result}
        />
      </div>

      {/* Side Panel */}
      <aside className="space-y-4">
        {/* Game Info */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          {gameMode === "ai" ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {preset.label} · ELO ~{preset.elo}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${
                    aiThinking ? "animate-pulse bg-accent" : "bg-primary"
                  }`}
                />
                {result ? "Game over" : aiThinking ? "AI is thinking…" : "Your move"}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Local Game · 2 Players
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {result ? "Game over" : `${currentTurn}'s turn`}
              </p>
            </>
          )}
        </div>

        {/* Game Result */}
        {result && (
          <GameResultCard
            outcome={result.outcome}
            reason={result.reason}
            eloDelta={result.elo_delta}
            newElo={result.new_elo}
            coinsEarned={result.coins_earned}
            newCoins={result.new_coins}
            moveBonus={result.move_bonus}
            onRematch={handleRematch}
            analyzeHref={gameMode === "ai" && gameId && gameId !== "local" ? `/game/${gameId}` : undefined}
          />
        )}

        {/* Resign Button (only when game is active) */}
        {!result && (
          <Button variant="outline" className="w-full" onClick={handleResign}>
            <Flag className="h-4 w-4" /> Resign
          </Button>
        )}

        {/* Move History */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Moves</h3>
          <MoveHistory moves={moves} />
        </div>

        {/* Back Button */}
        {result && (
          <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
            Back to home
          </Button>
        )}
      </aside>
    </div>
  );
}


import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { ChessBoardView } from "@/components/ChessBoardView";
import { MoveHistory } from "@/components/MoveHistory";
import { EvalBar } from "@/components/EvalBar";
import { GameResultCard } from "@/components/GameResultCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngine, getEvalEngine } from "@/lib/stockfish";
import { useRouter } from "@/lib/next-compat";
import {
  Bot,
  Crown,
  Sparkles,
  Trophy,
  ChevronRight,
  Users,
  RefreshCcw,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";

type Mode = "ai" | "local";

const DIFFICULTY_PRESETS = [
  { skill: 0, depth: 4, label: "Beginner", elo: 600 },
  { skill: 5, depth: 6, label: "Easy", elo: 1000 },
  { skill: 10, depth: 10, label: "Intermediate", elo: 1400 },
  { skill: 15, depth: 12, label: "Advanced", elo: 1800 },
  { skill: 20, depth: 14, label: "Master", elo: 2400 },
];

type MoveItem = {
  san: string;
  fen: string;
};

type GameOver = {
  result: "white_win" | "black_win" | "draw";
  reason: string;
};

function detectGameOver(chess: Chess): GameOver | null {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    const loser = chess.turn();
    return {
      result: loser === "w" ? "black_win" : "white_win",
      reason: "Checkmate",
    };
  }
  if (chess.isStalemate()) return { result: "draw", reason: "Stalemate" };
  if (chess.isThreefoldRepetition())
    return { result: "draw", reason: "Threefold repetition" };
  if (chess.isInsufficientMaterial())
    return { result: "draw", reason: "Insufficient material" };
  if (chess.isDraw()) return { result: "draw", reason: "50-move rule" };
  return null;
}

export default function PlayPage() {
  return (
    <Layout>
      <PlayInner />
    </Layout>
  );
}

function PlayInner() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const gameRef = useRef(new Chess());

  const [mode, setMode] = useState<Mode>("ai");
  const [fen, setFen] = useState(gameRef.current.fen());
  const [moves, setMoves] = useState<MoveItem[]>([]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [difficulty, setDifficulty] = useState(2);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [gameOver, setGameOver] = useState<GameOver | null>(null);
  const [evalCp, setEvalCp] = useState<number | null>(0);
  const [evalMate, setEvalMate] = useState<number | null>(null);

  const preset = DIFFICULTY_PRESETS[difficulty];

  // Initialize the AI engine when in AI mode and refresh skill on changes.
  useEffect(() => {
    if (mode !== "ai") return;
    let cancelled = false;
    getEngine()
      .init(preset.skill)
      .then(() => {
        if (cancelled) return;
        getEngine().setSkill(preset.skill);
      })
      .catch((err) => console.error("AI engine init failed", err));
    return () => {
      cancelled = true;
    };
  }, [mode, preset.skill]);

  // Initialize the dedicated eval engine once, regardless of mode.
  useEffect(() => {
    getEvalEngine()
      .init(20)
      .catch((err) => console.error("Eval engine init failed", err));
  }, []);

  // After every position change, refresh the eval bar via the eval engine.
  // The shallow depth keeps each request fast (<300ms). The cancelled flag
  // guards against stale results from outdated positions.
  useEffect(() => {
    if (!gameStarted) return;
    let cancelled = false;
    getEvalEngine()
      .analyze(fen, 10)
      .then((res) => {
        if (cancelled) return;
        if (res.scoreCp === null && res.mateIn === null) return;
        setEvalCp(res.scoreCp);
        setEvalMate(res.mateIn);
      })
      .catch(() => {
        /* ignore eval failures — eval bar is non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, [fen, gameStarted]);

  // Persist the result of the current game to Supabase (AI mode only).
  const persistResult = useCallback(
    (g: Chess, id: string | null, over: GameOver) => {
      if (mode !== "ai" || !id) return;
      supabase
        .from("games")
        .update({
          status: "finished",
          result: over.result,
          result_reason: over.reason,
          fen: g.fen(),
          pgn: g.pgn(),
        })
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Failed to persist game result", error);
        });
    },
    [mode],
  );

  const playAi = useCallback(
    async (id: string | null) => {
      const game = gameRef.current;
      if (game.isGameOver()) {
        const over = detectGameOver(game);
        if (over) {
          setGameOver(over);
          persistResult(game, id, over);
        }
        return;
      }
      setAiThinking(true);
      try {
        const eng = getEngine();
        await eng.init(preset.skill);
        const res = await eng.analyze(game.fen(), preset.depth);
        const uci = res.bestMove;
        if (!uci) {
          // Engine returned no move → position must be terminal.
          const over = detectGameOver(game);
          if (over) {
            setGameOver(over);
            persistResult(game, id, over);
          }
          return;
        }
        let move;
        try {
          move = game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length === 5 ? uci[4] : "q",
          });
        } catch {
          move = null;
        }
        if (!move) {
          console.warn("AI returned an illegal move:", uci);
          return;
        }

        const newFen = game.fen();
        setFen(newFen);
        setMoves((m) => [...m, { san: move.san, fen: newFen }]);

        const over = detectGameOver(game);
        if (over) {
          setGameOver(over);
          persistResult(game, id, over);
        }
      } catch (err) {
        console.error("AI move failed", err);
        toast.error("AI move failed — please try again");
      } finally {
        setAiThinking(false);
      }
    },
    [preset.depth, preset.skill, persistResult],
  );

  const startGame = useCallback(async () => {
    const g = gameRef.current;
    g.reset();
    setFen(g.fen());
    setMoves([]);
    setGameOver(null);
    setEvalCp(0);
    setEvalMate(null);

    if (mode === "local") {
      setOrientation("white");
      setGameId(null);
      setGameStarted(true);
      return;
    }

    setOrientation(playerColor);

    // Persist the new game to Supabase if signed in. Anonymous players can
    // still play; their results just aren't recorded.
    let createdId: string | null = null;
    if (user) {
      try {
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
        if (error || !data) throw error ?? new Error("Insert failed");
        createdId = data.id;
      } catch (err) {
        console.error("Game record creation failed", err);
        toast.error("Couldn't save the game — playing offline");
      }
    }

    setGameId(createdId);
    setGameStarted(true);

    if (playerColor === "black") {
      // Defer slightly so the UI renders the empty board before the AI thinks.
      setTimeout(() => playAi(createdId), 200);
    }
  }, [mode, user, playerColor, playAi]);

  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      if (gameOver || aiThinking) return false;
      const g = gameRef.current;

      // For AI mode, only the human's color can move.
      if (mode === "ai") {
        const playerSide = playerColor === "white" ? "w" : "b";
        if (g.turn() !== playerSide) return false;
      }

      let move;
      try {
        move = g.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const newFen = g.fen();
      setFen(newFen);
      setMoves((m) => [...m, { san: move.san, fen: newFen }]);

      // Check for end-of-game first; if so, do not summon the AI.
      const over = detectGameOver(g);
      if (over) {
        setGameOver(over);
        persistResult(g, gameId, over);
        return true;
      }

      if (mode === "ai") {
        // Yield to the browser so the player's move animates first.
        setTimeout(() => playAi(gameId), 80);
      }

      return true;
    },
    [gameOver, aiThinking, mode, playerColor, gameId, playAi, persistResult],
  );

  const lastMoveHighlight = useMemo(() => {
    const hist = gameRef.current.history({ verbose: true });
    const last = hist[hist.length - 1];
    if (!last) return {};
    return {
      [last.from]: {
        background: "color-mix(in oklab, var(--accent) 35%, transparent)",
      },
      [last.to]: {
        background: "color-mix(in oklab, var(--accent) 35%, transparent)",
      },
    };
    // depend on `fen` so the highlight refreshes after every move
  }, [fen]);

  const newGame = useCallback(() => {
    setGameStarted(false);
    setGameOver(null);
    setGameId(null);
    setMoves([]);
    setEvalCp(0);
    setEvalMate(null);
    gameRef.current.reset();
    setFen(gameRef.current.fen());
  }, []);

  const rematch = useCallback(() => {
    setGameOver(null);
    setMoves([]);
    setEvalCp(0);
    setEvalMate(null);
    gameRef.current.reset();
    setFen(gameRef.current.fen());

    if (mode === "local") {
      setGameId(null);
      return;
    }

    // For AI mode, create a fresh game record so analytics stay correct.
    setGameId(null);
    if (!user) {
      // Anonymous AI rematch: just play, don't persist.
      if (playerColor === "black") {
        setTimeout(() => playAi(null), 200);
      }
      return;
    }
    supabase
      .from("games")
      .insert({
        mode: "ai",
        status: "active",
        white_player: playerColor === "white" ? user.id : null,
        black_player: playerColor === "black" ? user.id : null,
        created_by: user.id,
        fen: gameRef.current.fen(),
        pgn: "",
      })
      .select()
      .single()
      .then(({ data }) => {
        if (data) setGameId(data.id);
        if (playerColor === "black") {
          setTimeout(() => playAi(data?.id ?? null), 200);
        }
      });
  }, [mode, user, playerColor, playAi]);

  if (!gameStarted) {
    return (
      <Lobby
        mode={mode}
        setMode={setMode}
        playerColor={playerColor}
        setPlayerColor={setPlayerColor}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        startGame={startGame}
      />
    );
  }

  // ---------- IN-GAME UI ----------

  const allowDragging = !gameOver && !aiThinking;
  const turn = gameRef.current.turn(); // "w" | "b"
  const playerSideLetter = playerColor === "white" ? "w" : "b";

  let statusLabel: string;
  let statusDot: string;
  if (gameOver) {
    statusLabel = "Game over";
    statusDot = "bg-muted-foreground";
  } else if (mode === "local") {
    statusLabel = turn === "w" ? "White to move" : "Black to move";
    statusDot = "bg-primary";
  } else if (aiThinking) {
    statusLabel = "AI is thinking…";
    statusDot = "animate-pulse bg-accent";
  } else if (turn === playerSideLetter) {
    statusLabel = "Your move";
    statusDot = "bg-primary";
  } else {
    statusLabel = "Opponent's move";
    statusDot = "bg-muted-foreground";
  }

  // For the GameResultCard outcome, AI mode reports win/loss from the human's
  // perspective; local mode always shows the result of the side that just won.
  const cardOutcome: "win" | "loss" | "draw" = (() => {
    if (!gameOver) return "draw";
    if (gameOver.result === "draw") return "draw";
    if (mode === "ai") {
      const humanWon =
        (gameOver.result === "white_win" && playerColor === "white") ||
        (gameOver.result === "black_win" && playerColor === "black");
      return humanWon ? "win" : "loss";
    }
    return "win";
  })();

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[auto_minmax(0,1fr)_320px]">
      {/* EVAL BAR */}
      <div className="hidden lg:block">
        <div className="h-full min-h-[400px]">
          <EvalBar scoreCp={evalCp} mateIn={evalMate} />
        </div>
      </div>

      {/* BOARD + RESULT */}
      <div className="mx-auto w-full max-w-[640px] space-y-4">
        <ChessBoardView
          position={fen}
          orientation={orientation}
          onPieceDrop={onDrop}
          allowDragging={allowDragging}
          squareStyles={lastMoveHighlight}
          boardSkin={profile?.active_board_skin ?? "classic"}
          pieceSkin={profile?.active_piece_skin ?? "classic"}
        />

        {gameOver && (
          <GameResultCard
            outcome={cardOutcome}
            reason={
              mode === "local" && gameOver.result !== "draw"
                ? `${gameOver.reason} — ${gameOver.result === "white_win" ? "White" : "Black"} wins`
                : gameOver.reason
            }
            eloDelta={0}
            newElo={profile?.elo ?? 1200}
            coinsEarned={0}
            newCoins={profile?.coins ?? 0}
            onRematch={rematch}
          />
        )}
      </div>

      {/* SIDE PANEL */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {mode === "ai" ? `${preset.label} · ELO ~${preset.elo}` : "Local 2-player"}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            {statusLabel}
          </p>
          {mode === "local" && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() =>
                setOrientation((o) => (o === "white" ? "black" : "white"))
              }
            >
              <Repeat className="h-3.5 w-3.5" /> Flip board
            </Button>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Moves
          </h3>
          <MoveHistory moves={moves} />
        </div>

        <div className="space-y-2">
          {!gameOver && (
            <Button
              variant="outline"
              className="w-full"
              onClick={newGame}
              disabled={aiThinking}
            >
              <RefreshCcw className="h-4 w-4" /> New game
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/")}
          >
            Back to home
          </Button>
        </div>
      </aside>
    </div>
  );
}

// -------------------- LOBBY --------------------

function Lobby({
  mode,
  setMode,
  playerColor,
  setPlayerColor,
  difficulty,
  setDifficulty,
  startGame,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  playerColor: "white" | "black";
  setPlayerColor: (c: "white" | "black") => void;
  difficulty: number;
  setDifficulty: (d: number) => void;
  startGame: () => void;
}) {
  const modes: {
    id: Mode;
    icon: React.ReactNode;
    label: string;
    desc: string;
  }[] = [
    {
      id: "ai",
      icon: <Bot className="h-5 w-5" />,
      label: "Play vs AI",
      desc: "Stockfish opponent · 5 difficulty levels",
    },
    {
      id: "local",
      icon: <Users className="h-5 w-5" />,
      label: "Play with friend",
      desc: "Same device, two players",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="rounded-3xl bg-[image:var(--gradient-hero)] px-6 py-10 text-primary-foreground shadow-[var(--shadow-elegant)] md:px-10">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> New game
        </span>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Start a game
        </h1>
        <p className="mt-2 max-w-lg text-sm text-primary-foreground/85">
          Train against Stockfish in your browser, or hand the device to a
          friend for a quick over-the-board match.
        </p>
      </div>

      {/* Mode */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Mode
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-[var(--shadow-elegant)]"
                    : "border-border bg-background hover:border-primary/40 hover:bg-secondary/40"
                }`}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-lg ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-primary"
                  }`}
                >
                  {m.icon}
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
                {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </section>

      {mode === "ai" && (
        <>
          {/* Color */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Your color
              </h2>
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

          {/* Difficulty */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Difficulty
              </h2>
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
        </>
      )}

      {mode === "local" && (
        <section className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-sm text-muted-foreground">
          Two players take turns on the same device. Tap{" "}
          <span className="font-semibold text-foreground">Flip board</span> in
          the side panel to swap perspectives between turns. The game uses
          standard chess rules with full draw and checkmate detection.
        </section>
      )}

      <Button onClick={startGame} variant="hero" size="xl" className="w-full">
        Start game <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

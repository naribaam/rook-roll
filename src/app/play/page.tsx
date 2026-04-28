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
import { Bot, Crown, Sparkles, Trophy, ChevronRight } from "lucide-react";
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
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-3xl bg-[image:var(--gradient-hero)] px-6 py-10 text-primary-foreground shadow-[var(--shadow-elegant)] md:px-10">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Bot className="h-3.5 w-3.5" /> AI training
          </span>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Play vs AI</h1>
          <p className="mt-2 max-w-lg text-sm text-primary-foreground/85">
            Choose your side and difficulty. Stockfish runs locally in your browser.
          </p>
        </div>

        {/* Color */}
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

        {/* Difficulty */}
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

        <Button onClick={startGame} variant="hero" size="xl" className="w-full">
          Start game <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* BOARD */}
      <div className="mx-auto w-full max-w-[640px]">
        <ChessBoardView
          position={fen}
          orientation={playerColor}
          onPieceDrop={onDrop}
          squareStyles={lastMoveHighlight}
          boardSkin={profile?.active_board_skin ?? "classic"}
          pieceSkin={profile?.active_piece_skin ?? "classic"}
        />
      </div>

      {/* SIDE PANEL */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {preset.label} · ELO ~{preset.elo}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            <span
              className={`h-2 w-2 rounded-full ${
                aiThinking ? "animate-pulse bg-accent" : "bg-primary"
              }`}
            />
            {aiThinking ? "AI is thinking…" : "Your move"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Moves</h3>
          <MoveHistory moves={moves} />
        </div>

        <Button variant="outline" className="w-full" onClick={() => router.push("/")}>
          Back to home
        </Button>
      </aside>
    </div>
  );
}

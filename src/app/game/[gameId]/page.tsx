"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Chess } from "chess.js";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { ChessBoardView } from "@/components/ChessBoardView";
import { MoveHistory } from "@/components/MoveHistory";
import { EvalBar } from "@/components/EvalBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getEngine } from "@/lib/stockfish";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles, Loader as Loader2 } from "lucide-react";

export default function GameAnalysisPage() {
  return (
    <Layout>
      <AuthGate>
        <Inner />
      </AuthGate>
    </Layout>
  );
}

type MoveAnalysis = {
  san: string;
  fen: string;
  fenBefore: string;
  scoreCpAfterWhite: number | null;
  bestMove: string | null;
  quality: "best" | "great" | "good" | "inaccuracy" | "mistake" | "blunder";
  centipawnLoss: number;
  isUserMove: boolean;
};

function classify(loss: number): MoveAnalysis["quality"] {
  if (loss <= 10) return "best";
  if (loss <= 50) return "great";
  if (loss <= 100) return "good";
  if (loss <= 200) return "inaccuracy";
  if (loss <= 350) return "mistake";
  return "blunder";
}

function Inner() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { user, profile } = useAuth();
  const [pgn, setPgn] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<"w" | "b">("w");
  const [analysis, setAnalysis] = useState<MoveAnalysis[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cursor, setCursor] = useState(-1);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("games")
      .select("pgn, white_player, black_player, status")
      .eq("id", gameId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setPgn(data.pgn);
        setUserColor(data.white_player === user.id ? "w" : "b");
      });
  }, [gameId, user]);

  const positions = useMemo(() => {
    if (!pgn) return null;
    const c = new Chess();
    try {
      c.loadPgn(pgn);
    } catch {
      return null;
    }
    const history = c.history({ verbose: true });
    const fens: { san: string; fen: string; fenBefore: string; color: "w" | "b" }[] = [];
    const replay = new Chess();
    for (const m of history) {
      const before = replay.fen();
      const move = replay.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (!move) break;
      fens.push({ san: m.san, fen: replay.fen(), fenBefore: before, color: m.color });
    }
    return { startFen: new Chess().fen(), moves: fens };
  }, [pgn]);

  const runAnalysis = async () => {
    if (!positions) return;
    setAnalyzing(true);
    setProgress(0);
    const eng = getEngine();
    await eng.init(20);
    const out: MoveAnalysis[] = [];
    for (let i = 0; i < positions.moves.length; i++) {
      const m = positions.moves[i];
      const before = await eng.analyze(m.fenBefore, 12);
      const after = await eng.analyze(m.fen, 12);
      const beforeTurnSign = m.fenBefore.split(" ")[1] === "w" ? 1 : -1;
      const afterTurnSign = m.fen.split(" ")[1] === "w" ? 1 : -1;
      const scoreBefore = (before.scoreCp ?? 0) * beforeTurnSign;
      const scoreAfter = (after.scoreCp ?? 0) * afterTurnSign;
      const moverSign = m.color === "w" ? 1 : -1;
      const loss = Math.max(0, scoreBefore * moverSign - scoreAfter * moverSign);
      out.push({
        san: m.san,
        fen: m.fen,
        fenBefore: m.fenBefore,
        scoreCpAfterWhite: scoreAfter,
        bestMove: before.bestMove,
        quality: classify(loss),
        centipawnLoss: Math.round(loss),
        isUserMove: m.color === userColor,
      });
      setProgress(Math.round(((i + 1) / positions.moves.length) * 100));
    }
    setAnalysis(out);
    setAnalyzing(false);
  };

  const totalMoves = positions?.moves.length ?? 0;
  const currentFen =
    cursor === -1
      ? positions?.startFen ?? new Chess().fen()
      : positions?.moves[cursor]?.fen ?? new Chess().fen();
  const currentEval =
    analysis && cursor >= 0 ? analysis[cursor]?.scoreCpAfterWhite ?? null : 0;

  const userMoves = analysis?.filter((a) => a.isUserMove) ?? [];
  const summary = useMemo(() => {
    if (!userMoves.length) return null;
    const counts: Record<MoveAnalysis["quality"], number> = {
      best: 0, great: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0,
    };
    let totalLoss = 0;
    for (const m of userMoves) {
      counts[m.quality]++;
      totalLoss += m.centipawnLoss;
    }
    const accuracy = Math.max(0, Math.min(100, 100 - totalLoss / userMoves.length / 5));
    return { counts, accuracy: Math.round(accuracy) };
  }, [userMoves]);

  if (!positions) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr_320px]">
      <div className="hidden lg:block">
        <EvalBar scoreCp={currentEval} mateIn={null} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Game analysis</h1>
            <p className="text-sm text-muted-foreground">
              {analysis ? "Click a move to inspect" : "Run AI analysis to detect blunders"}
            </p>
          </div>
          <Link href="/profile">
            <Button variant="ghost" size="sm">Back to profile</Button>
          </Link>
        </div>

        <ChessBoardView
          position={currentFen}
          orientation={userColor === "w" ? "white" : "black"}
          allowDragging={false}
          boardSkin={profile?.active_board_skin ?? "classic"}
          arrows={
            analysis && cursor >= 0 && analysis[cursor]?.bestMove && analysis[cursor].quality !== "best"
              ? [
                  {
                    startSquare: analysis[cursor].bestMove!.slice(0, 2),
                    endSquare: analysis[cursor].bestMove!.slice(2, 4),
                    color: "rgba(34,197,94,0.7)",
                  },
                ]
              : []
          }
        />

        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor(-1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => Math.max(-1, c - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-mono text-muted-foreground">
            {cursor + 1} / {totalMoves}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((c) => Math.min(totalMoves - 1, c + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(totalMoves - 1)}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>

        {!analysis && (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 text-primary" />
            <h3 className="mb-1 font-bold">AI Coach</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Analyze every move with Stockfish to spot inaccuracies, mistakes and blunders.
            </p>
            <Button variant="hero" onClick={runAnalysis} disabled={analyzing}>
              {analyzing ? `Analyzing… ${progress}%` : "Run analysis"}
            </Button>
          </div>
        )}

        {analysis && summary && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">Your accuracy</h3>
              <span className="font-mono text-3xl font-bold text-primary">
                {summary.accuracy}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
              <Pill label="Best" value={summary.counts.best} tone="bg-emerald-500/15 text-emerald-700" />
              <Pill label="Great" value={summary.counts.great} tone="bg-emerald-400/15 text-emerald-600" />
              <Pill label="Good" value={summary.counts.good} tone="bg-secondary text-foreground" />
              <Pill label="Inacc." value={summary.counts.inaccuracy} tone="bg-amber-500/15 text-amber-700" />
              <Pill label="Mistake" value={summary.counts.mistake} tone="bg-orange-500/15 text-orange-700" />
              <Pill label="Blunder" value={summary.counts.blunder} tone="bg-destructive/15 text-destructive" />
            </div>
          </div>
        )}

        {analysis && cursor >= 0 && analysis[cursor] && (
          <MoveDetail move={analysis[cursor]} />
        )}
      </div>

      <div className="space-y-4">
        <MoveHistory
          moves={
            analysis
              ? analysis.map((a) => ({
                  san: a.san,
                  quality: a.isUserMove ? a.quality : undefined,
                }))
              : positions.moves.map((m) => ({ san: m.san }))
          }
          activeIndex={cursor < 0 ? undefined : cursor}
          onSelect={(i) => setCursor(i)}
        />
      </div>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg px-2 py-2 ${tone}`}>
      <div className="font-mono text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-70">{label}</div>
    </div>
  );
}

function MoveDetail({ move }: { move: MoveAnalysis }) {
  const tone =
    move.quality === "blunder"
      ? "border-destructive/40 bg-destructive/5"
      : move.quality === "mistake"
        ? "border-orange-500/40 bg-orange-500/5"
        : move.quality === "inaccuracy"
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-success/40 bg-success/5";
  const labels: Record<MoveAnalysis["quality"], string> = {
    best: "Best move",
    great: "Great move !",
    good: "Good move",
    inaccuracy: "Inaccuracy ?!",
    mistake: "Mistake ?",
    blunder: "Blunder ??",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {move.isUserMove ? "Your move" : "Opponent move"}
          </p>
          <p className="font-mono text-xl font-bold">{move.san}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-muted-foreground">{labels[move.quality]}</p>
          {move.centipawnLoss > 0 && (
            <p className="font-mono text-sm">-{(move.centipawnLoss / 100).toFixed(1)}</p>
          )}
        </div>
      </div>
      {move.bestMove && move.quality !== "best" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Engine recommended: <span className="font-mono font-semibold">{move.bestMove}</span>
        </p>
      )}
    </div>
  );
}

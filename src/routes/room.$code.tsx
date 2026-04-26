import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { ChessBoardView } from "@/components/ChessBoardView";
import { MoveHistory } from "@/components/MoveHistory";
import { GameResultCard } from "@/components/GameResultCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Flag, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/room/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Room ${params.code} — Gambit` },
      { name: "description", content: "Live multiplayer chess room." },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  return (
    <Layout>
      <AuthGate>
        <RoomInner />
      </AuthGate>
    </Layout>
  );
}

type GameRow = {
  id: string;
  status: "waiting" | "active" | "finished" | "abandoned";
  white_player: string | null;
  black_player: string | null;
  fen: string;
  pgn: string;
  moves: { san: string; fen: string }[];
  result: "white_win" | "black_win" | "draw" | null;
  result_reason: string | null;
};

type Profile = { id: string; name: string; avatar_url: string | null; elo: number };

function RoomInner() {
  const { code } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<GameRow | null>(null);
  const [opponents, setOpponents] = useState<Record<string, Profile>>({});
  const [chess] = useState(() => new Chess());
  const [, setTick] = useState(0);
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

  /** Initial load + realtime subscription */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("games")
        .select("*")
        .eq("room_code", code)
        .eq("mode", "multiplayer")
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Room not found");
        navigate({ to: "/multiplayer" });
        return;
      }
      const g = data as unknown as GameRow;
      setRow(g);
      try {
        chess.loadPgn(g.pgn || "");
      } catch {
        chess.reset();
      }
      // Auto-join as black
      if (g.status === "waiting" && g.white_player !== user.id && !g.black_player) {
        const { error: jErr } = await supabase
          .from("games")
          .update({
            black_player: user.id,
            status: "active",
            black_elo_before: profile?.elo ?? 1200,
          })
          .eq("id", g.id);
        if (jErr) console.error(jErr);
      }
    };
    load();

    const channel = supabase
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `room_code=eq.${code}` },
        (payload) => {
          const g = payload.new as unknown as GameRow;
          setRow(g);
          try {
            chess.loadPgn(g.pgn || "");
            setTick((t) => t + 1);
          } catch {
            chess.reset();
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [code, user]);

  /** Load opponent profiles */
  useEffect(() => {
    const ids = [row?.white_player, row?.black_player].filter(Boolean) as string[];
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("id, name, avatar_url, elo")
      .in("id", ids)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, Profile> = {};
          for (const p of data) map[p.id] = p as Profile;
          setOpponents(map);
        }
      });
  }, [row?.white_player, row?.black_player]);

  const isWhite = row?.white_player === user?.id;
  const isBlack = row?.black_player === user?.id;
  const isParticipant = isWhite || isBlack;
  const orientation: "white" | "black" = isBlack ? "black" : "white";

  const myTurn =
    row?.status === "active" &&
    isParticipant &&
    ((chess.turn() === "w" && isWhite) || (chess.turn() === "b" && isBlack));

  /** Detect terminal */
  const checkOver = (): { result: "white_win" | "black_win" | "draw"; reason: string } | null => {
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
  };

  const finalize = async (res: { result: "white_win" | "black_win" | "draw"; reason: string }) => {
    if (!row || finalizingRef.current) return;
    finalizingRef.current = true;
    try {
      const { data, error } = await supabase.functions.invoke("finalize-game", {
        body: { game_id: row.id, result: res.result, reason: res.reason },
      });
      if (error) throw error;
      const outcome =
        res.result === "draw"
          ? "draw"
          : (isWhite && res.result === "white_win") || (isBlack && res.result === "black_win")
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
    }
  };

  const onDrop = (from: string, to: string) => {
    if (!row || !myTurn || result) return false;
    let move;
    try {
      move = chess.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;
    const fenAfter = chess.fen();
    const newMoves = [...(row.moves || []), { san: move.san, fen: fenAfter }];
    setTick((t) => t + 1);

    supabase
      .from("games")
      .update({ fen: fenAfter, pgn: chess.pgn(), moves: newMoves as unknown as never })
      .eq("id", row.id)
      .then(({ error }) => {
        if (error) {
          console.error(error);
          // rollback
          chess.undo();
          setTick((t) => t + 1);
          toast.error("Move rejected");
        }
      });

    const over = checkOver();
    if (over) finalize(over);
    return true;
  };

  const onResign = async () => {
    if (!row || !isParticipant || result) return;
    await finalize({
      result: isWhite ? "black_win" : "white_win",
      reason: "Resignation",
    });
  };

  const copyLink = () => {
    const url = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const moveItems = useMemo(
    () => (row?.moves ?? []).map((m) => ({ san: m.san })),
    [row?.moves],
  );

  const lastMoveHighlight = useMemo(() => {
    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    if (!last) return {};
    return {
      [last.from]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
      [last.to]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
    };
  }, [row?.fen, row?.moves?.length]);

  if (!row) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const whiteP = row.white_player ? opponents[row.white_player] : null;
  const blackP = row.black_player ? opponents[row.black_player] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* Top player (opponent if you're white, you if you're black) */}
        <PlayerStripe
          player={orientation === "white" ? blackP : whiteP}
          color={orientation === "white" ? "Black" : "White"}
          isYou={orientation === "white" ? isBlack : isWhite}
        />

        <ChessBoardView
          position={row.fen}
          orientation={orientation}
          onPieceDrop={onDrop}
          squareStyles={lastMoveHighlight}
          boardSkin={profile?.active_board_skin ?? "classic"}
          allowDragging={!!myTurn && !result}
        />

        <PlayerStripe
          player={orientation === "white" ? whiteP : blackP}
          color={orientation === "white" ? "White" : "Black"}
          isYou={orientation === "white" ? isWhite : isBlack}
        />

        {row.status === "waiting" && (
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Users className="h-4 w-4" />
              <strong>Waiting for opponent</strong>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Share this link or room code with a friend.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-background px-3 py-1.5 font-mono text-lg font-bold text-primary">
                {code}
              </code>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5" /> Copy link
              </Button>
            </div>
          </div>
        )}

        {result && (
          <GameResultCard
            outcome={result.outcome}
            reason={result.reason}
            eloDelta={result.elo_delta}
            newElo={result.new_elo}
            coinsEarned={result.coins_earned}
            newCoins={result.new_coins}
            moveBonus={result.move_bonus}
            analyzeHref={`/game/${row.id}`}
          />
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
          <div className="text-xs">
            <p className="text-muted-foreground">Room</p>
            <p className="font-mono font-bold">{code}</p>
          </div>
          {isParticipant && row.status === "active" && !result && (
            <Button variant="outline" size="sm" onClick={onResign}>
              <Flag className="h-4 w-4" /> Resign
            </Button>
          )}
        </div>
        <MoveHistory moves={moveItems} />
      </div>
    </div>
  );
}

function PlayerStripe({
  player,
  color,
  isYou,
}: {
  player: Profile | null;
  color: string;
  isYou: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        {player?.avatar_url ? (
          <img src={player.avatar_url} className="h-8 w-8 rounded-full" alt="" />
        ) : (
          <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-bold">
            {(player?.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold">
            {player?.name ?? "Waiting…"}
            {isYou && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {color} {player ? `· ${player.elo}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
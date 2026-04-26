import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { ChessBoardView } from "@/components/ChessBoardView";
import { MoveHistory } from "@/components/MoveHistory";
import { GameResultCard } from "@/components/GameResultCard";
import { ChessClock } from "@/components/ChessClock";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Flag, Users, Loader as Loader2, Handshake, X } from "lucide-react";
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
  status: "waiting" | "active" | "finished";
  white_player: string | null;
  black_player: string | null;
  fen: string;
  pgn: string;
  moves: { san: string; fen: string }[];
  result: "white_win" | "black_win" | "draw" | "aborted" | null;
  result_reason: string | null;
  time_control: string | null;
  time_limit_seconds: number | null;
  increment_seconds: number | null;
  white_time_ms: number | null;
  black_time_ms: number | null;
  last_move_at: string | null;
  draw_offered_by: "white" | "black" | null;
};

type Profile = { id: string; name: string; avatar_url: string | null; elo: number };

// Compute effective remaining time accounting for time elapsed since last move
function effectiveTimeMs(row: GameRow, side: "white" | "black", turnColor: string): number | null {
  const ms = side === "white" ? row.white_time_ms : row.black_time_ms;
  if (ms === null || ms === undefined) return null;
  // If it's this side's turn and game is active, subtract elapsed time since last move
  const isTurn = (side === "white" && turnColor === "w") || (side === "black" && turnColor === "b");
  if (isTurn && row.status === "active" && row.last_move_at) {
    const elapsed = Date.now() - new Date(row.last_move_at).getTime();
    return Math.max(0, ms - elapsed);
  }
  return ms;
}

function RoomInner() {
  const { code } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [row, setRow] = useState<GameRow | null>(null);
  const [opponents, setOpponents] = useState<Record<string, Profile>>({});
  const chessRef = useRef(new Chess());
  const [turnColor, setTurnColor] = useState<string>("w");
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
  const hasJoinedRef = useRef(false);

  const syncChess = useCallback((g: GameRow) => {
    const chess = chessRef.current;
    try {
      if (g.pgn) {
        chess.loadPgn(g.pgn);
      } else {
        chess.reset();
      }
    } catch {
      chess.reset();
    }
    setTurnColor(chess.turn());
  }, []);

  // Initial load + auto-join + realtime
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
      syncChess(g);

      // Auto-join as black if waiting and not creator
      if (
        g.status === "waiting" &&
        g.white_player !== user.id &&
        !g.black_player &&
        !hasJoinedRef.current
      ) {
        hasJoinedRef.current = true;
        const { error: jErr } = await supabase
          .from("games")
          .update({
            black_player: user.id,
            status: "active",
            black_elo_before: profile?.elo ?? 1200,
            last_move_at: new Date().toISOString(),
          })
          .eq("id", g.id);
        if (jErr) console.error("join error", jErr);
      }

      // If already finished, show result
      if (g.status === "finished" && g.result && !finalizingRef.current) {
        const isWhite = g.white_player === user.id;
        const isBlack = g.black_player === user.id;
        if (isWhite || isBlack) {
          const outcome =
            g.result === "draw"
              ? "draw"
              : (isWhite && g.result === "white_win") || (isBlack && g.result === "black_win")
                ? "win"
                : "loss";
          finalizingRef.current = true;
          setResult({
            outcome,
            reason: g.result_reason ?? "",
            elo_delta: 0,
            new_elo: profile?.elo ?? 1200,
            coins_earned: 0,
            new_coins: profile?.coins ?? 0,
            move_bonus: 0,
          });
        }
      }
    };

    load();

    const channel = supabase
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `room_code=eq.${code}` },
        (payload) => {
          if (cancelled) return;
          const g = payload.new as unknown as GameRow;
          setRow(g);
          syncChess(g);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [code, user, navigate, syncChess]);

  // Load opponent profiles whenever players change
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
    !result &&
    ((turnColor === "w" && isWhite) || (turnColor === "b" && isBlack));

  const checkOver = useCallback((): { result: "white_win" | "black_win" | "draw"; reason: string } | null => {
    const chess = chessRef.current;
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

  const finalize = useCallback(
    async (res: { result: "white_win" | "black_win" | "draw"; reason: string }) => {
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
        finalizingRef.current = false;
        toast.error("Could not finalize game");
      }
    },
    [row, isWhite, isBlack, profile],
  );

  const onDrop = useCallback(
    (from: string, to: string): boolean => {
      if (!row || !myTurn || result) return false;
      const chess = chessRef.current;
      let move;
      try {
        move = chess.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!move) return false;

      const fenAfter = chess.fen();
      const newMoves = [...(row.moves || []), { san: move.san, fen: fenAfter }];
      setTurnColor(chess.turn());

      // Compute new clock times
      const now = new Date().toISOString();
      const increment = (row.increment_seconds ?? 0) * 1000;
      let newWhiteMs = row.white_time_ms;
      let newBlackMs = row.black_time_ms;

      if (row.white_time_ms !== null && row.last_move_at) {
        const elapsed = Date.now() - new Date(row.last_move_at).getTime();
        if (isWhite) {
          newWhiteMs = Math.max(0, (row.white_time_ms ?? 0) - elapsed + increment);
        } else {
          newBlackMs = Math.max(0, (row.black_time_ms ?? 0) - elapsed + increment);
        }
      }

      supabase
        .from("games")
        .update({
          fen: fenAfter,
          pgn: chess.pgn(),
          moves: newMoves as unknown as never,
          last_move_at: now,
          white_time_ms: newWhiteMs,
          black_time_ms: newBlackMs,
          draw_offered_by: null, // reset draw offer on move
        })
        .eq("id", row.id)
        .then(({ error }) => {
          if (error) {
            console.error("move persist error", error);
            // rollback local chess state
            chess.undo();
            setTurnColor(chess.turn());
            toast.error("Move rejected — please try again");
          }
        });

      const over = checkOver();
      if (over) finalize(over);
      return true;
    },
    [row, myTurn, result, isWhite, checkOver, finalize],
  );

  const onResign = useCallback(async () => {
    if (!row || !isParticipant || result) return;
    await finalize({
      result: isWhite ? "black_win" : "white_win",
      reason: "Resignation",
    });
  }, [row, isParticipant, result, isWhite, finalize]);

  const onOfferDraw = useCallback(async () => {
    if (!row || !isParticipant || result) return;
    const side = isWhite ? "white" : "black";
    if (row.draw_offered_by === side) {
      toast("Draw already offered — waiting for opponent");
      return;
    }
    const { error } = await supabase
      .from("games")
      .update({ draw_offered_by: side, draw_offer_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) toast.error("Could not offer draw");
    else toast("Draw offered — waiting for opponent to respond");
  }, [row, isParticipant, result, isWhite]);

  const onAcceptDraw = useCallback(async () => {
    await finalize({ result: "draw", reason: "Draw by agreement" });
  }, [finalize]);

  const onDeclineDraw = useCallback(async () => {
    if (!row) return;
    await supabase
      .from("games")
      .update({ draw_offered_by: null, draw_offer_at: null })
      .eq("id", row.id);
    toast("Draw declined");
  }, [row]);

  const onTimeout = useCallback(
    (side: "white" | "black") => {
      if (!isParticipant || result || !row) return;
      const loser = side;
      finalize({
        result: loser === "white" ? "black_win" : "white_win",
        reason: "Timeout",
      });
    },
    [isParticipant, result, row, finalize],
  );

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
    const chess = chessRef.current;
    const history = chess.history({ verbose: true });
    const last = history[history.length - 1];
    if (!last) return {};
    return {
      [last.from]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
      [last.to]: { background: "color-mix(in oklab, var(--accent) 35%, transparent)" },
    };
  }, [turnColor, row?.moves?.length]);

  const hasClocks = row?.white_time_ms !== null && row?.white_time_ms !== undefined;
  const opponentSide: "white" | "black" = orientation === "white" ? "black" : "white";

  // Draw offer banner: shown to the player who RECEIVED the offer
  const mySide = isWhite ? "white" : "black";
  const oppSide = isWhite ? "black" : "white";
  const drawOfferedByOpponent = row?.draw_offered_by === oppSide;
  const drawOfferedByMe = row?.draw_offered_by === mySide;

  if (!row) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const whiteP = row.white_player ? opponents[row.white_player] : null;
  const blackP = row.black_player ? opponents[row.black_player] : null;
  const topPlayer = orientation === "white" ? blackP : whiteP;
  const bottomPlayer = orientation === "white" ? whiteP : blackP;
  const topColor = orientation === "white" ? "black" : "white";
  const bottomColor = orientation === "white" ? "white" : "black";
  const topMs = row ? effectiveTimeMs(row, opponentSide, turnColor) : null;
  const bottomMs = row ? effectiveTimeMs(row, orientation, turnColor) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {/* Top player */}
        <div className="flex items-center justify-between gap-3">
          <PlayerStripe
            player={topPlayer}
            color={topColor}
            isYou={isParticipant && topColor === orientation ? false : topColor !== orientation}
          />
          {hasClocks && topMs !== null && (
            <ChessClock
              initialMs={topMs}
              active={row.status === "active" && !result && turnColor === (opponentSide === "white" ? "w" : "b")}
              onTimeout={() => {
                // Only the active player triggers timeout (prevents double-call)
                if (myTurn) return; // it's NOT my turn so opponent timed out
                onTimeout(opponentSide);
              }}
            />
          )}
        </div>

        {/* Draw offer banner */}
        {drawOfferedByOpponent && !result && (
          <div className="flex items-center justify-between rounded-xl border border-accent/50 bg-accent/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Handshake className="h-4 w-4 text-accent" />
              Opponent offers a draw
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={onAcceptDraw}>Accept</Button>
              <Button size="sm" variant="outline" onClick={onDeclineDraw}>
                <X className="h-3.5 w-3.5" /> Decline
              </Button>
            </div>
          </div>
        )}
        {drawOfferedByMe && !result && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            <Handshake className="h-4 w-4" />
            Draw offered — waiting for opponent…
          </div>
        )}

        <ChessBoardView
          position={row.fen}
          orientation={orientation}
          onPieceDrop={onDrop}
          squareStyles={lastMoveHighlight}
          boardSkin={profile?.active_board_skin ?? "classic"}
          allowDragging={!!myTurn && !result}
        />

        {/* Bottom player */}
        <div className="flex items-center justify-between gap-3">
          <PlayerStripe
            player={bottomPlayer}
            color={bottomColor}
            isYou={isParticipant}
          />
          {hasClocks && bottomMs !== null && (
            <ChessClock
              initialMs={bottomMs}
              active={row.status === "active" && !result && turnColor === (orientation === "white" ? "w" : "b")}
              onTimeout={() => {
                if (!myTurn) return; // it IS my turn so I timed out
                onTimeout(orientation);
              }}
            />
          )}
        </div>

        {/* Waiting for opponent */}
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
        {/* Controls */}
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
          <div className="text-xs">
            <p className="text-muted-foreground">Room</p>
            <p className="font-mono font-bold">{code}</p>
            {row.time_control && row.time_control !== "unlimited" && (
              <p className="text-muted-foreground capitalize">{row.time_control}</p>
            )}
          </div>
          {isParticipant && row.status === "active" && !result && (
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" onClick={onResign}>
                <Flag className="h-4 w-4" /> Resign
              </Button>
              {!drawOfferedByMe && (
                <Button variant="ghost" size="sm" onClick={onOfferDraw}>
                  <Handshake className="h-4 w-4" /> Draw
                </Button>
              )}
            </div>
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
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
      {player?.avatar_url ? (
        <img src={player.avatar_url} className="h-8 w-8 shrink-0 rounded-full object-cover" alt="" />
      ) : (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
          {(player?.name ?? "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {player?.name ?? "Waiting…"}
          {isYou && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {color.charAt(0).toUpperCase() + color.slice(1)}
          {player ? ` · ${player.elo}` : ""}
        </p>
      </div>
    </div>
  );
}

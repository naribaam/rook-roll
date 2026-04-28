
import Link from "@/lib/next-compat";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Coins, Trophy, Swords, Crown, Bot, Users } from "lucide-react";

export default function ProfilePage() {
  return (
    <Layout>
      <AuthGate>
        <Inner />
      </AuthGate>
    </Layout>
  );
}

type GameRow = {
  id: string;
  mode: "ai" | "multiplayer";
  status: string;
  result: "white_win" | "black_win" | "draw" | null;
  white_player: string | null;
  black_player: string | null;
  white_elo_after: number | null;
  black_elo_after: number | null;
  finished_at: string | null;
  created_at: string;
};

function Inner() {
  const { user, profile } = useAuth();
  const [games, setGames] = useState<GameRow[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("games")
      .select(
        "id, mode, status, result, white_player, black_player, white_elo_after, black_elo_after, finished_at, created_at",
      )
      .or(`white_player.eq.${user.id},black_player.eq.${user.id}`)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setGames((data ?? []) as GameRow[]));
  }, [user]);

  if (!profile) return null;

  const winRate =
    profile.games_played > 0
      ? Math.round((profile.games_won / profile.games_played) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-[image:var(--gradient-hero)] p-8 text-primary-foreground shadow-[var(--shadow-elegant)]">
        <div className="flex flex-wrap items-center gap-6">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.name}
              className="h-20 w-20 rounded-2xl object-cover ring-4 ring-white/20"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-2xl font-bold">
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.name}</h1>
            <p className="text-sm opacity-80">{profile.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={<Trophy className="h-4 w-4" />} label="ELO" value={profile.elo} />
            <Stat icon={<Coins className="h-4 w-4" />} label="Coins" value={profile.coins} />
            <Stat icon={<Swords className="h-4 w-4" />} label="Games" value={profile.games_played} />
            <Stat icon={<Crown className="h-4 w-4" />} label="Win %" value={`${winRate}%`} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ResultCount label="Wins" value={profile.games_won} tone="text-success" />
        <ResultCount label="Draws" value={profile.games_drawn} tone="text-accent" />
        <ResultCount label="Losses" value={profile.games_lost} tone="text-destructive" />
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold">Recent games</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {games.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No finished games yet —{" "}
              <Link href="/play" className="text-primary underline">
                play one
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {games.map((g) => {
                const isWhite = g.white_player === user?.id;
                const youWon =
                  (isWhite && g.result === "white_win") ||
                  (!isWhite && g.result === "black_win");
                const draw = g.result === "draw";
                const tone = draw
                  ? "text-accent"
                  : youWon
                    ? "text-success"
                    : "text-destructive";
                const label = draw ? "Draw" : youWon ? "Win" : "Loss";
                return (
                  <li key={g.id}>
                    <Link
                      href={`/game/${g.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-secondary/40"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                        {g.mode === "ai" ? <Bot className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {g.mode === "ai" ? "vs Stockfish" : "Multiplayer"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(g.finished_at ?? g.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`font-semibold ${tone}`}>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
      <div className="mb-1 flex items-center gap-1 text-[11px] uppercase opacity-70">
        {icon}
        {label}
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  );
}

function ResultCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-mono text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

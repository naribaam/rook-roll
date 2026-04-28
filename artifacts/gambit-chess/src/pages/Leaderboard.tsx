
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Crown, Medal } from "lucide-react";

type Row = {
  id: string;
  name: string;
  avatar_url: string | null;
  elo: number;
  games_played: number;
  games_won: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, name, avatar_url, elo, games_played, games_won")
      .order("elo", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[image:var(--gradient-gold)] text-accent-foreground shadow-md">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Top 100 players by ELO</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No players yet — be the first!</div>
          ) : (
            <ol>
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  className={`grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
                    i < 3 ? "bg-secondary/30" : ""
                  }`}
                >
                  <RankBadge rank={i + 1} />
                  <div className="flex items-center gap-3 min-w-0">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-sm font-bold">
                        {r.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.games_won}W · {r.games_played} games
                      </p>
                    </div>
                  </div>
                  <div className="font-mono text-lg font-bold text-primary">{r.elo}</div>
                  <div className="text-xs text-muted-foreground">ELO</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Layout>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[image:var(--gradient-gold)] text-accent-foreground">
        <Crown className="h-4 w-4" />
      </span>
    );
  if (rank === 2)
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground">
        <Medal className="h-4 w-4" />
      </span>
    );
  if (rank === 3)
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-muted-foreground">
        <Medal className="h-4 w-4" />
      </span>
    );
  return (
    <span className="text-center font-mono text-sm font-bold text-muted-foreground">#{rank}</span>
  );
}

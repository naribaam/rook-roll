"use client";

import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Sparkles, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

type TimeControl = {
  id: string;
  label: string;
  category: string;
  limitSeconds: number;
  incrementSeconds: number;
};

const TIME_CONTROLS: TimeControl[] = [
  { id: "unlimited", label: "Unlimited", category: "unlimited", limitSeconds: 0, incrementSeconds: 0 },
  { id: "bullet_1", label: "1+0", category: "bullet", limitSeconds: 60, incrementSeconds: 0 },
  { id: "bullet_2_1", label: "2+1", category: "bullet", limitSeconds: 120, incrementSeconds: 1 },
  { id: "blitz_3", label: "3+0", category: "blitz", limitSeconds: 180, incrementSeconds: 0 },
  { id: "blitz_3_2", label: "3+2", category: "blitz", limitSeconds: 180, incrementSeconds: 2 },
  { id: "blitz_5", label: "5+0", category: "blitz", limitSeconds: 300, incrementSeconds: 0 },
  { id: "rapid_10", label: "10+0", category: "rapid", limitSeconds: 600, incrementSeconds: 0 },
  { id: "rapid_10_5", label: "10+5", category: "rapid", limitSeconds: 600, incrementSeconds: 5 },
  { id: "classical_15", label: "15+10", category: "classical", limitSeconds: 900, incrementSeconds: 10 },
];

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function MultiplayerPage() {
  return (
    <Layout>
      <AuthGate>
        <Inner />
      </AuthGate>
    </Layout>
  );
}

function Inner() {
  const { user, profile } = useAuth();
  const navigate = useRouter();
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [selectedTc, setSelectedTc] = useState<string>("blitz_5");

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const code = makeRoomCode();
      const tc = TIME_CONTROLS.find((t) => t.id === selectedTc) ?? TIME_CONTROLS[0];
      const isUnlimited = tc.category === "unlimited";
      const initialMs = isUnlimited ? null : tc.limitSeconds * 1000;

      const { data, error } = await supabase
        .from("games")
        .insert({
          mode: "multiplayer",
          status: "waiting",
          white_player: user.id,
          black_player: null,
          room_code: code,
          created_by: user.id,
          white_elo_before: profile?.elo ?? 1200,
          time_control: tc.category,
          time_limit_seconds: isUnlimited ? null : tc.limitSeconds,
          increment_seconds: tc.incrementSeconds,
          white_time_ms: initialMs,
          black_time_ms: initialMs,
        })
        .select()
        .single();

      if (error || !data) throw error;
      navigate.push(`/room/${data.room_code}`);
    } catch (e) {
      console.error(e);
      toast.error("Could not create room");
    } finally {
      setCreating(false);
    }
  };

  const join = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    try {
      const { data: g } = await supabase
        .from("games")
        .select("id, room_code, status")
        .eq("room_code", code)
        .eq("mode", "multiplayer")
        .maybeSingle();
      if (!g) {
        toast.error("Room not found");
        return;
      }
      navigate.push(`/room/${code}`);
    } finally {
      setJoining(false);
    }
  };

  const grouped = TIME_CONTROLS.reduce<Record<string, TimeControl[]>>((acc, tc) => {
    if (!acc[tc.category]) acc[tc.category] = [];
    acc[tc.category].push(tc);
    return acc;
  }, {});

  const categoryLabel: Record<string, string> = {
    unlimited: "Unlimited",
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    classical: "Classical",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Plus className="h-5 w-5" />
          <h2 className="text-lg font-bold">Create a room</h2>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Time control
          </div>
          <div className="space-y-3">
            {Object.entries(grouped).map(([cat, controls]) => (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {categoryLabel[cat] ?? cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {controls.map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => setSelectedTc(tc.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-all ${
                        selectedTc === tc.id
                          ? "border-primary bg-primary/10 text-primary shadow-[var(--shadow-glow)]"
                          : "border-border bg-secondary/40 hover:border-primary/40"
                      }`}
                    >
                      {tc.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          You play White. First to join gets Black.
        </p>
        <Button variant="hero" size="lg" className="w-full" onClick={create} disabled={creating}>
          <Sparkles className="h-4 w-4" />
          {creating ? "Creating…" : "Create room"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-bold">Join with code</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter a 6-character room code from your friend.
        </p>
        <div className="flex gap-2">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="ABC123"
            maxLength={6}
            className="font-mono uppercase"
          />
          <Button onClick={join} disabled={joining || joinCode.length < 4}>
            Join
          </Button>
        </div>
      </div>
    </div>
  );
}

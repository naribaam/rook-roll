import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Users, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/multiplayer")({
  head: () => ({
    meta: [
      { title: "Multiplayer — Gambit" },
      { name: "description", content: "Create a private chess room and play live with a friend." },
    ],
  }),
  component: MultiplayerLobby,
});

function MultiplayerLobby() {
  return (
    <Layout>
      <AuthGate>
        <Inner />
      </AuthGate>
    </Layout>
  );
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function Inner() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const code = makeRoomCode();
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
        })
        .select()
        .single();
      if (error || !data) throw error;
      navigate({ to: `/room/${data.room_code}` });
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
      navigate({ to: `/room/${code}` });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Plus className="h-5 w-5" />
          <h2 className="text-lg font-bold">Create a room</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          You'll get a shareable link. First to join plays Black.
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
            onChange={(e) => setJoinCode(e.target.value)}
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
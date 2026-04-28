"use client";

import Link from "next/link";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  Bot,
  Users,
  Trophy,
  ShoppingBag,
  Crown,
  Sparkles,
  Zap,
  ShieldCheck,
} from "lucide-react";

export default function HomePage() {
  const { user, signInWithGoogle } = useAuth();
  return (
    <Layout>
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-[image:var(--gradient-hero)] px-6 py-16 text-primary-foreground shadow-[var(--shadow-elegant)] md:px-16 md:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-conic-gradient(currentColor 0% 25%, transparent 25% 50%)",
            backgroundSize: "120px 120px",
          }}
        />
        <div className="relative max-w-2xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Now in open beta
          </span>
          <h1 className="mb-4 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Play chess. Earn coins.
            <br />
            Climb the ranks.
          </h1>
          <p className="mb-8 max-w-lg text-base/relaxed text-primary-foreground/90 md:text-lg">
            A real-time chess platform with AI training, live multiplayer,
            global ELO and a cosmetic store fueled by your wins.
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <>
                <Link href="/play">
                  <Button variant="gold" size="xl">
                    <Bot className="h-5 w-5" /> Play vs AI
                  </Button>
                </Link>
                <Link href="/multiplayer">
                  <Button
                    size="xl"
                    variant="outline"
                    className="border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20"
                  >
                    <Users className="h-5 w-5" /> Multiplayer
                  </Button>
                </Link>
              </>
            ) : (
              <Button variant="gold" size="xl" onClick={() => signInWithGoogle()}>
                <Crown className="h-5 w-5" /> Start playing — free
              </Button>
            )}
          </div>
          <p className="mt-4 text-xs text-primary-foreground/70">
            Sign in with Google or email • 200 coins on signup
          </p>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={<Bot className="h-5 w-5" />}
          title="AI training"
          desc="Stockfish 18 in your browser. 20 difficulty levels."
          href="/play"
        />
        <FeatureCard
          icon={<Users className="h-5 w-5" />}
          title="Live multiplayer"
          desc="Create a room, share the link, play real-time."
          href="/multiplayer"
        />
        <FeatureCard
          icon={<Trophy className="h-5 w-5" />}
          title="Global ELO"
          desc="Standard rating, tracked across every game you play."
          href="/leaderboard"
        />
        <FeatureCard
          icon={<ShoppingBag className="h-5 w-5" />}
          title="Cosmetic store"
          desc="Unlock premium boards & pieces with your earnings."
          href="/store"
        />
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-16 grid gap-6 md:grid-cols-3">
        <HowCard
          n="1"
          icon={<Crown className="h-5 w-5" />}
          title="Create an account"
          desc="Get 200 coins as a welcome bonus. No card required."
        />
        <HowCard
          n="2"
          icon={<Zap className="h-5 w-5" />}
          title="Play and earn"
          desc="Win +100 coins, draw +50, plus bonuses for accurate play."
        />
        <HowCard
          n="3"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Climb & customize"
          desc="Rise on the global leaderboard and unlock premium cosmetics."
        />
      </section>
    </Layout>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]"
    >
      <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </span>
      <h3 className="mb-1 text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

function HowCard({
  n,
  icon,
  title,
  desc,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {n}
        </span>
        <span className="text-primary">{icon}</span>
      </div>
      <h3 className="mb-1 text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

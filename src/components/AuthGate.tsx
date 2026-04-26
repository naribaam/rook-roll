import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signInWithGoogle } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <Crown className="h-8 w-8" />
        </span>
        <h2 className="mb-2 text-2xl font-bold">Sign in to play</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Connect with Google to start playing, earning coins and climbing the leaderboard.
        </p>
        <Button variant="hero" size="lg" onClick={() => signInWithGoogle()}>
          Sign in with Google
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}

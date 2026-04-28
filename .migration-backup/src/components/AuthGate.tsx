"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Mail, CircleAlert as AlertCircle } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, authError, signInWithGoogle, signInWithEmail, signUpWithEmail, clearAuthError } = useAuth();
  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          Create an account to start playing, earning coins and climbing the leaderboard.
        </p>

        {authError && (
          <div className="mb-4 flex w-full items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{authError.message}</span>
          </div>
        )}

        {mode === "choose" && (
          <div className="flex w-full flex-col gap-3">
            <Button
              variant="hero"
              size="lg"
              onClick={() => signInWithGoogle()}
            >
              Sign in with Google
            </Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => { clearAuthError(); setMode("email"); }}
            >
              <Mail className="h-4 w-4" />
              Sign in with email
            </Button>
          </div>
        )}

        {mode === "email" && (
          <form
            className="w-full space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              await signInWithEmail(email, password);
              setSubmitting(false);
            }}
          >
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
            />
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                await signUpWithEmail(email, password);
                setSubmitting(false);
              }}
            >
              Create account
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => { clearAuthError(); setMode("choose"); }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

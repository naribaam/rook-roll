
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Mail, CircleAlert as AlertCircle } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    authError,
    oauthDisabled,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    clearAuthError,
  } = useAuth();
  // When OAuth isn't configured we always start in email mode and never
  // expose the Google button — the only working sign-in is email/password.
  const [mode, setMode] = useState<"choose" | "email">(
    oauthDisabled ? "email" : "choose",
  );
  const [intent, setIntent] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If we discover OAuth is unavailable mid-session, snap to email mode.
  useEffect(() => {
    if (oauthDisabled && mode === "choose") setMode("email");
  }, [oauthDisabled, mode]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    const isInfoNotice =
      authError?.message?.startsWith("Account created") ?? false;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
          <Crown className="h-8 w-8" />
        </span>
        <h2 className="mb-2 text-2xl font-bold">
          {intent === "signup" ? "Create your account" : "Sign in to play"}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {intent === "signup"
            ? "Free, 200 starting coins, no card required."
            : "Sign in to start playing, earning coins and climbing the leaderboard."}
        </p>

        {authError && (
          <div
            className={`mb-4 flex w-full items-start gap-2 rounded-lg border px-4 py-3 text-left text-sm ${
              isInfoNotice
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{authError.message}</span>
          </div>
        )}

        {mode === "choose" && !oauthDisabled && (
          <div className="flex w-full flex-col gap-3">
            <Button variant="hero" size="lg" onClick={() => signInWithGoogle()}>
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
              onClick={() => {
                clearAuthError();
                setMode("email");
              }}
            >
              <Mail className="h-4 w-4" />
              Sign in with email
            </Button>
          </div>
        )}

        {mode === "email" && (
          <form
            className="w-full space-y-3 text-left"
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              setSubmitting(true);
              if (intent === "signup") {
                await signUpWithEmail(email, password);
              } else {
                await signInWithEmail(email, password);
              }
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
              placeholder="Password (6+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={intent === "signup" ? "new-password" : "current-password"}
              minLength={6}
            />
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting
                ? intent === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : intent === "signup"
                  ? "Create account"
                  : "Sign in"}
            </Button>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => {
                  clearAuthError();
                  setIntent((i) => (i === "signin" ? "signup" : "signin"));
                }}
              >
                {intent === "signin"
                  ? "New here? Create an account"
                  : "Already have an account? Sign in"}
              </button>
              {!oauthDisabled && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => {
                    clearAuthError();
                    setMode("choose");
                  }}
                >
                  Back
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

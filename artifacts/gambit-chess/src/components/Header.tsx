
import { useState } from "react";
import Link from "@/lib/next-compat";
import { usePathname, useRouter } from "@/lib/next-compat";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Coins, Trophy, LogOut, User as UserIcon, Crown, Mail, CircleAlert as AlertCircle } from "lucide-react";

export function Header() {
  const { user, profile, authError, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, clearAuthError } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await signInWithEmail(email, password);
    setSubmitting(false);
    if (!authError) setAuthOpen(false);
  };

  const handleEmailSignUp = async () => {
    setSubmitting(true);
    await signUpWithEmail(email, password);
    setSubmitting(false);
    if (!authError) setAuthOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
            <Crown className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">
            Gambit<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/play" active={pathname === "/play"}>Play</NavLink>
          <NavLink href="/multiplayer" active={pathname === "/multiplayer"}>Multiplayer</NavLink>
          <NavLink href="/leaderboard" active={pathname === "/leaderboard"}>Leaderboard</NavLink>
          <NavLink href="/store" active={pathname === "/store"}>Store</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {user && profile ? (
            <>
              <div className="hidden items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground sm:flex">
                <Trophy className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono">{profile.elo}</span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-[image:var(--gradient-gold)] px-3 py-1.5 text-xs font-bold text-accent-foreground shadow-sm">
                <Coins className="h-3.5 w-3.5" />
                <span className="font-mono">{profile.coins}</span>
              </div>
              <Link href="/profile">
                <Button size="icon" variant="ghost" aria-label="Profile">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </Button>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  await signOut();
                  router.push("/");
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Dialog open={authOpen} onOpenChange={(open) => { setAuthOpen(open); if (!open) { clearAuthError(); setAuthMode("choose"); } }}>
              <DialogTrigger asChild>
                <Button variant="hero" size="sm">
                  Sign in
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Sign in to Gambit</DialogTitle>
                </DialogHeader>

                {authError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{authError.message}</span>
                  </div>
                )}

                {authMode === "choose" && (
                  <div className="space-y-3">
                    <Button
                      variant="hero"
                      size="lg"
                      className="w-full"
                      onClick={async () => {
                        await signInWithGoogle();
                      }}
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
                      className="w-full"
                      onClick={() => { clearAuthError(); setAuthMode("email"); }}
                    >
                      <Mail className="h-4 w-4" />
                      Sign in with email
                    </Button>
                  </div>
                )}

                {authMode === "email" && (
                  <form className="space-y-3" onSubmit={handleEmailSignIn}>
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
                      onClick={handleEmailSignUp}
                    >
                      Create account
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => { clearAuthError(); setAuthMode("choose"); }}
                    >
                      Back
                    </button>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
        <NavLink href="/play" active={pathname === "/play"}>Play</NavLink>
        <NavLink href="/multiplayer" active={pathname === "/multiplayer"}>Multiplayer</NavLink>
        <NavLink href="/leaderboard" active={pathname === "/leaderboard"}>Top</NavLink>
        <NavLink href="/store" active={pathname === "/store"}>Store</NavLink>
        <NavLink href="/profile" active={pathname === "/profile"}>Profile</NavLink>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-foreground ${
        active ? "bg-secondary text-foreground" : "text-muted-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

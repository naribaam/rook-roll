import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Coins, Trophy, LogOut, User as UserIcon, Crown } from "lucide-react";

export function Header() {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-glow)]">
            <Crown className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">
            Gambit<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/play">Play</NavLink>
          <NavLink to="/multiplayer">Multiplayer</NavLink>
          <NavLink to="/leaderboard">Leaderboard</NavLink>
          <NavLink to="/store">Store</NavLink>
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
              <Link to="/profile">
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
                  navigate({ to: "/" });
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Button
              variant="hero"
              size="sm"
              onClick={() => signInWithGoogle()}
            >
              Sign in with Google
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
        <NavLink to="/play">Play</NavLink>
        <NavLink to="/multiplayer">Multiplayer</NavLink>
        <NavLink to="/leaderboard">Top</NavLink>
        <NavLink to="/store">Store</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{
        className:
          "rounded-md px-3 py-1.5 text-sm font-medium bg-secondary text-foreground",
      }}
    >
      {children}
    </Link>
  );
}

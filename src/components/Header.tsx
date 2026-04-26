"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Coins, Trophy, LogOut, User as UserIcon, Crown } from "lucide-react";

export function Header() {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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

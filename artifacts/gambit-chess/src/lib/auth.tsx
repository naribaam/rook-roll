
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  name: string;
  avatar_url: string | null;
  coins: number;
  elo: number;
  active_piece_skin: string;
  active_board_skin: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_drawn: number;
};

type AuthErrorInfo = {
  message: string;
  code?: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authError: AuthErrorInfo | null;
  /** True when the Supabase project doesn't have Google OAuth configured.
   * Detected lazily after the first failed sign-in attempt and cached for
   * the rest of the session so we hide the button instead of dead-ending. */
  oauthDisabled: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const OAUTH_DISABLED_KEY = "gambit:oauth-disabled";

function isUnsupportedProviderError(error: AuthError): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("unsupported provider") ||
    msg.includes("missing oauth secret") ||
    msg.includes("provider is not enabled") ||
    msg.includes("oauth provider")
  );
}

function toAuthError(error: AuthError): AuthErrorInfo {
  const msg = error.message?.toLowerCase() ?? "";
  if (isUnsupportedProviderError(error)) {
    return {
      message: "Google sign-in isn't configured for this app yet — please use email instead.",
      code: error.status?.toString(),
    };
  }
  if (msg.includes("invalid login credentials")) {
    return { message: "Invalid email or password", code: error.status?.toString() };
  }
  if (msg.includes("user already registered")) {
    return { message: "An account with this email already exists — try signing in.", code: error.status?.toString() };
  }
  if (msg.includes("email not confirmed")) {
    return { message: "Please check your email to confirm your account", code: error.status?.toString() };
  }
  if (msg.includes("password should be") || msg.includes("password is too short")) {
    return { message: "Password must be at least 6 characters", code: error.status?.toString() };
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return { message: "Too many attempts — please wait a moment and try again.", code: error.status?.toString() };
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return { message: "Network error — please check your connection", code: error.status?.toString() };
  }
  return { message: error.message || "Authentication failed", code: error.status?.toString() };
}

async function ensureProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("fetchProfile error", error);
    return null;
  }

  if (data) return data as Profile;

  const meta = user.user_metadata ?? {};
  const name = meta.full_name || meta.name || user.email?.split("@")[0] || "Player";
  const avatarUrl = meta.avatar_url || meta.picture || null;

  const { data: newProfile, error: insertErr } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email,
      name,
      avatar_url: avatarUrl,
    })
    .select()
    .maybeSingle();

  if (insertErr) {
    console.error("createProfile error", insertErr);
    return null;
  }

  return newProfile as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const [oauthDisabled, setOauthDisabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(OAUTH_DISABLED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          ensureProfile(s.user).then(setProfile);
        }, 0);
        if (event === "SIGNED_IN") {
          const path = window.location.pathname;
          const validRoutes = ["/", "/play", "/multiplayer", "/leaderboard", "/store", "/profile"];
          const isValid = validRoutes.some(
            (r) => path === r || path.startsWith("/game/") || path.startsWith("/room/"),
          );
          if (!isValid) {
            window.location.replace("/");
          }
        }
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        ensureProfile(s.user).then((p) => {
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          setProfile(payload.new as Profile);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markOauthDisabled = useCallback(() => {
    setOauthDisabled(true);
    try {
      window.sessionStorage.setItem(OAUTH_DISABLED_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (oauthDisabled) {
      setAuthError({
        message: "Google sign-in isn't configured for this app — please use email instead.",
      });
      return;
    }
    try {
      // Step 1: ask Supabase to build the OAuth authorize URL but don't
      // navigate to it yet — we want to probe it first so we can fail
      // gracefully if the provider isn't configured (otherwise the user
      // would be redirected to a raw JSON error page).
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        if (isUnsupportedProviderError(error)) markOauthDisabled();
        setAuthError(toAuthError(error));
        return;
      }
      const url = data?.url;
      if (!url) {
        setAuthError({ message: "Could not start Google sign-in." });
        return;
      }

      // Step 2: probe the URL. Configured providers respond with a 302
      // redirect to Google (browsers surface this as an opaque redirect,
      // status 0). Unconfigured providers respond with a 400 + JSON error.
      try {
        const probe = await fetch(url, { redirect: "manual" });
        if (probe.type !== "opaqueredirect" && probe.status === 400) {
          let body = "";
          try {
            body = await probe.text();
          } catch {
            /* CORS-blocked, but status 400 is enough signal */
          }
          if (
            !body ||
            body.toLowerCase().includes("unsupported provider") ||
            body.toLowerCase().includes("missing oauth secret") ||
            body.toLowerCase().includes("provider is not enabled")
          ) {
            markOauthDisabled();
            setAuthError({
              message:
                "Google sign-in isn't configured for this app yet — please use email instead.",
            });
            return;
          }
        }
      } catch {
        /* network/CORS error — fall through and try the redirect anyway */
      }

      // Step 3: redirect the user to complete OAuth.
      window.location.href = url;
    } catch (err) {
      setAuthError({
        message: err instanceof Error ? err.message : "Google sign-in failed",
      });
    }
  }, [oauthDisabled, markOauthDisabled]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setAuthError(toAuthError(error));
    } catch (err) {
      setAuthError({
        message: err instanceof Error ? err.message : "Sign-in failed",
      });
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        setAuthError(toAuthError(error));
        return;
      }
      // If email confirmation is required, signUp returns a user but no session.
      if (data.user && !data.session) {
        setAuthError({
          message: "Account created — check your email for a confirmation link before signing in.",
        });
      }
    } catch (err) {
      setAuthError({
        message: err instanceof Error ? err.message : "Sign-up failed",
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await ensureProfile(user);
      setProfile(p);
    }
  }, [user]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        authError,
        oauthDisabled,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

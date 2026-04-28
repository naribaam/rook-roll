"use client";

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
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toAuthError(error: AuthError): AuthErrorInfo {
  const msg = error.message?.toLowerCase() ?? "";
  if (msg.includes("invalid login credentials")) {
    return { message: "Invalid email or password", code: error.status?.toString() };
  }
  if (msg.includes("user already registered")) {
    return { message: "An account with this email already exists", code: error.status?.toString() };
  }
  if (msg.includes("email not confirmed")) {
    return { message: "Please check your email to confirm your account", code: error.status?.toString() };
  }
  if (msg.includes("password should be")) {
    return { message: "Password must be at least 6 characters", code: error.status?.toString() };
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

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setAuthError(toAuthError(error));
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(toAuthError(error));
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(toAuthError(error));
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

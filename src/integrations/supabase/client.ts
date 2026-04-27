import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Lovable Cloud injects credentials into the .env file using VITE_ prefixes.
// Next.js only exposes vars to the browser when they start with NEXT_PUBLIC_.
// We accept both, plus a hard-coded fallback to the project's publishable
// values so production deployments never start up "blank".
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://yjybqjszpioblsvlgfer.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeWJxanN6cGlvYmxzdmxnZmVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDc5NDUsImV4cCI6MjA5Mjc4Mzk0NX0.slSvBogMPnx2mWuXcSXCDRvHLhgkZxhulboaZfO1Iw8";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

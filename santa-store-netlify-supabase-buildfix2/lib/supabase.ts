import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase environment variables are not configured.");
}

// Keep one browser client with a durable session and automatic token refresh.
// Supabase stores the session in localStorage by default; making these settings
// explicit prevents future client configuration changes from disabling it.
export const supabase = createClient(
  supabaseUrl ?? "http://127.0.0.1:54321",
  supabaseKey ?? "missing-supabase-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

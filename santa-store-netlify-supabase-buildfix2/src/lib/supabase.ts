import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Keep builds working without Supabase credentials; API calls will fail clearly at runtime.
  console.warn("Supabase environment variables are not configured.");
}

export const supabase = createClient(
  supabaseUrl ?? "http://127.0.0.1:54321",
  supabaseKey ?? "missing-supabase-key"
);

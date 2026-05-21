import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Returns a lazily-initialised Supabase client using the service-role key.
 * The service-role key bypasses RLS — appropriate for all server-side operations.
 * Never expose this client or key to the browser.
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  // Prefer service-role key so RLS is bypassed server-side (per migration 003_rls.sql).
  // Fall back to anon key for local dev environments that haven't set the service key yet.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

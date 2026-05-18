import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Returns a lazily-initialised Supabase client.
 * Reads SUPABASE_URL and SUPABASE_ANON_KEY from the environment.
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

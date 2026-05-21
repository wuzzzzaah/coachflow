import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}));

import { createClient } from '@supabase/supabase-js';

describe('supabase() — key preference', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset module cache so the singleton is cleared between tests
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses SUPABASE_SERVICE_ROLE_KEY when available', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    // Re-import the module after resetting so the singleton re-initialises
    const { supabase } = await import('../supabaseClient');
    supabase();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-key',
      expect.any(Object),
    );
  });

  it('falls back to SUPABASE_ANON_KEY when service-role key is absent', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_ANON_KEY = 'anon-key';

    const { supabase } = await import('../supabaseClient');
    supabase();

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.any(Object),
    );
  });

  it('throws when neither key nor URL is set', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    const { supabase } = await import('../supabaseClient');
    expect(() => supabase()).toThrow();
  });

  it('disables persistSession and autoRefreshToken for server-side use', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const { supabase } = await import('../supabaseClient');
    supabase();

    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      }),
    );
  });
});

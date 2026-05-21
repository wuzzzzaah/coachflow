/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/supabaseClient', () => ({
  supabase: vi.fn(),
}));

import { supabase } from '../../db/supabaseClient';
import { requireLearner } from '../learnerAuth';
import type { Request, Response, NextFunction } from 'express';

// ── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_ID = 'auth-uuid-001';
const TENANT_ID = 'tenant-abc';
const DB_USER_ID = 'db-user-uuid-001';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { authorization: 'Bearer valid-token' },
    query: { tenantId: TENANT_ID },
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): {
  res: Response;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const next: NextFunction = vi.fn();

/** Build a minimal Supabase chain mock that supports .from().select().eq().eq().maybeSingle() */
function makeDb({
  authUser = { id: AUTH_ID, email: 'test@example.com' },
  authError = null,
  userByLearnerId = null,
  userByEmail = null,
  insertResult = {
    data: { id: DB_USER_ID, tenant_id: TENANT_ID, learner_id: AUTH_ID, email: 'test@example.com' },
    error: null,
  },
}: {
  authUser?: { id: string; email?: string } | null;
  authError?: unknown;
  userByLearnerId?: object | null;
  userByEmail?: object | null;
  insertResult?: { data: object | null; error: { code?: string; message?: string } | null };
} = {}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: userByLearnerId, error: null }) // first: by learner_id
    .mockResolvedValueOnce({ data: userByEmail, error: null }); // second: by email

  const single = vi.fn().mockResolvedValue(insertResult);

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    maybeSingle,
    single,
  };

  const db = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };

  return db;
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireLearner — auto-provisioning', () => {
  it('auto-provisions a new user row when no existing record is found', async () => {
    const db = makeDb({
      userByLearnerId: null,
      userByEmail: null,
      insertResult: {
        data: { id: DB_USER_ID, tenant_id: TENANT_ID, learner_id: AUTH_ID, email: null },
        error: null,
      },
    });
    vi.mocked(supabase).mockReturnValue(db as any);

    const req = makeReq();
    const { res } = makeRes();

    await requireLearner(req, res, next);

    // insert should have been called with a synthetic whatsapp_number
    expect(db._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp_number: `web:${AUTH_ID}`,
        learner_id: AUTH_ID,
        tenant_id: TENANT_ID,
      }),
    );

    // next() should be called — middleware succeeded
    expect(next).toHaveBeenCalled();
    expect((req as any).learner?.id).toBe(DB_USER_ID);
  });

  it('attaches correct learner context after provisioning', async () => {
    const db = makeDb({
      userByLearnerId: null,
      userByEmail: null,
      insertResult: {
        data: { id: DB_USER_ID, tenant_id: TENANT_ID, learner_id: AUTH_ID, email: null },
        error: null,
      },
    });
    vi.mocked(supabase).mockReturnValue(db as any);

    const req = makeReq();
    const { res } = makeRes();

    await requireLearner(req, res, next);

    expect((req as any).learner).toEqual(
      expect.objectContaining({
        id: DB_USER_ID,
        authId: AUTH_ID,
        tenantId: TENANT_ID,
      }),
    );
  });

  it('handles race-condition duplicate (23505) by re-fetching existing user', async () => {
    const db = makeDb({
      userByLearnerId: null,
      userByEmail: null,
      insertResult: {
        data: null,
        error: { code: '23505', message: 'duplicate key' },
      },
    });

    const existingUser = { id: DB_USER_ID, tenant_id: TENANT_ID, learner_id: AUTH_ID, email: null };
    // Third maybeSingle call: re-fetch after duplicate error
    db._chain.maybeSingle.mockResolvedValueOnce({ data: existingUser, error: null });

    vi.mocked(supabase).mockReturnValue(db as any);

    const req = makeReq();
    const { res } = makeRes();

    await requireLearner(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).learner?.id).toBe(DB_USER_ID);
  });

  it('returns 500 when insert fails for a non-duplicate reason', async () => {
    const db = makeDb({
      userByLearnerId: null,
      userByEmail: null,
      insertResult: {
        data: null,
        error: { code: 'PGRST202', message: 'table not found' },
      },
    });
    vi.mocked(supabase).mockReturnValue(db as any);

    const req = makeReq();
    const { res, status } = makeRes();

    await requireLearner(req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when bearer token is missing', async () => {
    const db = makeDb();
    vi.mocked(supabase).mockReturnValue(db as any);

    const req = makeReq({ headers: {} } as any);
    const { res, status } = makeRes();

    await requireLearner(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT is invalid', async () => {
    const db = makeDb({ authUser: null, authError: new Error('invalid jwt') });
    vi.mocked(supabase).mockReturnValue(db as any);

    const req = makeReq();
    const { res, status } = makeRes();

    await requireLearner(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

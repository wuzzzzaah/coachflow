import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabaseClient';

export interface AuthUser {
  id: string;
  email?: string;
  app_metadata: {
    role?: string;
    tenant_id?: string;
  };
}

declare global {
  // Augment Express Request to carry the authenticated user.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenantId?: string;
    }
  }
}

/**
 * Require a valid Supabase Auth JWT on the request.
 * Attaches req.user and req.tenantId on success; returns 401 on failure.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  const token = authHeader.slice(7);
  const db = supabase();
  const { data, error } = await db.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  const appMeta = (data.user.app_metadata ?? {}) as AuthUser['app_metadata'];
  req.user = {
    id: data.user.id,
    email: data.user.email,
    app_metadata: appMeta,
  };
  req.tenantId = appMeta.tenant_id;
  next();
}

/**
 * Require the authenticated user to have one of the listed roles.
 * Must be used after requireAuth.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.app_metadata.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: 'insufficient_role', required: roles });
      return;
    }
    next();
  };
}

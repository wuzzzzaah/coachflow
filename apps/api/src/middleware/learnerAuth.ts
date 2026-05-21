import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabaseClient';

export interface LearnerContext {
  id: string; // The database user ID
  authId: string; // The Supabase Auth ID
  email?: string;
  tenantId: string;
}

declare global {
  namespace Express {
    interface Request {
      learner?: LearnerContext;
      tenantId?: string;
    }
  }
}

/**
 * Require a valid Supabase Auth JWT and verify it belongs to a registered learner.
 * Attaches req.learner and req.tenantId on success; returns 401/403 on failure.
 * Also handles auto-linking of learner_id for existing user records matched by email.
 */
export async function requireLearner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }

  const token = authHeader.slice(7);
  const db = supabase();
  const { data: { user: authUser }, error } = await db.auth.getUser(token);

  if (error || !authUser) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  // Get tenantId from request (query or body)
  const tenantId = (req.query.tenantId as string) || req.body.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: 'tenantId_required' });
    return;
  }

  // 1. Try to find user by learner_id (already linked)
  let { data: user, error: dbError } = await db
    .from('users')
    .select('id, tenant_id, learner_id, email')
    .eq('learner_id', authUser.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (dbError) {
    res.status(500).json({ error: dbError.message });
    return;
  }

  // 2. If not found by learner_id, try finding by email to auto-link
  if (!user && authUser.email) {
    const { data: matchedUser, error: matchError } = await db
      .from('users')
      .select('id, tenant_id, learner_id, email')
      .eq('email', authUser.email)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (matchError) {
      res.status(500).json({ error: matchError.message });
      return;
    }

    if (matchedUser) {
      // Auto-link: update the record with the learner_id
      const { data: updatedUser, error: updateError } = await db
        .from('users')
        .update({ learner_id: authUser.id })
        .eq('id', matchedUser.id)
        .select()
        .single();

      if (updateError) {
        // Handle race condition if learner_id was set by another request
        if (updateError.code === '23505') { // unique violation
           const { data: retryUser } = await db
            .from('users')
            .select('id, tenant_id, learner_id, email')
            .eq('learner_id', authUser.id)
            .eq('tenant_id', tenantId)
            .maybeSingle();
           user = retryUser;
        } else {
          res.status(500).json({ error: updateError.message });
          return;
        }
      } else {
        user = updatedUser;
      }
    }
  }

  if (!user) {
    res.status(403).json({ error: 'not_a_registered_learner' });
    return;
  }

  req.learner = {
    id: user.id,
    authId: authUser.id,
    email: authUser.email,
    tenantId: user.tenant_id,
  };
  req.tenantId = user.tenant_id;

  next();
}

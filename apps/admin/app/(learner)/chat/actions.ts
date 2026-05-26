'use server';

import { createClient } from '@/lib/supabase/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function serverApiFetch(path: string, init?: RequestInit) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function enrollInJourney(userId: string, tenantId: string, journeyId: string) {
  const res = await serverApiFetch('/channel/web/receive', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      tenantId,
      kind: 'list',
      replyId: journeyId,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || error.message || 'Failed to enroll in journey');
  }

  return res.json();
}

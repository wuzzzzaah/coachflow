'use server';

import { apiFetch } from '@/lib/api';

export async function enrollInJourney(userId: string, tenantId: string, journeyId: string) {
  const res = await apiFetch('/channel/web/receive', {
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
    throw new Error(error.message || 'Failed to enroll in journey');
  }

  return res.json();
}

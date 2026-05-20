import React from 'react';
import { apiFetch } from '../../../lib/api';
import { JourneyRow } from '@coachflow/shared';
import JourneysClientPage from './_components/JourneysClientPage';

// We must provide an async parameter object for Page components in Next.js 15+
export default async function JourneysPage({ searchParams }: { searchParams: Promise<{ tenantId?: string }> }) {
  const params = await searchParams;
  const tenantId = params.tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  const [res, templatesRes] = await Promise.all([
    apiFetch(`/api/journeys?tenantId=${tenantId}&includeAll=true`),
    apiFetch(`/api/templates?tenantId=${tenantId}`)
  ]);

  let journeys: JourneyRow[] = [];
  let templates: JourneyRow[] = [];

  if (res.ok) {
    journeys = await res.json();
  } else {
    console.error('Failed to fetch journeys');
  }

  if (templatesRes.ok) {
    templates = await templatesRes.json();
  } else {
    console.error('Failed to fetch templates');
  }

  return (
    <JourneysClientPage initialJourneys={journeys} initialTemplates={templates} tenantId={tenantId} />
  );
}

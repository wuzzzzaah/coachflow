import React from 'react';
import { apiFetch } from '../../../lib/api';
import CohortsClientPage from './_components/CohortsClientPage';

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ tenantId?: string }> }) {
  const params = await searchParams;
  const tenantId = params.tenantId || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '';

  const [cohortsRes, journeysRes] = await Promise.all([
    apiFetch(`/api/cohorts?tenantId=${tenantId}`),
    apiFetch(`/api/journeys?tenantId=${tenantId}&includeAll=true`)
  ]);

  let cohorts = [];
  let journeys = [];

  if (cohortsRes.ok) {
    cohorts = await cohortsRes.json();
  }
  if (journeysRes.ok) {
    journeys = await journeysRes.json();
  }

  return (
    <CohortsClientPage initialCohorts={cohorts} journeys={journeys} tenantId={tenantId} />
  );
}

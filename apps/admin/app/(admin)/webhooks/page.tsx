import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { TenantWebhook } from '@coachflow/shared'
import WebhooksClientPage from './_components/WebhooksClientPage'

export default async function WebhooksPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Admins can manage webhooks. Tenant ID is handled by the API (current_tenant claim or default).
  // In a real multi-tenant scenario, we might need to pass the tenantId explicitly if the user is a super_admin.
  const tenantId = user.app_metadata.tenant_id

  const res = await apiFetch(`/api/webhooks${tenantId ? `?tenantId=${tenantId}` : ''}`)
  let webhooks: TenantWebhook[] = []

  if (res.ok) {
    webhooks = await res.json()
  } else {
    console.error('Failed to fetch webhooks')
  }

  return (
    <WebhooksClientPage initialWebhooks={webhooks} tenantId={tenantId} />
  )
}

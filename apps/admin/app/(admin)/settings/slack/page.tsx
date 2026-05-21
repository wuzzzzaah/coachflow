'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { Tenant } from '@coachflow/shared'
import { MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react'

function SlackSettingsContent() {
  const searchParams = useSearchParams()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success) {
      setMessage({ type: 'success', text: 'Slack workspace connected successfully!' })
    } else if (error) {
      setMessage({ type: 'error', text: `Failed to connect Slack: ${error}` })
    }

    loadTenant()
  }, [searchParams])

  async function loadTenant() {
    try {
      const tenantId = localStorage.getItem('current_tenant_id')
      if (!tenantId) return

      const res = await apiFetch(`/api/tenants/${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        setTenant(data)
      }
    } catch (err) {
      console.error('Failed to load tenant:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!tenant || !confirm('Are you sure you want to disconnect your Slack workspace?')) return

    setDisconnecting(true)
    try {
      const res = await apiFetch(`/api/tenants/${tenant.id}/slack`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setMessage({ type: 'success', text: 'Slack workspace disconnected.' })
        loadTenant()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Failed to disconnect')
      }
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message })
    } finally {
      setDisconnecting(false)
    }
  }

  const handleConnect = () => {
    const tenantId = localStorage.getItem('current_tenant_id')
    if (!tenantId) return
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/slack/oauth/start?tenantId=${tenantId}`
  }

  if (loading) return <div className="p-8">Loading...</div>

  const isConnected = !!tenant?.slack_team_id

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center gap-3 mb-8">
        <MessageSquare className="w-8 h-8 text-[#4A154B]" />
        <h1 className="text-2xl font-bold">Slack Integration</h1>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-md flex items-start gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-100">
          <h2 className="text-lg font-semibold">Connect your Workspace</h2>
          <p className="text-zinc-500 text-sm mt-1">
            Connect CoachFlow to your Slack workspace to allow users to interact with journeys via Slack.
          </p>
        </div>

        <div className="p-6">
          {isConnected ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-[#4A154B]" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">{tenant.slack_team_name}</p>
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Connected
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-zinc-300" />
              </div>
              <h3 className="font-medium text-zinc-900">No workspace connected</h3>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto mt-2 mb-6">
                Authorize CoachFlow to access your Slack workspace to get started.
              </p>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#4A154B] text-white rounded-md hover:bg-[#3b113c] transition-colors font-medium shadow-sm"
              >
                <MessageSquare className="w-5 h-5" />
                Connect Slack
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 space-y-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">What happens after connecting?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100">
            <h4 className="font-medium text-zinc-900 text-sm mb-2">Bot User Created</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">A CoachFlow bot will be added to your workspace. Users can direct message the bot to start journeys.</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100">
            <h4 className="font-medium text-zinc-900 text-sm mb-2">Interactivity Enabled</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">Buttons and interactive menus will be available in Slack messages for a rich coaching experience.</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100">
            <h4 className="font-medium text-zinc-900 text-sm mb-2">Secure Storage</h4>
            <p className="text-xs text-zinc-500 leading-relaxed">Your workspace tokens are encrypted and stored securely in our vault, isolated per tenant.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SlackSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <SlackSettingsContent />
    </Suspense>
  )
}

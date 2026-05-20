'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { NotificationConfig } from '@coachflow/shared'

export default function NotificationsPage() {
  const [config, setConfig] = useState<Partial<NotificationConfig> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadConfig() {
      try {
        const tenantId = localStorage.getItem('current_tenant_id')
        if (!tenantId) return

        const res = await apiFetch(`/api/notifications/config?tenantId=${tenantId}`)
        const data = res.ok ? await res.json() : null
        setConfig(data || {
          tenant_id: tenantId,
          notify_journey_complete: true,
          notify_low_score: true,
          low_score_threshold: 5,
          notify_idle_user: false,
          email_to: '',
          resend_api_key: ''
        })
      } catch (err) {
        console.error('Failed to load notification config:', err)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!config) return

    setSaving(true)
    setMessage('')

    try {
      const res = await apiFetch('/api/notifications/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save')
      }
      setMessage('Configuration saved successfully!')
      // Clear password field after save
      setConfig({ ...config, resend_api_key: '' })
    } catch (err) {
      setMessage(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>
  if (!config) return <div className="p-8">No tenant selected.</div>

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Notification Settings</h1>

      <form onSubmit={handleSave} className="space-y-8 bg-white p-6 rounded-lg border border-zinc-200">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Email Recipients (comma separated)
          </label>
          <input
            type="text"
            className="w-full p-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="admin@example.com, coach@example.com"
            value={config.email_to || ''}
            onChange={(e) => setConfig({ ...config, email_to: e.target.value })}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Journey Completion</div>
              <div className="text-sm text-zinc-500">Notify when a user completes a journey</div>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, notify_journey_complete: !config.notify_journey_complete })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.notify_journey_complete ? 'bg-blue-600' : 'bg-zinc-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.notify_journey_complete ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Low Score Alert</div>
              <div className="text-sm text-zinc-500">Notify when a user scores below the threshold</div>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, notify_low_score: !config.notify_low_score })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.notify_low_score ? 'bg-blue-600' : 'bg-zinc-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.notify_low_score ? 'translate-x-6' : 'translate-x-1'}`}  />
            </button>
          </div>

          {config.notify_low_score && (
            <div className="pl-4 border-l-2 border-zinc-100 py-2">
              <label className="block text-sm font-medium text-zinc-700 mb-4">
                Low Score Threshold: {config.low_score_threshold}/10
              </label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                value={config.low_score_threshold}
                onChange={(e) => setConfig({ ...config, low_score_threshold: parseFloat(e.target.value) })}
              />
              <div className="flex justify-between text-xs text-zinc-400 mt-2">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Idle User Notification</div>
              <div className="text-sm text-zinc-500">Notify when an automated reminder is sent to an idle user</div>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, notify_idle_user: !config.notify_idle_user })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.notify_idle_user ? 'bg-blue-600' : 'bg-zinc-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.notify_idle_user ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-100">
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Resend API Key (Transactional Email)
          </label>
          <input
            type="password"
            className="w-full p-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="re_..."
            value={config.resend_api_key || ''}
            onChange={(e) => setConfig({ ...config, resend_api_key: e.target.value })}
          />
          <p className="mt-1 text-xs text-zinc-500">Stored securely in Supabase Vault. Only required if using email notifications.</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          {message && (
            <span className={`text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { AlertRule } from '@coachflow/shared'

export default function AlertRulesPage() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Form state for new rule
  const [newRule, setNewRule] = useState({
    metric: 'drop_off' as AlertRule['metric'],
    threshold: 40,
    channel: 'email' as AlertRule['channel'],
    enabled: true
  })

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    try {
      const tenantId = localStorage.getItem('current_tenant_id')
      if (!tenantId) return

      const res = await apiFetch(`/api/alert-rules?tenantId=${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      }
    } catch (err) {
      console.error('Failed to load alert rules:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      const tenantId = localStorage.getItem('current_tenant_id')
      const res = await apiFetch(`/api/alert-rules?tenantId=${tenantId}`, {
        method: 'POST',
        body: JSON.stringify(newRule),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create rule')
      }
      setMessage('Rule created successfully!')
      loadRules()
    } catch (err) {
      setMessage(`Error: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(rule: AlertRule) {
    try {
      const tenantId = localStorage.getItem('current_tenant_id')
      const res = await apiFetch(`/api/alert-rules/${rule.id}?tenantId=${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !rule.enabled }),
      })
      if (res.ok) {
        loadRules()
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err)
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const tenantId = localStorage.getItem('current_tenant_id')
      const res = await apiFetch(`/api/alert-rules/${id}?tenantId=${tenantId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        loadRules()
      }
    } catch (err) {
      console.error('Failed to delete rule:', err)
    }
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">Alert Rules</h1>

      <div className="bg-white p-6 rounded-lg border border-zinc-200 mb-8">
        <h2 className="text-lg font-semibold mb-4">Add New Rule</h2>
        <form onSubmit={handleCreateRule} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Metric</label>
            <select
              className="w-full p-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={newRule.metric}
              onChange={(e) => setNewRule({ ...newRule, metric: e.target.value as any })}
            >
              <option value="drop_off">Drop-off Rate</option>
              <option value="idle_user">Idle User</option>
              <option value="low_score">Low Score</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Threshold</label>
            <input
              type="number"
              className="w-full p-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={newRule.threshold}
              onChange={(e) => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Channel</label>
            <select
              className="w-full p-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              value={newRule.channel}
              onChange={(e) => setNewRule({ ...newRule, channel: e.target.value as any })}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Adding...' : 'Add Rule'}
          </button>
        </form>
        {message && (
          <p className={`mt-4 text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="p-4 font-semibold text-sm">Metric</th>
              <th className="p-4 font-semibold text-sm">Threshold</th>
              <th className="p-4 font-semibold text-sm">Channel</th>
              <th className="p-4 font-semibold text-sm text-center">Enabled</th>
              <th className="p-4 font-semibold text-sm"></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-500">
                  No alert rules configured yet.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors">
                  <td className="p-4 text-sm capitalize">{rule.metric.replace('_', ' ')}</td>
                  <td className="p-4 text-sm">{rule.threshold}{rule.metric === 'drop_off' ? '%' : ''}</td>
                  <td className="p-4 text-sm capitalize">{rule.channel}</td>
                  <td className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleRule(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.enabled ? 'bg-blue-600' : 'bg-zinc-200'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

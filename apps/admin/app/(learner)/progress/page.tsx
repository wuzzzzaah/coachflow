'use client'

import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { StepProgress } from './_components/StepProgress'
import { ScoreHistory } from './_components/ScoreHistory'
import { UserRecord, JourneyConfig, UserScore } from '@coachflow/shared'
import { LayoutPanelLeft, MessageSquare } from 'lucide-react'

export default function ProgressPage() {
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [journey, setJourney] = useState<JourneyConfig | null>(null)
  const [scores, setScores] = useState<UserScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || ''

        // Fetch user record by their ID (which is used as whatsapp_number for web channel)
        const userRes = await apiFetch(`/api/users/${user.id}?tenantId=${tenantId}`)
        if (!userRes.ok) throw new Error('Failed to fetch user record')
        const userData = await userRes.json()
        setUserRecord(userData)

        if (userData.current_journey_id) {
          // Fetch journey details and scores in parallel
          const [journeyRes, scoresRes] = await Promise.all([
            apiFetch(`/api/journeys/${userData.current_journey_id}?tenantId=${tenantId}`),
            apiFetch(`/api/users/${user.id}/scores?tenantId=${tenantId}`)
          ])

          if (journeyRes.ok) {
            setJourney(await journeyRes.json())
          }
          if (scoresRes.ok) {
            setScores(await scoresRes.json())
          }
        }
      } catch (err) {
        console.error('Failed to fetch progress data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-white"></div>
      </div>
    )
  }

  if (!userRecord?.current_journey_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full mb-4">
          <LayoutPanelLeft className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No active journey</h2>
        <p className="text-zinc-500 dark:text-zinc-400 mb-6">
          Pick a journey to get started with your coaching.
        </p>
        <Link
          href="/chat"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Go to Chat
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{journey?.title || 'Current Journey'}</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Track your progress and scores</p>
        </div>
        <Link
          href="/chat"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Continue Chat
        </Link>
      </div>

      <StepProgress
        currentStepIndex={userRecord.current_step_index}
        totalSteps={journey?.totalSteps || 0}
      />

      <div className="pt-4">
        <h2 className="text-xl font-semibold mb-4">Score History</h2>
        <ScoreHistory scores={scores} />
      </div>
    </div>
  )
}

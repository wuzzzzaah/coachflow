'use client'

import React from 'react'

interface StepProgressProps {
  currentStepIndex: number
  totalSteps: number
}

export function StepProgress({ currentStepIndex, totalSteps }: StepProgressProps) {
  // progress percentage (0 to 100)
  // currentStepIndex is 0-indexed. If user is on step 0, they are "starting" step 1.
  // Actually, let's say step X of Y means they are currently working on step X.
  const stepNumber = currentStepIndex + 1
  const percentage = totalSteps > 0 ? Math.min(Math.round((currentStepIndex / totalSteps) * 100), 100) : 0

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-end mb-4">
        <div>
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Overall Progress
          </span>
          <div className="text-3xl font-bold mt-1">
            Step {stepNumber} <span className="text-zinc-400 font-normal text-xl">of {totalSteps}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-zinc-900 dark:text-white">
            {percentage}%
          </span>
        </div>
      </div>

      <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-900 dark:bg-white transition-all duration-500 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        {percentage === 100
          ? "Congratulations! You've completed all steps in this journey."
          : `Keep going! You're making great progress through your coaching journey.`
        }
      </p>
    </div>
  )
}

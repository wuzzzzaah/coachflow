'use client';

import React, { useState } from 'react';
import { UserScore } from '@coachflow/shared';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';

interface ScoreHistoryProps {
  scores: UserScore[];
}

export function ScoreHistory({ scores }: ScoreHistoryProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  if (scores.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 text-center">
        <p className="text-zinc-500 dark:text-zinc-400">
          No scores yet. Complete assessment steps to see your results here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {scores.map((score) => (
              <React.Fragment key={score.id}>
                <tr
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                  onClick={() => toggleExpand(score.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-zinc-900 dark:text-white">
                      {new Date(score.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(score.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center text-zinc-900 dark:text-white font-bold text-lg">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 mr-1" />
                        {score.score}
                      </div>
                      <span className="text-zinc-400 text-sm">/ {score.max_score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {expandedIds.has(score.id) ? (
                      <ChevronUp className="w-5 h-5 text-zinc-400 inline" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-zinc-400 inline" />
                    )}
                  </td>
                </tr>
                {expandedIds.has(score.id) && (
                  <tr className="bg-zinc-50 dark:bg-zinc-800/30">
                    <td colSpan={3} className="px-6 py-6">
                      <div className="space-y-6">
                        {score.feedback && (
                          <div>
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                              Feedback
                            </h4>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                              {score.feedback}
                            </p>
                          </div>
                        )}

                        {score.criteria && score.criteria.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">
                              Dimension Breakdown
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {score.criteria.map((dim, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4 rounded-lg shadow-sm"
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-semibold text-zinc-900 dark:text-white">
                                      {dim.name}
                                    </span>
                                    <span className="text-sm font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                      {dim.score}/10
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
                                    {dim.feedback}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

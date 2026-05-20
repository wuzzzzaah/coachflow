"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";
import { downloadCsv } from "../../../../lib/downloadCsv";

interface UserProgress {
  journey_id: string;
  journey_title: string;
  completed_steps: number;
  total_steps: number;
  last_active_at: string | null;
}

interface ScoreDimension {
  name: string;
  score: number;
  feedback: string;
}

interface UserScore {
  id: string;
  session_id: string;
  journey_id: string;
  step_id: string;
  score: number;
  max_score: number;
  criteria: ScoreDimension[];
  feedback: string;
  created_at: string;
}

export default function UserProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [scores, setScores] = useState<UserScore[]>([]);
  const [expandedScoreIds, setExpandedScoreIds] = useState<Set<string>>(new Set());
  const [isEraseModalOpen, setIsEraseModalOpen] = useState(false);
  const [eraseConfirmText, setEraseConfirmText] = useState("");
  const [erasing, setErasing] = useState(false);

  // Group scores by journey and calculate averages
  const journeyAverages = React.useMemo(() => {
    const groups: Record<string, UserScore[]> = {};
    scores.forEach((s) => {
      if (!groups[s.journey_id]) groups[s.journey_id] = [];
      groups[s.journey_id].push(s);
    });

    const averages: Record<string, { score: number; criteria: ScoreDimension[] }> = {};
    Object.entries(groups).forEach(([journeyId, groupScores]) => {
      const totalScore = groupScores.reduce((acc, s) => acc + s.score, 0);
      const avgScore = Number((totalScore / groupScores.length).toFixed(1));

      const dimensionTotals: Record<string, { total: number; count: number }> = {};
      groupScores.forEach((s) => {
        s.criteria?.forEach((d) => {
          if (!dimensionTotals[d.name]) {
            dimensionTotals[d.name] = { total: 0, count: 0 };
          }
          dimensionTotals[d.name].total += d.score;
          dimensionTotals[d.name].count += 1;
        });
      });

      const avgCriteria = Object.entries(dimensionTotals).map(([name, data]) => ({
        name,
        score: Number((data.total / data.count).toFixed(1)),
        feedback: "Journey average",
      }));

      averages[journeyId] = { score: avgScore, criteria: avgCriteria };
    });
    return averages;
  }, [scores]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const tenantId =
          process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ||
          "00000000-0000-0000-0000-000000000000";

        const [progressRes, scoresRes] = await Promise.all([
          apiFetch(`/api/users/${userId}/progress?tenantId=${tenantId}`),
          apiFetch(`/api/users/${userId}/scores?tenantId=${tenantId}`)
        ]);

        const progressData = await progressRes.json();
        const scoresData = await scoresRes.json();

        setProgress(Array.isArray(progressData) ? progressData : []);
        setScores(Array.isArray(scoresData) ? scoresData : []);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchData();
    }
  }, [userId]);

  const toggleScoreExpanded = (id: string) => {
    setExpandedScoreIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleExport = async () => {
    try {
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000000";
      await downloadCsv(`/api/users/${userId}/export?tenantId=${tenantId}`, `user-${userId}-export.csv`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export user CSV");
    }
  };

  const handleExportJson = async () => {
    try {
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000000";
      await downloadCsv(`/api/users/${userId}/data-export?tenantId=${tenantId}`, `user-data-${userId}.json`);
    } catch (error) {
      console.error("JSON export failed:", error);
      alert("Failed to export user JSON");
    }
  };

  const handleEraseUser = async () => {
    if (eraseConfirmText !== "DELETE") return;
    setErasing(true);
    try {
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000000";
      const res = await apiFetch(`/api/users/${userId}?tenantId=${tenantId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        alert("User successfully erased");
        router.push("/users");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to erase user");
      }
    } catch (error) {
      console.error("Erasure failed:", error);
      alert(`Failed to erase user: ${(error as Error).message}`);
    } finally {
      setErasing(false);
      setIsEraseModalOpen(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <Link
            href="/users"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 w-fit flex items-center gap-1"
          >
            ← Back to Users
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 bg-zinc-800 text-white rounded-md hover:bg-zinc-700 transition-colors text-sm font-medium"
            >
              Export Data (JSON)
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Export CSV
            </button>
            <button
              onClick={() => setIsEraseModalOpen(true)}
              className="px-3 py-1.5 border border-red-600 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-sm font-medium"
            >
              Erase User
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-bold">User Progress</h1>
        <p className="text-sm text-zinc-500 font-mono">ID: {userId}</p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Journeys</h2>
        <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Journey Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200 dark:bg-zinc-900 dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-zinc-500"
                  >
                    Loading progress...
                  </td>
                </tr>
              ) : progress.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-4 text-center text-zinc-500"
                  >
                    No journey progress found for this user.
                  </td>
                </tr>
              ) : (
                progress.map((p) => (
                  <tr
                    key={p.journey_id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {p.journey_title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {p.completed_steps} / {p.total_steps}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {p.last_active_at
                        ? new Date(p.last_active_at).toLocaleString()
                        : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4 mt-8">
        <h2 className="text-xl font-semibold">Session Scores</h2>
        <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Session ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Overall Score
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-zinc-200 dark:bg-zinc-900 dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-zinc-500">
                    Loading scores...
                  </td>
                </tr>
              ) : scores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-zinc-500">
                    No scores found for this user.
                  </td>
                </tr>
              ) : (
                Object.entries(
                  scores.reduce((acc, s) => {
                    if (!acc[s.journey_id]) acc[s.journey_id] = [];
                    acc[s.journey_id].push(s);
                    return acc;
                  }, {} as Record<string, UserScore[]>)
                )
                .sort(([, a], [, b]) => {
                  const aMax = Math.max(...a.map(s => new Date(s.created_at).getTime()));
                  const bMax = Math.max(...b.map(s => new Date(s.created_at).getTime()));
                  return bMax - aMax;
                })
                .map(([journeyId, journeyScores]) => (
                  <React.Fragment key={journeyId}>
                    {journeyScores.map((s) => (
                      <React.Fragment key={s.id}>
                        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                            {new Date(s.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400 font-mono text-sm">
                            {s.session_id.substring(0, 8)}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-zinc-900 dark:text-zinc-100 font-medium">
                            {s.score} / {s.max_score}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end gap-3">
                            <Link
                              href={`/users/${userId}/sessions/${s.session_id}`}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            >
                              View Transcript
                            </Link>
                            <button
                              onClick={() => toggleScoreExpanded(s.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {expandedScoreIds.has(s.id) ? "Hide Details" : "View Details"}
                            </button>
                          </td>
                        </tr>
                        {expandedScoreIds.has(s.id) && (
                          <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="flex flex-col gap-4">
                                {s.feedback && (
                                  <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                                    <strong>Feedback:</strong>
                                    <p className="mt-1">{s.feedback}</p>
                                  </div>
                                )}
                                {s.criteria && s.criteria.length > 0 && (
                                  <div>
                                    <strong className="text-sm text-zinc-700 dark:text-zinc-300 block mb-2">Dimensions:</strong>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {s.criteria.map((dim, idx) => (
                                        <div key={idx} className="bg-white dark:bg-zinc-900 border dark:border-zinc-700 p-3 rounded shadow-sm">
                                          <div className="flex justify-between items-center mb-1">
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{dim.name}</span>
                                            <span className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                                              {dim.score}
                                            </span>
                                          </div>
                                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{dim.feedback}</p>
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
                    {/* Overall row for this journey */}
                    {journeyAverages[journeyId] && (
                      <React.Fragment>
                        <tr className="bg-blue-50 dark:bg-blue-900/10 border-t-2 border-blue-100 dark:border-blue-900/30">
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-blue-900 dark:text-blue-100">
                            OVERALL
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider">
                            Journey average
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-blue-900 dark:text-blue-100 font-bold">
                            {journeyAverages[journeyId].score} / 10
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => toggleScoreExpanded(`avg-${journeyId}`)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {expandedScoreIds.has(`avg-${journeyId}`) ? "Hide Breakdown" : "View Breakdown"}
                            </button>
                          </td>
                        </tr>
                        {expandedScoreIds.has(`avg-${journeyId}`) && (
                          <tr className="bg-blue-50/50 dark:bg-blue-900/5">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="flex flex-col gap-4">
                                <div>
                                  <strong className="text-sm text-blue-900 dark:text-blue-100 block mb-2">Dimension Averages:</strong>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {journeyAverages[journeyId].criteria.map((dim, idx) => (
                                      <div key={idx} className="bg-white dark:bg-zinc-900 border border-blue-100 dark:border-blue-900/30 p-3 rounded shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{dim.name}</span>
                                          <span className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                                            {dim.score}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEraseModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6 border dark:border-zinc-800">
            <h2 className="text-xl font-bold mb-2 text-red-600">Erase User Data</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This will permanently anonymise this user&apos;s personal data and delete all conversation history. This cannot be undone.
            </p>
            <p className="text-sm font-medium mb-2">
              Type <span className="font-bold text-red-600">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={eraseConfirmText}
              onChange={(e) => setEraseConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 mb-6 font-bold"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEraseModalOpen(false);
                  setEraseConfirmText("");
                }}
                className="px-4 py-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleEraseUser}
                disabled={eraseConfirmText !== "DELETE" || erasing}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
              >
                {erasing ? "Erasing..." : "Permanently Erase User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

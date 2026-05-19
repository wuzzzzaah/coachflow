"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "../../../../lib/api";

interface UserProgress {
  journey_id: string;
  journey_title: string;
  completed_steps: number;
  total_steps: number;
  last_active_at: string | null;
}

export default function UserProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      setLoading(true);
      try {
        const tenantId =
          process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ||
          "00000000-0000-0000-0000-000000000000";
        const res = await apiFetch(
          `/api/users/${userId}/progress?tenantId=${tenantId}`
        );
        const data = await res.json();
        setProgress(data);
      } catch (error) {
        console.error("Error fetching user progress:", error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchProgress();
    }
  }, [userId]);

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/users"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 w-fit flex items-center gap-1"
        >
          ← Back to Users
        </Link>
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
    </div>
  );
}

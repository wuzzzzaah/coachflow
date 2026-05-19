"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";

interface User {
  id: string;
  name: string | null;
  whatsapp_number: string;
  created_at: string;
}

export default function UsersPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000000";
      const res = await apiFetch(`/api/users?tenantId=${tenantId}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchUsers]);

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <div className="flex flex-col gap-4">
        <input
          type="search"
          placeholder="Search by name or WhatsApp number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md px-4 py-2 border rounded-md dark:bg-zinc-900 dark:border-zinc-700"
        />

        <div className="overflow-x-auto rounded-lg border dark:border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  WhatsApp Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
                  Joined
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
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-zinc-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {user.name || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {user.whatsapp_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/users/${user.id}`}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View Details
                      </Link>
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

"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "../../../../../../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  journey_title: string;
  step_title: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
}

export default function SessionTranscriptPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const resolvedParams = use(params);
  const { id: userId, sessionId } = resolvedParams;
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const tenantId =
          process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ||
          "00000000-0000-0000-0000-000000000000";

        const [messagesRes, sessionRes] = await Promise.all([
          apiFetch(`/api/users/${userId}/sessions/${sessionId}/messages?tenantId=${tenantId}`),
          apiFetch(`/api/sessions/${sessionId}?tenantId=${tenantId}`)
        ]);

        const messagesData = await messagesRes.json();
        const sessionData = await sessionRes.json();

        setMessages(Array.isArray(messagesData) ? messagesData : []);
        setSession(sessionData && sessionData.id ? sessionData : null);
      } catch (error) {
        console.error("Error fetching session data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (userId && sessionId) {
      fetchData();
    }
  }, [userId, sessionId]);

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/users/${userId}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 w-fit flex items-center gap-1"
        >
          ← Back to User Detail
        </Link>
        <h1 className="text-2xl font-bold">Conversation Transcript</h1>
        {session && (
          <div className="flex flex-col gap-1 text-sm text-zinc-500">
            <p>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Journey:</span> {session.journey_title}
            </p>
            <p>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Step:</span> {session.step_title} ({session.mode})
            </p>
            <p>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Started:</span> {new Date(session.started_at).toLocaleString()}
            </p>
            <p>
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Status:</span>{" "}
              {session.ended_at ? `Completed at ${new Date(session.ended_at).toLocaleString()}` : "In Progress"}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-6 border dark:border-zinc-800 min-h-[400px]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Loading transcript...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 italic">
            No messages found for this session.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-1 max-w-[80%] ${
                m.role === "user" ? "self-end items-end" : "self-start items-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white dark:bg-zinc-800 border dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-bl-none shadow-sm"
                }`}
              >
                {m.content}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono px-1">
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

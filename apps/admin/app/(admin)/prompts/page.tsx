"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

type PromptKeys = "system" | "coaching" | "roleplay" | "reflection" | "scoring";

const PROMPT_KEYS: PromptKeys[] = [
  "system",
  "coaching",
  "roleplay",
  "reflection",
  "scoring",
];

export default function PromptsPage() {
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "";

  const [prompts, setPrompts] = useState<Record<PromptKeys, string>>({
    system: "",
    coaching: "",
    roleplay: "",
    reflection: "",
    scoring: "",
  });

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Record<PromptKeys, { type: "saving" | "success" | "error", message: string } | null>>({
    system: null,
    coaching: null,
    roleplay: null,
    reflection: null,
    scoring: null,
  });

  useEffect(() => {
    async function loadPrompts() {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch(`/api/tenants/${tenantId}/prompts`);
        setPrompts((prev) => ({
          ...prev,
          ...(data || {}),
        }));
      } catch (err) {
        console.error("Failed to load prompts", err);
      } finally {
        setLoading(false);
      }
    }
    loadPrompts();
  }, [tenantId]);

  const handleSave = async (key: PromptKeys) => {
    if (!tenantId) return;
    setStatus((prev) => ({ ...prev, [key]: { type: "saving", message: "Saving..." } }));

    try {
      await apiFetch(`/api/tenants/${tenantId}/prompts/${key}`, {
        method: "PUT",
        body: JSON.stringify({ content: prompts[key] }),
      });
      setStatus((prev) => ({ ...prev, [key]: { type: "success", message: "Saved successfully!" } }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          [key]: prev[key]?.type === "success" ? null : prev[key],
        }));
      }, 3000);
    } catch (err: unknown) {
      console.error(`Failed to save ${key} prompt`, err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save";
      setStatus((prev) => ({ ...prev, [key]: { type: "error", message: errorMessage } }));
    }
  };

  const handleReset = async (key: PromptKeys) => {
    if (!tenantId) return;
    setStatus((prev) => ({ ...prev, [key]: { type: "saving", message: "Resetting..." } }));

    try {
      await apiFetch(`/api/tenants/${tenantId}/prompts/${key}`, {
        method: "DELETE",
      });

      setPrompts((prev) => ({ ...prev, [key]: "" }));
      setStatus((prev) => ({ ...prev, [key]: { type: "success", message: "Reset to default!" } }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          [key]: prev[key]?.type === "success" ? null : prev[key],
        }));
      }, 3000);
    } catch (err: unknown) {
      console.error(`Failed to reset ${key} prompt`, err);
      const errorMessage = err instanceof Error ? err.message : "Failed to reset";
      setStatus((prev) => ({ ...prev, [key]: { type: "error", message: errorMessage } }));
    }
  };

  const handleChange = (key: PromptKeys, value: string) => {
    setPrompts((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!tenantId) {
    return (
      <div className="p-8 text-red-600">
        Error: NEXT_PUBLIC_DEFAULT_TENANT_ID is not configured.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Prompt Overrides Editor</h1>

      <div className="space-y-8">
        {PROMPT_KEYS.map((key) => (
          <div key={key} className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200">
            <div className="mb-4">
              <label htmlFor={key} className="block text-lg font-medium text-zinc-900 capitalize">
                {key}
              </label>
            </div>

            <textarea
              id={key}
              value={prompts[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full min-h-[150px] p-3 border border-zinc-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder={`Enter custom ${key} prompt to override the default...`}
            />

            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => handleSave(key)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  disabled={status[key]?.type === "saving"}
                >
                  Save
                </button>
                <button
                  onClick={() => handleReset(key)}
                  className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-md hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-colors disabled:opacity-50 border border-zinc-300"
                  disabled={status[key]?.type === "saving"}
                >
                  Reset to default
                </button>
              </div>

              <div className="text-sm">
                {status[key] && (
                  <span
                    className={`
                      ${status[key]?.type === "saving" ? "text-zinc-500" : ""}
                      ${status[key]?.type === "success" ? "text-green-600" : ""}
                      ${status[key]?.type === "error" ? "text-red-600" : ""}
                    `}
                  >
                    {status[key]?.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

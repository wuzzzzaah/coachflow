"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

type CoachingMode = 'coaching' | 'roleplay' | 'reflection' | 'assessment';

interface Step {
  id: string;
  step_index: number;
  mode: CoachingMode;
  title: string;
  opening_message: string;
  min_turns: number;
  step_guidance?: string;
  scoring_criteria?: string[] | null;
  branch_on_low_score: boolean;
  branch_score_threshold: number | null;
  branch_step_index: number | null;
}

interface Journey {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  status: 'draft' | 'published';
  is_template: boolean;
  steps: Step[];
}

export default function JourneyDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || "default-tenant";

  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Journey State
  const [isEditingJourney, setIsEditingJourney] = useState(false);
  const [journeyEditData, setJourneyEditData] = useState({ title: '', description: '', estimated_minutes: 0, is_template: false });

  // Add Step State
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStep, setNewStep] = useState({
    title: '',
    mode: 'coaching' as CoachingMode,
    opening_message: '',
    min_turns: 3,
    step_guidance: ''
  });

  // Edit Step State
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepEditData, setStepEditData] = useState<Partial<Step>>({});

  useEffect(() => {
    if (id) {
      loadJourney();
    }
  }, [id]);

  const loadJourney = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/journeys/${id}?tenantId=${tenantId}`);
      setJourney(await data.json());
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJourney = async () => {
    try {
      await apiFetch(`/api/journeys/${id}?tenantId=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(journeyEditData),
      });
      setIsEditingJourney(false);
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleToggleTemplate = async () => {
    if (!journey) return;
    const newValue = !journey.is_template;
    try {
      await apiFetch(`/api/journeys/${id}?tenantId=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_template: newValue }),
      });
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleToggleStatus = async () => {
    if (!journey) return;
    const newStatus = journey.status === 'published' ? 'draft' : 'published';
    try {
      await apiFetch(`/api/journeys/${id}?tenantId=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journey) return;

    try {
      const stepId = crypto.randomUUID();
      const newStepIndex = journey.steps.length;

      await apiFetch(`/api/journeys/${id}/steps?tenantId=${tenantId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stepId,
          step_index: newStepIndex,
          ...newStep
        }),
      });

      setIsAddingStep(false);
      setNewStep({ title: '', mode: 'coaching', opening_message: '', min_turns: 3, step_guidance: '' });
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleSaveStep = async (stepId: string) => {
    try {
      await apiFetch(`/api/journeys/${id}/steps/${stepId}?tenantId=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepEditData),
      });
      setEditingStepId(null);
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm("Are you sure you want to delete this step?")) return;
    try {
      await apiFetch(`/api/journeys/${id}/steps/${stepId}?tenantId=${tenantId}`, {
        method: "DELETE",
      });
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleReorder = async (stepId: string, direction: 'up' | 'down') => {
    if (!journey) return;
    const steps = [...journey.steps].sort((a, b) => a.step_index - b.step_index);
    const currentIndex = steps.findIndex(s => s.id === stepId);

    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === steps.length - 1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Swap IDs in an order array
    const newOrder = [...steps].map(s => s.id);
    const temp = newOrder[currentIndex];
    newOrder[currentIndex] = newOrder[swapIndex];
    newOrder[swapIndex] = temp;

    // Optimistic UI update
    const updatedSteps = [...steps];
    const tempStep = updatedSteps[currentIndex];
    updatedSteps[currentIndex] = updatedSteps[swapIndex];
    updatedSteps[swapIndex] = tempStep;
    updatedSteps.forEach((s, idx) => s.step_index = idx);
    setJourney({ ...journey, steps: updatedSteps });

    try {
      await apiFetch(`/api/journeys/${id}/steps/reorder?tenantId=${tenantId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });
      // reload to ensure consistency
      loadJourney();
    } catch (err: unknown) {
      alert((err as Error).message);
      loadJourney(); // revert
    }
  };

  if (loading) return <div>Loading journey...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!journey) return <div>Journey not found.</div>;

  const sortedSteps = [...journey.steps].sort((a, b) => a.step_index - b.step_index);

  return (
    <div className="max-w-4xl mx-auto py-8">
      {/* Journey Details Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        {isEditingJourney ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={journeyEditData.title}
                onChange={e => setJourneyEditData({ ...journeyEditData, title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border p-2 rounded"
                value={journeyEditData.description}
                onChange={e => setJourneyEditData({ ...journeyEditData, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Minutes</label>
              <input
                type="number"
                className="w-full border p-2 rounded"
                value={journeyEditData.estimated_minutes}
                onChange={e => setJourneyEditData({ ...journeyEditData, estimated_minutes: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={handleSaveJourney}
              >
                Save
              </button>
              <button
                className="border px-4 py-2 rounded hover:bg-gray-50"
                onClick={() => setIsEditingJourney(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{journey.title}</h1>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  journey.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {journey.status}
                </span>
                {journey.is_template && (
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold uppercase">
                    Template
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-2">{journey.description}</p>
              <p className="text-sm text-gray-500">Estimated duration: {journey.estimated_minutes} minutes</p>
            </div>
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded text-sm font-medium border ${
                  journey.status === 'published'
                    ? 'hover:bg-red-50 text-red-600 border-red-200'
                    : 'hover:bg-green-50 text-green-600 border-green-200'
                }`}
                onClick={handleToggleStatus}
              >
                {journey.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button
                className={`px-4 py-2 rounded text-sm font-medium border ${
                  journey.is_template
                    ? 'hover:bg-purple-50 text-purple-600 border-purple-200'
                    : 'hover:bg-gray-50 text-gray-600 border-gray-200'
                }`}
                onClick={handleToggleTemplate}
              >
                {journey.is_template ? 'Remove Template' : 'Mark as Template'}
              </button>
              <button
                className="border px-4 py-2 rounded hover:bg-gray-50 text-sm font-medium"
                onClick={() => {
                setJourneyEditData({
                  title: journey.title,
                  description: journey.description,
                  estimated_minutes: journey.estimated_minutes,
                  is_template: journey.is_template,
                });
                  setIsEditingJourney(true);
                }}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Steps List */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold">Steps</h2>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium text-sm"
          onClick={() => setIsAddingStep(true)}
        >
          Add Step
        </button>
      </div>

      <div className="space-y-4">
        {sortedSteps.map((step, index) => (
          <div key={step.id} className="bg-white p-6 rounded-lg shadow-sm border">
            {editingStepId === step.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      className="w-full border p-2 rounded"
                      value={stepEditData.title || ''}
                      onChange={e => setStepEditData({ ...stepEditData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mode</label>
                    <select
                      className="w-full border p-2 rounded"
                      value={stepEditData.mode || 'coaching'}
                      onChange={e => setStepEditData({ ...stepEditData, mode: e.target.value as CoachingMode })}
                    >
                      <option value="coaching">Coaching</option>
                      <option value="roleplay">Roleplay</option>
                      <option value="reflection">Reflection</option>
                      <option value="assessment">Assessment</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Opening Message</label>
                  <textarea
                    className="w-full border p-2 rounded"
                    value={stepEditData.opening_message || ''}
                    onChange={e => setStepEditData({ ...stepEditData, opening_message: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Step Guidance (Optional)</label>
                  <textarea
                    className="w-full border p-2 rounded"
                    value={stepEditData.step_guidance || ''}
                    onChange={e => setStepEditData({ ...stepEditData, step_guidance: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Min Turns</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={stepEditData.min_turns || 0}
                    onChange={e => setStepEditData({ ...stepEditData, min_turns: parseInt(e.target.value) || 0 })}
                  />
                </div>

                {step.scoring_criteria && step.scoring_criteria.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-bold mb-3">Branching</h4>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="branch_on_low_score"
                        checked={stepEditData.branch_on_low_score || false}
                        onChange={e => setStepEditData({ ...stepEditData, branch_on_low_score: e.target.checked })}
                      />
                      <label htmlFor="branch_on_low_score" className="text-sm font-medium">Branch on low score</label>
                    </div>

                    {stepEditData.branch_on_low_score && (
                      <div className="grid grid-cols-2 gap-4 ml-6">
                        <div>
                          <label className="block text-sm font-medium mb-1">Score threshold (0-10)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            className="w-full border p-2 rounded"
                            value={stepEditData.branch_score_threshold ?? ''}
                            onChange={e => setStepEditData({ ...stepEditData, branch_score_threshold: parseFloat(e.target.value) || null })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Go to step # (index)</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border p-2 rounded"
                            value={stepEditData.branch_step_index ?? ''}
                            onChange={e => setStepEditData({ ...stepEditData, branch_step_index: parseInt(e.target.value) ?? null })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                    onClick={() => handleSaveStep(step.id)}
                  >
                    Save
                  </button>
                  <button
                    className="border px-4 py-2 rounded hover:bg-gray-50 text-sm"
                    onClick={() => setEditingStepId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-1 rounded">
                      Step {index + 1}
                    </span>
                    <h3 className="font-bold text-lg">{step.title}</h3>
                    <span className="text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded capitalize">
                      {step.mode}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mb-2"><span className="font-semibold">Opening:</span> {step.opening_message}</p>
                  {step.step_guidance && (
                    <p className="text-gray-600 text-sm mb-2"><span className="font-semibold">Guidance:</span> {step.step_guidance}</p>
                  )}
                  <p className="text-gray-500 text-xs">Min turns: {step.min_turns}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReorder(step.id, 'up')}
                      disabled={index === 0}
                      className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                      title="Move Up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleReorder(step.id, 'down')}
                      disabled={index === sortedSteps.length - 1}
                      className="p-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                      title="Move Down"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button
                      className="text-sm text-blue-600 hover:underline"
                      onClick={() => {
                        setStepEditData({
                          title: step.title,
                          mode: step.mode,
                          opening_message: step.opening_message,
                          step_guidance: step.step_guidance,
                          min_turns: step.min_turns,
                          branch_on_low_score: step.branch_on_low_score,
                          branch_score_threshold: step.branch_score_threshold,
                          branch_step_index: step.branch_step_index,
                        });
                        setEditingStepId(step.id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => handleDeleteStep(step.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {sortedSteps.length === 0 && !isAddingStep && (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed text-gray-500">
            No steps found. Add a step to get started.
          </div>
        )}
      </div>

      {/* Add Step Form */}
      {isAddingStep && (
        <div className="mt-6 bg-blue-50 p-6 rounded-lg border border-blue-100">
          <h3 className="font-bold text-lg mb-4">Add New Step</h3>
          <form onSubmit={handleAddStep} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  required
                  className="w-full border p-2 rounded"
                  value={newStep.title}
                  onChange={e => setNewStep({ ...newStep, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mode *</label>
                <select
                  className="w-full border p-2 rounded"
                  value={newStep.mode}
                  onChange={e => setNewStep({ ...newStep, mode: e.target.value as CoachingMode })}
                >
                  <option value="coaching">Coaching</option>
                  <option value="roleplay">Roleplay</option>
                  <option value="reflection">Reflection</option>
                  <option value="assessment">Assessment</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Opening Message *</label>
              <textarea
                required
                className="w-full border p-2 rounded"
                value={newStep.opening_message}
                onChange={e => setNewStep({ ...newStep, opening_message: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Step Guidance (Optional)</label>
              <textarea
                className="w-full border p-2 rounded"
                value={newStep.step_guidance}
                onChange={e => setNewStep({ ...newStep, step_guidance: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Turns</label>
              <input
                type="number"
                min="0"
                className="w-full border p-2 rounded"
                value={newStep.min_turns}
                onChange={e => setNewStep({ ...newStep, min_turns: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                Create Step
              </button>
              <button
                type="button"
                className="border px-4 py-2 rounded hover:bg-gray-50 text-sm bg-white"
                onClick={() => setIsAddingStep(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

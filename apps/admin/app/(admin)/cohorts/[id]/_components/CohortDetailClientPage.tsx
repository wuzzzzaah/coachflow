'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../../../lib/api';
import { Users, BarChart3, Loader2 } from 'lucide-react';

export default function CohortDetailClientPage({ cohort, initialMembers, allUsers, tenantId }: { cohort: any, initialMembers: any[], allUsers: any[], tenantId: string }) {
  const [activeTab, setActiveTab] = useState<'members' | 'analytics'>('members');
  const [members, setMembers] = useState(initialMembers);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      fetchAnalytics();
    }
  }, [activeTab]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await apiFetch(`/api/cohorts/${cohort.id}/analytics?tenantId=${tenantId}`);
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch cohort analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const filteredUsers = allUsers.filter(u =>
    !members.some(m => m.user_id === u.id) &&
    (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.whatsapp_number.includes(searchQuery))
  );

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) return;

    const res = await apiFetch(`/api/cohorts/${cohort.id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds: selectedUserIds, tenantId }),
    });

    if (res.ok) {
      const updatedRes = await apiFetch(`/api/cohorts/${cohort.id}/members?tenantId=${tenantId}`);
      if (updatedRes.ok) {
        setMembers(await updatedRes.json());
      }
      setIsAddModalOpen(false);
      setSelectedUserIds([]);
      setSearchQuery('');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove user from cohort?')) return;
    const res = await apiFetch(`/api/cohorts/${cohort.id}/members/${userId}?tenantId=${tenantId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setMembers(members.filter(m => m.user_id !== userId));
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{cohort.name}</h1>
            <p className="text-zinc-500 mt-1">Journey: {cohort.journey_title}</p>
            {cohort.starts_at && (
              <p className="text-sm text-zinc-500 mt-1">
                {new Date(cohort.starts_at).toLocaleDateString()} - {cohort.ends_at ? new Date(cohort.ends_at).toLocaleDateString() : 'Ongoing'}
              </p>
            )}
          </div>
          {activeTab === 'members' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors"
            >
              Add Members
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1 mt-8 border-b border-zinc-200">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {activeTab === 'members' ? (
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Last Active</th>
              <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {members.map((member) => (
              <tr key={member.user_id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-zinc-900">{member.display_name || 'Anonymous'}</td>
                <td className="px-6 py-4 text-sm text-zinc-600">{member.whatsapp_number}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-zinc-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all"
                        style={{ width: `${(member.completed_steps / member.total_steps) * 100 || 0}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {member.completed_steps} / {member.total_steps}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-600">
                  {member.last_active_at ? new Date(member.last_active_at).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  No members in this cohort.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="space-y-8">
          {loadingAnalytics ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading analytics...</p>
            </div>
          ) : !analytics ? (
            <div className="text-center py-24 text-zinc-500">
              Failed to load analytics data.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Completion Rate</h3>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-3xl font-bold text-zinc-900">{analytics.completionRate.completedMembers} / {analytics.completionRate.totalMembers}</span>
                    <span className="text-sm font-medium text-zinc-500">members</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-green-500 h-full transition-all duration-500"
                      style={{ width: `${analytics.completionRate.completionRate}%` }}
                    />
                  </div>
                  <p className="text-sm text-zinc-600">{analytics.completionRate.completionRate}% of cohort completed the journey.</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm md:col-span-2">
                  <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-6">Score Distribution</h3>
                  <div className="flex items-end space-x-2 h-32">
                    {analytics.scoreDistribution.map((item: any) => {
                      const maxCount = Math.max(...analytics.scoreDistribution.map((i: any) => i.count));
                      const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                      return (
                        <div key={item.range} className="flex-1 flex flex-col items-center group">
                          <div className="w-full relative flex flex-col items-center justify-end h-full">
                            <div
                              className="w-full bg-zinc-900 rounded-t-sm transition-all duration-500 hover:bg-zinc-700"
                              style={{ height: `${height}%` }}
                            >
                              <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-xs px-2 py-1 rounded pointer-events-none transition-opacity whitespace-nowrap">
                                {item.count} users
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-2 font-medium">{item.range}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50">
                  <h3 className="text-sm font-semibold text-zinc-900">Member Progress</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Avg Score</th>
                      <th className="px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {analytics.memberProgress.map((member: any) => (
                      <tr key={member.userId} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">{member.phone}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-24 bg-zinc-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-zinc-900 h-full transition-all duration-500"
                                style={{ width: `${(member.completedSteps / (member.totalSteps || 1)) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500">{member.completedSteps} / {member.totalSteps}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600 font-semibold">{member.avgScore}</td>
                        <td className="px-6 py-4 text-sm text-zinc-500">
                          {member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                    {analytics.memberProgress.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                          No progress data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4">Add Members</h2>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name or phone..."
                className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-md mb-4">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`flex items-center px-4 py-3 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 cursor-pointer ${selectedUserIds.includes(user.id) ? 'bg-zinc-50' : ''}`}
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <input
                    type="checkbox"
                    className="mr-3 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    checked={selectedUserIds.includes(user.id)}
                    readOnly
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{user.name || 'Anonymous'}</p>
                    <p className="text-xs text-zinc-500">{user.whatsapp_number}</p>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-zinc-500">No users found to add.</div>
              )}
            </div>

            <div className="flex justify-between items-center mt-auto">
              <span className="text-sm text-zinc-500">
                {selectedUserIds.length} users selected
              </span>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-zinc-600 hover:text-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={selectedUserIds.length === 0}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

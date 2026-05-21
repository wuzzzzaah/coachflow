'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';
import { LiveMetrics } from './_components/LiveMetrics';
import { DropOffFunnel } from './_components/DropOffFunnel';
import { StuckUserList } from './_components/StuckUserList';

export default function LiveTelemetryPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/analytics"
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Analytics
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Live Telemetry</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            Real-time session monitoring and engagement metrics. Refreshes every 30s.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <LiveMetrics />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DropOffFunnel />
        <StuckUserList />
      </div>
    </div>
  );
}

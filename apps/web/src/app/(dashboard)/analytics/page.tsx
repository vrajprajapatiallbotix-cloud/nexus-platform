'use client';

import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, CheckSquare, Clock, Users, FolderKanban, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface AnalyticsData {
  tasksCompleted: number;
  tasksCreated: number;
  activeProjects: number;
  teamMembers: number;
  avgCompletionTime: number;
  completionRate: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SimpleBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: AnalyticsData }>('/analytics/overview')
      .then(r => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    DONE: '#10b981', IN_PROGRESS: '#f59e0b', IN_REVIEW: '#8b5cf6', TODO: '#3b82f6', BACKLOG: '#94a3b8',
  };
  const priorityColors: Record<string, string> = {
    URGENT: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#3b82f6', NONE: '#94a3b8',
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Team performance and productivity insights</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={CheckSquare} label="Tasks Completed" value={data?.tasksCompleted ?? 0} sub="this month" />
            <StatCard icon={TrendingUp} label="Tasks Created" value={data?.tasksCreated ?? 0} sub="this month" />
            <StatCard icon={FolderKanban} label="Active Projects" value={data?.activeProjects ?? 0} />
            <StatCard icon={Users} label="Team Members" value={data?.teamMembers ?? 0} />
            <StatCard icon={Clock} label="Avg. Completion" value={data?.avgCompletionTime ? `${data.avgCompletionTime}d` : '—'} sub="days" />
            <StatCard icon={BarChart2} label="Completion Rate" value={data?.completionRate ? `${data.completionRate}%` : '—'} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tasks by status */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Tasks by Status</h3>
              {data?.tasksByStatus && Object.keys(data.tasksByStatus).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(data.tasksByStatus).map(([status, count]) => (
                    <SimpleBar
                      key={status}
                      label={status.replace('_', ' ')}
                      value={count}
                      max={Math.max(...Object.values(data.tasksByStatus))}
                      color={statusColors[status] ?? '#94a3b8'}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">No data available</p>
                </div>
              )}
            </div>

            {/* Tasks by priority */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4">Tasks by Priority</h3>
              {data?.tasksByPriority && Object.keys(data.tasksByPriority).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(data.tasksByPriority).map(([priority, count]) => (
                    <SimpleBar
                      key={priority}
                      label={priority}
                      value={count}
                      max={Math.max(...Object.values(data.tasksByPriority))}
                      color={priorityColors[priority] ?? '#94a3b8'}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">No data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Coming soon chart area */}
          <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
            <BarChart2 className="h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="font-semibold">Activity Timeline</h3>
            <p className="text-sm text-muted-foreground mt-1">Detailed charts and trend analysis coming soon.</p>
          </div>
        </>
      )}
    </div>
  );
}

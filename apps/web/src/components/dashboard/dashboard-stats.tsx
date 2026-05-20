'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckSquare, FolderKanban, Users, Zap } from 'lucide-react';
import { api } from '@/lib/api';

interface Stat {
  label: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

export function DashboardStats() {
  const { data } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
    staleTime: 60_000,
  });

  const stats: Stat[] = [
    {
      label: 'My Open Tasks',
      value: data?.openTasks ?? '—',
      change: data?.openTasksChange,
      icon: <CheckSquare className="h-5 w-5" />,
      color: 'text-blue-500',
    },
    {
      label: 'Active Projects',
      value: data?.activeProjects ?? '—',
      icon: <FolderKanban className="h-5 w-5" />,
      color: 'text-purple-500',
    },
    {
      label: 'Team Members',
      value: data?.teamMembers ?? '—',
      icon: <Users className="h-5 w-5" />,
      color: 'text-green-500',
    },
    {
      label: 'Completed Today',
      value: data?.completedToday ?? '—',
      icon: <Zap className="h-5 w-5" />,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-border bg-card p-4 flex items-start gap-4"
        >
          <div className={`mt-0.5 ${stat.color}`}>{stat.icon}</div>
          <div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            {stat.change && (
              <p className="text-xs text-green-500 mt-1">{stat.change}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

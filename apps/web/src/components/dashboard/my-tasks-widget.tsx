'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Circle, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format, isPast } from 'date-fns';
import type { Task } from '@/types';

const priorityConfig = {
  URGENT: { label: 'Urgent', class: 'bg-red-500/10 text-red-500 border-red-500/20' },
  HIGH: { label: 'High', class: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  MEDIUM: { label: 'Medium', class: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  LOW: { label: 'Low', class: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  NONE: { label: '', class: '' },
} satisfies Record<import('@/types').TaskPriority, { label: string; class: string }>;

export function MyTasksWidget() {
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/tasks/my?limit=10').then((r) => r.data.data ?? r.data),
    staleTime: 30_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-primary" />
          My Tasks
        </h2>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <ScrollArea className="h-64">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <CheckSquare className="h-8 w-8 opacity-30" />
            <p className="text-sm">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const overdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'DONE';
              const p = priorityConfig[task.priority] ?? priorityConfig.NONE;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                >
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    {task.dueDate && (
                      <p className={cn('text-xs mt-0.5 flex items-center gap-1', overdue ? 'text-red-500' : 'text-muted-foreground')}>
                        {overdue && <AlertCircle className="h-3 w-3" />}
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.dueDate), 'MMM d')}
                      </p>
                    )}
                  </div>
                  {p.label && (
                    <Badge variant="outline" className={cn('text-xs shrink-0', p.class)}>
                      {p.label}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

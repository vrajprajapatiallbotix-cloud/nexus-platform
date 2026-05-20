'use client';

import { useQuery } from '@tanstack/react-query';
import { FolderKanban } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';

interface ProjectProgress {
  id: string;
  name: string;
  color: string | null;
  totalTasks: number;
  completedTasks: number;
  status: string;
}

export function ProjectProgressWidget() {
  const { data: projects = [], isLoading } = useQuery<ProjectProgress[]>({
    queryKey: ['project-progress'],
    queryFn: () => api.get('/projects?includeProgress=true&limit=6').then((r) => r.data.data ?? r.data),
    staleTime: 60_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <FolderKanban className="h-4 w-4 text-primary" />
        Project Progress
      </h2>

      <ScrollArea className="h-64">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <FolderKanban className="h-8 w-8 opacity-30" />
            <p className="text-sm">No projects yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const pct = project.totalTasks > 0
                ? Math.round((project.completedTasks / project.totalTasks) * 100)
                : 0;
              return (
                <div key={project.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: project.color ?? '#6366f1' }}
                      />
                      <span className="text-sm font-medium truncate">{project.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {project.completedTasks} / {project.totalTasks} tasks
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

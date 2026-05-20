'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  actor: { name: string | null; avatarUrl: string | null };
  createdAt: string;
}

export function RecentActivityWidget() {
  const { data: items = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['recent-activity'],
    queryFn: () => api.get('/activity?limit=20').then((r) => r.data.data ?? r.data),
    staleTime: 60_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-primary" />
        Recent Activity
      </h2>

      <ScrollArea className="h-64">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                  <AvatarImage src={item.actor.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {item.actor.name?.[0] ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed">{item.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

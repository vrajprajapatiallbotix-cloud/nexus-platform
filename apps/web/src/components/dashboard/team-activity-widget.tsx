'use client';

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface TeamMemberActivity {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  status: 'online' | 'away' | 'offline';
  currentTask?: string | null;
  lastSeen: string;
  tasksCompletedToday: number;
}

const statusColor = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  offline: 'bg-muted-foreground',
};

export function TeamActivityWidget() {
  const { data: members = [], isLoading } = useQuery<TeamMemberActivity[]>({
    queryKey: ['team-activity'],
    queryFn: () => api.get('/users/team-activity').then((r) => r.data.data ?? r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-primary" />
        Team Activity
      </h2>

      <ScrollArea className="h-56">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Users className="h-8 w-8 opacity-30" />
            <p className="text-sm">No team members found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.userId} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{member.name?.[0] ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${statusColor[member.status]}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.currentTask ?? (member.status === 'offline'
                      ? `Last seen ${formatDistanceToNow(new Date(member.lastSeen), { addSuffix: true })}`
                      : 'No active task')}
                  </p>
                </div>
                {member.tasksCompletedToday > 0 && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {member.tasksCompletedToday} done
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

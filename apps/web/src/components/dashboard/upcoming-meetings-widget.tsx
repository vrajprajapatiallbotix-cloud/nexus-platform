'use client';

import { useQuery } from '@tanstack/react-query';
import { Video, Clock } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { format, isToday, isTomorrow } from 'date-fns';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string | null;
  participants: { name: string | null; avatarUrl: string | null }[];
}

function formatMeetingDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return `Today, ${format(d, 'h:mm a')}`;
  if (isTomorrow(d)) return `Tomorrow, ${format(d, 'h:mm a')}`;
  return format(d, 'MMM d, h:mm a');
}

export function UpcomingMeetingsWidget() {
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['upcoming-meetings'],
    queryFn: () => api.get('/meetings/upcoming?limit=5').then((r) => r.data.data ?? r.data),
    staleTime: 60_000,
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <Video className="h-4 w-4 text-primary" />
        Upcoming Meetings
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
          <Video className="h-8 w-8 opacity-30" />
          <p className="text-sm">No upcoming meetings</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium line-clamp-1">{meeting.title}</p>
                {meeting.meetingUrl && (
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" asChild>
                    <a href={meeting.meetingUrl} target="_blank" rel="noreferrer">Join</a>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatMeetingDate(meeting.startTime)}
              </div>
              <div className="flex -space-x-1.5">
                {meeting.participants.slice(0, 5).map((p, i) => (
                  <Avatar key={i} className="h-5 w-5 border border-background">
                    <AvatarImage src={p.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">{p.name?.[0] ?? '?'}</AvatarFallback>
                  </Avatar>
                ))}
                {meeting.participants.length > 5 && (
                  <div className="h-5 w-5 rounded-full bg-muted border border-background flex items-center justify-center text-[10px] text-muted-foreground">
                    +{meeting.participants.length - 5}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

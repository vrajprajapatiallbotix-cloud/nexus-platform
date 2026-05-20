'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, Plus, Calendar, Clock, Users, Loader2, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  meetingLink?: string;
  attendees: Array<{ user: { displayName: string; avatarUrl?: string } }>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    api.get<{ data: { meetings: Meeting[] } }>('/meetings')
      .then(r => setMeetings(r.data.data.meetings ?? []))
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = meetings.filter(m => new Date(m.startTime) >= now);
  const past = meetings.filter(m => new Date(m.startTime) < now);
  const shown = tab === 'upcoming' ? upcoming : past;

  // Group by date
  const grouped = shown.reduce<Record<string, Meeting[]>>((acc, m) => {
    const key = formatDate(m.startTime);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-muted-foreground text-sm mt-1">{upcoming.length} upcoming meeting{upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Schedule Meeting
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['upcoming', 'past'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No {tab} meetings</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {tab === 'upcoming' ? 'Schedule a meeting to get started.' : 'Past meetings will appear here.'}
          </p>
          {tab === 'upcoming' && (
            <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Schedule Meeting</Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayMeetings]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{date}</h3>
              <div className="space-y-3">
                {dayMeetings.map((meeting, i) => (
                  <motion.div key={meeting.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <MeetingCard meeting={meeting} />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const isLive = new Date(meeting.startTime) <= new Date() && new Date(meeting.endTime) >= new Date();
  const duration = Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / 60000);

  return (
    <div className={cn('bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow', isLive ? 'border-green-400/50 bg-green-50/5' : 'border-border')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 flex-1 min-w-0">
          <div className="text-center shrink-0 min-w-[52px]">
            <p className="text-xs text-muted-foreground">{formatTime(meeting.startTime)}</p>
            <p className="text-xs text-muted-foreground">{duration}min</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{meeting.title}</p>
              {isLive && <Badge className="bg-green-500 text-white text-xs shrink-0">Live</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />{meeting.attendees?.length ?? 0} attendees
              </span>
            </div>
            <div className="flex items-center -space-x-1.5 mt-2">
              {(meeting.attendees ?? []).slice(0, 5).map((a, i) => (
                <Avatar key={i} className="h-6 w-6 border-2 border-card">
                  <AvatarImage src={a.user.avatarUrl ?? ''} />
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                    {a.user.displayName?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </div>
        {meeting.meetingLink && (
          <Button size="sm" variant={isLive ? 'default' : 'outline'} className="gap-1.5 shrink-0">
            <Video className="h-3.5 w-3.5" />
            {isLive ? 'Join' : 'Open'}
          </Button>
        )}
      </div>
    </div>
  );
}

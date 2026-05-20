'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, Play, Square, Plus, Calendar, Loader2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

interface TimeEntry {
  id: string;
  description?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  task?: { title: string };
  project?: { name: string; color?: string };
  billable: boolean;
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    api.get<{ data: { entries: TimeEntry[] } }>('/time-tracking')
      .then(r => setEntries(r.data.data.entries ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setRunning(true);
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
  };

  // Group by date
  const grouped = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    const key = formatDate(e.startTime);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const todayTotal = entries
    .filter(e => new Date(e.startTime).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + (e.duration ?? 0), 0);

  const weekTotal = entries
    .filter(e => {
      const d = new Date(e.startTime);
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
      return d >= weekStart;
    })
    .reduce((sum, e) => sum + (e.duration ?? 0), 0);

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Time Tracking</h1>
          <p className="text-muted-foreground text-sm mt-1">Track time spent on tasks and projects</p>
        </div>
      </div>

      {/* Timer widget */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <Input
              placeholder="What are you working on?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="border-0 bg-transparent text-lg font-medium px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-3xl font-mono font-bold tabular-nums text-foreground">
              {formatDuration(elapsed)}
            </span>
            <Button
              onClick={toggleTimer}
              size="icon"
              className={`h-12 w-12 rounded-full ${running ? 'bg-red-500 hover:bg-red-600' : 'bg-primary'}`}
            >
              {running ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: formatDuration(todayTotal) },
          { label: 'This week', value: formatDuration(weekTotal) },
          { label: 'Entries', value: entries.length.toString() },
          { label: 'Billable', value: formatDuration(entries.filter(e => e.billable).reduce((s, e) => s + (e.duration ?? 0), 0)) },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-mono">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Timer className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">No time entries yet</h3>
          <p className="text-muted-foreground text-sm mt-1">Start the timer above to track your first entry.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayEntries]) => {
            const total = dayEntries.reduce((s, e) => s + (e.duration ?? 0), 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">{date}</h3>
                  <span className="text-sm font-mono text-muted-foreground">{formatDuration(total)}</span>
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry, i) => (
                    <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <div className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.description ?? 'No description'}</p>
                          {entry.project && (
                            <p className="text-xs text-muted-foreground">{entry.project.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {entry.billable && <Badge variant="outline" className="text-xs">Billable</Badge>}
                          <span className="text-sm font-mono">{formatDuration(entry.duration ?? 0)}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

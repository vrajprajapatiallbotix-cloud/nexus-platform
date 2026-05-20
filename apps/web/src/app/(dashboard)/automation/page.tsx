'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Plus, Play, Pause, Loader2, ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Automation {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: { type: string; config: Record<string, unknown> };
  executionCount: number;
  lastRunAt?: string;
  actions: Array<{ type: string }>;
}

const TRIGGER_LABELS: Record<string, string> = {
  TASK_CREATED: 'Task created',
  TASK_STATUS_CHANGED: 'Task status changed',
  TASK_ASSIGNED: 'Task assigned',
  DUE_DATE_APPROACHING: 'Due date approaching',
  PROJECT_CREATED: 'Project created',
  SCHEDULE: 'On schedule',
};

const ACTION_LABELS: Record<string, string> = {
  SEND_NOTIFICATION: 'Send notification',
  ASSIGN_TASK: 'Assign task',
  CHANGE_STATUS: 'Change status',
  SEND_EMAIL: 'Send email',
  CREATE_TASK: 'Create task',
  WEBHOOK: 'Call webhook',
};

export default function AutomationPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: { automations: Automation[] } }>('/automation')
      .then(r => setAutomations(r.data.data.automations ?? []))
      .catch(() => setAutomations([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await api.patch(`/automation/${id}`, { isActive: !current });
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, isActive: !current } : a));
    } catch { /* ignore */ }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automation</h1>
          <p className="text-muted-foreground text-sm mt-1">Automate repetitive workflows and tasks</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total automations', value: automations.length },
          { label: 'Active', value: automations.filter(a => a.isActive).length },
          { label: 'Total runs', value: automations.reduce((s, a) => s + (a.executionCount ?? 0), 0) },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No automations yet</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-xs">
            Set up automations to save time and reduce manual work for your team.
          </p>
          <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Automation</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((automation, i) => (
            <motion.div
              key={automation.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', automation.isActive ? 'bg-primary/10' : 'bg-muted')}>
                      <Zap className={cn('h-5 w-5', automation.isActive ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{automation.name}</p>
                        <Badge variant={automation.isActive ? 'default' : 'secondary'} className="text-xs">
                          {automation.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {automation.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{automation.description}</p>
                      )}
                      {/* Flow */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {TRIGGER_LABELS[automation.trigger?.type] ?? automation.trigger?.type}
                        </Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        {(automation.actions ?? []).slice(0, 3).map((action, j) => (
                          <Badge key={j} variant="outline" className="text-xs bg-primary/5">
                            {ACTION_LABELS[action.type] ?? action.type}
                          </Badge>
                        ))}
                        {(automation.actions?.length ?? 0) > 3 && (
                          <span className="text-xs text-muted-foreground">+{automation.actions.length - 3} more</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {automation.executionCount ?? 0} runs
                        {automation.lastRunAt && ` · Last run ${new Date(automation.lastRunAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleActive(automation.id, automation.isActive)}
                    >
                      {automation.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

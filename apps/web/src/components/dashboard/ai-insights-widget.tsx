'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Insight {
  type: 'tip' | 'warning' | 'trend';
  title: string;
  description: string;
}

const insightIcon = {
  tip: <Lightbulb className="h-4 w-4 text-yellow-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  trend: <TrendingUp className="h-4 w-4 text-green-500" />,
};

const insightBg = {
  tip: 'bg-yellow-500/5 border-yellow-500/20',
  warning: 'bg-orange-500/5 border-orange-500/20',
  trend: 'bg-green-500/5 border-green-500/20',
};

const fallbackInsights: Insight[] = [
  { type: 'tip', title: 'Focus time', description: 'You have 3 high-priority tasks due this week. Consider blocking focus time.' },
  { type: 'trend', title: 'Great momentum', description: 'Task completion rate is up 24% compared to last week.' },
  { type: 'warning', title: 'Approaching deadline', description: '2 projects are at risk of missing their milestones.' },
];

export function AiInsightsWidget() {
  const { data: insights = fallbackInsights } = useQuery<Insight[]>({
    queryKey: ['ai-insights'],
    queryFn: () => api.get('/ai/insights').then((r) => r.data?.data?.insights ?? r.data?.insights ?? fallbackInsights),
    staleTime: 300_000,
    retry: false,
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-primary" />
        AI Insights
      </h2>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={cn('rounded-lg border p-3 space-y-1', insightBg[insight.type])}
          >
            <div className="flex items-center gap-2">
              {insightIcon[insight.type]}
              <p className="text-sm font-medium">{insight.title}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

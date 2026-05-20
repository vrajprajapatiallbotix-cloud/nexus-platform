import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardGreeting } from '@/components/dashboard/dashboard-greeting';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { MyTasksWidget } from '@/components/dashboard/my-tasks-widget';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';
import { ProjectProgressWidget } from '@/components/dashboard/project-progress-widget';
import { AiInsightsWidget } from '@/components/dashboard/ai-insights-widget';
import { UpcomingMeetingsWidget } from '@/components/dashboard/upcoming-meetings-widget';
import { TeamActivityWidget } from '@/components/dashboard/team-activity-widget';
import { WidgetSkeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      <DashboardGreeting />

      {/* Stats row */}
      <Suspense fallback={<WidgetSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<WidgetSkeleton />}>
            <MyTasksWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <ProjectProgressWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <TeamActivityWidget />
          </Suspense>
        </div>

        {/* Right column — 1/3 width */}
        <div className="space-y-6">
          <Suspense fallback={<WidgetSkeleton />}>
            <AiInsightsWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <UpcomingMeetingsWidget />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton />}>
            <RecentActivityWidget />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useAuthStore } from '@/stores/auth.store';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardGreeting() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.firstName ?? user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        {getGreeting()}, {firstName} 👋
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Here&apos;s what&apos;s happening across your workspace today.
      </p>
    </div>
  );
}

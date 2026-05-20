import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { CommandPalette } from '@/components/command-palette';
import { AiAssistant } from '@/components/ai/ai-assistant';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { getServerSession } from '@/lib/auth/server-session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto scrollbar-thin">
          {children}
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette />
      <AiAssistant />
      <NotificationCenter />
    </div>
  );
}

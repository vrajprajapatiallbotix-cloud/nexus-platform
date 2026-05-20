'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, CheckSquare, FolderKanban, MessageSquare, FileText,
  BarChart2, Users, Settings, Sparkles, ChevronLeft, ChevronRight,
  Video, Clock, Zap, Database, UserCog, CreditCard, Search,
  Plus, ChevronDown, Building2, Crown, Shield, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRole, ROLE_LABELS, ROLE_COLORS } from '@/hooks/useRole';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

// Role icons for the avatar badge
const ROLE_ICONS = {
  MANAGER:   Crown,
  TEAM_LEAD: Shield,
  EMPLOYEE:  User,
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { currentWorkspace } = useWorkspaceStore();
  const { user, logout } = useAuthStore();
  const { isManager, isTeamLead, isEmployee, role, label: roleLabel, colorClass } = useRole();

  // ── Navigation items filtered by role ──────────────────────────────────
  const mainNav: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Tasks', href: '/tasks', icon: CheckSquare, badge: 0 },

    // Projects: visible to Manager + Team Lead (employees see only their assigned tasks)
    ...(!isEmployee ? [{ label: 'Projects', href: '/projects', icon: FolderKanban }] : []),

    { label: 'Chat', href: '/chat', icon: MessageSquare, badge: 0 },
    { label: 'Docs & Wiki', href: '/docs', icon: FileText },

    // Meetings: Manager + Team Lead
    ...(!isEmployee ? [{ label: 'Meetings', href: '/meetings', icon: Video }] : []),

    // Time Tracking: everyone
    { label: 'Time Tracking', href: '/time', icon: Clock },

    // Automation: Manager only
    ...(isManager ? [{ label: 'Automation', href: '/automation', icon: Zap }] : []),

    // CRM: Manager + Team Lead
    ...(isManager || isTeamLead ? [{ label: 'CRM', href: '/crm', icon: Database }] : []),

    // HR: Manager only
    ...(isManager ? [{ label: 'HR', href: '/hr', icon: UserCog }] : []),

    // Analytics: Manager + Team Lead
    ...(!isEmployee ? [{ label: 'Analytics', href: '/analytics', icon: BarChart2 }] : []),

    // Team: Manager + Team Lead
    ...(!isEmployee ? [{ label: 'Team', href: '/team', icon: Users }] : []),
  ];

  const bottomNav: NavItem[] = [
    // Billing: Manager only
    ...(isManager ? [{ label: 'Billing', href: '/settings/billing', icon: CreditCard }] : []),
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const RoleIcon = ROLE_ICONS[role];

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative flex flex-col h-full bg-card border-r border-border shrink-0 overflow-hidden"
      >
        {/* Logo & workspace */}
        <div className="flex items-center gap-3 p-4 min-h-[64px] border-b border-border">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <WorkspaceSwitcher workspace={currentWorkspace} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="px-4 pt-2 pb-1">
            <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border', colorClass)}>
              <RoleIcon className="h-3 w-3" />
              {roleLabel}
            </div>
          </div>
        )}

        {/* Search */}
        {!collapsed && (
          <div className="p-3 border-b border-border">
            <button
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent transition-colors"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded border">⌘K</kbd>
            </button>
          </div>
        )}

        {/* New button */}
        <div className="p-3">
          {collapsed ? (
            <SidebarTooltip label="New task">
              <Button size="icon" className="w-full h-9 rounded-lg">
                <Plus className="h-4 w-4" />
              </Button>
            </SidebarTooltip>
          ) : (
            <Button className="w-full gap-2 rounded-lg" size="sm">
              <Plus className="h-4 w-4" />
              {isEmployee ? 'New Task' : 'Create New'}
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2 space-y-0.5">
          {mainNav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
            />
          ))}
        </nav>

        {/* Bottom items */}
        <div className="p-3 border-t border-border space-y-0.5">
          {bottomNav.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={pathname.startsWith(item.href)}
            />
          ))}

          {/* User profile */}
          <div className={cn('flex items-center gap-3 mt-2 p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors', collapsed && 'justify-center')}>
            <div className="relative shrink-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? ''} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Role dot */}
              <div className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card flex items-center justify-center',
                role === 'MANAGER' ? 'bg-purple-500' : role === 'TEAM_LEAD' ? 'bg-blue-500' : 'bg-green-500',
              )}>
                <RoleIcon className="h-2 w-2 text-white" />
              </div>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] z-10 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors shadow-sm"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>
    </TooltipProvider>
  );
}

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  const content = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        collapsed && 'justify-center px-2',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {typeof item.badge === 'number' && item.badge > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 text-xs px-1.5">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return <SidebarTooltip label={item.label}>{content}</SidebarTooltip>;
  }
  return content;
}

function SidebarTooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function WorkspaceSwitcher({ workspace }: { workspace: unknown }) {
  return (
    <button className="flex items-center gap-2 w-full group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold truncate">
          {(workspace as { name?: string })?.name ?? 'My Workspace'}
        </span>
      </div>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </button>
  );
}

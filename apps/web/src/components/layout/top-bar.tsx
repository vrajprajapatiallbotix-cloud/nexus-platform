'use client';

import { Bell, Moon, Sun, Monitor, Search, Sparkles, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { useAiAssistantStore } from '@/stores/ai-assistant.store';

export function TopBar() {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { toggle: toggleAi } = useAiAssistantStore();
  const { theme, setTheme } = useTheme();

  const themeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const ThemeIcon = themeIcon;
  const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-6 gap-4 shrink-0">
      {/* Breadcrumb area */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {/* Dynamic breadcrumb rendered by child pages */}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Quick create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2 hidden sm:flex">
              <Plus className="h-4 w-4" />
              New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Create new</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>Task</DropdownMenuItem>
              <DropdownMenuItem>Project</DropdownMenuItem>
              <DropdownMenuItem>Document</DropdownMenuItem>
              <DropdownMenuItem>Meeting</DropdownMenuItem>
              <DropdownMenuItem>Contact (CRM)</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* AI assistant */}
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={toggleAi}
          title="Open AI assistant"
        >
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>

        {/* Search */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          title="Search (⌘K)"
        >
          <Search className="h-4 w-4" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 text-xs px-1 flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(nextTheme)}
          title="Toggle theme"
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>

        {/* Profile menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-ring transition-all">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? ''} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Account settings</DropdownMenuItem>
              <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => void logout()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

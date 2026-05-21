'use client';

import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckSquare, Plus, Clock, AlertCircle, Circle, Loader2, Flag, Users, MoreHorizontal, Trash2, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRole } from '@/hooks/useRole';
import type { Task, TaskStatus, TaskPriority } from '@/types';

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  BACKLOG: { label: 'Backlog', color: 'text-muted-foreground', icon: Circle },
  TODO: { label: 'Todo', color: 'text-blue-500', icon: Circle },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-500', icon: Clock },
  IN_REVIEW: { label: 'In Review', color: 'text-purple-500', icon: AlertCircle },
  DONE: { label: 'Done', color: 'text-green-500', icon: CheckSquare },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: 'text-red-500' },
  HIGH: { label: 'High', color: 'text-orange-500' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-500' },
  LOW: { label: 'Low', color: 'text-blue-400' },
  NONE: { label: 'None', color: 'text-muted-foreground' },
};

const GROUPS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BACKLOG', 'DONE'];

function fetchMyTasks(): Promise<Task[]> {
  return api.get('/tasks/my').then(r => {
    const payload = (r.data as any)?.data ?? r.data;
    return Array.isArray(payload) ? payload : [];
  });
}

function fetchAllTasks(): Promise<Task[]> {
  return api.get('/tasks').then(r => {
    const payload = (r.data as any)?.data ?? r.data;
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object' && 'tasks' in payload) return (payload as any).tasks ?? [];
    return [];
  });
}

export default function TasksPage() {
  const { isEmployee, isManager } = useRole();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TaskStatus | 'ALL'>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null); // person id or '__external__name'
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'mine' | 'all'>(isEmployee ? 'mine' : 'all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const queryKey = viewMode === 'mine' ? ['my-tasks'] : ['all-tasks'];

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey,
    queryFn: viewMode === 'mine' ? fetchMyTasks : fetchAllTasks,
    staleTime: 30_000,
    gcTime: 120_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
  };

  // Derive unique assignees from loaded tasks for the filter dropdown
  const uniqueAssignees = Array.from(
    new Map(
      tasks.flatMap(t => {
        const entries: { id: string; label: string; avatarUrl?: string | null; isExternal?: boolean }[] = [];
        if (t.assignee) entries.push({ id: t.assignee.id, label: t.assignee.displayName, avatarUrl: t.assignee.avatarUrl });
        const extName = t.metadata?.externalAssigneeName as string | undefined;
        if (!t.assignee && extName) entries.push({ id: `__ext__${extName}`, label: extName, isExternal: true });
        return entries;
      }).map(e => [e.id, e])
    ).values()
  );

  const visible = tasks.filter(t => {
    if (filter !== 'ALL' && t.status !== filter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (assigneeFilter) {
      if (assigneeFilter.startsWith('__ext__')) {
        const name = assigneeFilter.slice(7);
        return !t.assignee && (t.metadata?.externalAssigneeName as string | undefined) === name;
      }
      return t.assignee?.id === assigneeFilter;
    }
    return true;
  });

  const grouped = GROUPS.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s] = visible.filter(t => t.status === s);
    return acc;
  }, {} as Record<string, Task[]>);

  const activeFiltersCount = (assigneeFilter ? 1 : 0) + (priorityFilter !== 'ALL' ? 1 : 0);

  const handleUpdate = (updated: Task) => {
    queryClient.setQueryData<Task[]>(queryKey, prev =>
      prev?.map(t => t.id === updated.id ? updated : t) ?? []
    );
    setSelectedTask(updated);
  };

  const handleDelete = (taskId: string) => {
    queryClient.setQueryData<Task[]>(queryKey, prev => prev?.filter(t => t.id !== taskId) ?? []);
    queryClient.setQueryData<Task[]>(['my-tasks'], prev => prev?.filter(t => t.id !== taskId) ?? []);
    queryClient.setQueryData<Task[]>(['all-tasks'], prev => prev?.filter(t => t.id !== taskId) ?? []);
    setSelectedTask(null);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visible.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} task${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map(id => api.delete(`/tasks/${id}`)));
      const remove = (prev: Task[] | undefined) => prev?.filter(t => !selectedIds.has(t.id)) ?? [];
      queryClient.setQueryData<Task[]>(queryKey, remove);
      queryClient.setQueryData<Task[]>(['my-tasks'], remove);
      queryClient.setQueryData<Task[]>(['all-tasks'], remove);
      setSelectedIds(new Set());
    } catch {
      // partial failure — refetch to get accurate state
      queryClient.invalidateQueries({ queryKey });
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {viewMode === 'mine' ? 'My Tasks' : 'All Tasks'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            {viewMode === 'mine' ? ' assigned to you' : ' across all projects'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEmployee && (
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                onClick={() => setViewMode('mine')}
                className={cn('px-3 py-1.5 transition-colors', viewMode === 'mine' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                Mine
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors border-l border-border', viewMode === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
              >
                <Users className="h-3.5 w-3.5" />
                {isManager ? 'All' : 'Team'}
              </button>
            </div>
          )}
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {isEmployee ? 'New Task' : 'Create New'}
          </Button>
        </div>
      </div>

      {/* Role info banner */}
      {!isEmployee && viewMode === 'all' && (
        <div className={cn(
          'px-4 py-2.5 rounded-lg border text-sm',
          isManager
            ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/20 dark:border-purple-800 dark:text-purple-300'
            : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300',
        )}>
          {isManager ? 'Showing all tasks across the organization' : 'Showing tasks in your projects and assigned to your team'}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status tabs */}
        {(['ALL', ...GROUPS] as (TaskStatus | 'ALL')[]).map(s => {
          const count = s === 'ALL' ? tasks.length : tasks.filter(t => t.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
              {count > 0 && (
                <span className={cn('ml-1.5 text-xs', filter === s ? 'opacity-70' : 'text-muted-foreground')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <div className="h-5 w-px bg-border mx-1" />

        {/* Assignee filter */}
        <AssigneeFilterPicker
          assigneeFilter={assigneeFilter}
          assigneePickerOpen={assigneePickerOpen}
          setAssigneePickerOpen={setAssigneePickerOpen}
          setAssigneeFilter={setAssigneeFilter}
          uniqueAssignees={uniqueAssignees}
        />

        {/* Priority filter */}
        <PriorityFilterPicker
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
        />

        {/* Clear filters */}
        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={() => { setAssigneeFilter(null); setPriorityFilter('ALL'); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-3 w-3" />
            Clear {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <CheckSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No tasks</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {activeFiltersCount > 0 || filter !== 'ALL'
              ? 'No tasks match the active filters.'
              : 'No tasks found.'}
          </p>
          {filter === 'ALL' && (
            <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Task
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map(status => {
            const group = grouped[status];
            if (!group || group.length === 0) return null;
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <cfg.icon className={cn('h-4 w-4', cfg.color)} />
                  <span className="text-sm font-semibold">{cfg.label}</span>
                  <span className="text-xs text-muted-foreground">({group.length})</span>
                </div>
                <div className="space-y-2">
                  {group.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <TaskRow
                        task={task}
                        showAssignee={viewMode === 'all'}
                        onClick={() => setSelectedTask(task)}
                        onDelete={handleDelete}
                        isSelected={selectedIds.has(task.id)}
                        onToggleSelect={e => toggleSelect(task.id, e)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating bulk-action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background px-5 py-2.5 rounded-full shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="w-px h-4 bg-background/20" />
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-sm opacity-70 hover:opacity-100 transition-opacity"
          >
            {selectedIds.size === visible.length ? 'Deselect all' : 'Select all'}
          </button>
          <div className="w-px h-4 bg-background/20" />
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          projectId={selectedTask.projectId}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {showCreate && (
        <CreateTaskModal
          projectId=""
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}

// ── Filter picker sub-components ────────────────────────────────────────────

type UniqueAssignee = { id: string; label: string; avatarUrl?: string | null; isExternal?: boolean };

function AssigneeFilterPicker({ assigneeFilter, assigneePickerOpen, setAssigneePickerOpen, setAssigneeFilter, uniqueAssignees }: {
  assigneeFilter: string | null;
  assigneePickerOpen: boolean;
  setAssigneePickerOpen: (v: boolean) => void;
  setAssigneeFilter: (v: string | null) => void;
  uniqueAssignees: UniqueAssignee[];
}) {
  const active = uniqueAssignees.find(u => u.id === assigneeFilter);
  return (
    <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
            assigneeFilter ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {active ? (
            <>
              <Avatar className={cn('h-4 w-4', active.isExternal && 'ring-1 ring-dashed ring-orange-400')}>
                <AvatarFallback className={cn('text-[8px]', active.isExternal ? 'bg-orange-100 text-orange-700' : 'bg-primary text-primary-foreground')}>
                  {active.label[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{active.label.split(' ')[0]}</span>
            </>
          ) : (
            <><Users className="h-3.5 w-3.5" /><span>Assignee</span></>
          )}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search person..." />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="everyone"
                onMouseDown={(e) => { e.preventDefault(); setAssigneeFilter(null); setAssigneePickerOpen(false); }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-muted-foreground">Everyone</span>
                {!assigneeFilter && <span className="text-primary text-xs">✓</span>}
              </CommandItem>
              {uniqueAssignees.map(a => (
                <CommandItem
                  key={a.id}
                  value={a.label}
                  onMouseDown={(e) => { e.preventDefault(); setAssigneeFilter(a.id); setAssigneePickerOpen(false); }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className={cn('h-5 w-5 shrink-0', a.isExternal && 'ring-1 ring-dashed ring-orange-400')}>
                    {!a.isExternal && <AvatarImage src={a.avatarUrl ?? ''} />}
                    <AvatarFallback className={cn('text-[10px]', a.isExternal ? 'bg-orange-100 text-orange-700' : 'bg-primary text-primary-foreground')}>
                      {a.label[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{a.label}</span>
                  {a.isExternal && <span className="text-[10px] text-orange-500">ext</span>}
                  {assigneeFilter === a.id && <span className="text-primary text-xs">✓</span>}
                </CommandItem>
              ))}
              {uniqueAssignees.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No assignees yet</p>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PriorityFilterPicker({ priorityFilter, setPriorityFilter }: {
  priorityFilter: TaskPriority | 'ALL';
  setPriorityFilter: (v: TaskPriority | 'ALL') => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
            priorityFilter !== 'ALL' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          <Flag className={cn('h-3.5 w-3.5', priorityFilter !== 'ALL' ? PRIORITY_CONFIG[priorityFilter].color : '')} />
          <span>{priorityFilter === 'ALL' ? 'Priority' : PRIORITY_CONFIG[priorityFilter].label}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuItem onSelect={() => setPriorityFilter('ALL')}>
          <span className="flex-1 text-muted-foreground">All priorities</span>
          {priorityFilter === 'ALL' && <span className="text-primary text-xs">✓</span>}
        </DropdownMenuItem>
        {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map(p => (
          <DropdownMenuItem key={p} onSelect={() => setPriorityFilter(p)}>
            <Flag className={cn('mr-2 h-3.5 w-3.5', PRIORITY_CONFIG[p].color)} />
            <span className="flex-1">{PRIORITY_CONFIG[p].label}</span>
            {priorityFilter === p && <span className="text-primary text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onClick, showAssignee, onDelete, isSelected, onToggleSelect }: {
  task: Task;
  onClick: () => void;
  showAssignee?: boolean;
  onDelete?: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
}) {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.NONE;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  const externalName = !task.assignee ? (task.metadata?.externalAssigneeName as string | undefined) : undefined;
  const person = task.assignee ?? (externalName ? null : task.creator);
  const isCreatorFallback = !task.assignee && !externalName && !!task.creator;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      onDelete?.(task.id);
    } catch {
      // toast shown by parent on failure
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-card border rounded-lg hover:shadow-sm transition-all group cursor-pointer',
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div
        className={cn('shrink-0 transition-opacity', isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
        onClick={e => { e.stopPropagation(); onToggleSelect?.(e); }}
      >
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => {}}
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
        />
      </div>
      <Flag className={cn('h-3.5 w-3.5 shrink-0', priority.color)} />
      <span className="flex-1 text-sm font-medium truncate group-hover:text-primary transition-colors">{task.title}</span>
      <div className="flex items-center gap-3 shrink-0">
        {(task as Task & { project?: { name: string } }).project?.name && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {(task as Task & { project?: { name: string } }).project!.name}
          </span>
        )}
        {task.dueDate && (
          <span className={cn('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <Badge variant="outline" className="text-xs hidden sm:flex">{priority.label}</Badge>
        {externalName ? (
          <div className="flex items-center gap-1.5" title={`Assigned to ${externalName} (external)`}>
            <Avatar className="h-6 w-6 ring-1 ring-dashed ring-orange-400">
              <AvatarFallback className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                {externalName[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {showAssignee && (
              <span className="text-xs text-orange-600 dark:text-orange-400 hidden md:block max-w-[80px] truncate">{externalName.split(' ')[0]}</span>
            )}
          </div>
        ) : person ? (
          <div className="flex items-center gap-1.5" title={isCreatorFallback ? `Created by ${person.displayName}` : person.displayName}>
            <Avatar className={cn('h-6 w-6', isCreatorFallback && 'opacity-50 ring-1 ring-dashed ring-muted-foreground')}>
              <AvatarImage src={person.avatarUrl ?? ''} />
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {person.displayName?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {showAssignee && (
              <span className="text-xs text-muted-foreground hidden md:block max-w-[80px] truncate">
                {isCreatorFallback ? <span className="italic">Unassigned</span> : person.displayName?.split(' ')[0]}
              </span>
            )}
          </div>
        ) : null}
        {/* Row actions — visible on hover */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <button className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

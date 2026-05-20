'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import {
  X, Flag, Calendar, User, Tag, MessageSquare, Paperclip, CheckSquare,
  Circle, Clock, AlertCircle, ChevronDown, Send, Loader2, Trash2, Link2, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Task, TaskStatus, TaskPriority, User as UserType } from '@/types';

// ── Config ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'BACKLOG', label: 'Backlog', icon: Circle, color: 'text-slate-400' },
  { value: 'TODO', label: 'Todo', icon: Circle, color: 'text-blue-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: Clock, color: 'text-yellow-500' },
  { value: 'IN_REVIEW', label: 'In Review', icon: AlertCircle, color: 'text-purple-500' },
  { value: 'DONE', label: 'Done', icon: CheckSquare, color: 'text-green-500' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'URGENT', label: 'Urgent', color: 'text-red-500' },
  { value: 'HIGH', label: 'High', color: 'text-orange-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-500' },
  { value: 'LOW', label: 'Low', color: 'text-blue-400' },
  { value: 'NONE', label: 'None', color: 'text-muted-foreground' },
];

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string; avatarUrl?: string };
}

interface TaskDetailDrawerProps {
  task: Task | null;
  projectId: string;
  onClose: () => void;
  onUpdate?: (updated: Task) => void;
  onDelete?: (taskId: string) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function TaskDetailDrawer({ task, projectId, onClose, onUpdate, onDelete }: TaskDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [localTask, setLocalTask] = useState<Task | null>(task);
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [members, setMembers] = useState<UserType[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTask(task);
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setEditingTitle(false);
    setEditingDesc(false);
    if (task) {
      loadComments(task.id);
      loadMembers();
    }
  }, [task?.id]);

  const loadComments = async (taskId: string) => {
    try {
      const r = await api.get<{ data: Comment[] }>(`/tasks/${taskId}/comments`);
      setComments(Array.isArray(r.data.data) ? r.data.data : []);
    } catch { setComments([]); }
  };

  const loadMembers = async () => {
    try {
      const r = await api.get<{ data: { members: Array<{ user: UserType }> } }>('/organizations/members');
      setMembers((r.data.data.members ?? []).map(m => m.user));
    } catch { setMembers([]); }
  };

  const patchTask = async (data: Record<string, unknown>, field: string) => {
    if (!localTask) return;
    setSavingField(field);
    try {
      const r = await api.patch<{ data: Task }>(`/tasks/${localTask.id}`, data);
      const updated = { ...localTask, ...data } as Task;
      setLocalTask(updated);
      onUpdate?.(updated);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    } catch {
      toast.error('Failed to update task');
    } finally {
      setSavingField(null);
    }
  };

  const saveTitle = async () => {
    setEditingTitle(false);
    if (title.trim() && title !== localTask?.title) {
      await patchTask({ title: title.trim() }, 'title');
    }
  };

  const saveDescription = async () => {
    setEditingDesc(false);
    if (description !== localTask?.description) {
      await patchTask({ description }, 'description');
    }
  };

  const sendComment = async () => {
    if (!newComment.trim() || !localTask) return;
    setSendingComment(true);
    const text = newComment.trim();
    setNewComment('');
    try {
      await api.post(`/tasks/${localTask.id}/comments`, { content: text });
      await loadComments(localTask.id);
    } catch {
      toast.error('Failed to send comment');
      setNewComment(text);
    } finally {
      setSendingComment(false);
    }
  };

  const deleteTask = async () => {
    if (!localTask) return;
    if (!confirm(`Delete "${localTask.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/tasks/${localTask.id}`);
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
      toast.success('Task deleted');
      onDelete?.(localTask.id);
      onClose();
    } catch {
      toast.error('Failed to delete task');
    }
  };

  if (!localTask) return null;

  const statusCfg = STATUS_OPTIONS.find(s => s.value === localTask.status)!;
  const priorityCfg = PRIORITY_OPTIONS.find(p => p.value === localTask.priority)!;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 bg-background border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <StatusPicker
              value={localTask.status}
              onChange={s => patchTask({ status: s }, 'status')}
              loading={savingField === 'status'}
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={deleteTask}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              {editingTitle ? (
                <input
                  ref={titleRef}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(localTask.title); setEditingTitle(false); } }}
                  className="w-full text-xl font-bold bg-transparent outline-none border-b-2 border-primary pb-1"
                  autoFocus
                />
              ) : (
                <h1
                  className="text-xl font-bold cursor-text hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {localTask.title}
                </h1>
              )}
            </div>

            {/* Properties grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <PropertyRow label="Status" icon={statusCfg.icon} iconClass={statusCfg.color}>
                <StatusPicker value={localTask.status} onChange={s => patchTask({ status: s }, 'status')} loading={savingField === 'status'} showLabel />
              </PropertyRow>

              {/* Priority */}
              <PropertyRow label="Priority" icon={Flag} iconClass={priorityCfg.color}>
                <PriorityPicker value={localTask.priority} onChange={p => patchTask({ priority: p }, 'priority')} loading={savingField === 'priority'} />
              </PropertyRow>

              {/* Assignee */}
              <PropertyRow label="Assignee" icon={User} iconClass="text-muted-foreground">
                <AssigneePicker
                  value={localTask.assignee ?? null}
                  externalName={(localTask.metadata?.externalAssigneeName as string) ?? ''}
                  members={members}
                  onChange={u => patchTask({ assigneeId: u?.id ?? null, metadata: { ...(localTask.metadata ?? {}), externalAssigneeName: '' } }, 'assigneeId')}
                  onExternalChange={name => patchTask({ assigneeId: null, metadata: { ...(localTask.metadata ?? {}), externalAssigneeName: name } }, 'assigneeId')}
                  loading={savingField === 'assigneeId'}
                />
              </PropertyRow>

              {/* Due date */}
              <PropertyRow label="Due Date" icon={Calendar} iconClass="text-muted-foreground">
                <DatePicker
                  value={localTask.dueDate ? new Date(localTask.dueDate) : undefined}
                  onChange={d => patchTask({ dueDate: d ? d.toISOString() : null }, 'dueDate')}
                  loading={savingField === 'dueDate'}
                />
              </PropertyRow>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Description</p>
              {editingDesc ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="min-h-[120px] resize-none"
                    placeholder="Add a description..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDescription}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDescription(localTask.description ?? ''); setEditingDesc(false); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="min-h-[60px] rounded-lg px-3 py-2 text-sm cursor-text hover:bg-muted/50 transition-colors"
                  onClick={() => setEditingDesc(true)}
                >
                  {description || <span className="text-muted-foreground">Click to add a description...</span>}
                </div>
              )}
            </div>

            <Separator />

            {/* Tabs: Comments / Activity */}
            <Tabs defaultValue="comments">
              <TabsList className="w-full">
                <TabsTrigger value="comments" className="flex-1 gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comments ({comments.length})
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="space-y-4 mt-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first to comment.</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map(comment => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarImage src={comment.author.avatarUrl ?? ''} />
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {comment.author.displayName?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold">{comment.author.displayName}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment input */}
                <div className="flex gap-2 pt-2">
                  <Textarea
                    placeholder="Write a comment..."
                    className="flex-1 min-h-[72px] resize-none"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendComment(); }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0 self-end"
                    onClick={sendComment}
                    disabled={!newComment.trim() || sendingComment}
                  >
                    {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">⌘+Enter to submit</p>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <p className="text-sm text-muted-foreground text-center py-6">Activity log coming soon.</p>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between text-xs text-muted-foreground">
          <span>Created {format(new Date(localTask.createdAt), 'MMM d, yyyy')}</span>
          <span>Updated {format(new Date(localTask.updatedAt), 'MMM d, yyyy')}</span>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PropertyRow({ label, icon: Icon, iconClass, children }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', iconClass)} />
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusPicker({ value, onChange, loading, showLabel }: {
  value: TaskStatus;
  onChange: (v: TaskStatus) => void;
  loading?: boolean;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_OPTIONS.find(s => s.value === value)!;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm hover:bg-accent rounded px-2 py-1 transition-colors">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <cfg.icon className={cn('h-3.5 w-3.5', cfg.color)} />}
          {showLabel && <span>{cfg.label}</span>}
          {!showLabel && <span className="text-muted-foreground">{cfg.label}</span>}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => { onChange(s.value); setOpen(false); }}
            className={cn('flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors', value === s.value && 'bg-accent')}
          >
            <s.icon className={cn('h-3.5 w-3.5', s.color)} />
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PriorityPicker({ value, onChange, loading }: {
  value: TaskPriority;
  onChange: (v: TaskPriority) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cfg = PRIORITY_OPTIONS.find(p => p.value === value)!;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm hover:bg-accent rounded px-2 py-1 transition-colors">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className={cn('h-3.5 w-3.5', cfg.color)} />}
          <span>{cfg.label}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-36 p-1" align="start">
        {PRIORITY_OPTIONS.map(p => (
          <button
            key={p.value}
            onClick={() => { onChange(p.value); setOpen(false); }}
            className={cn('flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors', value === p.value && 'bg-accent')}
          >
            <Flag className={cn('h-3.5 w-3.5', p.color)} />
            {p.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function AssigneePicker({ value, externalName, members, onChange, onExternalChange, loading }: {
  value: UserType | null;
  externalName?: string;
  members: UserType[];
  onChange: (u: UserType | null) => void;
  onExternalChange?: (name: string) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const displayExternal = !value && !!externalName;

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-sm hover:bg-accent rounded px-2 py-1 transition-colors">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : displayExternal ? (
            <Avatar className="h-5 w-5 ring-1 ring-dashed ring-orange-400">
              <AvatarFallback className="text-[10px] bg-orange-100 text-orange-700">{externalName![0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : value ? (
            <Avatar className="h-5 w-5">
              <AvatarImage src={value.avatarUrl ?? ''} />
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{value.displayName?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={displayExternal ? 'text-orange-600 dark:text-orange-400' : value ? '' : 'text-muted-foreground'}>
            {displayExternal ? externalName : value?.displayName ?? 'Unassigned'}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type a name..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandGroup>
              <CommandItem onSelect={() => { onChange(null); onExternalChange?.(''); setOpen(false); }}>
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Unassigned</span>
              </CommandItem>
              {members
                .filter(m => !search || m.displayName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()))
                .map(m => (
                  <CommandItem key={m.id} onSelect={() => { onChange(m); onExternalChange?.(''); setOpen(false); }}>
                    <Avatar className="h-5 w-5 mr-2">
                      <AvatarImage src={m.avatarUrl ?? ''} />
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{m.displayName?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    </div>
                    {value?.id === m.id && <CheckSquare className="h-4 w-4 text-primary ml-2" />}
                  </CommandItem>
                ))}
              {/* Manual name entry */}
              {search.trim().length > 1 && !members.some(m => m.displayName.toLowerCase() === search.toLowerCase()) && (
                <CommandItem
                  onSelect={() => { onChange(null); onExternalChange?.(search.trim()); setSearch(''); setOpen(false); }}
                  className="gap-2 text-orange-600 dark:text-orange-400"
                >
                  <Plus className="h-4 w-4" />
                  Add &quot;{search.trim()}&quot; manually
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DatePicker({ value, onChange, loading }: {
  value?: Date;
  onChange: (d: Date | undefined) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isOverdue = value && value < new Date();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('flex items-center gap-1.5 text-sm hover:bg-accent rounded px-2 py-1 transition-colors', isOverdue && 'text-red-500')}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5" />}
          <span>{value ? format(value, 'MMM d, yyyy') : <span className="text-muted-foreground">No due date</span>}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={value}
          onSelect={d => { onChange(d); setOpen(false); }}
          initialFocus
        />
        {value && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => { onChange(undefined); setOpen(false); }}>
              Clear due date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Flag, Calendar, User, ChevronDown, Loader2, X, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { TaskStatus, TaskPriority, User as UserType } from '@/types';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'URGENT', label: 'Urgent', color: 'text-red-500' },
  { value: 'HIGH', label: 'High', color: 'text-orange-500' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-500' },
  { value: 'LOW', label: 'Low', color: 'text-blue-400' },
  { value: 'NONE', label: 'None', color: 'text-muted-foreground' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'Todo' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
];

interface CreateTaskModalProps {
  projectId: string;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateTaskModal({ projectId, defaultStatus = 'TODO', onClose, onCreated }: CreateTaskModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [assignee, setAssignee] = useState<UserType | null>(null);
  const [externalAssigneeName, setExternalAssigneeName] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [members, setMembers] = useState<UserType[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, setFocus } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    setFocus('title');
    // Try workspace members first, fall back to org members
    api.get<{ data: { members: Array<{ user: UserType }> } }>('/workspaces/current/members')
      .then(r => setMembers((r.data.data?.members ?? []).map(m => m.user)))
      .catch(() =>
        api.get<{ data: { members: Array<{ user: UserType }> } }>('/users')
          .then(r => {
            const list = Array.isArray(r.data.data) ? r.data.data : (r.data.data as any)?.users ?? [];
            setMembers(list);
          })
          .catch(() => {})
      );
  }, []);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await api.post('/tasks', {
        title: data.title,
        description: data.description || undefined,
        ...(projectId ? { projectId } : {}),
        status,
        priority,
        assigneeId: assignee?.id ?? (externalAssigneeName ? undefined : user?.id),
        dueDate: dueDate?.toISOString(),
        ...(externalAssigneeName ? { metadata: { externalAssigneeName } } : {}),
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task created');
      onCreated?.();
      onClose();
    } catch {
      toast.error('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const priorityCfg = PRIORITY_OPTIONS.find(p => p.value === priority)!;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Create Task</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="Task title..."
              {...register('title')}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add more details..."
              className="min-h-[80px] resize-none"
              {...register('description')}
            />
          </div>

          {/* Properties row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  {STATUS_OPTIONS.find(s => s.value === status)?.label}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => { setStatus(s.value); setStatusOpen(false); }}
                    className={cn('flex w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors', status === s.value && 'bg-accent')}
                  >
                    {s.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Priority */}
            <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <Flag className={cn('h-3.5 w-3.5', priorityCfg.color)} />
                  {priorityCfg.label}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-36 p-1" align="start">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setPriority(p.value); setPriorityOpen(false); }}
                    className={cn('flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors', priority === p.value && 'bg-accent')}
                  >
                    <Flag className={cn('h-3.5 w-3.5', p.color)} />
                    {p.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Assignee */}
            <Popover open={assigneeOpen} onOpenChange={open => { setAssigneeOpen(open); if (!open) setAssigneeSearch(''); }}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  {assignee ? (
                    <>
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={assignee.avatarUrl ?? ''} />
                        <AvatarFallback className="text-[8px]">{assignee.displayName?.[0]}</AvatarFallback>
                      </Avatar>
                      {assignee.displayName}
                    </>
                  ) : externalAssigneeName ? (
                    <>
                      <Avatar className="h-4 w-4 ring-1 ring-dashed ring-orange-400">
                        <AvatarFallback className="text-[8px] bg-orange-100 text-orange-700">{externalAssigneeName[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {externalAssigneeName}
                    </>
                  ) : (
                    <>
                      <User className="h-3.5 w-3.5" />
                      Assignee
                    </>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search or type a name..."
                    value={assigneeSearch}
                    onValueChange={setAssigneeSearch}
                  />
                  <CommandList>
                    <CommandGroup>
                      <CommandItem
                        value="unassigned"
                        onMouseDown={(e) => { e.preventDefault(); setAssignee(null); setExternalAssigneeName(''); setAssigneeOpen(false); }}
                      >
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Unassigned</span>
                      </CommandItem>
                      {members
                        .filter(m => !assigneeSearch || m.displayName.toLowerCase().includes(assigneeSearch.toLowerCase()))
                        .map(m => (
                          <CommandItem
                            key={m.id}
                            value={m.displayName}
                            onMouseDown={(e) => { e.preventDefault(); setAssignee(m); setExternalAssigneeName(''); setAssigneeOpen(false); }}
                          >
                            <Avatar className="h-5 w-5 mr-2 shrink-0">
                              <AvatarImage src={m.avatarUrl ?? ''} />
                              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{m.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{m.displayName}</span>
                          </CommandItem>
                        ))}
                      {/* Type a name to create an external assignee */}
                      {assigneeSearch.trim().length > 1 && !members.some(m => m.displayName.toLowerCase() === assigneeSearch.toLowerCase()) && (
                        <CommandItem
                          value={`create-${assigneeSearch}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setAssignee(null);
                            setExternalAssigneeName(assigneeSearch.trim());
                            setAssigneeSearch('');
                            setAssigneeOpen(false);
                          }}
                          className="gap-2 text-orange-600 dark:text-orange-400"
                        >
                          <Plus className="h-4 w-4" />
                          Add &quot;{assigneeSearch.trim()}&quot; as assignee
                        </CommandItem>
                      )}
                    </CommandGroup>
                    {!assigneeSearch && members.length === 0 && (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        No team members yet — type a name to assign manually
                      </div>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Due date */}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-8">
                  <Calendar className="h-3.5 w-3.5" />
                  {dueDate ? format(dueDate, 'MMM d') : 'Due date'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={dueDate}
                  onSelect={d => { setDueDate(d); setDateOpen(false); }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

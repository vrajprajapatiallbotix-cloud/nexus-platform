'use client';

import { useState, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageSquare, Paperclip, Flag, Clock, Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { CreateTaskModal } from '@/components/tasks/create-task-modal';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Task, TaskStatus, TaskPriority } from '@/types';

type Column = { id: TaskStatus; label: string; color: string; limit?: number };

const COLUMNS: Column[] = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'TODO', label: 'To Do', color: 'bg-blue-400' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-400', limit: 5 },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-400', limit: 3 },
  { id: 'DONE', label: 'Done', color: 'bg-green-400' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  URGENT: 'text-red-500', HIGH: 'text-orange-500',
  MEDIUM: 'text-yellow-500', LOW: 'text-blue-400', NONE: 'text-muted-foreground',
};

export default function KanbanBoardPage({ params }: { params: { id: string } }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', params.id],
    queryFn: () => api.get<{ data: { tasks: Task[] } }>(`/tasks?projectId=${params.id}&limit=200`),
  });

  const tasks: Task[] = (tasksData?.data as unknown as { data: { tasks: Task[] } })?.data?.tasks
    ?? (tasksData?.data as unknown as { tasks: Task[] })?.tasks
    ?? [];

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.patch(`/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', params.id] });
      const prev = queryClient.getQueryData(['tasks', params.id]);
      queryClient.setQueryData(['tasks', params.id], (old: unknown) => {
        const o = old as { data: { tasks: Task[] } } | undefined;
        if (!o) return old;
        return { ...o, data: { ...o.data, tasks: o.data.tasks.map(t => t.id === id ? { ...t, status } : t) } };
      });
      return { prev };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['tasks', params.id], ctx?.prev);
      toast.error('Failed to move task');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', params.id] }),
  });

  const tasksByStatus = useCallback(
    (status: TaskStatus) => tasks.filter(t => t.status === status).sort((a, b) => a.orderIndex - b.orderIndex),
    [tasks],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || active.id === over.id) return;
    const dragged = tasks.find(t => t.id === active.id);
    const overColumn = COLUMNS.find(c => c.id === over.id);
    const overTask = tasks.find(t => t.id === over.id);
    const newStatus = overColumn?.id ?? overTask?.status;
    if (dragged && newStatus && dragged.status !== newStatus) {
      updateTaskMutation.mutate({ id: String(active.id), status: newStatus });
    }
  };

  const handleTaskClick = (task: Task) => setSelectedTask(task);

  const handleTaskUpdate = (updated: Task) => {
    queryClient.setQueryData(['tasks', params.id], (old: unknown) => {
      const o = old as { data: { tasks: Task[] } } | undefined;
      if (!o) return old;
      return { ...o, data: { ...o.data, tasks: o.data.tasks.map(t => t.id === updated.id ? updated : t) } };
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full gap-4 p-6 overflow-x-auto">
        {COLUMNS.map(col => (
          <div key={col.id} className="w-72 shrink-0">
            <div className="h-8 bg-muted rounded-lg animate-pulse mb-4" />
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse mb-3" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
        <span className="text-sm text-muted-foreground">{tasks.length} tasks</span>
        <Button variant="outline" size="sm" className="gap-2 ml-auto">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Generate
        </Button>
        <Button size="sm" className="gap-2" onClick={() => setCreateStatus('TODO')}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-6 h-full min-h-0">
            {COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus(column.id)}
                isOverLimit={!!(column.limit && tasksByStatus(column.id).length > column.limit)}
                onAddTask={() => setCreateStatus(column.id)}
                onTaskClick={handleTaskClick}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          projectId={params.id}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
        />
      )}

      {/* Create task modal */}
      {createStatus && (
        <CreateTaskModal
          projectId={params.id}
          defaultStatus={createStatus}
          onClose={() => setCreateStatus(null)}
        />
      )}
    </div>
  );
}

function KanbanColumn({ column, tasks, isOverLimit, onAddTask, onTaskClick }: {
  column: Column; tasks: Task[]; isOverLimit: boolean;
  onAddTask: () => void; onTaskClick: (t: Task) => void;
}) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-2 w-2 rounded-full', column.color)} />
        <span className="font-medium text-sm">{column.label}</span>
        <Badge variant="secondary" className={cn('ml-auto text-xs', isOverLimit && 'bg-destructive/10 text-destructive')}>
          {tasks.length}{column.limit ? `/${column.limit}` : ''}
        </Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddTask}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div
          id={column.id}
          className="flex-1 space-y-3 min-h-[120px] rounded-xl p-2 bg-muted/30 border-2 border-dashed border-transparent transition-colors"
        >
          <AnimatePresence mode="popLayout">
            {tasks.map(task => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <SortableTaskCard task={task} onClick={() => onTaskClick(task)} />
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes}>
      <TaskCard task={task} isDragging={isDragging} dragListeners={listeners} onClick={onClick} />
    </div>
  );
}

function TaskCard({ task, isDragging, dragListeners, onClick }: {
  task: Task; isDragging?: boolean;
  dragListeners?: ReturnType<typeof useSortable>['listeners'];
  onClick?: () => void;
}) {
  const subtaskProgress = task._count.subtasks > 0
    ? Math.round((task.completedSubtasks ?? 0) / task._count.subtasks * 100)
    : null;

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-3 space-y-3 shadow-sm',
        'hover:shadow-md hover:border-primary/20 transition-all',
        isDragging && 'opacity-50 rotate-2 shadow-xl',
      )}
    >
      {/* Drag handle + Labels */}
      <div {...dragListeners} className="cursor-grab active:cursor-grabbing">
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels.slice(0, 3).map(l => (
              <span
                key={l.label.id}
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: l.label.color + '20', color: l.label.color }}
              >
                {l.label.name}
              </span>
            ))}
          </div>
        )}

        {/* Title — clickable */}
        <p
          className="text-sm font-medium leading-snug line-clamp-2 cursor-pointer hover:text-primary transition-colors"
          onClick={e => { e.stopPropagation(); onClick?.(); }}
        >
          {task.title}
        </p>
      </div>

      {/* Subtask progress */}
      {subtaskProgress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtasks</span>
            <span>{task.completedSubtasks ?? 0}/{task._count.subtasks}</span>
          </div>
          <Progress value={subtaskProgress} className="h-1" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2">
        <Flag className={cn('h-3.5 w-3.5 shrink-0', PRIORITY_COLORS[task.priority])} />
        {task.dueDate && (
          <span className={cn(
            'text-xs text-muted-foreground',
            new Date(task.dueDate) < new Date() && task.status !== 'DONE' && 'text-destructive font-medium',
          )}>
            {format(new Date(task.dueDate), 'MMM d')}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {task._count.comments > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />{task._count.comments}
            </div>
          )}
          {task._count.attachments > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />{task._count.attachments}
            </div>
          )}
          {task.assignee && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={task.assignee.avatarUrl ?? ''} />
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {task.assignee.displayName[0]}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}

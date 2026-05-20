export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface User {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export interface TaskLabel {
  label: {
    id: string;
    name: string;
    color: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  orderIndex: number;
  dueDate?: string | null;
  estimatedHours?: number | null;
  completedAt?: string | null;
  projectId: string;
  assignee?: User | null;
  creator?: User | null;
  assignees?: User[];
  labels: TaskLabel[];
  completedSubtasks?: number;
  metadata?: Record<string, unknown> | null;
  _count: {
    comments: number;
    attachments: number;
    subtasks: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  color?: string | null;
  icon?: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  plan: string;
}

export interface Workspace {
  id: string;
  name: string;
  organizationId: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  actionUrl?: string | null;
  createdAt: string;
}

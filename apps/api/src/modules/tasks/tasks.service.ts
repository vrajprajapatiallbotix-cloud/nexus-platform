import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Task, TaskStatus, TaskPriority, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';
import type { TaskFiltersDto } from './dto/task-filters.dto.js';

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateTaskDto, creatorId: string): Promise<Task> {
    if (dto.parentId) {
      const parent = await this.prisma.task.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent task not found');
    }

    // Strip non-Prisma fields before spread to prevent PrismaClientValidationError
    const { labelIds, tagIds, ...taskData } = dto;

    const maxOrder = await this.prisma.task.findFirst({
      where: { projectId: taskData.projectId ?? null, parentId: taskData.parentId ?? null, status: taskData.status ?? 'TODO' },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const task = await this.prisma.task.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...taskData,
        creatorId,
        orderIndex: (maxOrder?.orderIndex ?? 0) + 1000,
        ...(labelIds?.length
          ? { labels: { create: labelIds.map((labelId) => ({ label: { connect: { id: labelId } } })) } }
          : {}),
        ...(tagIds?.length
          ? { tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) } }
          : {}),
      } as any,
      include: this.getTaskIncludes(),
    });

    this.events.emit('task.created', { task, creatorId });
    this.logger.debug(`Task created: ${task.id} by ${creatorId}`);

    return task;
  }

  async findAll(filters: TaskFiltersDto, userId: string, userRole = 'MEMBER'): Promise<PaginatedTasks> {
    const { page = 1, limit = 50, projectId, status, priority, assigneeId, search, sprintId, parentId, dueDateStart, dueDateEnd } = filters;

    // Role-based scope: managers see all, team leads see project tasks, employees see only theirs
    const roleScope: Prisma.TaskWhereInput =
      userRole === 'SUPER_ADMIN' || userRole === 'MANAGER'
        ? {}
        : userRole === 'ADMIN'
          ? { OR: [{ assigneeId: userId }, { project: { members: { some: { userId } } } }] }
          : { assigneeId: userId };

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...roleScope,
      ...(projectId && { projectId }),
      ...(status && { status: status as TaskStatus }),
      ...(priority && { priority: priority as TaskPriority }),
      ...(assigneeId && { assigneeId }),
      ...(sprintId && { sprintId }),
      ...(parentId !== undefined && { parentId: parentId ?? null }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(dueDateStart || dueDateEnd
        ? {
            dueDate: {
              ...(dueDateStart && { gte: new Date(dueDateStart) }),
              ...(dueDateEnd && { lte: new Date(dueDateEnd) }),
            },
          }
        : {}),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: this.getTaskIncludes(),
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
        ...this.prisma.paginate(page, limit),
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...this.getTaskIncludes(),
        subtasks: {
          where: { deletedAt: null },
          include: this.getTaskIncludes(),
          orderBy: { orderIndex: 'asc' },
        },
        dependencies: {
          include: { blocking: { select: { id: true, title: true, status: true } } },
        },
        blockedBy: {
          include: { dependent: { select: { id: true, title: true, status: true } } },
        },
        checklists: {
          orderBy: { orderIndex: 'asc' },
          include: { items: { orderBy: { orderIndex: 'asc' } } },
        },
        timeEntries: {
          where: { userId },
          orderBy: { startTime: 'desc' },
          take: 10,
        },
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string): Promise<Task> {
    const existing = await this.prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Task not found');

    const oldStatus = existing.status;

    // Strip non-Prisma fields before spread
    const { labelIds, tagIds, ...updateData } = dto as UpdateTaskDto & { labelIds?: string[]; tagIds?: string[] };

    const task = await this.prisma.task.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        ...updateData,
        ...(dto.status === 'DONE' && !existing.completedAt ? { completedAt: new Date() } : {}),
        ...(dto.status && dto.status !== 'DONE' && existing.completedAt ? { completedAt: null } : {}),
        ...(labelIds
          ? { labels: { deleteMany: {}, create: labelIds.map((labelId) => ({ label: { connect: { id: labelId } } })) } }
          : {}),
      } as any,
      include: this.getTaskIncludes(),
    });

    // Record activity
    await this.prisma.activityLog.create({
      data: {
        userId,
        taskId: id,
        action: 'task.updated',
        entityType: 'task',
        entityId: id,
        data: { changes: dto as unknown, oldValues: { status: oldStatus } } as unknown as Record<string, unknown>,
      },
    });

    this.events.emit('task.updated', { task, oldStatus, updatedBy: userId });

    if (dto.status && dto.status !== oldStatus) {
      this.events.emit('task.status_changed', {
        task,
        oldStatus,
        newStatus: dto.status,
        changedBy: userId,
      });
    }

    return task;
  }

  async delete(id: string, userId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({ where: { id, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found');

    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.events.emit('task.deleted', { taskId: id, deletedBy: userId });
  }

  async bulkUpdate(ids: string[], data: Partial<UpdateTaskDto>, userId: string): Promise<number> {
    const result = await this.prisma.task.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    });
    this.events.emit('tasks.bulk_updated', { ids, data, updatedBy: userId });
    return result.count;
  }

  async reorder(projectId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.task.update({
          where: { id },
          data: { orderIndex: (index + 1) * 1000 },
        }),
      ),
    );
    this.events.emit('tasks.reordered', { projectId, orderedIds });
  }

  async addDependency(taskId: string, blockingId: string): Promise<void> {
    if (taskId === blockingId) throw new BadRequestException('A task cannot depend on itself');

    // Check for circular dependency
    const wouldCreateCycle = await this.checkCircularDependency(taskId, blockingId);
    if (wouldCreateCycle) throw new BadRequestException('This would create a circular dependency');

    await this.prisma.taskDependency.create({
      data: { dependentId: taskId, blockingId },
    });
  }

  async removeDependency(taskId: string, blockingId: string): Promise<void> {
    await this.prisma.taskDependency.deleteMany({
      where: { dependentId: taskId, blockingId },
    });
  }

  private async checkCircularDependency(dependentId: string, blockingId: string): Promise<boolean> {
    // BFS to detect cycles
    const visited = new Set<string>();
    const queue = [blockingId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === dependentId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = await this.prisma.taskDependency.findMany({
        where: { dependentId: current },
        select: { blockingId: true },
      });
      queue.push(...deps.map((d) => d.blockingId));
    }

    return false;
  }

  async addComment(taskId: string, content: string, authorId: string, parentId?: string) {
    const comment = await this.prisma.taskComment.create({
      data: { taskId, authorId, content, parentId },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        replies: { include: { author: { select: { id: true, displayName: true, avatarUrl: true } } } },
      },
    });

    this.events.emit('task.comment_added', { comment, taskId, authorId });
    return comment;
  }

  async getComments(taskId: string) {
    return this.prisma.taskComment.findMany({
      where: { taskId, parentId: null, deletedAt: null },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        reactions: true,
        replies: {
          where: { deletedAt: null },
          include: { author: { select: { id: true, displayName: true, avatarUrl: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async toggleWatch(taskId: string, userId: string): Promise<boolean> {
    const existing = await this.prisma.taskWatcher.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });

    if (existing) {
      await this.prisma.taskWatcher.delete({ where: { taskId_userId: { taskId, userId } } });
      return false;
    }

    await this.prisma.taskWatcher.create({ data: { taskId, userId } });
    return true;
  }

  async getMyTasks(userId: string, filters: Partial<TaskFiltersDto>): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        ...(filters.status ? { status: filters.status as TaskStatus } : {}),
      },
      include: this.getTaskIncludes(),
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
      take: 100,
    });
  }

  private getTaskIncludes() {
    return {
      assignee: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      creator: { select: { id: true, displayName: true, avatarUrl: true } },
      labels: { include: { label: true } },
      tags: { include: { tag: true } },
      attachments: {
        include: { file: { select: { id: true, name: true, url: true, mimeType: true, size: true } } },
      },
      watchers: { select: { userId: true } },
      _count: { select: { subtasks: true, comments: true, attachments: true } },
    } as const;
  }
}

import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async getOverview(@CurrentUser('id') userId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      tasksCompleted,
      tasksCreated,
      activeProjects,
      tasksByStatus,
      tasksByPriority,
    ] = await Promise.all([
      this.prisma.task.count({ where: { status: 'DONE', completedAt: { gte: monthStart }, deletedAt: null } }),
      this.prisma.task.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      this.prisma.project.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.task.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { status: true } }),
      this.prisma.task.groupBy({ by: ['priority'], where: { deletedAt: null }, _count: { priority: true } }),
    ]);

    const teamMembers = await this.prisma.user.count({ where: { status: 'ACTIVE' } });

    return {
      tasksCompleted,
      tasksCreated,
      activeProjects,
      teamMembers,
      completionRate: tasksCreated > 0 ? Math.round((tasksCompleted / tasksCreated) * 100) : 0,
      tasksByStatus: Object.fromEntries(tasksByStatus.map(r => [r.status, r._count.status])),
      tasksByPriority: Object.fromEntries(tasksByPriority.map(r => [r.priority, r._count.priority])),
    };
  }
}

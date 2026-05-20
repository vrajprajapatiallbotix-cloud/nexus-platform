import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async getStats(@CurrentUser('id') userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openTasks, activeProjects, teamMembers, completedToday] = await Promise.all([
      this.prisma.task.count({
        where: { assigneeId: userId, status: { notIn: ['DONE', 'CANCELLED'] }, deletedAt: null },
      }),
      this.prisma.project.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.task.count({
        where: { assigneeId: userId, status: 'DONE', completedAt: { gte: today }, deletedAt: null },
      }),
    ]);

    return { openTasks, activeProjects, teamMembers, completedToday };
  }
}

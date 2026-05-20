import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getActivity(@CurrentUser('id') userId: string, @Query('limit') limit = 20) {
    try {
      const logs = await this.prisma.activityLog.findMany({
        where: { userId },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      });

      return logs.map(log => ({
        id: log.id,
        type: log.action,
        description: this.formatAction(log.action, log.entityType),
        actor: { name: log.user.displayName, avatarUrl: log.user.avatarUrl },
        createdAt: log.createdAt,
      }));
    } catch {
      return [];
    }
  }

  private formatAction(action: string, entityType: string): string {
    const parts = action.split('.');
    const verb = parts[1] ?? action;
    const verbMap: Record<string, string> = {
      created: 'created a', updated: 'updated a', deleted: 'deleted a',
      status_changed: 'changed status of a', comment_added: 'commented on a',
      assigned: 'was assigned a',
    };
    return `${verbMap[verb] ?? verb} ${entityType}`;
  }
}

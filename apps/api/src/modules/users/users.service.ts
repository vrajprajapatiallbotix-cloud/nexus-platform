import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getTeamActivity(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      take: 20,
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      status: 'offline' as const,
      lastSeen: m.user.lastActiveAt?.toISOString() ?? new Date().toISOString(),
      tasksCompletedToday: 0,
    }));
  }
}

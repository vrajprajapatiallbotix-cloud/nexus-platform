import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  async getOrgForUser(userId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true },
    });
    return member?.organization ?? null;
  }

  async getMembers(userId: string) {
    const org = await this.getOrgForUser(userId);
    if (!org) return { members: [] };

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: org.id },
      include: {
        user: { select: { id: true, displayName: true, email: true, avatarUrl: true, status: true, role: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return { members };
  }

  async changeMemberRole(requesterId: string, targetUserId: string, newRole: string) {
    const org = await this.getOrgForUser(requesterId);
    if (!org) throw new NotFoundException('Organization not found');

    const requesterMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId: org.id, userId: requesterId },
    });
    if (!requesterMember || (requesterMember.role !== 'SUPER_ADMIN' && requesterMember.role !== 'MANAGER' && !requesterMember.isOwner)) {
      throw new ForbiddenException('Only managers can change member roles');
    }

    const targetMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId: org.id, userId: targetUserId },
    });
    if (!targetMember) throw new NotFoundException('Member not found');
    if (targetMember.isOwner) throw new ForbiddenException('Cannot change owner role');

    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER', 'GUEST'];
    if (!validRoles.includes(newRole)) throw new ForbiddenException('Invalid role');

    await Promise.all([
      this.prisma.organizationMember.update({
        where: { id: targetMember.id },
        data: { role: newRole as any },
      }),
      this.prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole as any },
      }),
    ]);

    return { success: true };
  }
}

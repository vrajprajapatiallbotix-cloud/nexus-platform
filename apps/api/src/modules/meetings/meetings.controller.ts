import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../database/prisma.service.js';

@ApiTags('meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    try {
      const meetings = await this.prisma.meeting.findMany({
        where: { participants: { some: { userId } } },
        include: {
          participants: {
            include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          },
        },
        orderBy: { startTime: 'asc' },
        take: 50,
      });
      return {
        meetings: meetings.map(m => ({
          id: m.id,
          title: m.title,
          startTime: m.startTime,
          endTime: m.endTime,
          status: m.status,
          meetingLink: m.meetingUrl,
          attendees: m.participants.map(p => ({ user: p.user })),
        })),
      };
    } catch {
      return { meetings: [] };
    }
  }

  @Get('upcoming')
  async getUpcoming(@CurrentUser('id') userId: string, @Query('limit') limit = '5') {
    try {
      const meetings = await this.prisma.meeting.findMany({
        where: {
          participants: { some: { userId } },
          startTime: { gte: new Date() },
        },
        include: {
          participants: {
            include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
          },
        },
        orderBy: { startTime: 'asc' },
        take: Number(limit),
      });

      return meetings.map(m => ({
        id: m.id,
        title: m.title,
        startTime: m.startTime,
        endTime: m.endTime,
        meetingUrl: m.meetingUrl,
        participants: m.participants.map(p => ({ name: p.user.displayName, avatarUrl: p.user.avatarUrl })),
      }));
    } catch {
      return [];
    }
  }
}

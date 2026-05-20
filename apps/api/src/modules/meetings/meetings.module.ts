import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller.js';
import { PrismaService } from '../../database/prisma.service.js';

@Module({
  controllers: [MeetingsController],
  providers: [PrismaService],
})
export class MeetingsModule {}

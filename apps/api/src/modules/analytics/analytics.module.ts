import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { DashboardController } from './dashboard.controller.js';
import { ActivityController } from './activity.controller.js';
import { PrismaService } from '../../database/prisma.service.js';

@Module({
  controllers: [AnalyticsController, DashboardController, ActivityController],
  providers: [PrismaService],
})
export class AnalyticsModule {}

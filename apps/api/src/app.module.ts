import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { LoggerModule } from 'nestjs-pino';

import { appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { databaseConfig } from './config/database.config.js';
import { redisConfig } from './config/redis.config.js';
import { aiConfig } from './config/ai.config.js';
import { storageConfig } from './config/storage.config.js';
import { emailConfig } from './config/email.config.js';

import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { CrmModule } from './modules/crm/crm.module.js';
import { HrModule } from './modules/hr/hr.module.js';
import { AutomationModule } from './modules/automation/automation.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { IntegrationsModule } from './modules/integrations/integrations.module.js';
import { MeetingsModule } from './modules/meetings/meetings.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { TimeTrackingModule } from './modules/time-tracking/time-tracking.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    // ---- Config ----
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, authConfig, databaseConfig, redisConfig, aiConfig, storageConfig, emailConfig],
      expandVariables: true,
    }),

    // ---- Logger ----
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('LOG_LEVEL', 'info'),
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          transport: configService.get('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        },
      }),
    }),

    // ---- Rate Limiting ----
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1000, limit: 10 },
          { name: 'medium', ttl: 10000, limit: 50 },
          { name: 'long', ttl: 60000, limit: config.get('RATE_LIMIT_MAX', 100) },
        ],
      }),
    }),

    // ---- Event Emitter ----
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),

    // ---- Task Scheduler ----
    ScheduleModule.forRoot(),

    // ---- Queue (Bull) ----
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        return {
          redis: redisUrl ?? {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get('REDIS_PASSWORD'),
            db: config.get<number>('REDIS_DB', 0),
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        };
      },
    }),

    // ---- Cache (in-memory for development; swap for Redis store in production) ----
    CacheModule.register({
      isGlobal: true,
      ttl: 300,
      max: 1000,
    }),

    // ---- Core modules ----
    DatabaseModule,
    HealthModule,

    // ---- Feature modules ----
    AuthModule,
    UsersModule,
    OrganizationsModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    ChatModule,
    DocumentsModule,
    AiModule,
    CrmModule,
    HrModule,
    AutomationModule,
    AnalyticsModule,
    BillingModule,
    FilesModule,
    NotificationsModule,
    IntegrationsModule,
    MeetingsModule,
    WebhooksModule,
    AdminModule,
    RealtimeModule,
    TimeTrackingModule,
  ],
})
export class AppModule {}

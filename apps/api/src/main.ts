import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import { pino } from 'pino';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter.js';

async function bootstrap(): Promise<void> {
  const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');

  // ---- Security middleware ----
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: nodeEnv === 'production',
    }),
  );
  app.use(compression());

  // ---- CORS ----
  app.enableCors({
    origin: [appUrl, /\.nexusplatform\.io$/],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Organization-Id', 'X-Request-Id'],
    exposedHeaders: ['X-Total-Count', 'X-Request-Id'],
  });

  // ---- API versioning ----
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // ---- WebSocket adapter with Redis ----
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // ---- Global pipes & filters ----
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ---- Swagger (non-prod only or behind auth in prod) ----
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nexus Platform API')
      .setDescription('Enterprise AI-Powered Productivity & Collaboration Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('organizations', 'Organization management')
      .addTag('workspaces', 'Workspace management')
      .addTag('projects', 'Project management')
      .addTag('tasks', 'Task management')
      .addTag('chat', 'Real-time chat')
      .addTag('documents', 'Documents & wiki')
      .addTag('ai', 'AI features')
      .addTag('crm', 'CRM module')
      .addTag('hr', 'HR module')
      .addTag('automation', 'Workflow automation')
      .addTag('analytics', 'Analytics & reporting')
      .addTag('billing', 'Billing & subscriptions')
      .addTag('files', 'File management')
      .addTag('notifications', 'Notifications')
      .addTag('integrations', 'Third-party integrations')
      .addServer(`http://localhost:${port}`)
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha' },
    });
  }

  // ---- Trust proxy for rate limiting & IP ----
  app.set('trust proxy', 1);

  await app.listen(port);
  logger.info(`Nexus API running on http://localhost:${port} [${nodeEnv}]`);
  logger.info(`Swagger docs: http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  console.error('Failed to start Nexus API', err);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Starting Nexus API...');

    const app = await NestFactory.create(AppModule);

    // ---- CORS (must allow specific origin + credentials) ----
    app.enableCors({
      origin: [
        'https://nexus-web-a507.onrender.com',
        'http://localhost:3000',
        'http://localhost:3001',
      ],
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Organization-Id', 'X-Request-Id'],
    });

    // ---- Global prefix + versioning so routes match /api/v1/... ----
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    const port = process.env.PORT || 4000;

    logger.log(`🌐 Binding to port ${port}`);

    await app.listen(port, '0.0.0.0');

    logger.log(`✅ Nexus API running on port ${port}`);
  } catch (error) {
    console.error('❌ FULL BOOT ERROR:');
    console.error(error);
    if (error?.stack) console.error(error.stack);
    process.exit(1);
  }
}

bootstrap();

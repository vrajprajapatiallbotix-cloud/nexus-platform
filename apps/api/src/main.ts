import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('🚀 Starting Nexus API...');

    const app = await NestFactory.create(AppModule);

    logger.log('✅ App module initialized');

    app.enableCors();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    const port = process.env.PORT || 4000;

    logger.log(`🌐 Binding to port ${port}`);

    await app.listen(port, '0.0.0.0');

    logger.log(`✅ Nexus API running on port ${port}`);
  } catch (error) {
    console.error('❌ FULL BOOT ERROR:');
    console.error(error);

    if (error?.stack) {
      console.error(error.stack);
    }

    process.exit(1);
  }
}

bootstrap();

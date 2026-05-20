import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Starting Nexus API...');

    const app = await NestFactory.create(AppModule);

    app.enableCors();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    const port = process.env.PORT || 4000;

    await app.listen(port, '0.0.0.0');

    console.log(`✅ Nexus API running on port ${port}`);
  } catch (error) {
    console.error('❌ BOOT ERROR:', error);
    process.exit(1);
  }
}

bootstrap();

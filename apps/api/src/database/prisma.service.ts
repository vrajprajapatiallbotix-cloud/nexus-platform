import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: { url: configService.get<string>('DATABASE_URL') },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    // Log slow queries in development
    if (configService.get('NODE_ENV') === 'development') {
      this.$on('query' as never, (event: { duration: number; query: string }) => {
        if (event.duration > 200) {
          this.logger.warn(`Slow query (${event.duration}ms): ${event.query}`);
        }
      });
    }

    this.$on('error' as never, (event: { message: string }) => {
      this.logger.error(`Database error: ${event.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    console.log('🟡 Connecting Prisma...');
    await this.$connect();
    console.log('🟢 Prisma Connected');
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /** Soft-delete helper: marks deletedAt instead of hard-deleting. */
  async softDelete(model: string, where: Record<string, unknown>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this as any)[model].update({ where, data: { deletedAt: new Date() } });
  }

  /** Paginate helper. */
  paginate(page: number, limit: number): { skip: number; take: number } {
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;
    return { skip, take };
  }
}

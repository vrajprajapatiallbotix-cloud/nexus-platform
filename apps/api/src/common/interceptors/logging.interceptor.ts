import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; url: string; headers: Record<string, string> }>();
    const res = context.switchToHttp().getResponse<{ statusCode: number; setHeader: (k: string, v: string) => void }>();
    const requestId = randomUUID();
    const start = Date.now();

    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms [${requestId}]`);
        },
        error: (err: Error) => {
          const duration = Date.now() - start;
          this.logger.error(`${req.method} ${req.url} ERROR ${duration}ms [${requestId}]: ${err.message}`);
        },
      }),
    );
  }
}

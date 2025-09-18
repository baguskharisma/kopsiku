import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const { method, url, body, query, params } = req;
    const userAgent = req.get('user-agent') || '';
    const ip = req.ip || req.connection.remoteAddress;

    const now = Date.now();

    this.logger.log(`Incoming Request: ${method} ${url}`, {
      method,
      url,
      userAgent,
      ip,
      body: method !== 'GET' ? body : undefined,
      query: Object.keys(query).length ? query : undefined,
      params: Object.keys(params).length ? params : undefined,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - now;
          this.logger.log(
            `Outgoing Response: ${method} ${url} ${res.statusCode} - ${duration}ms`,
            {
              method,
              url,
              statusCode: res.statusCode,
              duration: `${duration}ms`,
              responseSize: JSON.stringify(data).length,
            },
          );
        },
        error: (error) => {
          const duration = Date.now() - now;
          this.logger.error(
            `Request Failed: ${method} ${url} - ${duration}ms`,
            {
              method,
              url,
              duration: `${duration}ms`,
              error: error.message,
              stack: error.stack,
            },
          );
        },
      }),
    );
  }
}

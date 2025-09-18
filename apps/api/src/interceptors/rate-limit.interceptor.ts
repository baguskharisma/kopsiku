import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private requestCounts = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(private configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const now = Date.now();
    const ttl = this.configService.get<number>('RATE_LIMIT_TTL', 60) * 1000;
    const limit = this.configService.get<number>('RATE_LIMIT_LIMIT', 100);

    const userRequests = this.requestCounts.get(ip);

    if (!userRequests || now > userRequests.resetTime) {
      this.requestCounts.set(ip, { count: 1, resetTime: now + ttl });
    } else {
      userRequests.count++;
      if (userRequests.count > limit) {
        throw new HttpException(
          'Too Many Requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return next.handle();
  }
}

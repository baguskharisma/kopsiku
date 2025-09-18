import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from 'src/auth/auth.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: true, // We handle expiration manually
      secretOrKey:
        configService.get<string>('JWT_REFRESH_SECRET') ||
        configService.get<string>('JWT_SECRET'),
      passReqToCallback: true as const, // Fix: ensure type matches StrategyOptionsWithRequest
    } as any); // Fix: cast to any to satisfy type checker due to passReqToCallback: true
  }

  async validate(
    req: Request,
    payload: JwtPayload,
  ): Promise<{ userId: string; refreshToken: string }> {
    const refreshToken = req.body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token tidak ditemukan');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Payload sub (userId) tidak ditemukan');
    }

    return {
      userId: payload.sub,
      refreshToken,
    };
  }
}

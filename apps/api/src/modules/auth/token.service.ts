import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthTokensDto } from './dto/auth-tokens.dto.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(user: User, ipAddress?: string, userAgent?: string): Promise<AuthTokensDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

    return { accessToken, refreshToken };
  }

  private async generateRefreshToken(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const familyId = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId, token, familyId, expiresAt },
    });

    await this.prisma.userSession.create({
      data: {
        userId,
        token,
        ipAddress,
        userAgent,
        expiresAt,
        deviceInfo: { ipAddress, userAgent },
      },
    });

    return token;
  }

  async refreshTokens(refreshToken: string, ipAddress?: string): Promise<AuthTokensDto> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // If token was already used, it could indicate token theft — revoke entire family
      if (stored?.used) {
        this.logger.warn(`Refresh token reuse detected for user ${stored.userId} — revoking family`);
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: mark old token as used
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { used: true },
    });

    return this.generateTokenPair(stored.user, ipAddress);
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async generateShortLivedToken(userId: string, purpose: string, ttlMinutes = 60): Promise<string> {
    return this.jwtService.sign(
      { sub: userId, purpose },
      { expiresIn: `${ttlMinutes}m` },
    );
  }

  verifyShortLivedToken(token: string, expectedPurpose: string): { sub: string } {
    try {
      const payload = this.jwtService.verify<{ sub: string; purpose: string }>(token);
      if (payload.purpose !== expectedPurpose) throw new Error('Wrong purpose');
      return { sub: payload.sub };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

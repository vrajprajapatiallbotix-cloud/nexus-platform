import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { User, OAuthProvider } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service.js';
import { TokenService } from './token.service.js';
import { TwoFactorService } from './two-factor.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AuthTokensDto } from './dto/auth-tokens.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly configService: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthTokensDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const displayName = dto.firstName && dto.lastName
      ? `${dto.firstName} ${dto.lastName}`
      : dto.email.split('@')[0] ?? dto.email;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        displayName,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        status: 'PENDING_VERIFICATION',
      },
    });

    await this.emailVerificationService.sendVerificationEmail(user.id, user.email);
    this.events.emit('user.registered', { user, ipAddress });
    this.logger.log(`New user registered: ${user.email}`);

    return this.tokenService.generateTokenPair(user, ipAddress);
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthTokensDto & { requiresTwoFactor?: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });

    if (!user || !user.passwordHash) {
      // Constant-time comparison to prevent timing attacks
      await bcrypt.compare(dto.password, '$2b$12$placeholder.hash.to.prevent.timing.attack.padding');
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') throw new ForbiddenException('Account suspended. Contact support.');
    if (user.deletedAt) throw new NotFoundException('Account not found');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.events.emit('auth.failed_login', { email: dto.email, ipAddress });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode) {
        return { accessToken: '', refreshToken: '', requiresTwoFactor: true } as AuthTokensDto & { requiresTwoFactor: boolean };
      }
      const isValidCode = this.twoFactorService.verifyToken(user.twoFactorSecret!, dto.twoFactorCode);
      if (!isValidCode) throw new UnauthorizedException('Invalid 2FA code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    this.events.emit('auth.login', { user, ipAddress, userAgent });

    return this.tokenService.generateTokenPair(user, ipAddress, userAgent);
  }

  async refreshTokens(refreshToken: string, ipAddress?: string): Promise<AuthTokensDto> {
    return this.tokenService.refreshTokens(refreshToken, ipAddress);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revokedAt: new Date() },
      });
    }
    // Revoke all sessions if logging out everywhere
    this.events.emit('auth.logout', { userId });
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.prisma.userSession.deleteMany({ where: { userId } });
    this.events.emit('auth.logout_all', { userId });
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  async handleOAuthLogin(
    provider: OAuthProvider,
    providerAccountId: string,
    profile: { email: string; name?: string; avatarUrl?: string },
    ipAddress?: string,
  ): Promise<AuthTokensDto> {
    let user: User;

    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });

    if (existingOAuth) {
      user = existingOAuth.user;
    } else {
      const existingUser = await this.prisma.user.findUnique({ where: { email: profile.email.toLowerCase() } });

      if (existingUser) {
        await this.prisma.oAuthAccount.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { userId: existingUser.id, provider, providerAccountId, rawProfile: profile as any },
        });
        user = existingUser;
      } else {
        user = await this.prisma.user.create({
          data: {
            email: profile.email.toLowerCase(),
            displayName: profile.name ?? profile.email.split('@')[0] ?? profile.email,
            avatarUrl: profile.avatarUrl,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            status: 'ACTIVE',
            accounts: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              create: { provider, providerAccountId, rawProfile: profile as any },
            },
          },
        });
        this.events.emit('user.registered_oauth', { user, provider });
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });

    return this.tokenService.generateTokenPair(user, ipAddress);
  }

  async sendMagicLink(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return success to prevent user enumeration
    if (!user || user.deletedAt) return;
    await this.emailVerificationService.sendMagicLink(user.email);
  }

  async verifyMagicLink(token: string, ipAddress?: string): Promise<AuthTokensDto> {
    const link = await this.prisma.magicLink.findUnique({ where: { token } });
    if (!link || link.used || link.expiresAt < new Date()) {
      throw new BadRequestException('Magic link is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({ where: { email: link.email } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.magicLink.update({ where: { id: link.id }, data: { used: true } });
    if (!user.emailVerified) {
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifiedAt: new Date(), status: 'ACTIVE' } });
    }

    return this.tokenService.generateTokenPair(user, ipAddress);
  }

  async verifyEmail(token: string): Promise<void> {
    await this.emailVerificationService.verifyEmail(token);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.deletedAt) return; // Silent fail
    await this.emailVerificationService.sendPasswordReset(user.id, user.email);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.emailVerificationService.resetPassword(token, newPassword);
  }

  async enableTwoFactor(userId: string): Promise<{ qrCode: string; secret: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.twoFactorService.generateSecret(user.email);
  }

  async confirmTwoFactor(userId: string, secret: string, code: string): Promise<string[]> {
    const isValid = this.twoFactorService.verifyToken(secret, code);
    if (!isValid) throw new BadRequestException('Invalid verification code');

    const backupCodes = this.twoFactorService.generateBackupCodes();
    const backupHashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorSecret: secret, twoFactorBackupCodes: backupHashes },
    });

    return backupCodes;
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash) throw new BadRequestException('No password set');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async sendVerificationEmail(userId: string, email: string) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.magicLink.create({
      data: { userId, token, email, expiresAt },
    });

    this.logger.log(`Verification email queued for ${email} (token: ${token.slice(0, 8)}…)`);
    return { token };
  }

  async sendMagicLink(email: string) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.magicLink.create({
      data: { email, token, expiresAt },
    });

    this.logger.log(`Magic link sent to ${email}`);
    return { token };
  }

  async sendPasswordReset(userId: string, email: string) {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.magicLink.create({
      data: { userId, token, email, expiresAt },
    });

    this.logger.log(`Password reset email sent to ${email}`);
    return { token };
  }

  async resetPassword(token: string, newPasswordHash: string) {
    const link = await this.prisma.magicLink.findUnique({ where: { token } });
    if (!link || link.used || link.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    await Promise.all([
      this.prisma.user.update({
        where: { id: link.userId ?? '' },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.magicLink.update({ where: { id: link.id }, data: { used: true } }),
    ]);
  }

  async verifyEmail(token: string) {
    const link = await this.prisma.magicLink.findUnique({ where: { token } });
    if (!link || link.used || link.expiresAt < new Date()) {
      throw new Error('Invalid or expired verification token');
    }

    await Promise.all([
      this.prisma.user.update({ where: { id: link.userId ?? '' }, data: { emailVerified: true } }),
      this.prisma.magicLink.update({ where: { id: link.id }, data: { used: true } }),
    ]);

    return { verified: true };
  }
}

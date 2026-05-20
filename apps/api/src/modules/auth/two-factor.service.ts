import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomBytes } from 'crypto';

@Injectable()
export class TwoFactorService {
  generateSecret(email: string): Promise<{ qrCode: string; secret: string }> {
    const secret = speakeasy.generateSecret({
      name: `Nexus Platform (${email})`,
      length: 32,
    });

    return QRCode.toDataURL(secret.otpauth_url!).then((qrCode) => ({
      qrCode,
      secret: secret.base32,
    }));
  }

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow ±2 time steps (60 seconds tolerance)
    });
  }

  generateBackupCodes(count = 10): string[] {
    return Array.from({ length: count }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-'),
    );
  }
}

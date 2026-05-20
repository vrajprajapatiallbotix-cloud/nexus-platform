import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import type { VerifyCallback } from 'passport-oauth2';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'GOOGLE_NOT_CONFIGURED',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'GOOGLE_NOT_CONFIGURED',
      callbackURL: `${configService.get('API_URL', 'http://localhost:4000')}/api/v1/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: Array<{ value: string }>; displayName?: string; photos?: Array<{ value: string }> },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from Google'), undefined);

    try {
      const tokens = await this.authService.handleOAuthLogin('GOOGLE', profile.id, {
        email,
        name: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value,
      });
      done(null, tokens);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}

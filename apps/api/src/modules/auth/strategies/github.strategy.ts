import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import type { VerifyCallback } from 'passport-oauth2';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'GITHUB_NOT_CONFIGURED',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'GITHUB_NOT_CONFIGURED',
      callbackURL: `${configService.get('API_URL', 'http://localhost:4000')}/api/v1/auth/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails?: Array<{ value: string }>; displayName?: string; username?: string; photos?: Array<{ value: string }> },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error('No email from GitHub'), undefined);

    try {
      const tokens = await this.authService.handleOAuthLogin('GITHUB', profile.id, {
        email,
        name: profile.displayName ?? profile.username,
        avatarUrl: profile.photos?.[0]?.value,
      });
      done(null, tokens);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}

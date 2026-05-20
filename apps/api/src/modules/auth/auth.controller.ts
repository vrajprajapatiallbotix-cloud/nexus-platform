import {
  Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode, HttpStatus, Ip, Query, Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { User } from '@prisma/client';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

class RefreshTokenDto { @IsString() refreshToken!: string; }
class MagicLinkDto { @IsEmail() email!: string; }
class ForgotPasswordDto { @IsEmail() email!: string; }
class ResetPasswordDto { @IsString() token!: string; @IsString() @MinLength(8) password!: string; }
class VerifyTwoFactorDto { @IsString() secret!: string; @IsString() code!: string; }
class DisableTwoFactorDto { @IsString() password!: string; }

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.authService.register(dto, ip);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Ip() ip: string, @Req() req: Request) {
    return this.authService.login(dto, ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string) {
    return this.authService.refreshTokens(dto.refreshToken, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async logout(@CurrentUser() user: User, @Body() dto: Partial<RefreshTokenDto>) {
    await this.authService.logout(user.id, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  async logoutAll(@CurrentUser() user: User) {
    await this.authService.logoutAllDevices(user.id);
  }

  // ---- OAuth ----
  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  googleAuth(@Res() res: Response) {
    const params = new URLSearchParams({
      client_id: process.env['GOOGLE_CLIENT_ID'] ?? '',
      redirect_uri: `${process.env['API_URL']}/api/v1/auth/google/callback`,
      response_type: 'code',
      scope: 'email profile',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  @Public()
  @Get('github')
  @ApiOperation({ summary: 'Redirect to GitHub OAuth' })
  githubAuth(@Res() res: Response) {
    const params = new URLSearchParams({
      client_id: process.env['GITHUB_CLIENT_ID'] ?? '',
      redirect_uri: `${process.env['API_URL']}/api/v1/auth/github/callback`,
      scope: 'user:email',
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }

  // ---- Magic Link ----
  @Public()
  @Post('magic-link')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  async sendMagicLink(@Body() dto: MagicLinkDto) {
    await this.authService.sendMagicLink(dto.email);
    return { message: 'Magic link sent if account exists' };
  }

  @Public()
  @Get('magic-link/verify')
  async verifyMagicLink(@Query('token') token: string, @Ip() ip: string, @Res() res: Response) {
    const tokens = await this.authService.verifyMagicLink(token, ip);
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
    res.redirect(`${appUrl}/auth/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`);
  }

  // ---- Email verification ----
  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string, @Res() res: Response) {
    await this.authService.verifyEmail(token);
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
    res.redirect(`${appUrl}/auth/email-verified`);
  }

  // ---- Password ----
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 300000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'Password reset email sent if account exists' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password reset successfully' };
  }

  // ---- 2FA ----
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @ApiBearerAuth()
  async enableTwoFactor(@CurrentUser('id') userId: string) {
    return this.authService.enableTwoFactor(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/confirm')
  @ApiBearerAuth()
  async confirmTwoFactor(@CurrentUser('id') userId: string, @Body() dto: VerifyTwoFactorDto) {
    const backupCodes = await this.authService.confirmTwoFactor(userId, dto.secret, dto.code);
    return { backupCodes, message: '2FA enabled successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  async disableTwoFactor(@CurrentUser('id') userId: string, @Body() dto: DisableTwoFactorDto) {
    await this.authService.disableTwoFactor(userId, dto.password);
    return { message: '2FA disabled successfully' };
  }

  // ---- Me ----
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  async getMe(@CurrentUser() user: User) {
    const { passwordHash, twoFactorSecret, twoFactorBackupCodes, ...safeUser } = user;
    return safeUser;
  }
}

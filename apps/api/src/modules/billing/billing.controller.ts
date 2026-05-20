import { Controller, Get, Post, Body, Param, UseGuards, Headers, RawBodyRequest, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BillingService } from './billing.service.js';
import type { PlanType, BillingInterval } from '@prisma/client';

class CreateCheckoutDto { organizationId!: string; planType!: PlanType; interval!: BillingInterval; }
class PortalDto { organizationId!: string; }

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Get all available plans' })
  getPlans() {
    return this.billingService.getPlans();
  }

  @Get('subscription/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get organization subscription' })
  getSubscription(@Param('organizationId') organizationId: string) {
    return this.billingService.getSubscription(organizationId);
  }

  @Get('usage/:organizationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get organization usage statistics' })
  getUsage(@Param('organizationId') organizationId: string) {
    return this.billingService.getUsage(organizationId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  createCheckout(@Body() dto: CreateCheckoutDto, @CurrentUser('id') userId: string) {
    return this.billingService.createCheckoutSession(dto.organizationId, dto.planType, dto.interval, userId);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe customer portal session' })
  createPortal(@Body() dto: PortalDto) {
    return this.billingService.createPortalSession(dto.organizationId);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.billingService.handleWebhook(req.rawBody!, signature);
  }
}

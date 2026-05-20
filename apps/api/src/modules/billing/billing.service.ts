import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../database/prisma.service.js';
import type { PlanType, BillingInterval } from '@prisma/client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(configService.get<string>('STRIPE_SECRET_KEY', ''), {
      apiVersion: '2024-06-20',
    });
  }

  async getPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getSubscription(organizationId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
  }

  async createCheckoutSession(
    organizationId: string,
    planType: PlanType,
    interval: BillingInterval,
    userId: string,
  ): Promise<{ url: string }> {
    const plan = await this.prisma.plan.findUnique({ where: { type: planType } });
    if (!plan) throw new NotFoundException('Plan not found');

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const priceId = interval === 'YEARLY' ? plan.stripeYearlyPriceId : plan.stripePriceId;
    if (!priceId) throw new BadRequestException('Stripe price not configured for this plan');

    // Get or create Stripe customer
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        name: org.name,
        metadata: { organizationId, userId },
      });
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.configService.get('APP_URL')}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('APP_URL')}/settings/billing?canceled=true`,
      subscription_data: {
        trial_period_days: plan.trialDays,
        metadata: { organizationId, planType, interval },
      },
      allow_promotion_codes: true,
      metadata: { organizationId, planType, interval },
    });

    return { url: session.url! };
  }

  async createPortalSession(organizationId: string): Promise<{ url: string }> {
    const sub = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (!sub?.stripeCustomerId) throw new BadRequestException('No active subscription');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${this.configService.get('APP_URL')}/settings/billing`,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { organizationId, planType, interval } = session.metadata ?? {};
    if (!organizationId || !planType) return;

    const plan = await this.prisma.plan.findUnique({ where: { type: planType as PlanType } });
    if (!plan) return;

    const stripeSubscription = await this.stripe.subscriptions.retrieve(session.subscription as string);

    await this.prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: 'TRIALING',
        interval: interval as BillingInterval ?? 'MONTHLY',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: stripeSubscription.items.data[0]?.price.id,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      },
      update: {
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: session.customer as string,
        status: 'TRIALING',
      },
    });

    this.logger.log(`Checkout completed for org ${organizationId}, plan ${planType}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata['organizationId'];
    if (!organizationId) return;

    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      trialing: 'TRIALING',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'UNPAID',
      incomplete: 'INCOMPLETE',
      paused: 'PAUSED',
    };

    await this.prisma.subscription.updateMany({
      where: { organizationId },
      data: {
        status: (statusMap[subscription.status] ?? 'ACTIVE') as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata['organizationId'];
    if (!organizationId) return;

    await this.prisma.subscription.updateMany({
      where: { organizationId },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });
    this.logger.log(`Subscription canceled for org ${organizationId}`);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const sub = await this.prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
    if (!sub) return;

    await this.prisma.invoice.create({
      data: {
        organizationId: sub.organizationId,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        status: 'paid',
        paidAt: new Date(),
        stripeInvoiceId: invoice.id,
        invoiceUrl: invoice.hosted_invoice_url ?? undefined,
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      include: { organization: { include: { members: { where: { isOwner: true } } } } },
    });
    if (!sub) return;

    this.logger.warn(`Payment failed for organization ${sub.organizationId}`);
    // Would send email notification here
  }

  async getUsage(organizationId: string) {
    const [userCount, storageUsed, aiCreditsUsed] = await Promise.all([
      this.prisma.workspaceMember.count({
        where: { workspace: { organizationId } },
      }),
      this.prisma.file.aggregate({
        where: { workspaceId: { in: await this.prisma.workspace.findMany({ where: { organizationId }, select: { id: true } }).then((ws) => ws.map((w) => w.id)) } },
        _sum: { size: true },
      }),
      this.prisma.aiMessage.count({
        where: { session: { user: { organizationMembers: { some: { organizationId } } } } },
      }),
    ]);

    const plan = await this.getSubscription(organizationId);

    return {
      users: { used: userCount, limit: plan?.plan.maxUsers ?? null },
      storage: { usedBytes: storageUsed._sum.size ?? 0, limitGB: plan?.plan.maxStorage ?? null },
      aiCredits: { used: aiCreditsUsed, limit: plan?.plan.maxAiCredits ?? null },
    };
  }
}

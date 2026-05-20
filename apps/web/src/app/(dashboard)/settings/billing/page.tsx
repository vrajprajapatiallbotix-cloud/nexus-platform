'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Check, Zap, Building2, ArrowRight, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Subscription {
  id: string;
  status: string;
  plan: { name: string; price: number; interval: string; features: string[] };
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  date: string;
  invoiceUrl?: string;
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'forever',
    description: 'For individuals and small teams',
    features: ['5 projects', '10 GB storage', 'Basic analytics', 'Email support'],
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    interval: 'per user/month',
    description: 'For growing teams',
    features: ['Unlimited projects', '100 GB storage', 'Advanced analytics', 'Priority support', 'Custom fields', 'Automations', 'API access'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 49,
    interval: 'per user/month',
    description: 'For large organizations',
    features: ['Everything in Pro', 'Unlimited storage', 'SSO/SAML', 'Custom contracts', 'SLA', 'Dedicated support', 'Custom integrations'],
    highlighted: false,
  },
];

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Subscription }>('/billing/subscription').catch(() => ({ data: { data: null } })),
      api.get<{ data: { invoices: Invoice[] } }>('/billing/invoices').catch(() => ({ data: { data: { invoices: [] } } })),
    ]).then(([subRes, invRes]) => {
      setSubscription((subRes as { data: { data: Subscription | null } }).data.data);
      setInvoices((invRes as { data: { data: { invoices: Invoice[] } } }).data.data.invoices ?? []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and payment details</p>
      </div>

      {/* Current plan */}
      {!loading && subscription && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">{subscription.plan.name}</h2>
                <Badge variant={subscription.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {subscription.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                ${subscription.plan.price}/{subscription.plan.interval} ·
                {subscription.cancelAtPeriodEnd
                  ? ` Cancels on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                  : ` Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Update payment</Button>
              {!subscription.cancelAtPeriodEnd && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">Cancel plan</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'relative bg-card border rounded-xl p-6 flex flex-col',
                plan.highlighted ? 'border-primary shadow-lg shadow-primary/10' : 'border-border',
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground shadow-sm">Most Popular</Badge>
                </div>
              )}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  {plan.id === 'pro' ? <Zap className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-sm text-muted-foreground ml-1">{plan.interval}</span>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlighted ? 'default' : 'outline'}
                className="w-full gap-2"
              >
                {plan.price === 0 ? 'Current plan' : 'Upgrade'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Payment Method</h2>
        <div className="flex items-center gap-4">
          <div className="h-10 w-16 rounded-lg bg-muted flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No payment method on file</p>
            <p className="text-xs text-muted-foreground">Add a payment method to upgrade your plan</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto">Add card</Button>
        </div>
      </div>

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Invoice History</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {invoices.map((inv, i) => (
              <div
                key={inv.id}
                className={cn(
                  'flex items-center gap-4 px-6 py-4',
                  i < invoices.length - 1 ? 'border-b border-border' : '',
                )}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">${(inv.amount / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <Badge variant={inv.status === 'PAID' ? 'default' : 'secondary'} className="text-xs">
                  {inv.status}
                </Badge>
                {inv.invoiceUrl && (
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

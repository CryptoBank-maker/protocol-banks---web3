/**
 * Billing types for SaaS subscription and usage-based billing
 */

export type BillingCycle = 'monthly' | 'yearly';
export type BillingSubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trial';
export type FeeStatus = 'pending' | 'collected' | 'waived';
export type BillingStatus = 'pending' | 'paid' | 'failed' | 'refunded';

// Subscription Plans
export interface SubscriptionPlan {
  id: string;
  name: string;  // 'free', 'pro', 'enterprise'
  display_name: string;
  description?: string;
  price_monthly: number;
  price_yearly?: number;
  features: string[];
  limits: PlanLimits;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface PlanLimits {
  max_recipients_per_batch: number;  // -1 = unlimited
  max_scheduled_payments: number;
  max_team_members: number;
  max_split_templates: number;
  transaction_fee_bps: number;  // Basis points (50 = 0.5%)
  // Aliases for backward compatibility
  max_scheduled?: number;  // alias for max_scheduled_payments
  max_recipients?: number;  // alias for max_recipients_per_batch
}

// User Subscription
export interface UserSubscription {
  id: string;
  user_address: string;
  team_id?: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  status: BillingSubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancelled_at?: string;
  payment_method?: BillingPaymentMethod;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

export interface BillingPaymentMethod {
  type: 'crypto';
  token: string;  // 'USDC', 'USDT'
  chain_id: number;
  wallet_address: string;
}

// Transaction Fees
export interface TransactionFee {
  id: string;
  user_address: string;
  payment_id?: string;
  batch_id?: string;
  split_execution_id?: string;
  original_amount: number;
  fee_amount: number;
  fee_percentage: number;
  fee_token: string;
  status: FeeStatus;
  collected_at?: string;
  created_at: string;
}

// Billing History
export interface BillingRecord {
  id: string;
  user_address: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  description: string;
  status: BillingStatus;
  payment_method?: BillingPaymentMethod;
  tx_hash?: string;
  invoice_url?: string;
  created_at: string;
  paid_at?: string;
}

// Usage Metrics
export interface UsageMetric {
  id: string;
  user_address: string;
  team_id?: string;
  metric_name: MetricName;
  metric_value: number;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
  updated_at: string;
}

export type MetricName =
  | 'batch_payments'
  | 'scheduled_payments'
  | 'team_members'
  | 'split_templates'
  | 'api_calls';

// Input types for API
export interface SubscribeInput {
  plan_id: string;
  billing_cycle: BillingCycle;
  payment_method?: BillingPaymentMethod;
}

export interface UpdateSubscriptionInput {
  plan_id?: string;
  billing_cycle?: BillingCycle;
  payment_method?: BillingPaymentMethod;
}

// Response types
export interface UserPlanInfo {
  plan_name: string;
  display_name: string;
  limits: PlanLimits;
  features: string[];
  status: BillingSubscriptionStatus | 'free';
  period_end?: string;
  usage: CurrentUsage;
}

export interface CurrentUsage {
  batch_payments: number;
  scheduled_payments: number;
  team_members: number;
  split_templates: number;
}

export interface PlanComparisonItem {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

// Helper functions
export function formatPrice(price: number, cycle: BillingCycle): string {
  if (price === 0) return 'Free';
  const period = cycle === 'monthly' ? '/mo' : '/yr';
  return `$${price}${period}`;
}

export function calculateTransactionFee(
  amount: number,
  feeBps: number
): number {
  return (amount * feeBps) / 10000;
}

export function checkLimit(
  limits: PlanLimits,
  limitName: keyof PlanLimits,
  currentValue: number
): boolean {
  const limit = limits[limitName];
  if (typeof limit !== 'number') return true;
  if (limit === -1) return true;  // Unlimited
  return currentValue < limit;
}

export function getLimitDisplay(limit: number): string {
  if (limit === -1) return 'Unlimited';
  if (limit === 0) return 'Not available';
  return limit.toString();
}

// Plan comparison for pricing page
export function getPlanComparison(): PlanComparisonItem[] {
  return [
    {
      feature: 'Recipients per batch',
      free: '5',
      pro: 'Unlimited',
      enterprise: 'Unlimited',
    },
    {
      feature: 'Scheduled payments',
      free: false,
      pro: '20',
      enterprise: 'Unlimited',
    },
    {
      feature: 'Team members',
      free: '1',
      pro: '5',
      enterprise: 'Unlimited',
    },
    {
      feature: 'Split payment templates',
      free: '3',
      pro: 'Unlimited',
      enterprise: 'Unlimited',
    },
    {
      feature: 'Transaction fee',
      free: '0.5%',
      pro: '0.2%',
      enterprise: 'Free',
    },
    {
      feature: 'Export formats',
      free: 'CSV',
      pro: 'CSV, Excel, PDF',
      enterprise: 'CSV, Excel, PDF',
    },
    {
      feature: 'API access',
      free: false,
      pro: false,
      enterprise: true,
    },
    {
      feature: 'Priority support',
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      feature: 'Dedicated support',
      free: false,
      pro: false,
      enterprise: true,
    },
  ];
}

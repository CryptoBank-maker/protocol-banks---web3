/**
 * Billing Service
 * Manages SaaS subscription plans, user subscriptions, and transaction fees
 */

import { createClient } from '@/lib/supabase-client';
import type {
  SubscriptionPlan,
  UserSubscription,
  TransactionFee,
  BillingRecord,
  PlanLimits,
  BillingSubscriptionStatus,
} from '@/types/billing';

// ============================================
// Types
// ============================================

export interface CreateSubscriptionParams {
  user_address: string;
  plan_id: string;
}

export interface RecordFeeParams {
  user_address: string;
  payment_id: string;
  amount: number;
  fee_percentage: number;
}

export interface UsageMetrics {
  recipients_count: number;
  scheduled_count: number;
  team_members_count: number;
  transactions_this_month: number;
  total_volume_this_month: number;
}

// ============================================
// Billing Service Class
// ============================================

export class BillingService {
  private supabase = createClient();

  // ============================================
  // Plan Management
  // ============================================

  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) throw new Error(`Failed to fetch plans: ${error.message}`);
    return data || [];
  }

  /**
   * Get a specific plan by ID
   */
  async getPlan(planId: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }
    return data;
  }

  /**
   * Get plan by name (Free, Pro, Enterprise)
   */
  async getPlanByName(name: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }
    return data;
  }

  // ============================================
  // User Subscription Management
  // ============================================

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userAddress: string): Promise<UserSubscription | null> {
    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('user_address', userAddress)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch subscription: ${error.message}`);
    }
    return data;
  }

  /**
   * Create a new subscription (default to Free plan)
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<UserSubscription> {
    const { user_address, plan_id } = params;

    // Calculate period end (1 month from now)
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .insert({
        user_address,
        plan_id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select('*, plan:subscription_plans(*)')
      .single();

    if (error) throw new Error(`Failed to create subscription: ${error.message}`);
    return data;
  }

  /**
   * Ensure user has a subscription (create Free plan if none exists)
   */
  async ensureSubscription(userAddress: string): Promise<UserSubscription> {
    // Check existing subscription
    const existing = await this.getUserSubscription(userAddress);
    if (existing) return existing;

    // Get Free plan
    const freePlan = await this.getPlanByName('Free');
    if (!freePlan) {
      throw new Error('Free plan not found in database');
    }

    // Create subscription with Free plan
    return this.createSubscription({
      user_address: userAddress,
      plan_id: freePlan.id,
    });
  }

  /**
   * Upgrade or downgrade subscription
   */
  async changePlan(userAddress: string, newPlanId: string): Promise<UserSubscription> {
    const currentSub = await this.getUserSubscription(userAddress);
    if (!currentSub) {
      throw new Error('No existing subscription found');
    }

    const newPlan = await this.getPlan(newPlanId);
    if (!newPlan) {
      throw new Error('Plan not found');
    }

    // Calculate new period
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .update({
        plan_id: newPlanId,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_address', userAddress)
      .select('*, plan:subscription_plans(*)')
      .single();

    if (error) throw new Error(`Failed to change plan: ${error.message}`);

    // Record billing history
    await this.recordBillingEvent(userAddress, {
      type: 'plan_change',
      amount: newPlan.price_monthly,
      description: `Changed to ${newPlan.name} plan`,
      plan_id: newPlanId,
    });

    return data;
  }

  /**
   * Cancel subscription (move to Free plan)
   */
  async cancelSubscription(userAddress: string): Promise<UserSubscription> {
    const freePlan = await this.getPlanByName('Free');
    if (!freePlan) {
      throw new Error('Free plan not found');
    }

    const { data, error } = await this.supabase
      .from('user_subscriptions')
      .update({
        plan_id: freePlan.id,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_address', userAddress)
      .select('*, plan:subscription_plans(*)')
      .single();

    if (error) throw new Error(`Failed to cancel subscription: ${error.message}`);

    await this.recordBillingEvent(userAddress, {
      type: 'cancellation',
      amount: 0,
      description: 'Subscription cancelled, moved to Free plan',
    });

    return data;
  }

  /**
   * Update subscription status
   */
  async updateStatus(userAddress: string, status: BillingSubscriptionStatus): Promise<void> {
    const { error } = await this.supabase
      .from('user_subscriptions')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('user_address', userAddress);

    if (error) throw new Error(`Failed to update status: ${error.message}`);
  }

  // ============================================
  // Limit Checking
  // ============================================

  /**
   * Get user's current plan limits
   */
  async getPlanLimits(userAddress: string): Promise<PlanLimits> {
    const subscription = await this.ensureSubscription(userAddress);
    const plan = subscription.plan as SubscriptionPlan;

    return plan.limits;
  }

  /**
   * Check if user can perform an action based on their plan limits
   */
  async checkLimit(
    userAddress: string,
    limitType: keyof PlanLimits,
    currentCount: number
  ): Promise<{ allowed: boolean; limit: number; current: number }> {
    const limits = await this.getPlanLimits(userAddress);
    const limit = limits[limitType] ?? 0;

    // -1 means unlimited
    const allowed = limit === -1 || currentCount < limit;

    return {
      allowed,
      limit: limit ?? 0,
      current: currentCount,
    };
  }

  /**
   * Check if user can add more recipients to a batch
   */
  async canAddRecipients(userAddress: string, count: number): Promise<boolean> {
    const result = await this.checkLimit(userAddress, 'max_recipients', count);
    return result.allowed;
  }

  /**
   * Check if user can create more scheduled payments
   */
  async canCreateScheduledPayment(userAddress: string): Promise<boolean> {
    // Count existing scheduled payments
    const { count, error } = await this.supabase
      .from('scheduled_payments')
      .select('*', { count: 'exact', head: true })
      .eq('owner_address', userAddress)
      .in('status', ['active', 'paused']);

    if (error) throw new Error(`Failed to count scheduled payments: ${error.message}`);

    const result = await this.checkLimit(userAddress, 'max_scheduled', count || 0);
    return result.allowed;
  }

  /**
   * Check if team can add more members
   */
  async canAddTeamMember(userAddress: string, teamId: string): Promise<boolean> {
    // Count current team members
    const { count, error } = await this.supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (error) throw new Error(`Failed to count team members: ${error.message}`);

    const result = await this.checkLimit(userAddress, 'max_team_members', count || 0);
    return result.allowed;
  }

  // ============================================
  // Transaction Fees
  // ============================================

  /**
   * Calculate and record transaction fee
   */
  async recordTransactionFee(params: RecordFeeParams): Promise<TransactionFee> {
    const { user_address, payment_id, amount, fee_percentage } = params;

    const feeAmount = amount * (fee_percentage / 100);

    const { data, error } = await this.supabase
      .from('transaction_fees')
      .insert({
        user_address,
        payment_id,
        fee_amount: feeAmount,
        fee_percentage,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record fee: ${error.message}`);
    return data;
  }

  /**
   * Get user's fee rate based on their plan
   */
  async getFeeRate(userAddress: string): Promise<number> {
    const limits = await this.getPlanLimits(userAddress);
    return limits.transaction_fee_bps / 10000; // Convert basis points to percentage
  }

  /**
   * Get total fees for a user in a period
   */
  async getTotalFees(
    userAddress: string,
    startDate: string,
    endDate: string
  ): Promise<{ total: number; count: number }> {
    const { data, error } = await this.supabase
      .from('transaction_fees')
      .select('fee_amount')
      .eq('user_address', userAddress)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw new Error(`Failed to fetch fees: ${error.message}`);

    const total = (data || []).reduce((sum: number, f: any) => sum + parseFloat(f.fee_amount), 0);
    return { total, count: (data || []).length };
  }

  // ============================================
  // Billing History
  // ============================================

  /**
   * Record a billing event
   */
  async recordBillingEvent(
    userAddress: string,
    event: {
      type: string;
      amount: number;
      description: string;
      plan_id?: string;
      invoice_url?: string;
    }
  ): Promise<BillingRecord> {
    const { data, error } = await this.supabase
      .from('billing_history')
      .insert({
        user_address: userAddress,
        event_type: event.type,
        amount: event.amount,
        description: event.description,
        plan_id: event.plan_id,
        invoice_url: event.invoice_url,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to record billing event: ${error.message}`);
    return data;
  }

  /**
   * Get user's billing history
   */
  async getBillingHistory(
    userAddress: string,
    limit: number = 20
  ): Promise<BillingRecord[]> {
    const { data, error } = await this.supabase
      .from('billing_history')
      .select('*')
      .eq('user_address', userAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch billing history: ${error.message}`);
    return data || [];
  }

  // ============================================
  // Usage Metrics
  // ============================================

  /**
   * Get user's current usage metrics
   */
  async getUsageMetrics(userAddress: string): Promise<UsageMetrics> {
    // Get date range for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    // Parallel queries for efficiency
    const [
      scheduledCount,
      teamMembersCount,
      transactionsData,
    ] = await Promise.all([
      // Count scheduled payments
      this.supabase
        .from('scheduled_payments')
        .select('*', { count: 'exact', head: true })
        .eq('owner_address', userAddress)
        .in('status', ['active', 'paused']),

      // Count team members across all owned teams
      this.supabase
        .from('team_members')
        .select('team_id', { count: 'exact', head: true })
        .in('team_id',
          this.supabase
            .from('teams')
            .select('id')
            .eq('owner_address', userAddress)
        )
        .eq('status', 'active'),

      // Get transactions this month
      this.supabase
        .from('payments')
        .select('amount_usd')
        .eq('from_address', userAddress)
        .gte('timestamp', startOfMonth)
        .lte('timestamp', endOfMonth)
        .eq('status', 'completed'),
    ]);

    const transactions = transactionsData.data || [];
    const totalVolume = transactions.reduce(
      (sum: number, t: any) => sum + parseFloat(t.amount_usd || 0),
      0
    );

    return {
      recipients_count: 0, // This would be calculated per batch
      scheduled_count: scheduledCount.count || 0,
      team_members_count: teamMembersCount.count || 0,
      transactions_this_month: transactions.length,
      total_volume_this_month: totalVolume,
    };
  }

  /**
   * Update usage metrics in database
   */
  async updateUsageMetrics(userAddress: string): Promise<void> {
    const metrics = await this.getUsageMetrics(userAddress);
    const periodStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString();

    const { error } = await this.supabase
      .from('usage_metrics')
      .upsert({
        user_address: userAddress,
        period_start: periodStart,
        recipients_used: metrics.recipients_count,
        scheduled_payments_count: metrics.scheduled_count,
        team_members_count: metrics.team_members_count,
        transactions_count: metrics.transactions_this_month,
        total_volume: metrics.total_volume_this_month,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_address,period_start',
      });

    if (error) throw new Error(`Failed to update usage metrics: ${error.message}`);
  }

  // ============================================
  // Plan Comparison
  // ============================================

  /**
   * Get comparison data for all plans
   */
  async getPlanComparison(): Promise<{
    plans: SubscriptionPlan[];
    features: string[];
  }> {
    const plans = await this.getPlans();

    // Extract all unique features
    const featuresSet = new Set<string>();
    plans.forEach((plan) => {
      (plan.features as string[]).forEach((f) => featuresSet.add(f));
    });

    return {
      plans,
      features: Array.from(featuresSet),
    };
  }
}

// Export singleton instance
export const billingService = new BillingService();

/**
 * Scheduled Payment Service
 * Handles automated payroll and recurring payments
 * Supports daily, weekly, bi-weekly, and monthly schedules
 */

import { createClient } from '@/lib/supabase-client';
import type {
  ScheduledPayment,
  ScheduledPaymentLog,
  ScheduledRecipient,
  ScheduleType,
  ScheduleConfig,
  ScheduledPaymentStatus,
  ExecutionStatus,
  CreateScheduledPaymentInput,
  UpdateScheduledPaymentInput,
  ScheduledPaymentWithLogs,
  ExecuteScheduledResult,
  CronExecutionSummary,
  calculateNextExecution,
  getScheduleDescription,
} from '@/types';

// Re-export helpers
export { calculateNextExecution, getScheduleDescription } from '@/types/scheduled-payment';

// ============================================
// Scheduled Payment Service Class
// ============================================

export class ScheduledPaymentService {
  private supabase = createClient();

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Create a new scheduled payment
   */
  async create(
    ownerAddress: string,
    input: CreateScheduledPaymentInput
  ): Promise<ScheduledPayment> {
    // Validate recipients
    if (!input.recipients || input.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Calculate first execution date
    const { calculateNextExecution } = require('@/types/scheduled-payment');
    const startDate = input.start_date ? new Date(input.start_date) : new Date();
    const nextExecution = calculateNextExecution(
      input.schedule_type,
      input.schedule_config,
      startDate
    );

    const { data, error } = await this.supabase
      .from('scheduled_payments')
      .insert({
        owner_address: ownerAddress,
        team_id: input.team_id,
        name: input.name,
        description: input.description,
        recipients: input.recipients,
        schedule_type: input.schedule_type,
        schedule_config: input.schedule_config,
        timezone: input.timezone || 'UTC',
        next_execution: nextExecution.toISOString(),
        max_executions: input.max_executions,
        chain_id: input.chain_id || 42161,
        token: input.token || 'USDT',
        status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create scheduled payment: ${error.message}`);

    return data;
  }

  /**
   * Get scheduled payment by ID
   */
  async get(paymentId: string): Promise<ScheduledPayment | null> {
    const { data, error } = await this.supabase
      .from('scheduled_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get scheduled payment: ${error.message}`);
    }

    return data;
  }

  /**
   * Get scheduled payment with recent logs
   */
  async getWithLogs(
    paymentId: string,
    logLimit: number = 10
  ): Promise<ScheduledPaymentWithLogs | null> {
    const payment = await this.get(paymentId);
    if (!payment) return null;

    const { data: logs } = await this.supabase
      .from('scheduled_payment_logs')
      .select('*')
      .eq('scheduled_payment_id', paymentId)
      .order('execution_time', { ascending: false })
      .limit(logLimit);

    return {
      ...payment,
      recent_logs: logs || [],
    };
  }

  /**
   * Update scheduled payment
   */
  async update(
    paymentId: string,
    input: UpdateScheduledPaymentInput
  ): Promise<ScheduledPayment> {
    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    // Recalculate next execution if schedule changed
    if (input.schedule_type || input.schedule_config) {
      const current = await this.get(paymentId);
      if (current) {
        const { calculateNextExecution } = require('@/types/scheduled-payment');
        const scheduleType = input.schedule_type || current.schedule_type;
        const scheduleConfig = input.schedule_config || current.schedule_config;
        const nextExecution = calculateNextExecution(scheduleType, scheduleConfig);
        updateData.next_execution = nextExecution.toISOString();
      }
    }

    const { data, error } = await this.supabase
      .from('scheduled_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update scheduled payment: ${error.message}`);

    return data;
  }

  /**
   * Delete scheduled payment
   */
  async delete(paymentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('scheduled_payments')
      .delete()
      .eq('id', paymentId);

    if (error) throw new Error(`Failed to delete scheduled payment: ${error.message}`);
  }

  /**
   * List scheduled payments for user
   */
  async list(
    ownerAddress: string,
    options?: {
      status?: ScheduledPaymentStatus;
      teamId?: string;
      limit?: number;
    }
  ): Promise<ScheduledPayment[]> {
    let query = this.supabase
      .from('scheduled_payments')
      .select('*')
      .order('next_execution', { ascending: true });

    if (options?.teamId) {
      query = query.or(`owner_address.eq.${ownerAddress},team_id.eq.${options.teamId}`);
    } else {
      query = query.eq('owner_address', ownerAddress);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list scheduled payments: ${error.message}`);

    return data || [];
  }

  // ============================================
  // Status Management
  // ============================================

  /**
   * Pause a scheduled payment
   */
  async pause(paymentId: string): Promise<ScheduledPayment> {
    return this.update(paymentId, { status: 'paused' });
  }

  /**
   * Resume a paused scheduled payment
   */
  async resume(paymentId: string): Promise<ScheduledPayment> {
    const payment = await this.get(paymentId);
    if (!payment) throw new Error('Scheduled payment not found');

    // Recalculate next execution from now
    const { calculateNextExecution } = require('@/types/scheduled-payment');
    const nextExecution = calculateNextExecution(
      payment.schedule_type,
      payment.schedule_config
    );

    const { data, error } = await this.supabase
      .from('scheduled_payments')
      .update({
        status: 'active',
        next_execution: nextExecution.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to resume scheduled payment: ${error.message}`);

    return data;
  }

  /**
   * Cancel a scheduled payment
   */
  async cancel(paymentId: string): Promise<ScheduledPayment> {
    return this.update(paymentId, { status: 'cancelled' });
  }

  // ============================================
  // Execution (For Cron Jobs)
  // ============================================

  /**
   * Get all due scheduled payments
   */
  async getDuePayments(limit: number = 100): Promise<ScheduledPayment[]> {
    const { data, error } = await this.supabase
      .from('scheduled_payments')
      .select('*')
      .eq('status', 'active')
      .lte('next_execution', new Date().toISOString())
      .order('next_execution', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to get due payments: ${error.message}`);

    return data || [];
  }

  /**
   * Execute a single scheduled payment
   * Note: This creates a log entry but doesn't actually transfer funds.
   * The actual transfer should be done by the calling code using the batch transfer service.
   */
  async executePayment(paymentId: string): Promise<ExecuteScheduledResult> {
    const payment = await this.get(paymentId);
    if (!payment) {
      throw new Error('Scheduled payment not found');
    }

    if (payment.status !== 'active') {
      return {
        payment_id: paymentId,
        success: false,
        log_id: '',
        recipients_processed: 0,
        successful_count: 0,
        failed_count: 0,
        error_message: `Payment is ${payment.status}, not active`,
      };
    }

    // Check max executions
    if (payment.max_executions && payment.total_executions >= payment.max_executions) {
      await this.update(paymentId, { status: 'cancelled' });
      return {
        payment_id: paymentId,
        success: false,
        log_id: '',
        recipients_processed: 0,
        successful_count: 0,
        failed_count: 0,
        error_message: 'Maximum executions reached',
      };
    }

    // Calculate total amount
    const recipients = payment.recipients as ScheduledRecipient[];
    const totalAmount = recipients.reduce(
      (sum, r) => sum + parseFloat(r.amount || '0'),
      0
    );

    // Create log entry
    const { data: log, error: logError } = await this.supabase
      .from('scheduled_payment_logs')
      .insert({
        scheduled_payment_id: paymentId,
        status: 'success',  // Will be updated after actual execution
        total_amount: totalAmount.toString(),
        recipients_count: recipients.length,
        successful_count: recipients.length,
        failed_count: 0,
        details: recipients.map((r) => ({
          address: r.address,
          amount: r.amount,
          status: 'pending',
        })),
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create execution log: ${logError.message}`);
    }

    // Calculate next execution
    const { calculateNextExecution } = require('@/types/scheduled-payment');
    const nextExecution = calculateNextExecution(
      payment.schedule_type,
      payment.schedule_config
    );

    // Update payment record
    await this.supabase
      .from('scheduled_payments')
      .update({
        last_execution: new Date().toISOString(),
        next_execution: nextExecution.toISOString(),
        total_executions: payment.total_executions + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    return {
      payment_id: paymentId,
      success: true,
      log_id: log.id,
      recipients_processed: recipients.length,
      successful_count: recipients.length,
      failed_count: 0,
    };
  }

  /**
   * Update execution log after actual transfer
   */
  async updateExecutionLog(
    logId: string,
    result: {
      status: ExecutionStatus;
      tx_hash?: string;
      successful_count: number;
      failed_count: number;
      error_message?: string;
      details?: Array<{ address: string; amount: string; status: string; error?: string }>;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('scheduled_payment_logs')
      .update(result)
      .eq('id', logId);

    if (error) throw new Error(`Failed to update execution log: ${error.message}`);
  }

  /**
   * Execute all due payments (for cron job)
   */
  async executeAllDue(limit: number = 100): Promise<CronExecutionSummary> {
    const duePayments = await this.getDuePayments(limit);
    const results: ExecuteScheduledResult[] = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const payment of duePayments) {
      try {
        const result = await this.executePayment(payment.id);
        results.push(result);

        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error: any) {
        failed++;
        results.push({
          payment_id: payment.id,
          success: false,
          log_id: '',
          recipients_processed: 0,
          successful_count: 0,
          failed_count: 0,
          error_message: error.message,
        });
      }
    }

    return {
      executed_at: new Date().toISOString(),
      payments_processed: duePayments.length,
      successful,
      failed,
      skipped,
      results,
    };
  }

  // ============================================
  // Logs
  // ============================================

  /**
   * Get execution logs for a payment
   */
  async getLogs(
    paymentId: string,
    limit: number = 20
  ): Promise<ScheduledPaymentLog[]> {
    const { data, error } = await this.supabase
      .from('scheduled_payment_logs')
      .select('*')
      .eq('scheduled_payment_id', paymentId)
      .order('execution_time', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get logs: ${error.message}`);

    return data || [];
  }
}

// Export singleton instance
export const scheduledPaymentService = new ScheduledPaymentService();

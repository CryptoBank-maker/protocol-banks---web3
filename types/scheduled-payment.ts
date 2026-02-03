/**
 * Scheduled payment types for automated payroll
 * Supports various frequencies: daily, weekly, bi-weekly, monthly
 */

export type ScheduleType = 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
export type ScheduledPaymentStatus = 'active' | 'paused' | 'cancelled';
export type ExecutionStatus = 'success' | 'partial' | 'failed';

export interface ScheduledRecipient {
  address: string;
  amount: string;
  token?: string;
  vendorName?: string;
  vendorId?: string;
}

export interface ScheduleConfig {
  time?: string;  // "09:00" format
  day_of_week?: number;  // 1-7 (Monday-Sunday)
  day_of_month?: number;  // 1-31
}

export interface ScheduledPayment {
  id: string;
  owner_address: string;
  team_id?: string;
  name: string;
  description?: string;
  recipients: ScheduledRecipient[];
  schedule_type: ScheduleType;
  schedule_config: ScheduleConfig;
  timezone: string;
  next_execution: string;
  last_execution?: string;
  status: ScheduledPaymentStatus;
  total_executions: number;
  max_executions?: number;
  chain_id: number;
  token: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledPaymentLog {
  id: string;
  scheduled_payment_id: string;
  execution_time: string;
  status: ExecutionStatus;
  tx_hash?: string;
  total_amount?: string;
  recipients_count: number;
  successful_count: number;
  failed_count: number;
  error_message?: string;
  details?: ExecutionDetail[];
  created_at: string;
}

export interface ExecutionDetail {
  address: string;
  amount: string;
  status: 'success' | 'failed';
  tx_hash?: string;
  error?: string;
}

// Input types for API
export interface CreateScheduledPaymentInput {
  name: string;
  description?: string;
  recipients: ScheduledRecipient[];
  schedule_type: ScheduleType;
  schedule_config: ScheduleConfig;
  timezone?: string;
  start_date?: string;  // ISO date string
  max_executions?: number;
  chain_id?: number;
  token?: string;
  team_id?: string;
  total_amount?: string;  // Total amount for the payment
}

export interface UpdateScheduledPaymentInput {
  name?: string;
  description?: string;
  recipients?: ScheduledRecipient[];
  schedule_type?: ScheduleType;
  schedule_config?: ScheduleConfig;
  timezone?: string;
  status?: ScheduledPaymentStatus;
  max_executions?: number;
  total_amount?: string;  // Total amount for the payment
  token?: string;
}

// Response types
export interface ScheduledPaymentWithLogs extends ScheduledPayment {
  recent_logs: ScheduledPaymentLog[];
}

export interface ExecuteScheduledResult {
  payment_id: string;
  success: boolean;
  log_id: string;
  tx_hash?: string;
  recipients_processed: number;
  successful_count: number;
  failed_count: number;
  error_message?: string;
}

export interface CronExecutionSummary {
  executed_at: string;
  payments_processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ExecuteScheduledResult[];
}

// Helper functions
export function getScheduleDescription(
  scheduleType: ScheduleType,
  config: ScheduleConfig
): string {
  const time = config.time || '09:00';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  switch (scheduleType) {
    case 'daily':
      return `Every day at ${time}`;
    case 'weekly':
      const dayOfWeek = config.day_of_week || 1;
      return `Every ${days[dayOfWeek % 7]} at ${time}`;
    case 'bi-weekly':
      const biWeekDay = config.day_of_week || 5;
      return `Every other ${days[biWeekDay % 7]} at ${time}`;
    case 'monthly':
      const dayOfMonth = config.day_of_month || 1;
      const suffix = getDaySuffix(dayOfMonth);
      return `${dayOfMonth}${suffix} of every month at ${time}`;
    default:
      return 'Unknown schedule';
  }
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function calculateNextExecution(
  scheduleType: ScheduleType,
  config: ScheduleConfig,
  fromDate: Date = new Date()
): Date {
  const time = config.time || '09:00';
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(fromDate);

  switch (scheduleType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(hours, minutes, 0, 0);
      break;

    case 'weekly':
      const targetDay = config.day_of_week || 1;
      const currentDay = next.getDay();
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0) daysToAdd = 7;
      next.setDate(next.getDate() + daysToAdd);
      next.setHours(hours, minutes, 0, 0);
      break;

    case 'bi-weekly':
      const biTargetDay = config.day_of_week || 5;
      const biCurrentDay = next.getDay();
      let biDaysToAdd = (biTargetDay - biCurrentDay + 7) % 7;
      if (biDaysToAdd === 0) biDaysToAdd = 14;
      else biDaysToAdd += 7;
      next.setDate(next.getDate() + biDaysToAdd);
      next.setHours(hours, minutes, 0, 0);
      break;

    case 'monthly':
      const targetDayOfMonth = config.day_of_month || 1;
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(targetDayOfMonth, lastDay));
      next.setHours(hours, minutes, 0, 0);
      break;
  }

  return next;
}

/**
 * Split payment types for percentage-based payment distribution
 * Users can set custom percentages for each recipient
 */

export interface SplitRecipient {
  address: string;
  percentage: number;  // 0-100, user-defined
  vendorName?: string;
  vendorId?: string;
  calculatedAmount?: string;  // Calculated at execution time
}

export interface SplitTemplate {
  id: string;
  owner_address: string;
  team_id?: string;
  name: string;
  description?: string;
  recipients: SplitRecipient[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SplitExecution {
  id: string;
  template_id?: string | null;
  owner_address: string;
  team_id?: string | null;
  total_amount: string;
  token: string;
  chain_id: number;
  recipients: SplitRecipient[];
  status: SplitExecutionStatus;
  tx_hash?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
  executed_at?: string;
}

export type SplitExecutionStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Input types for API
export interface CreateSplitTemplateInput {
  name: string;
  description?: string;
  recipients: SplitRecipient[];
  team_id?: string;
}

export interface UpdateSplitTemplateInput {
  name?: string;
  description?: string;
  recipients?: SplitRecipient[];
  is_active?: boolean;
}

export interface ExecuteSplitInput {
  template_id?: string;  // Optional: use existing template
  total_amount: string;
  token: string;
  chain_id?: number;
  recipients?: SplitRecipient[];  // Required if no template_id
}

export interface CalculateSplitInput {
  total_amount: string;
  recipients: SplitRecipient[];
}

// Response types
export interface CalculateSplitResult {
  total_amount: string;
  recipients: SplitRecipient[];
  validation: {
    is_valid: boolean;
    total_percentage: number;
    errors: string[];
  };
}

export interface ExecuteSplitResult {
  success: boolean;
  execution_id?: string;
  tx_hash?: string;
  recipients_count: number;
  total_amount: string;
  error_message?: string;
}

// Validation helpers
export function validateSplitRecipients(recipients: SplitRecipient[]): {
  is_valid: boolean;
  total_percentage: number;
  errors: string[];
} {
  const errors: string[] = [];
  let total_percentage = 0;

  if (recipients.length === 0) {
    errors.push('At least one recipient is required');
  }

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];

    if (!r.address || !/^0x[a-fA-F0-9]{40}$/.test(r.address)) {
      errors.push(`Recipient ${i + 1}: Invalid wallet address`);
    }

    if (typeof r.percentage !== 'number' || r.percentage <= 0 || r.percentage > 100) {
      errors.push(`Recipient ${i + 1}: Percentage must be between 0 and 100`);
    }

    total_percentage += r.percentage || 0;
  }

  // Allow small floating point tolerance
  if (Math.abs(total_percentage - 100) > 0.01) {
    errors.push(`Total percentage must equal 100% (currently ${total_percentage.toFixed(2)}%)`);
  }

  return {
    is_valid: errors.length === 0,
    total_percentage,
    errors,
  };
}

// Calculate split amounts
export function calculateSplitAmounts(
  totalAmount: string,
  recipients: SplitRecipient[]
): SplitRecipient[] {
  const total = parseFloat(totalAmount);
  if (isNaN(total) || total <= 0) {
    return recipients;
  }

  return recipients.map((r) => ({
    ...r,
    calculatedAmount: ((total * r.percentage) / 100).toFixed(6),
  }));
}

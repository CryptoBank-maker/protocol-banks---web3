/**
 * Split Payment Service
 * Handles percentage-based payment distribution
 * Users can set custom percentages for each recipient
 */

import { createClient } from '@/lib/supabase-client';
import { publicBatchTransferService } from './public-batch-transfer-service';
import type { WalletClient, PublicClient } from 'viem';
import type {
  SplitRecipient,
  SplitTemplate,
  SplitExecution,
  SplitExecutionStatus,
  CreateSplitTemplateInput,
  UpdateSplitTemplateInput,
  ExecuteSplitInput,
  CalculateSplitResult,
  ExecuteSplitResult,
  validateSplitRecipients,
  calculateSplitAmounts,
} from '@/types';

// Re-export validation helpers
export { validateSplitRecipients, calculateSplitAmounts } from '@/types/split-payment';

// ============================================
// Split Payment Service Class
// ============================================

export class SplitPaymentService {
  private supabase = createClient();

  // ============================================
  // Calculation
  // ============================================

  /**
   * Calculate split amounts and validate percentages
   */
  calculateSplit(
    totalAmount: string,
    recipients: SplitRecipient[]
  ): CalculateSplitResult {
    const { validateSplitRecipients, calculateSplitAmounts } = require('@/types/split-payment');

    const validation = validateSplitRecipients(recipients);
    const calculatedRecipients = calculateSplitAmounts(totalAmount, recipients);

    return {
      total_amount: totalAmount,
      recipients: calculatedRecipients,
      validation,
    };
  }

  // ============================================
  // Template CRUD Operations
  // ============================================

  /**
   * Create a new split template
   */
  async createTemplate(
    ownerAddress: string,
    input: CreateSplitTemplateInput
  ): Promise<SplitTemplate> {
    // Validate recipients
    const { validateSplitRecipients } = require('@/types/split-payment');
    const validation = validateSplitRecipients(input.recipients);
    if (!validation.is_valid) {
      throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
    }

    const { data, error } = await this.supabase
      .from('payment_split_templates')
      .insert({
        owner_address: ownerAddress,
        team_id: input.team_id,
        name: input.name,
        description: input.description,
        recipients: input.recipients,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);

    return data;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<SplitTemplate | null> {
    const { data, error } = await this.supabase
      .from('payment_split_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get template: ${error.message}`);
    }

    return data;
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    ownerAddress: string,
    input: UpdateSplitTemplateInput
  ): Promise<SplitTemplate> {
    // Validate recipients if provided
    if (input.recipients) {
      const { validateSplitRecipients } = require('@/types/split-payment');
      const validation = validateSplitRecipients(input.recipients);
      if (!validation.is_valid) {
        throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
      }
    }

    const { data, error } = await this.supabase
      .from('payment_split_templates')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update template: ${error.message}`);

    return data;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await this.supabase
      .from('payment_split_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw new Error(`Failed to delete template: ${error.message}`);
  }

  /**
   * List templates for user
   */
  async listTemplates(
    ownerAddress: string,
    teamId?: string
  ): Promise<SplitTemplate[]> {
    let query = this.supabase
      .from('payment_split_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (teamId) {
      query = query.or(`owner_address.eq.${ownerAddress},team_id.eq.${teamId}`);
    } else {
      query = query.eq('owner_address', ownerAddress);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list templates: ${error.message}`);

    return data || [];
  }

  // ============================================
  // API-Compatible Methods
  // ============================================

  /**
   * Create a split execution record (API route compatible)
   * This is a simplified method that records the split intent
   * The actual execution with wallet signing happens client-side
   */
  async createSplitExecution(input: {
    owner_address: string;
    template_id?: string;
    team_id?: string;
    total_amount: string;
    token: string;
    chain_id: number;
    recipients: SplitRecipient[];
  }): Promise<SplitExecution> {
    // Validate recipients
    const { validateSplitRecipients, calculateSplitAmounts } = require('@/types/split-payment');
    const validation = validateSplitRecipients(input.recipients);
    if (!validation.is_valid) {
      throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
    }

    // Calculate amounts
    const calculatedRecipients = calculateSplitAmounts(input.total_amount, input.recipients);

    // Create execution record
    const { data, error } = await this.supabase
      .from('payment_split_executions')
      .insert({
        owner_address: input.owner_address,
        template_id: input.template_id,
        team_id: input.team_id,
        total_amount: input.total_amount,
        token: input.token,
        chain_id: input.chain_id,
        recipients: calculatedRecipients,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create split execution: ${error.message}`);

    return data;
  }

  // ============================================
  // Execution
  // ============================================

  /**
   * Execute a split payment
   */
  async executeSplit(
    walletClient: WalletClient,
    publicClient: PublicClient,
    ownerAddress: string,
    input: ExecuteSplitInput
  ): Promise<ExecuteSplitResult> {
    let recipients = input.recipients;

    // If template_id is provided, load template recipients
    if (input.template_id) {
      const template = await this.getTemplate(input.template_id);
      if (!template) {
        throw new Error('Template not found');
      }
      recipients = template.recipients;
    }

    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients provided');
    }

    // Calculate amounts
    const { calculateSplitAmounts, validateSplitRecipients } = require('@/types/split-payment');
    const validation = validateSplitRecipients(recipients);
    if (!validation.is_valid) {
      throw new Error(`Invalid recipients: ${validation.errors.join(', ')}`);
    }

    const calculatedRecipients = calculateSplitAmounts(input.total_amount, recipients);

    // Create execution record
    const { data: execution, error: createError } = await this.supabase
      .from('payment_split_executions')
      .insert({
        template_id: input.template_id,
        owner_address: ownerAddress,
        total_amount: input.total_amount,
        token: input.token,
        chain_id: input.chain_id || 42161,
        recipients: calculatedRecipients,
        status: 'processing',
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create execution record: ${createError.message}`);
    }

    try {
      // Convert to batch transfer format
      const batchRecipients = calculatedRecipients.map((r: SplitRecipient) => ({
        address: r.address as `0x${string}`,
        amount: r.calculatedAmount || '0',
      }));

      // Execute batch transfer
      const result = await publicBatchTransferService.batchTransfer(
        walletClient,
        publicClient,
        batchRecipients,
        input.token,
        input.chain_id || 42161
      );

      // Update execution record
      const updateData: Partial<SplitExecution> = {
        status: result.success ? 'completed' : 'failed',
        executed_at: new Date().toISOString(),
      };

      if (result.txHash) {
        updateData.tx_hash = result.txHash;
      }

      if (result.errorMessage) {
        updateData.error_message = result.errorMessage;
      }

      await this.supabase
        .from('payment_split_executions')
        .update(updateData)
        .eq('id', execution.id);

      return {
        success: result.success,
        execution_id: execution.id,
        tx_hash: result.txHash,
        recipients_count: calculatedRecipients.length,
        total_amount: input.total_amount,
        error_message: result.errorMessage,
      };
    } catch (error: any) {
      // Update execution as failed
      await this.supabase
        .from('payment_split_executions')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', execution.id);

      return {
        success: false,
        execution_id: execution.id,
        recipients_count: calculatedRecipients.length,
        total_amount: input.total_amount,
        error_message: error.message,
      };
    }
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(
    ownerAddress: string,
    options?: {
      templateId?: string;
      status?: SplitExecutionStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<SplitExecution[]> {
    let query = this.supabase
      .from('payment_split_executions')
      .select('*')
      .eq('owner_address', ownerAddress)
      .order('created_at', { ascending: false });

    if (options?.templateId) {
      query = query.eq('template_id', options.templateId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get execution history: ${error.message}`);

    return data || [];
  }

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<SplitExecution | null> {
    const { data, error } = await this.supabase
      .from('payment_split_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get execution: ${error.message}`);
    }

    return data;
  }
}

// Export singleton instance
export const splitPaymentService = new SplitPaymentService();

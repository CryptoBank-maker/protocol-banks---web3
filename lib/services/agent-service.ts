/**
 * Agent Service
 *
 * Manages AI agent registration, authentication, and lifecycle.
 * Agents can request budgets, propose payments, and execute transactions
 * with human oversight.
 *
 * @module lib/services/agent-service
 */

import { createHash, randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';

// ============================================
// Types
// ============================================

export type AgentType = 'trading' | 'payroll' | 'expense' | 'subscription' | 'custom';
export type AgentStatus = 'active' | 'paused' | 'deactivated';

export interface AutoExecuteRules {
  max_single_amount?: string;
  max_daily_amount?: string;
  allowed_tokens?: string[];
  allowed_recipients?: string[];
  allowed_chains?: number[];
}

export interface Agent {
  id: string;
  owner_address: string;
  name: string;
  description?: string;
  type: AgentType;
  avatar_url?: string;
  api_key_hash: string;
  api_key_prefix: string;
  webhook_url?: string;
  webhook_secret_hash?: string;
  status: AgentStatus;
  auto_execute_enabled: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute: number;
  created_at: Date;
  updated_at: Date;
  last_active_at?: Date;
}

export interface CreateAgentInput {
  owner_address: string;
  name: string;
  description?: string;
  type?: AgentType;
  avatar_url?: string;
  webhook_url?: string;
  auto_execute_enabled?: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute?: number;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  type?: AgentType;
  avatar_url?: string;
  webhook_url?: string;
  status?: AgentStatus;
  auto_execute_enabled?: boolean;
  auto_execute_rules?: AutoExecuteRules;
  rate_limit_per_minute?: number;
}

export interface AgentValidationResult {
  valid: boolean;
  agent?: Agent;
  error?: string;
}

// ============================================
// In-Memory Storage (for fallback/testing)
// ============================================

// Legacy in-memory storage - only used for testing
const agentsStore = new Map<string, Agent>();
const apiKeyToAgentId = new Map<string, string>();

// Flag to enable/disable database (for testing)
let useDatabaseStorage = true;

export function setUseDatabaseStorage(enabled: boolean) {
  useDatabaseStorage = enabled;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a secure API key with agent_ prefix
 */
export function generateAgentApiKey(): { key: string; prefix: string; hash: string } {
  const randomPart = randomBytes(24).toString('hex');
  const key = `agent_${randomPart}`;
  const prefix = key.substring(0, 12); // agent_xxxx
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a webhook secret
 */
export function generateWebhookSecret(): { secret: string; hash: string } {
  const secret = `whsec_${randomBytes(24).toString('hex')}`;
  const hash = hashApiKey(secret);
  return { secret, hash };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${randomBytes(8).toString('hex')}`;
}

// ============================================
// Agent Service
// ============================================

export const agentService = {
  /**
   * Create a new agent
   */
  async create(input: CreateAgentInput): Promise<{ agent: Agent; apiKey: string; webhookSecret?: string }> {
    // Validate input
    if (!input.owner_address) {
      throw new Error('owner_address is required');
    }
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('name is required');
    }

    // Generate API key
    const { key: apiKey, prefix, hash: apiKeyHash } = generateAgentApiKey();

    // Generate webhook secret if webhook URL provided
    let webhookSecret: string | undefined;
    let webhookSecretHash: string | undefined;
    if (input.webhook_url) {
      const webhookData = generateWebhookSecret();
      webhookSecret = webhookData.secret;
      webhookSecretHash = webhookData.hash;
    }

    const now = new Date();
    const agentData = {
      owner_address: input.owner_address.toLowerCase(),
      name: input.name.trim(),
      description: input.description,
      type: input.type || 'custom',
      avatar_url: input.avatar_url,
      api_key_hash: apiKeyHash,
      api_key_prefix: prefix,
      webhook_url: input.webhook_url,
      webhook_secret_hash: webhookSecretHash,
      status: 'active' as AgentStatus,
      auto_execute_enabled: input.auto_execute_enabled || false,
      auto_execute_rules: input.auto_execute_rules,
      rate_limit_per_minute: input.rate_limit_per_minute || 60,
    };

    // Use database or fallback to in-memory
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context for owner
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: input.owner_address.toLowerCase(),
        });

        // Insert agent
        const { data, error } = await supabase
          .from('agents')
          .insert(agentData)
          .select()
          .single();

        if (error) {
          console.error('[Agent Service] Database insert error:', error);
          throw new Error(`Failed to create agent: ${error.message}`);
        }

        // Convert database dates to Date objects
        const agent: Agent = {
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
          last_active_at: data.last_active_at ? new Date(data.last_active_at) : undefined,
        };

        return { agent, apiKey, webhookSecret };
      } catch (error) {
        console.error('[Agent Service] Failed to create agent in database:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent: Agent = {
        id: generateId(),
        ...agentData,
        created_at: now,
        updated_at: now,
      };

      agentsStore.set(agent.id, agent);
      apiKeyToAgentId.set(apiKeyHash, agent.id);

      return { agent, apiKey, webhookSecret };
    }
  },

  /**
   * List all agents for an owner
   */
  async list(ownerAddress: string): Promise<Agent[]> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('owner_address', ownerAddress.toLowerCase())
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Agent Service] List error:', error);
          throw new Error(`Failed to list agents: ${error.message}`);
        }

        // Convert database dates to Date objects
        return (data || []).map((agent) => ({
          ...agent,
          created_at: new Date(agent.created_at),
          updated_at: new Date(agent.updated_at),
          last_active_at: agent.last_active_at ? new Date(agent.last_active_at) : undefined,
        }));
      } catch (error) {
        console.error('[Agent Service] Failed to list agents:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agents: Agent[] = [];
      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase()) {
          agents.push(agent);
        }
      }
      return agents.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }
  },

  /**
   * Get an agent by ID
   */
  async get(id: string, ownerAddress: string): Promise<Agent | null> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', id)
          .eq('owner_address', ownerAddress.toLowerCase())
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found
            return null;
          }
          console.error('[Agent Service] Get error:', error);
          throw new Error(`Failed to get agent: ${error.message}`);
        }

        // Convert database dates to Date objects
        return {
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
          last_active_at: data.last_active_at ? new Date(data.last_active_at) : undefined,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to get agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent = agentsStore.get(id);
      if (!agent) return null;
      if (agent.owner_address.toLowerCase() !== ownerAddress.toLowerCase()) {
        return null;
      }
      return agent;
    }
  },

  /**
   * Get an agent by ID (internal, no owner check)
   */
  async getById(id: string): Promise<Agent | null> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found
            return null;
          }
          console.error('[Agent Service] GetById error:', error);
          return null;
        }

        // Convert database dates to Date objects
        return {
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
          last_active_at: data.last_active_at ? new Date(data.last_active_at) : undefined,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to get agent by id:', error);
        return null;
      }
    } else {
      // Fallback to in-memory storage
      return agentsStore.get(id) || null;
    }
  },

  /**
   * Update an agent
   */
  async update(id: string, ownerAddress: string, input: UpdateAgentInput): Promise<Agent> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        // Check agent exists
        const agent = await this.get(id, ownerAddress);
        if (!agent) {
          throw new Error('Agent not found');
        }

        // Build update object
        const updates: Record<string, any> = {};
        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.description !== undefined) updates.description = input.description;
        if (input.type !== undefined) updates.type = input.type;
        if (input.avatar_url !== undefined) updates.avatar_url = input.avatar_url;
        if (input.webhook_url !== undefined) {
          updates.webhook_url = input.webhook_url;
          // Generate new webhook secret if URL changed
          if (input.webhook_url) {
            const { hash } = generateWebhookSecret();
            updates.webhook_secret_hash = hash;
          }
        }
        if (input.status !== undefined) updates.status = input.status;
        if (input.auto_execute_enabled !== undefined) updates.auto_execute_enabled = input.auto_execute_enabled;
        if (input.auto_execute_rules !== undefined) updates.auto_execute_rules = input.auto_execute_rules;
        if (input.rate_limit_per_minute !== undefined) updates.rate_limit_per_minute = input.rate_limit_per_minute;

        updates.updated_at = new Date().toISOString();

        // Update in database
        const { data, error } = await supabase
          .from('agents')
          .update(updates)
          .eq('id', id)
          .eq('owner_address', ownerAddress.toLowerCase())
          .select()
          .single();

        if (error) {
          console.error('[Agent Service] Update error:', error);
          throw new Error(`Failed to update agent: ${error.message}`);
        }

        // Convert database dates to Date objects
        return {
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
          last_active_at: data.last_active_at ? new Date(data.last_active_at) : undefined,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to update agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent = await this.get(id, ownerAddress);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Update fields
      if (input.name !== undefined) agent.name = input.name.trim();
      if (input.description !== undefined) agent.description = input.description;
      if (input.type !== undefined) agent.type = input.type;
      if (input.avatar_url !== undefined) agent.avatar_url = input.avatar_url;
      if (input.webhook_url !== undefined) {
        agent.webhook_url = input.webhook_url;
        // Generate new webhook secret if URL changed
        if (input.webhook_url) {
          const { hash } = generateWebhookSecret();
          agent.webhook_secret_hash = hash;
        }
      }
      if (input.status !== undefined) agent.status = input.status;
      if (input.auto_execute_enabled !== undefined) agent.auto_execute_enabled = input.auto_execute_enabled;
      if (input.auto_execute_rules !== undefined) agent.auto_execute_rules = input.auto_execute_rules;
      if (input.rate_limit_per_minute !== undefined) agent.rate_limit_per_minute = input.rate_limit_per_minute;

      agent.updated_at = new Date();
      agentsStore.set(id, agent);

      return agent;
    }
  },

  /**
   * Deactivate an agent (soft delete)
   */
  async deactivate(id: string, ownerAddress: string): Promise<void> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        // Check agent exists
        const agent = await this.get(id, ownerAddress);
        if (!agent) {
          throw new Error('Agent not found');
        }

        // Update status to deactivated
        const { error } = await supabase
          .from('agents')
          .update({
            status: 'deactivated',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('owner_address', ownerAddress.toLowerCase());

        if (error) {
          console.error('[Agent Service] Deactivate error:', error);
          throw new Error(`Failed to deactivate agent: ${error.message}`);
        }
      } catch (error) {
        console.error('[Agent Service] Failed to deactivate agent:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      const agent = await this.get(id, ownerAddress);
      if (!agent) {
        throw new Error('Agent not found');
      }

      agent.status = 'deactivated';
      agent.updated_at = new Date();
      agentsStore.set(id, agent);

      // Remove API key mapping
      apiKeyToAgentId.delete(agent.api_key_hash);
    }
  },

  /**
   * Validate an agent API key
   */
  async validate(apiKey: string): Promise<AgentValidationResult> {
    // Check format
    if (!apiKey || !apiKey.startsWith('agent_')) {
      return { valid: false, error: 'Invalid API key format' };
    }

    // Hash the API key
    const hash = hashApiKey(apiKey);

    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Find agent by API key hash
        const { data, error } = await supabase
          .from('agents')
          .select('*')
          .eq('api_key_hash', hash)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // Not found
            return { valid: false, error: 'API key not found' };
          }
          console.error('[Agent Service] Validate error:', error);
          return { valid: false, error: 'Failed to validate API key' };
        }

        const agent: Agent = {
          ...data,
          created_at: new Date(data.created_at),
          updated_at: new Date(data.updated_at),
          last_active_at: data.last_active_at ? new Date(data.last_active_at) : undefined,
        };

        // Check status
        if (agent.status === 'deactivated') {
          return { valid: false, error: 'Agent is deactivated' };
        }

        if (agent.status === 'paused') {
          return { valid: false, error: 'Agent is paused' };
        }

        return { valid: true, agent };
      } catch (error) {
        console.error('[Agent Service] Failed to validate API key:', error);
        return { valid: false, error: 'Failed to validate API key' };
      }
    } else {
      // Fallback to in-memory storage
      const agentId = apiKeyToAgentId.get(hash);

      if (!agentId) {
        return { valid: false, error: 'API key not found' };
      }

      const agent = agentsStore.get(agentId);
      if (!agent) {
        return { valid: false, error: 'Agent not found' };
      }

      // Check status
      if (agent.status === 'deactivated') {
        return { valid: false, error: 'Agent is deactivated' };
      }

      if (agent.status === 'paused') {
        return { valid: false, error: 'Agent is paused' };
      }

      return { valid: true, agent };
    }
  },

  /**
   * Update last active timestamp
   */
  async updateLastActive(id: string): Promise<void> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        await supabase
          .from('agents')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', id);
      } catch (error) {
        console.error('[Agent Service] Failed to update last active:', error);
        // Don't throw error for this non-critical operation
      }
    } else {
      // Fallback to in-memory storage
      const agent = agentsStore.get(id);
      if (agent) {
        agent.last_active_at = new Date();
        agentsStore.set(id, agent);
      }
    }
  },

  /**
   * Pause all agents for an owner
   */
  async pauseAll(ownerAddress: string): Promise<number> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        const { data, error } = await supabase
          .from('agents')
          .update({
            status: 'paused',
            auto_execute_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('owner_address', ownerAddress.toLowerCase())
          .eq('status', 'active')
          .select('id');

        if (error) {
          console.error('[Agent Service] Pause all error:', error);
          throw new Error(`Failed to pause agents: ${error.message}`);
        }

        return data?.length || 0;
      } catch (error) {
        console.error('[Agent Service] Failed to pause all agents:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let count = 0;
      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase() && agent.status === 'active') {
          agent.status = 'paused';
          agent.auto_execute_enabled = false;
          agent.updated_at = new Date();
          agentsStore.set(agent.id, agent);
          count++;
        }
      }
      return count;
    }
  },

  /**
   * Resume all agents for an owner
   */
  async resumeAll(ownerAddress: string): Promise<number> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        const { data, error } = await supabase
          .from('agents')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('owner_address', ownerAddress.toLowerCase())
          .eq('status', 'paused')
          .select('id');

        if (error) {
          console.error('[Agent Service] Resume all error:', error);
          throw new Error(`Failed to resume agents: ${error.message}`);
        }

        return data?.length || 0;
      } catch (error) {
        console.error('[Agent Service] Failed to resume all agents:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let count = 0;
      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase() && agent.status === 'paused') {
          agent.status = 'active';
          agent.updated_at = new Date();
          agentsStore.set(agent.id, agent);
          count++;
        }
      }
      return count;
    }
  },

  /**
   * Get agent count for an owner
   */
  async getCount(ownerAddress: string): Promise<{ total: number; active: number; paused: number }> {
    if (useDatabaseStorage) {
      try {
        const supabase = await createClient();

        // Set RLS context
        await supabase.rpc('set_config', {
          setting: 'app.current_user_address',
          value: ownerAddress.toLowerCase(),
        });

        // Get all agents for owner
        const { data, error } = await supabase
          .from('agents')
          .select('status')
          .eq('owner_address', ownerAddress.toLowerCase());

        if (error) {
          console.error('[Agent Service] Get count error:', error);
          throw new Error(`Failed to get agent count: ${error.message}`);
        }

        const agents = data || [];
        return {
          total: agents.length,
          active: agents.filter((a) => a.status === 'active').length,
          paused: agents.filter((a) => a.status === 'paused').length,
        };
      } catch (error) {
        console.error('[Agent Service] Failed to get agent count:', error);
        throw error;
      }
    } else {
      // Fallback to in-memory storage
      let total = 0;
      let active = 0;
      let paused = 0;

      for (const agent of agentsStore.values()) {
        if (agent.owner_address.toLowerCase() === ownerAddress.toLowerCase()) {
          total++;
          if (agent.status === 'active') active++;
          if (agent.status === 'paused') paused++;
        }
      }

      return { total, active, paused };
    }
  },

  // ============================================
  // Test Helpers (for unit tests)
  // ============================================

  /**
   * Clear all agents (for testing)
   */
  _clearAll(): void {
    agentsStore.clear();
    apiKeyToAgentId.clear();
  },

  /**
   * Get store size (for testing)
   */
  _getStoreSize(): number {
    return agentsStore.size;
  },
};

export default agentService;

// API Key management service
import { prisma } from "@/lib/prisma"
import { createHash, randomBytes } from "crypto"

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  owner_address: string
  permissions: string[]
  rate_limit_per_minute: number
  rate_limit_per_day: number
  allowed_ips?: string[]
  allowed_origins?: string[]
  expires_at?: string
  last_used_at?: string
  usage_count: number
  is_active: boolean
  created_at: string
}

export interface CreateApiKeyResult {
  apiKey: ApiKey
  secretKey: string // Only returned once on creation
}

export interface Webhook {
  id: string
  name: string
  url: string
  owner_address: string
  events: string[]
  is_active: boolean
  retry_count: number
  timeout_ms: number
  created_at: string
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event_type: string
  payload: Record<string, unknown>
  status: "pending" | "delivered" | "failed"
  attempts: number
  response_status?: number
  error_message?: string
  created_at: string
  delivered_at?: string
}

// Available webhook events
export const WEBHOOK_EVENTS = [
  "payment.created",
  "payment.completed",
  "payment.failed",
  "batch_payment.created",
  "batch_payment.completed",
  "multisig.proposal_created",
  "multisig.confirmation_added",
  "multisig.executed",
  "vendor.created",
  "vendor.updated",
] as const

// Available API permissions
export const API_PERMISSIONS = [
  "read",
  "write",
  "payments.create",
  "payments.read",
  "vendors.manage",
  "analytics.read",
  "webhooks.manage",
] as const

export class ApiKeyService {
  // Generate a new API key
  async createApiKey(params: {
    name: string
    ownerAddress: string
    permissions?: string[]
    rateLimitPerMinute?: number
    rateLimitPerDay?: number
    allowedIps?: string[]
    allowedOrigins?: string[]
    expiresInDays?: number
  }): Promise<CreateApiKeyResult> {
    const secretKey = `pb_${randomBytes(32).toString("hex")}`
    const keyHash = createHash("sha256").update(secretKey).digest("hex")
    const keyPrefix = secretKey.substring(0, 12)

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const rows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO api_keys (name, key_hash, key_prefix, owner_address, permissions, rate_limit_per_minute, rate_limit_per_day, allowed_ips, allowed_origins, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      params.name,
      keyHash,
      keyPrefix,
      params.ownerAddress.toLowerCase(),
      JSON.stringify(params.permissions || ["read"]),
      params.rateLimitPerMinute || 60,
      params.rateLimitPerDay || 10000,
      params.allowedIps ? JSON.stringify(params.allowedIps) : null,
      params.allowedOrigins ? JSON.stringify(params.allowedOrigins) : null,
      expiresAt,
    )

    if (!rows[0]) throw new Error("Failed to create API key")

    return {
      apiKey: rows[0],
      secretKey, // Only returned once
    }
  }

  // Validate an API key
  async validateApiKey(secretKey: string): Promise<ApiKey | null> {
    const keyHash = createHash("sha256").update(secretKey).digest("hex")

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM api_keys WHERE key_hash = $1 AND is_active = true LIMIT 1`,
      keyHash,
    )

    if (!rows[0]) return null

    const data = rows[0]

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null
    }

    // Update usage stats
    await prisma.$executeRawUnsafe(
      `UPDATE api_keys SET last_used_at = $1, usage_count = usage_count + 1 WHERE id = $2`,
      new Date().toISOString(),
      data.id,
    )

    return data
  }

  // Check rate limit
  async checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; remaining: number }> {
    const keyRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT rate_limit_per_minute, rate_limit_per_day FROM api_keys WHERE id = $1 LIMIT 1`,
      apiKeyId,
    )

    if (!keyRows[0]) return { allowed: false, remaining: 0 }

    const key = keyRows[0]

    // Get usage in last minute
    const minuteAgo = new Date(Date.now() - 60000).toISOString()
    const minuteResult: { count: bigint }[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM api_key_usage_logs WHERE api_key_id = $1 AND created_at >= $2`,
      apiKeyId,
      minuteAgo,
    )
    const minuteCount = Number(minuteResult[0]?.count || 0)

    if (minuteCount >= key.rate_limit_per_minute) {
      return { allowed: false, remaining: 0 }
    }

    // Get usage today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayResult: { count: bigint }[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM api_key_usage_logs WHERE api_key_id = $1 AND created_at >= $2`,
      apiKeyId,
      today.toISOString(),
    )
    const dayCount = Number(dayResult[0]?.count || 0)

    if (dayCount >= key.rate_limit_per_day) {
      return { allowed: false, remaining: 0 }
    }

    return {
      allowed: true,
      remaining: key.rate_limit_per_minute - minuteCount,
    }
  }

  // Log API usage
  async logUsage(params: {
    apiKeyId: string
    endpoint: string
    method: string
    statusCode: number
    responseTimeMs: number
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await prisma.$executeRawUnsafe(
      `INSERT INTO api_key_usage_logs (api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      params.apiKeyId,
      params.endpoint,
      params.method,
      params.statusCode,
      params.responseTimeMs,
      params.ipAddress || null,
      params.userAgent || null,
    )
  }

  // Get all API keys for a user
  async getApiKeys(ownerAddress: string): Promise<ApiKey[]> {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM api_keys WHERE owner_address = $1 ORDER BY created_at DESC`,
      ownerAddress.toLowerCase(),
    )

    return rows || []
  }

  // Revoke an API key
  async revokeApiKey(keyId: string, ownerAddress: string): Promise<void> {
    const result = await prisma.$executeRawUnsafe(
      `UPDATE api_keys SET is_active = false WHERE id = $1 AND owner_address = $2`,
      keyId,
      ownerAddress.toLowerCase(),
    )

    if (result === 0) throw new Error("API key not found or not owned by user")
  }

  // Delete an API key
  async deleteApiKey(keyId: string, ownerAddress: string): Promise<void> {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM api_keys WHERE id = $1 AND owner_address = $2`,
      keyId,
      ownerAddress.toLowerCase(),
    )

    if (result === 0) throw new Error("API key not found or not owned by user")
  }
}

export class WebhookService {
  // Create a new webhook
  async createWebhook(params: {
    name: string
    url: string
    ownerAddress: string
    events: string[]
  }): Promise<{ webhook: Webhook; secret: string }> {
    const secret = `whsec_${randomBytes(32).toString("hex")}`
    const secretHash = createHash("sha256").update(secret).digest("hex")

    const rows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO webhooks (name, url, owner_address, events, secret_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      params.name,
      params.url,
      params.ownerAddress.toLowerCase(),
      JSON.stringify(params.events),
      secretHash,
    )

    if (!rows[0]) throw new Error("Failed to create webhook")

    return {
      webhook: rows[0],
      secret, // Only returned once
    }
  }

  // Get all webhooks for a user
  async getWebhooks(ownerAddress: string): Promise<Webhook[]> {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM webhooks WHERE owner_address = $1 ORDER BY created_at DESC`,
      ownerAddress.toLowerCase(),
    )

    return rows || []
  }

  // Trigger a webhook event
  async triggerEvent(params: {
    ownerAddress: string
    eventType: string
    payload: Record<string, unknown>
  }): Promise<void> {
    // Find all active webhooks for this event
    const webhooks: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM webhooks
       WHERE owner_address = $1 AND is_active = true AND events @> $2`,
      params.ownerAddress.toLowerCase(),
      JSON.stringify([params.eventType]),
    )

    if (!webhooks || webhooks.length === 0) return

    // Create delivery records
    for (const webhook of webhooks) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status)
         VALUES ($1, $2, $3, $4)`,
        webhook.id,
        params.eventType,
        JSON.stringify(params.payload),
        "pending",
      )
    }

    // In production, use a queue to process deliveries
    // For now, we'll process inline
    for (const webhook of webhooks) {
      await this.deliverWebhook(webhook, params.eventType, params.payload)
    }
  }

  // Deliver a webhook
  private async deliverWebhook(webhook: Webhook, eventType: string, payload: Record<string, unknown>): Promise<void> {
    const deliveryPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    }

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": eventType,
          "X-Webhook-Timestamp": new Date().toISOString(),
        },
        body: JSON.stringify(deliveryPayload),
        signal: AbortSignal.timeout(webhook.timeout_ms),
      })

      await prisma.$executeRawUnsafe(
        `UPDATE webhook_deliveries
         SET status = $1, response_status = $2, delivered_at = $3, attempts = 1, last_attempt_at = $4
         WHERE webhook_id = $5 AND event_type = $6 AND status = 'pending'`,
        response.ok ? "delivered" : "failed",
        response.status,
        response.ok ? new Date().toISOString() : null,
        new Date().toISOString(),
        webhook.id,
        eventType,
      )
    } catch (error) {
      await prisma.$executeRawUnsafe(
        `UPDATE webhook_deliveries
         SET status = $1, error_message = $2, attempts = 1, last_attempt_at = $3
         WHERE webhook_id = $4 AND event_type = $5 AND status = 'pending'`,
        "failed",
        error instanceof Error ? error.message : "Unknown error",
        new Date().toISOString(),
        webhook.id,
        eventType,
      )
    }
  }

  // Get webhook deliveries
  async getDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 100`,
      webhookId,
    )

    return rows || []
  }

  // Update webhook
  async updateWebhook(params: {
    webhookId: string
    ownerAddress: string
    updates: Partial<Pick<Webhook, "name" | "url" | "events" | "is_active">>
  }): Promise<void> {
    const setClauses: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (params.updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`)
      values.push(params.updates.name)
    }
    if (params.updates.url !== undefined) {
      setClauses.push(`url = $${paramIndex++}`)
      values.push(params.updates.url)
    }
    if (params.updates.events !== undefined) {
      setClauses.push(`events = $${paramIndex++}`)
      values.push(JSON.stringify(params.updates.events))
    }
    if (params.updates.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`)
      values.push(params.updates.is_active)
    }

    if (setClauses.length === 0) return

    values.push(params.webhookId)
    values.push(params.ownerAddress.toLowerCase())

    const result = await prisma.$executeRawUnsafe(
      `UPDATE webhooks SET ${setClauses.join(", ")} WHERE id = $${paramIndex++} AND owner_address = $${paramIndex}`,
      ...values,
    )

    if (result === 0) throw new Error("Webhook not found or not owned by user")
  }

  // Delete webhook
  async deleteWebhook(webhookId: string, ownerAddress: string): Promise<void> {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM webhooks WHERE id = $1 AND owner_address = $2`,
      webhookId,
      ownerAddress.toLowerCase(),
    )

    if (result === 0) throw new Error("Webhook not found or not owned by user")
  }
}

export const apiKeyService = new ApiKeyService()
export const webhookService = new WebhookService()

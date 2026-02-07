/**
 * Recovery Manager Service
 * Handles retry logic for failed transactions
 */

import prisma from '@/lib/prisma'

export interface FailedItem {
  id: string
  recipient: string
  amount: number
  token: string
  error: string
  attempts: number
  lastAttempt: number
  originalBatchId?: string
}

export interface RetryResult {
  id: string
  success: boolean
  transactionHash?: string
  error?: string
}

export interface RecoveryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_CONFIG: RecoveryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/**
 * Calculate delay for retry attempt
 */
export function calculateRetryDelay(
  attempt: number,
  config: RecoveryConfig = DEFAULT_CONFIG
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1)
  return Math.min(delay, config.maxDelayMs)
}

/**
 * Check if item should be retried
 */
export function shouldRetry(
  item: FailedItem,
  config: RecoveryConfig = DEFAULT_CONFIG
): boolean {
  return item.attempts < config.maxAttempts
}

/**
 * Retry failed items
 */
export async function retryFailedItems(
  items: FailedItem[],
  retryFn: (item: FailedItem) => Promise<RetryResult>,
  config: RecoveryConfig = DEFAULT_CONFIG
): Promise<{
  results: RetryResult[]
  successCount: number
  failureCount: number
  stillFailed: FailedItem[]
}> {
  const results: RetryResult[] = []
  const stillFailed: FailedItem[] = []
  
  for (const item of items) {
    if (!shouldRetry(item, config)) {
      stillFailed.push(item)
      results.push({
        id: item.id,
        success: false,
        error: `Max retry attempts (${config.maxAttempts}) exceeded`,
      })
      continue
    }
    
    // Calculate delay based on attempts
    const delay = calculateRetryDelay(item.attempts + 1, config)
    await sleep(delay)
    
    try {
      const result = await retryFn({
        ...item,
        attempts: item.attempts + 1,
        lastAttempt: Date.now(),
      })
      
      results.push(result)
      
      if (!result.success) {
        stillFailed.push({
          ...item,
          attempts: item.attempts + 1,
          lastAttempt: Date.now(),
          error: result.error || item.error,
        })
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({
        id: item.id,
        success: false,
        error,
      })
      stillFailed.push({
        ...item,
        attempts: item.attempts + 1,
        lastAttempt: Date.now(),
        error,
      })
    }
  }
  
  const successCount = results.filter(r => r.success).length
  const failureCount = results.length - successCount
  
  return {
    results,
    successCount,
    failureCount,
    stillFailed,
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create failed item record
 */
export function createFailedItem(
  id: string,
  recipient: string,
  amount: number,
  token: string,
  error: string,
  originalBatchId?: string
): FailedItem {
  return {
    id,
    recipient,
    amount,
    token,
    error,
    attempts: 1,
    lastAttempt: Date.now(),
    originalBatchId,
  }
}

/**
 * Store failed items for later recovery
 */
export async function storeFailedItems(
  items: FailedItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.failedTransaction.createMany({
      data: items.map(item => ({
        id: item.id,
        recipient: item.recipient,
        amount: item.amount,
        token: item.token,
        error: item.error,
        attempts: item.attempts,
        last_attempt: new Date(item.lastAttempt),
        original_batch_id: item.originalBatchId,
      })),
    })
    
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

/**
 * Get pending failed items for recovery
 */
export async function getPendingFailedItems(
  config: RecoveryConfig = DEFAULT_CONFIG
): Promise<FailedItem[]> {
  try {
    const data = await prisma.failedTransaction.findMany({
      where: {
        attempts: { lt: config.maxAttempts },
      },
      orderBy: { created_at: 'asc' },
    })
    
    return data.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      amount: row.amount,
      token: row.token,
      error: row.error,
      attempts: row.attempts,
      lastAttempt: row.last_attempt ? new Date(row.last_attempt).getTime() : Date.now(),
      originalBatchId: row.original_batch_id ?? undefined,
    }))
  } catch (err) {
    console.error('[RecoveryManager] Failed to get pending items:', err)
    return []
  }
}

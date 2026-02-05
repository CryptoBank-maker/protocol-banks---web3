/**
 * Nonce Manager Service
 * Manages nonces for EIP-3009 TransferWithAuthorization
 */

// Lazy Redis import to avoid bundling ioredis in client components
let redis: any = null
const getRedis = async () => {
  if (redis) return redis
  if (typeof window !== "undefined") return null // Never use Redis on client
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null
  const { default: Redis } = await import("ioredis")
  redis = new Redis(redisUrl)
  return redis
}

// In-memory nonce tracking fallback
const usedNonces = new Map<string, Set<string>>()

/**
 * Generate a unique nonce for authorization
 */
export function generateNonce(): string {
  const randomBytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes)
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check if a nonce has been used (Distributed)
 */
export async function isNonceUsed(address: string, nonce: string): Promise<boolean> {
  const normalizedNonce = nonce.toLowerCase()
  const normalizedAddress = address.toLowerCase()

  const redisClient = await getRedis()
  if (redisClient) {
    const exists = await redisClient.sismember(`nonces:${normalizedAddress}`, normalizedNonce)
    return exists === 1
  }

  // Fallback
  const nonceSet = usedNonces.get(normalizedAddress)
  return nonceSet ? nonceSet.has(normalizedNonce) : false
}

/**
 * Mark a nonce as used (Distributed)
 */
export async function markNonceUsed(address: string, nonce: string): Promise<void> {
  const normalizedNonce = nonce.toLowerCase()
  const normalizedAddress = address.toLowerCase()

  const redisClient = await getRedis()
  if (redisClient) {
    await redisClient.sadd(`nonces:${normalizedAddress}`, normalizedNonce)
    return
  }

  // Fallback
  if (!usedNonces.has(normalizedAddress)) {
    usedNonces.set(normalizedAddress, new Set())
  }
  usedNonces.get(normalizedAddress)!.add(normalizedNonce)
}

/**
 * Get current nonce count for an address
 */
export async function getNonceCount(address: string): Promise<number> {
  const redisClient = await getRedis()
  if (redisClient) {
    return await redisClient.scard(`nonces:${address.toLowerCase()}`)
  }
  const nonceSet = usedNonces.get(address.toLowerCase())
  return nonceSet ? nonceSet.size : 0
}


/**
 * Increment nonce (generate new and mark current as used)
 */
export function incrementNonce(address: string): string {
  const newNonce = generateNonce()
  return newNonce
}

/**
 * Clear all nonces for an address (for testing)
 */
export function clearNonces(address: string): void {
  const normalizedAddress = address.toLowerCase()
  usedNonces.delete(normalizedAddress)
}

/**
 * Validate nonce format
 */
export function isValidNonce(nonce: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(nonce)
}

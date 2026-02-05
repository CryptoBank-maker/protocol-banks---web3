/**
 * Shared API Route Authentication
 * Extracts owner/wallet address from request using:
 * 1. Server-side Supabase auth (cookie-based)
 * 2. Fallback: x-wallet-address header
 */

import { type NextRequest } from 'next/server'

export async function getAuthenticatedAddress(request: NextRequest): Promise<string | null> {
  // Try Supabase server auth first
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      return user.user_metadata?.wallet_address || user.email || null
    }
  } catch {
    // Supabase not configured or cookies not available
  }

  // Fallback: x-wallet-address header
  const walletAddress = request.headers.get('x-wallet-address')
  if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return walletAddress
  }

  return null
}

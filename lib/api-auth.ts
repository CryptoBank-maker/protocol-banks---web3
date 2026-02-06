/**
 * Shared API Route Authentication
 * Extracts owner/wallet address from request using:
 * 1. x-wallet-address header (primary – set by client-side authenticated fetch)
 * 2. Wallet query parameter (secondary – for simple GET requests)
 */

import { type NextRequest } from 'next/server'

export async function getAuthenticatedAddress(request: NextRequest): Promise<string | null> {
  // Primary: x-wallet-address header (set by createAuthenticatedFetch / authHeaders)
  const walletHeader = request.headers.get('x-wallet-address')
  if (walletHeader && /^0x[a-fA-F0-9]{40}$/i.test(walletHeader)) {
    return walletHeader
  }

  // Secondary: wallet query parameter (for GET requests that pass ?wallet=0x...)
  const { searchParams } = new URL(request.url)
  const walletParam = searchParams.get('wallet')
  if (walletParam && /^0x[a-fA-F0-9]{40}$/i.test(walletParam)) {
    return walletParam
  }

  return null
}

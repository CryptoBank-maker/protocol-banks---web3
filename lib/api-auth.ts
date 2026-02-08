/**
 * Shared API Route Authentication
 * Extracts owner/wallet address from request using:
 * 1. x-wallet-address header (primary – set by client-side authenticated fetch)
 * 2. Wallet query parameter (secondary – for simple GET requests)
 */

import { type NextRequest } from 'next/server'

function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(address)
}

function isTronAddress(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
}

function isSupportedAddress(address: string | null): address is string {
  if (!address) return false
  return isEvmAddress(address) || isTronAddress(address)
}

export async function getAuthenticatedAddress(request: NextRequest): Promise<string | null> {
  // Primary: x-wallet-address header (set by createAuthenticatedFetch / authHeaders)
  const walletHeader = request.headers.get('x-wallet-address')
  if (isSupportedAddress(walletHeader)) {
    return walletHeader
  }

  // Secondary: wallet query parameter (for GET requests that pass ?wallet=...)
  const { searchParams } = new URL(request.url)
  const walletParam = searchParams.get('wallet')
  if (isSupportedAddress(walletParam)) {
    return walletParam
  }

  return null
}

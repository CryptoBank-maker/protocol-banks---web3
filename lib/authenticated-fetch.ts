/**
 * Authenticated Fetch Utility
 *
 * Wraps the native fetch to automatically include the x-wallet-address header
 * for Prisma-backed API route authentication.
 *
 * Usage:
 *   import { createAuthenticatedFetch } from "@/lib/authenticated-fetch"
 *   const authFetch = createAuthenticatedFetch(walletAddress)
 *   const res = await authFetch("/api/payments")
 */

export function createAuthenticatedFetch(walletAddress: string | null | undefined) {
  return async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers)

    // Always attach wallet address if available
    if (walletAddress && !headers.has("x-wallet-address")) {
      headers.set("x-wallet-address", walletAddress)
    }

    return fetch(input, {
      ...init,
      headers,
    })
  }
}

/**
 * Helper to build headers object with wallet address included.
 * Useful when you need to pass headers inline.
 */
export function authHeaders(
  walletAddress: string | null | undefined,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  if (walletAddress) {
    headers["x-wallet-address"] = walletAddress
  }
  return headers
}

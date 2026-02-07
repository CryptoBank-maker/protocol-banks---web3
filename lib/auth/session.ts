/**
 * Session Management
 */

import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { generateSecureToken, sha256 } from "./crypto"
import { AUTH_CONFIG } from "./config"

export interface Session {
  userId: string
  email: string
  walletAddress?: string
  expiresAt: Date
}

/**
 * Create a new session for user
 */
export async function createSession(
  userId: string,
  email: string,
  walletAddress?: string,
  metadata?: {
    ipAddress?: string
    userAgent?: string
    deviceFingerprint?: string
  },
): Promise<string> {
  // Generate session token
  const sessionToken = generateSecureToken()
  const tokenHash = await sha256(sessionToken)

  // Calculate expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + AUTH_CONFIG.session.expiresInDays)

  // Store session in database
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO auth_sessions (user_id, session_token_hash, device_fingerprint, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      userId,
      tokenHash,
      metadata?.deviceFingerprint || null,
      metadata?.ipAddress || null,
      metadata?.userAgent || null,
      expiresAt.toISOString(),
    )
  } catch (error) {
    console.error("[Auth] Failed to create session:", error)
    throw new Error("Failed to create session")
  }

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set(AUTH_CONFIG.session.cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  })

  return sessionToken
}

/**
 * Get current session from cookie
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(AUTH_CONFIG.session.cookieName)?.value

  if (!sessionToken) {
    return null
  }

  const tokenHash = await sha256(sessionToken)

  // Get session from database with user info
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT s.id, s.user_id, s.expires_at, u.email, ew.address as wallet_address
     FROM auth_sessions s
     JOIN auth_users u ON u.id = s.user_id
     LEFT JOIN embedded_wallets ew ON ew.user_id = s.user_id
     WHERE s.session_token_hash = $1 AND s.expires_at > $2
     LIMIT 1`,
    tokenHash,
    new Date().toISOString(),
  )

  if (!rows || rows.length === 0) {
    return null
  }

  const session = rows[0]

  // Update last active
  await prisma.$executeRawUnsafe(
    `UPDATE auth_sessions SET last_active_at = $1 WHERE id = $2`,
    new Date().toISOString(),
    session.id,
  )

  return {
    userId: session.user_id,
    email: session.email || "",
    walletAddress: session.wallet_address,
    expiresAt: new Date(session.expires_at),
  }
}

/**
 * Destroy current session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(AUTH_CONFIG.session.cookieName)?.value

  if (sessionToken) {
    const tokenHash = await sha256(sessionToken)

    // Delete from database
    await prisma.$executeRawUnsafe(
      `DELETE FROM auth_sessions WHERE session_token_hash = $1`,
      tokenHash,
    )
  }

  // Clear cookie
  cookieStore.delete(AUTH_CONFIG.session.cookieName)
}

/**
 * Refresh session if needed
 */
export async function refreshSessionIfNeeded(): Promise<void> {
  const session = await getSession()

  if (!session) return

  const daysUntilExpiry = (session.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)

  if (daysUntilExpiry < AUTH_CONFIG.session.refreshThresholdDays) {
    // Create new session
    await createSession(session.userId, session.email, session.walletAddress)
  }
}

/**
 * Verify session and return session data or null
 * Use this in API routes to check authentication
 */
export async function verifySession(): Promise<Session | null> {
  try {
    const session = await getSession()

    if (!session) {
      return null
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await destroySession()
      return null
    }

    // Optionally refresh if close to expiry
    await refreshSessionIfNeeded()

    return session
  } catch (error) {
    console.error("[Auth] Session verification failed:", error)
    return null
  }
}

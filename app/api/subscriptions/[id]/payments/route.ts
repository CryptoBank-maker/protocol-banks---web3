/**
 * Subscription Payments History API
 * GET /api/subscriptions/[id]/payments - Get payment history for a subscription
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAddress } from "@/lib/api-auth"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET - Get payment history for a subscription
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: subscriptionId } = await params

    const walletAddress = await getAuthenticatedAddress(request)
    if (!walletAddress) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Verify the subscription belongs to this user
    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId },
    })

    if (!subscription) {
      return NextResponse.json({ success: false, error: "Subscription not found" }, { status: 404 })
    }

    if (subscription.owner_address.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
    }

    // Parse query parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    // Fetch payment history and count in parallel
    const where = { subscription_id: subscriptionId }

    const [payments, total] = await Promise.all([
      prisma.subscriptionPayment.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.subscriptionPayment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      payments,
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit,
      },
    })
  } catch (error) {
    console.error("[SubscriptionPayments] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { budgetService } from '@/lib/services/budget-service'
import { agentX402Service } from '@/lib/services/agent-x402-service'

/**
 * POST /api/cron/budget-reset
 *
 * Cron endpoint to reset expired periodic budgets and expire stale authorizations.
 * Should be called periodically (e.g., every hour) by Vercel Cron or similar.
 *
 * Security: Requires CRON_SECRET header in production.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret in production
  if (process.env.NODE_ENV === 'production') {
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '')

    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    console.log('[BudgetResetCron] Starting budget reset processing...')
    const startTime = Date.now()

    // Reset expired periodic budgets (daily, weekly, monthly)
    const resetCount = await budgetService.resetPeriodBudgets()

    // Expire stale x402 authorizations
    const expiredAuthCount = await agentX402Service.expireStaleAuthorizations()

    const duration = Date.now() - startTime

    console.log(
      `[BudgetResetCron] Completed in ${duration}ms: ${resetCount} budgets reset, ${expiredAuthCount} authorizations expired`
    )

    return NextResponse.json({
      success: true,
      results: {
        budgets_reset: resetCount,
        authorizations_expired: expiredAuthCount,
        duration_ms: duration,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[BudgetResetCron] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

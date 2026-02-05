import { NextRequest, NextResponse } from 'next/server';
import { scheduledPaymentService } from '@/lib/services/scheduled-payment-service';

/**
 * GET /api/cron/execute-scheduled-payments
 * Cron endpoint to execute due scheduled payments
 * Called by Vercel Cron every hour
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    if (process.env.NODE_ENV === 'production') {
      const authHeader = request.headers.get('authorization');
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] Starting scheduled payment execution...');

    // Execute all due payments
    const executionResult = await scheduledPaymentService.executeAllDue();

    // Use the summary directly from the service
    const summary = {
      total: executionResult.payments_processed,
      successful: executionResult.successful,
      failed: executionResult.failed,
      results: executionResult.results.map((r) => ({
        payment_id: r.payment_id,
        success: r.success,
        tx_hash: r.tx_hash,
        error: r.error_message,
      })),
    };

    console.log(`[Cron] Execution complete. ${summary.successful}/${summary.total} successful`);

    return NextResponse.json({
      message: 'Scheduled payment execution complete',
      summary,
      executed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cron] Failed to execute scheduled payments:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute scheduled payments' },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}

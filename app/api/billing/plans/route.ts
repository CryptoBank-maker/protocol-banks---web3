import { NextRequest, NextResponse } from 'next/server';
import { billingService } from '@/lib/services/billing-service';

/**
 * GET /api/billing/plans
 * Get all available subscription plans
 */
export async function GET() {
  try {
    const plans = await billingService.getPlans();
    const comparison = await billingService.getPlanComparison();

    return NextResponse.json({
      plans,
      features: comparison.features,
    });
  } catch (error: any) {
    console.error('[API] Failed to get plans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get plans' },
      { status: 500 }
    );
  }
}

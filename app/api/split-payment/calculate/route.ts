import { NextRequest, NextResponse } from 'next/server';
import { calculateSplitAmounts, validateSplitRecipients } from '@/types/split-payment';

/**
 * POST /api/split-payment/calculate
 * Calculate split amounts based on percentages
 * This is a stateless calculation endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { total_amount, recipients } = body;

    if (!total_amount || total_amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid total amount' },
        { status: 400 }
      );
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json(
        { error: 'At least one recipient is required' },
        { status: 400 }
      );
    }

    // Validate percentages
    const validation = validateSplitRecipients(recipients);
    if (!validation.is_valid) {
      return NextResponse.json(
        { error: validation.errors[0] || 'Invalid recipients' },
        { status: 400 }
      );
    }

    // Calculate amounts
    const calculatedRecipients = calculateSplitAmounts(total_amount, recipients);

    // Calculate summary
    const summary = {
      total_amount,
      recipient_count: calculatedRecipients.length,
      breakdown: calculatedRecipients.map((r) => ({
        address: r.address,
        vendorName: r.vendorName,
        percentage: r.percentage,
        amount: r.calculatedAmount,
      })),
    };

    return NextResponse.json({
      recipients: calculatedRecipients,
      summary,
    });
  } catch (error: any) {
    console.error('[API] Failed to calculate split:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate split' },
      { status: 500 }
    );
  }
}

-- Migration: 028_subscription_session_keys.sql
-- Description: Add session keys for automated payments and subscription enhancements
-- Date: 2024

-- ============================================
-- Session Keys Table
-- For automated/delegated transaction execution
-- ============================================

CREATE TABLE IF NOT EXISTS session_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  session_key_address TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL, -- AES-256-GCM encrypted
  chain_id INTEGER NOT NULL,

  -- Permissions
  allowed_tokens TEXT[] DEFAULT '{}', -- Empty = all tokens allowed
  max_amount_per_tx DECIMAL(36, 18),
  max_daily_amount DECIMAL(36, 18),
  allowed_recipients TEXT[] DEFAULT '{}', -- Empty = all recipients allowed

  -- Validity
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,

  -- Usage tracking
  daily_used_amount DECIMAL(36, 18) DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  total_transactions INTEGER DEFAULT 0,

  -- Constraints
  UNIQUE(owner_address, session_key_address, chain_id)
);

CREATE INDEX idx_session_keys_owner ON session_keys(owner_address);
CREATE INDEX idx_session_keys_active ON session_keys(is_active, expires_at);

-- ============================================
-- Subscription Payments History Table
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount TEXT NOT NULL,
  token TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX idx_subscription_payments_created ON subscription_payments(created_at DESC);

-- ============================================
-- x402 Authorizations Table
-- ============================================

CREATE TABLE IF NOT EXISTS x402_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id TEXT UNIQUE NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  valid_after TIMESTAMPTZ NOT NULL,
  valid_before TIMESTAMPTZ NOT NULL,
  signature TEXT, -- Actual EIP-712 signature when signed
  status TEXT NOT NULL DEFAULT 'pending', -- pending, signed, executed, expired, cancelled
  tx_hash TEXT, -- Transaction hash when executed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);

CREATE INDEX idx_x402_auth_from ON x402_authorizations(from_address);
CREATE INDEX idx_x402_auth_status ON x402_authorizations(status);
CREATE INDEX idx_x402_auth_transfer ON x402_authorizations(transfer_id);

-- ============================================
-- Update Subscriptions Table
-- Add missing columns if they don't exist
-- ============================================

DO $$
BEGIN
  -- Add recipient_address column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'recipient_address'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN recipient_address TEXT;
  END IF;

  -- Add last_tx_hash column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'last_tx_hash'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN last_tx_hash TEXT;
  END IF;

  -- Add chain column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'chain'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN chain TEXT DEFAULT 'ethereum';
  END IF;

  -- Add total_paid column with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'total_paid'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN total_paid TEXT DEFAULT '0';
  END IF;

  -- Add payment_count column with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'payment_count'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN payment_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================
-- Batch Payments Table (for payout bridge)
-- ============================================

CREATE TABLE IF NOT EXISTS batch_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  total_recipients INTEGER NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, partial_failure, failed, cancelled
  use_multisig BOOLEAN DEFAULT false,
  multisig_wallet_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_batch_payments_user ON batch_payments(user_id);
CREATE INDEX idx_batch_payments_status ON batch_payments(status);

-- ============================================
-- Batch Payment Items Table
-- ============================================

CREATE TABLE IF NOT EXISTS batch_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id TEXT NOT NULL REFERENCES batch_payments(id) ON DELETE CASCADE,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  vendor_name TEXT,
  vendor_id TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, confirmed, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_batch_items_batch ON batch_payment_items(batch_id);
CREATE INDEX idx_batch_items_status ON batch_payment_items(status);

-- ============================================
-- Row Level Security
-- ============================================

-- Session Keys RLS
ALTER TABLE session_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session keys"
  ON session_keys FOR SELECT
  USING (owner_address = current_setting('app.current_user_address', true));

CREATE POLICY "Users can create their own session keys"
  ON session_keys FOR INSERT
  WITH CHECK (owner_address = current_setting('app.current_user_address', true));

CREATE POLICY "Users can update their own session keys"
  ON session_keys FOR UPDATE
  USING (owner_address = current_setting('app.current_user_address', true));

CREATE POLICY "Users can delete their own session keys"
  ON session_keys FOR DELETE
  USING (owner_address = current_setting('app.current_user_address', true));

-- Subscription Payments RLS
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their subscription payments"
  ON subscription_payments FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions
      WHERE owner_address = current_setting('app.current_user_address', true)
    )
  );

-- x402 Authorizations RLS
ALTER TABLE x402_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own authorizations"
  ON x402_authorizations FOR SELECT
  USING (from_address = current_setting('app.current_user_address', true));

CREATE POLICY "Users can create their own authorizations"
  ON x402_authorizations FOR INSERT
  WITH CHECK (from_address = current_setting('app.current_user_address', true));

-- Batch Payments RLS
ALTER TABLE batch_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batches"
  ON batch_payments FOR SELECT
  USING (user_id = current_setting('app.current_user_address', true));

CREATE POLICY "Users can create their own batches"
  ON batch_payments FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_address', true));

-- Batch Payment Items RLS
ALTER TABLE batch_payment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their batch items"
  ON batch_payment_items FOR SELECT
  USING (
    batch_id IN (
      SELECT id FROM batch_payments
      WHERE user_id = current_setting('app.current_user_address', true)
    )
  );

-- ============================================
-- Cron Job Helper Function
-- Resets daily session key usage
-- ============================================

CREATE OR REPLACE FUNCTION reset_session_key_daily_usage()
RETURNS void AS $$
BEGIN
  UPDATE session_keys
  SET
    daily_used_amount = 0,
    daily_reset_at = NOW()
  WHERE daily_reset_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Expire Old Authorizations Function
-- ============================================

CREATE OR REPLACE FUNCTION expire_old_x402_authorizations()
RETURNS void AS $$
BEGIN
  UPDATE x402_authorizations
  SET status = 'expired'
  WHERE status = 'pending'
    AND valid_before < NOW();
END;
$$ LANGUAGE plpgsql;

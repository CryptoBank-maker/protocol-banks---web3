-- Create SaaS billing tables for subscription plans and usage-based billing

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- 'free', 'pro', 'enterprise'
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2),
  features JSONB NOT NULL DEFAULT '[]',
  -- features: ["Unlimited recipients", "Scheduled payments", "Team access"]
  limits JSONB NOT NULL DEFAULT '{}',
  -- limits: {max_recipients_per_batch: 5, max_scheduled_payments: 0, max_team_members: 1, max_split_templates: 3}
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL UNIQUE,
  team_id UUID REFERENCES teams(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly', 'yearly'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'cancelled', 'past_due', 'trial'
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  payment_method JSONB,
  -- payment_method: {type: 'crypto', token: 'USDC', chain_id: 42161, wallet_address: '0x...'}
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transaction fees table (for usage-based billing)
CREATE TABLE IF NOT EXISTS transaction_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  payment_id UUID,
  batch_id UUID,
  split_execution_id UUID REFERENCES payment_split_executions(id),
  original_amount DECIMAL(18,6) NOT NULL,
  fee_amount DECIMAL(18,6) NOT NULL,
  fee_percentage DECIMAL(5,4) NOT NULL,  -- e.g., 0.0020 = 0.2%
  fee_token TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'collected', 'waived'
  collected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing history table
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'paid', 'failed', 'refunded'
  payment_method JSONB,
  tx_hash TEXT,
  invoice_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Usage metrics table (for tracking limits)
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  metric_name TEXT NOT NULL,  -- 'batch_payments', 'scheduled_payments', 'team_members', 'split_templates'
  metric_value INTEGER NOT NULL DEFAULT 0,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_address, metric_name, billing_period_start)
);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view active subscription plans
CREATE POLICY "Anyone can view plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

-- Users can manage their own subscription
CREATE POLICY "Users can view their subscription"
  ON user_subscriptions FOR SELECT
  USING (user_address = get_current_user_address());

CREATE POLICY "Users can create subscription"
  ON user_subscriptions FOR INSERT
  WITH CHECK (user_address = get_current_user_address());

CREATE POLICY "Users can update their subscription"
  ON user_subscriptions FOR UPDATE
  USING (user_address = get_current_user_address());

-- Users can view their transaction fees
CREATE POLICY "Users can view their fees"
  ON transaction_fees FOR SELECT
  USING (user_address = get_current_user_address());

-- System can insert fees
CREATE POLICY "System can insert fees"
  ON transaction_fees FOR INSERT
  WITH CHECK (true);

-- Users can view their billing history
CREATE POLICY "Users can view their billing"
  ON billing_history FOR SELECT
  USING (user_address = get_current_user_address());

-- System can manage billing history
CREATE POLICY "System can manage billing"
  ON billing_history FOR ALL
  USING (true);

-- Users can view their usage metrics
CREATE POLICY "Users can view their usage"
  ON usage_metrics FOR SELECT
  USING (user_address = get_current_user_address());

-- System can manage usage metrics
CREATE POLICY "System can manage usage"
  ON usage_metrics FOR ALL
  USING (true);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order)
VALUES
  ('free', 'Free', 'Basic features for individuals', 0, 0,
   '["5 recipients per batch", "Manual payments only", "Basic export (CSV)", "Email support"]'::JSONB,
   '{"max_recipients_per_batch": 5, "max_scheduled_payments": 0, "max_team_members": 1, "max_split_templates": 3, "transaction_fee_bps": 50}'::JSONB,
   1),
  ('pro', 'Pro', 'For growing businesses', 29, 290,
   '["Unlimited recipients", "Up to 20 scheduled payments", "Team access (5 members)", "Split payments", "Excel & PDF export", "Priority support"]'::JSONB,
   '{"max_recipients_per_batch": -1, "max_scheduled_payments": 20, "max_team_members": 5, "max_split_templates": -1, "transaction_fee_bps": 20}'::JSONB,
   2),
  ('enterprise', 'Enterprise', 'For large organizations', 99, 990,
   '["Everything in Pro", "Unlimited team members", "Unlimited scheduled payments", "API access", "Custom integrations", "Dedicated support", "SLA guarantee"]'::JSONB,
   '{"max_recipients_per_batch": -1, "max_scheduled_payments": -1, "max_team_members": -1, "max_split_templates": -1, "transaction_fee_bps": 0}'::JSONB,
   3)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_address);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_period_end ON user_subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_transaction_fees_user ON transaction_fees(user_address);
CREATE INDEX IF NOT EXISTS idx_transaction_fees_status ON transaction_fees(status);
CREATE INDEX IF NOT EXISTS idx_billing_history_user ON billing_history(user_address);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_user ON usage_metrics(user_address);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_period ON usage_metrics(billing_period_start, billing_period_end);

-- Function to check user's plan limits
CREATE OR REPLACE FUNCTION check_plan_limit(
  p_user_address TEXT,
  p_limit_name TEXT,
  p_current_count INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_plan_id UUID;
BEGIN
  -- Get user's current plan
  SELECT plan_id INTO v_plan_id
  FROM user_subscriptions
  WHERE user_address = p_user_address AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Default to free plan if no subscription
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM subscription_plans WHERE name = 'free';
  END IF;

  -- Get the limit value
  SELECT (limits->>p_limit_name)::INTEGER INTO v_limit
  FROM subscription_plans
  WHERE id = v_plan_id;

  -- -1 means unlimited
  IF v_limit = -1 THEN
    RETURN TRUE;
  END IF;

  RETURN p_current_count < v_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user's current plan
CREATE OR REPLACE FUNCTION get_user_plan(p_user_address TEXT)
RETURNS TABLE (
  plan_name TEXT,
  display_name TEXT,
  limits JSONB,
  features JSONB,
  status TEXT,
  period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.name,
    sp.display_name,
    sp.limits,
    sp.features,
    COALESCE(us.status, 'free'),
    us.current_period_end
  FROM subscription_plans sp
  LEFT JOIN user_subscriptions us ON us.plan_id = sp.id AND us.user_address = p_user_address AND us.status = 'active'
  WHERE sp.name = COALESCE(
    (SELECT sp2.name FROM subscription_plans sp2
     JOIN user_subscriptions us2 ON us2.plan_id = sp2.id
     WHERE us2.user_address = p_user_address AND us2.status = 'active'
     ORDER BY us2.created_at DESC LIMIT 1),
    'free'
  );
END;
$$ LANGUAGE plpgsql STABLE;

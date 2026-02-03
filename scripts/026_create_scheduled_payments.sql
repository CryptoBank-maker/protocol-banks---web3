-- Create scheduled payments tables for automated payroll
-- Supports various frequencies: daily, weekly, bi-weekly, monthly

-- Scheduled payments table
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  description TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  -- recipients format: [{address: "0x...", amount: "1000", token: "USDT", vendorName?: "Employee A"}]
  schedule_type TEXT NOT NULL DEFAULT 'monthly',  -- 'daily', 'weekly', 'bi-weekly', 'monthly'
  schedule_config JSONB NOT NULL DEFAULT '{}',
  -- schedule_config examples:
  -- daily: {time: "09:00"}
  -- weekly: {day_of_week: 1, time: "09:00"}  -- 1 = Monday
  -- bi-weekly: {day_of_week: 5, time: "17:00"}  -- Every other Friday
  -- monthly: {day_of_month: 1, time: "09:00"}  -- 1st of month
  timezone TEXT DEFAULT 'UTC',
  next_execution TIMESTAMP WITH TIME ZONE NOT NULL,
  last_execution TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'paused', 'cancelled'
  total_executions INTEGER DEFAULT 0,
  max_executions INTEGER,  -- null = unlimited
  chain_id INTEGER DEFAULT 42161,
  token TEXT DEFAULT 'USDT',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled payment execution logs
CREATE TABLE IF NOT EXISTS scheduled_payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_payment_id UUID NOT NULL REFERENCES scheduled_payments(id) ON DELETE CASCADE,
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL,  -- 'success', 'partial', 'failed'
  tx_hash TEXT,
  total_amount TEXT,
  recipients_count INTEGER,
  successful_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB,  -- Detailed results per recipient
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_payment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_payments

CREATE POLICY "Users can view their scheduled payments"
  ON scheduled_payments FOR SELECT
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND (
      is_team_member(team_id, get_current_user_address())
      OR EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_address = get_current_user_address())
    ))
  );

CREATE POLICY "Users can create scheduled payments"
  ON scheduled_payments FOR INSERT
  WITH CHECK (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

CREATE POLICY "Users can update their scheduled payments"
  ON scheduled_payments FOR UPDATE
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

CREATE POLICY "Users can delete their scheduled payments"
  ON scheduled_payments FOR DELETE
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

-- RLS Policies for scheduled_payment_logs

CREATE POLICY "Users can view their payment logs"
  ON scheduled_payment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_payments sp
      WHERE sp.id = scheduled_payment_logs.scheduled_payment_id
      AND (
        sp.owner_address = get_current_user_address()
        OR (sp.team_id IS NOT NULL AND (
          is_team_member(sp.team_id, get_current_user_address())
          OR EXISTS (SELECT 1 FROM teams WHERE id = sp.team_id AND owner_address = get_current_user_address())
        ))
      )
    )
  );

-- System can insert logs (via cron jobs)
CREATE POLICY "System can insert payment logs"
  ON scheduled_payment_logs FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_owner ON scheduled_payments(owner_address);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_team ON scheduled_payments(team_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_next ON scheduled_payments(next_execution);
CREATE INDEX IF NOT EXISTS idx_scheduled_payment_logs_payment ON scheduled_payment_logs(scheduled_payment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payment_logs_time ON scheduled_payment_logs(execution_time DESC);

-- Function to calculate next execution date
CREATE OR REPLACE FUNCTION calculate_next_execution(
  p_schedule_type TEXT,
  p_schedule_config JSONB,
  p_timezone TEXT DEFAULT 'UTC',
  p_from_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
  v_next TIMESTAMP WITH TIME ZONE;
  v_time TEXT;
  v_day_of_week INTEGER;
  v_day_of_month INTEGER;
BEGIN
  v_time := COALESCE(p_schedule_config->>'time', '09:00');

  CASE p_schedule_type
    WHEN 'daily' THEN
      -- Next day at specified time
      v_next := DATE_TRUNC('day', p_from_date AT TIME ZONE p_timezone) + INTERVAL '1 day' + v_time::TIME;

    WHEN 'weekly' THEN
      v_day_of_week := COALESCE((p_schedule_config->>'day_of_week')::INTEGER, 1);  -- Default Monday
      v_next := DATE_TRUNC('week', p_from_date AT TIME ZONE p_timezone)
                + ((v_day_of_week - 1) || ' days')::INTERVAL
                + INTERVAL '1 week'
                + v_time::TIME;
      IF v_next <= p_from_date THEN
        v_next := v_next + INTERVAL '1 week';
      END IF;

    WHEN 'bi-weekly' THEN
      v_day_of_week := COALESCE((p_schedule_config->>'day_of_week')::INTEGER, 5);  -- Default Friday
      v_next := DATE_TRUNC('week', p_from_date AT TIME ZONE p_timezone)
                + ((v_day_of_week - 1) || ' days')::INTERVAL
                + INTERVAL '2 weeks'
                + v_time::TIME;
      IF v_next <= p_from_date THEN
        v_next := v_next + INTERVAL '2 weeks';
      END IF;

    WHEN 'monthly' THEN
      v_day_of_month := COALESCE((p_schedule_config->>'day_of_month')::INTEGER, 1);
      -- Handle month-end edge cases (e.g., 31st in February)
      v_next := DATE_TRUNC('month', p_from_date AT TIME ZONE p_timezone) + INTERVAL '1 month';
      v_next := v_next + LEAST(v_day_of_month - 1,
                              EXTRACT(DAY FROM (DATE_TRUNC('month', v_next) + INTERVAL '1 month - 1 day'))::INTEGER - 1
                              ) * INTERVAL '1 day';
      v_next := v_next + v_time::TIME;
      IF v_next <= p_from_date THEN
        v_next := DATE_TRUNC('month', v_next) + INTERVAL '1 month';
        v_next := v_next + LEAST(v_day_of_month - 1,
                                EXTRACT(DAY FROM (DATE_TRUNC('month', v_next) + INTERVAL '1 month - 1 day'))::INTEGER - 1
                                ) * INTERVAL '1 day';
        v_next := v_next + v_time::TIME;
      END IF;

    ELSE
      v_next := p_from_date + INTERVAL '1 month';
  END CASE;

  RETURN v_next AT TIME ZONE p_timezone AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

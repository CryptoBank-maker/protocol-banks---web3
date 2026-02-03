-- Create split payment tables for percentage-based payment distribution
-- Users can set custom percentages for each recipient

-- Split payment templates (reusable configurations)
CREATE TABLE IF NOT EXISTS payment_split_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  description TEXT,
  recipients JSONB NOT NULL DEFAULT '[]',
  -- recipients format: [{address: "0x...", percentage: 30, vendorName: "Vendor A", vendorId: "uuid"}]
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Split payment executions (history)
CREATE TABLE IF NOT EXISTS payment_split_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES payment_split_templates(id),
  owner_address TEXT NOT NULL,
  team_id UUID REFERENCES teams(id),
  total_amount TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDT',
  chain_id INTEGER DEFAULT 42161,
  recipients JSONB NOT NULL,
  -- recipients snapshot with calculated amounts:
  -- [{address: "0x...", percentage: 30, calculatedAmount: "300.00", vendorName: "Vendor A"}]
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  tx_hash TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE payment_split_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_split_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_split_templates

CREATE POLICY "Users can view their split templates"
  ON payment_split_templates FOR SELECT
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND (
      is_team_member(team_id, get_current_user_address())
      OR EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_address = get_current_user_address())
    ))
  );

CREATE POLICY "Users can create split templates"
  ON payment_split_templates FOR INSERT
  WITH CHECK (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

CREATE POLICY "Users can update their split templates"
  ON payment_split_templates FOR UPDATE
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

CREATE POLICY "Users can delete their split templates"
  ON payment_split_templates FOR DELETE
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

-- RLS Policies for payment_split_executions

CREATE POLICY "Users can view their split executions"
  ON payment_split_executions FOR SELECT
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND (
      is_team_member(team_id, get_current_user_address())
      OR EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_address = get_current_user_address())
    ))
  );

CREATE POLICY "Users can create split executions"
  ON payment_split_executions FOR INSERT
  WITH CHECK (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

CREATE POLICY "Users can update their split executions"
  ON payment_split_executions FOR UPDATE
  USING (
    owner_address = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_split_templates_owner ON payment_split_templates(owner_address);
CREATE INDEX IF NOT EXISTS idx_split_templates_team ON payment_split_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_split_executions_owner ON payment_split_executions(owner_address);
CREATE INDEX IF NOT EXISTS idx_split_executions_template ON payment_split_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_split_executions_status ON payment_split_executions(status);
CREATE INDEX IF NOT EXISTS idx_split_executions_created ON payment_split_executions(created_at DESC);

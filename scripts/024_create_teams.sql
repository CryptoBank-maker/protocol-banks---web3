-- Create teams table for multi-user collaboration
-- Teams support Owner/Viewer role-based permissions

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_address TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',  -- 'owner' or 'viewer'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'active', 'removed'
  invited_by TEXT NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(team_id, member_address)
);

-- Team audit log for tracking changes
CREATE TABLE IF NOT EXISTS team_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'member_invited', 'member_accepted', 'member_removed', 'role_changed', etc.
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add team_id column to existing tables (nullable for backward compatibility)
DO $$
BEGIN
  -- Add team_id to vendors if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'vendors' AND column_name = 'team_id') THEN
    ALTER TABLE vendors ADD COLUMN team_id UUID REFERENCES teams(id);
  END IF;

  -- Add team_id to payments if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payments' AND column_name = 'team_id') THEN
    ALTER TABLE payments ADD COLUMN team_id UUID REFERENCES teams(id);
  END IF;

  -- Add team_id to batch_payments if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_payments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'batch_payments' AND column_name = 'team_id') THEN
      ALTER TABLE batch_payments ADD COLUMN team_id UUID REFERENCES teams(id);
    END IF;
  END IF;

  -- Add team_id to subscriptions if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscriptions' AND column_name = 'team_id') THEN
    ALTER TABLE subscriptions ADD COLUMN team_id UUID REFERENCES teams(id);
  END IF;

  -- Add team_id to auto_payments if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'auto_payments' AND column_name = 'team_id') THEN
    ALTER TABLE auto_payments ADD COLUMN team_id UUID REFERENCES teams(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a team member
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND member_address = p_user_address
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is a team owner
CREATE OR REPLACE FUNCTION is_team_owner(p_team_id UUID, p_user_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams WHERE id = p_team_id AND owner_address = p_user_address
  ) OR EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id
    AND member_address = p_user_address
    AND role = 'owner'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user address
CREATE OR REPLACE FUNCTION get_current_user_address()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('app.current_user', true)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- RLS Policies for teams table

-- Team owners can manage their teams
CREATE POLICY "Team owners can view their teams"
  ON teams FOR SELECT
  USING (owner_address = get_current_user_address());

-- Team members can view teams they belong to
CREATE POLICY "Team members can view teams"
  ON teams FOR SELECT
  USING (is_team_member(id, get_current_user_address()));

-- Only owners can create teams (with themselves as owner)
CREATE POLICY "Users can create teams"
  ON teams FOR INSERT
  WITH CHECK (owner_address = get_current_user_address());

-- Only team owners can update teams
CREATE POLICY "Team owners can update teams"
  ON teams FOR UPDATE
  USING (owner_address = get_current_user_address());

-- Only team owners can delete teams
CREATE POLICY "Team owners can delete teams"
  ON teams FOR DELETE
  USING (owner_address = get_current_user_address());

-- RLS Policies for team_members table

-- Team members can view other members in their teams
CREATE POLICY "Team members can view members"
  ON team_members FOR SELECT
  USING (
    is_team_member(team_id, get_current_user_address())
    OR EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_address = get_current_user_address())
  );

-- Only team owners can add members
CREATE POLICY "Team owners can add members"
  ON team_members FOR INSERT
  WITH CHECK (is_team_owner(team_id, get_current_user_address()));

-- Users can accept their own invitations
CREATE POLICY "Users can accept invitations"
  ON team_members FOR UPDATE
  USING (member_address = get_current_user_address() AND status = 'pending');

-- Team owners can update/remove members
CREATE POLICY "Team owners can manage members"
  ON team_members FOR UPDATE
  USING (is_team_owner(team_id, get_current_user_address()));

CREATE POLICY "Team owners can remove members"
  ON team_members FOR DELETE
  USING (is_team_owner(team_id, get_current_user_address()));

-- RLS Policies for team_audit_logs

-- Team members can view audit logs
CREATE POLICY "Team members can view audit logs"
  ON team_audit_logs FOR SELECT
  USING (
    is_team_member(team_id, get_current_user_address())
    OR EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_address = get_current_user_address())
  );

-- Only system can insert audit logs (via service functions)
CREATE POLICY "System can insert audit logs"
  ON team_audit_logs FOR INSERT
  WITH CHECK (true);

-- Update vendors RLS to support team access
DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
CREATE POLICY "Users can view vendors"
  ON vendors FOR SELECT
  USING (
    created_by = get_current_user_address()
    OR (team_id IS NOT NULL AND (
      is_team_member(team_id, get_current_user_address())
      OR EXISTS (SELECT 1 FROM teams WHERE id = team_id AND owner_address = get_current_user_address())
    ))
  );

DROP POLICY IF EXISTS "Users can create vendors" ON vendors;
CREATE POLICY "Users can create vendors"
  ON vendors FOR INSERT
  WITH CHECK (
    created_by = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

DROP POLICY IF EXISTS "Users can update their vendors" ON vendors;
CREATE POLICY "Users can update vendors"
  ON vendors FOR UPDATE
  USING (
    created_by = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

DROP POLICY IF EXISTS "Users can delete their vendors" ON vendors;
CREATE POLICY "Users can delete vendors"
  ON vendors FOR DELETE
  USING (
    created_by = get_current_user_address()
    OR (team_id IS NOT NULL AND is_team_owner(team_id, get_current_user_address()))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_address);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_address);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_audit_team ON team_audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_vendors_team ON vendors(team_id);
CREATE INDEX IF NOT EXISTS idx_payments_team ON payments(team_id);

/**
 * Team types for multi-user collaboration
 * Supports Owner/Viewer role-based permissions
 */

export type TeamRole = 'owner' | 'viewer';
export type MemberStatus = 'pending' | 'active' | 'removed';

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  owner_address: string;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
  member_count?: number;
}

export interface TeamMember {
  id: string;
  team_id: string;
  member_address: string;
  role: TeamRole;
  status: MemberStatus;
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
}

export interface TeamInvite {
  team_id: string;
  member_address: string;
  role: TeamRole;
}

export interface TeamAuditLog {
  id: string;
  team_id: string;
  user_address: string;
  action: TeamAuditAction;
  details?: Record<string, unknown>;
  created_at: string;
}

export type TeamAuditAction =
  | 'team_created'
  | 'team_updated'
  | 'team_deleted'
  | 'member_invited'
  | 'member_accepted'
  | 'member_removed'
  | 'role_changed';

// Input types for API
export interface CreateTeamInput {
  name: string;
  description?: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
}

export interface InviteMemberInput {
  member_address: string;
  role: TeamRole;
}

// Response types
export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export interface TeamPermission {
  can_read: boolean;
  can_write: boolean;
  role: TeamRole | null;
}

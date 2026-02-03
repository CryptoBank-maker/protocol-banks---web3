/**
 * Team Service
 * Manages teams and team member permissions (Owner/Viewer)
 */

import { createClient } from '@/lib/supabase-client';
import type {
  Team,
  TeamMember,
  TeamRole,
  MemberStatus,
  CreateTeamInput,
  UpdateTeamInput,
  InviteMemberInput,
  TeamWithMembers,
  TeamPermission,
  TeamAuditLog,
  TeamAuditAction,
} from '@/types';

// ============================================
// Team Service Class
// ============================================

export class TeamService {
  private supabase = createClient();

  // ============================================
  // Alias Methods for API Compatibility
  // ============================================

  /**
   * Alias for listTeamsForUser - used by API routes
   */
  listTeams = (userAddress: string) => this.listTeamsForUser(userAddress);

  /**
   * Alias for getTeamWithMembers - used by API routes
   * Returns just the members array for compatibility
   */
  async getTeamMembers(teamId: string) {
    const teamWithMembers = await this.getTeamWithMembers(teamId);
    return teamWithMembers?.members || [];
  }

  // ============================================
  // Team CRUD Operations
  // ============================================

  /**
   * Create a new team
   */
  async createTeam(
    ownerAddress: string,
    input: CreateTeamInput
  ): Promise<Team> {
    const { data, error } = await this.supabase
      .from('teams')
      .insert({
        name: input.name,
        description: input.description,
        owner_address: ownerAddress,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create team: ${error.message}`);

    // Auto-add owner as a member with 'owner' role
    await this.supabase.from('team_members').insert({
      team_id: data.id,
      member_address: ownerAddress,
      role: 'owner',
      status: 'active',
      invited_by: ownerAddress,
      accepted_at: new Date().toISOString(),
    });

    // Log the action
    await this.logAction(data.id, ownerAddress, 'team_created', { name: input.name });

    return data;
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: string): Promise<Team | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get team: ${error.message}`);
    }

    return data;
  }

  /**
   * Get team with members
   */
  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
    const { data: team, error: teamError } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError) {
      if (teamError.code === 'PGRST116') return null;
      throw new Error(`Failed to get team: ${teamError.message}`);
    }

    const { data: members, error: membersError } = await this.supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .neq('status', 'removed')
      .order('invited_at', { ascending: true });

    if (membersError) throw new Error(`Failed to get members: ${membersError.message}`);

    return {
      ...team,
      members: members || [],
    };
  }

  /**
   * Update team
   */
  async updateTeam(
    teamId: string,
    userAddress: string,
    input: UpdateTeamInput
  ): Promise<Team> {
    // Check permission
    const isOwner = await this.isTeamOwner(teamId, userAddress);
    if (!isOwner) {
      throw new Error('Only team owners can update team settings');
    }

    const { data, error } = await this.supabase
      .from('teams')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update team: ${error.message}`);

    await this.logAction(teamId, userAddress, 'team_updated', input as Record<string, unknown>);

    return data;
  }

  /**
   * Delete team
   */
  async deleteTeam(teamId: string, userAddress: string): Promise<void> {
    // Only the original owner can delete
    const team = await this.getTeam(teamId);
    if (!team || team.owner_address !== userAddress) {
      throw new Error('Only the team owner can delete the team');
    }

    const { error } = await this.supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw new Error(`Failed to delete team: ${error.message}`);
  }

  /**
   * List teams for a user
   */
  async listTeamsForUser(userAddress: string): Promise<Team[]> {
    // Get teams where user is owner
    const { data: ownedTeams, error: ownedError } = await this.supabase
      .from('teams')
      .select('*')
      .eq('owner_address', userAddress);

    if (ownedError) throw new Error(`Failed to list owned teams: ${ownedError.message}`);

    // Get teams where user is a member
    const { data: memberTeams, error: memberError } = await this.supabase
      .from('team_members')
      .select('team_id')
      .eq('member_address', userAddress)
      .eq('status', 'active');

    if (memberError) throw new Error(`Failed to list member teams: ${memberError.message}`);

    const memberTeamIds = memberTeams?.map((m: any) => m.team_id) || [];

    if (memberTeamIds.length === 0) {
      return ownedTeams || [];
    }

    const { data: memberTeamData, error: teamDataError } = await this.supabase
      .from('teams')
      .select('*')
      .in('id', memberTeamIds);

    if (teamDataError) throw new Error(`Failed to get member team data: ${teamDataError.message}`);

    // Merge and deduplicate
    const allTeams = [...(ownedTeams || []), ...(memberTeamData || [])];
    const uniqueTeams = allTeams.filter(
      (team, index, self) => index === self.findIndex((t) => t.id === team.id)
    );

    return uniqueTeams;
  }

  // ============================================
  // Member Management
  // ============================================

  /**
   * Invite a member to the team
   */
  async inviteMember(
    teamId: string,
    inviterAddress: string,
    input: InviteMemberInput
  ): Promise<TeamMember> {
    // Check if inviter is an owner
    const isOwner = await this.isTeamOwner(teamId, inviterAddress);
    if (!isOwner) {
      throw new Error('Only team owners can invite members');
    }

    // Check if member already exists
    const { data: existing } = await this.supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('member_address', input.member_address)
      .single();

    if (existing && existing.status !== 'removed') {
      throw new Error('Member already exists in the team');
    }

    // Create or update member
    const memberData = {
      team_id: teamId,
      member_address: input.member_address,
      role: input.role,
      status: 'pending' as MemberStatus,
      invited_by: inviterAddress,
      invited_at: new Date().toISOString(),
    };

    const { data, error } = existing
      ? await this.supabase
          .from('team_members')
          .update(memberData)
          .eq('id', existing.id)
          .select()
          .single()
      : await this.supabase
          .from('team_members')
          .insert(memberData)
          .select()
          .single();

    if (error) throw new Error(`Failed to invite member: ${error.message}`);

    await this.logAction(teamId, inviterAddress, 'member_invited', {
      member_address: input.member_address,
      role: input.role,
    });

    return data;
  }

  /**
   * Accept team invitation
   */
  async acceptInvitation(teamId: string, memberAddress: string): Promise<TeamMember> {
    const { data, error } = await this.supabase
      .from('team_members')
      .update({
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .eq('member_address', memberAddress)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw new Error(`Failed to accept invitation: ${error.message}`);

    await this.logAction(teamId, memberAddress, 'member_accepted', {});

    return data;
  }

  /**
   * Remove a member from the team
   */
  async removeMember(
    teamId: string,
    removerAddress: string,
    memberAddress: string
  ): Promise<void> {
    // Check if remover is an owner
    const isOwner = await this.isTeamOwner(teamId, removerAddress);
    if (!isOwner) {
      throw new Error('Only team owners can remove members');
    }

    // Cannot remove the original team owner
    const team = await this.getTeam(teamId);
    if (team?.owner_address === memberAddress) {
      throw new Error('Cannot remove the original team owner');
    }

    const { error } = await this.supabase
      .from('team_members')
      .update({ status: 'removed' })
      .eq('team_id', teamId)
      .eq('member_address', memberAddress);

    if (error) throw new Error(`Failed to remove member: ${error.message}`);

    await this.logAction(teamId, removerAddress, 'member_removed', {
      member_address: memberAddress,
    });
  }

  /**
   * Change member role
   */
  async changeRole(
    teamId: string,
    changerAddress: string,
    memberAddress: string,
    newRole: TeamRole
  ): Promise<TeamMember> {
    // Check if changer is an owner
    const isOwner = await this.isTeamOwner(teamId, changerAddress);
    if (!isOwner) {
      throw new Error('Only team owners can change member roles');
    }

    // Cannot change original owner's role
    const team = await this.getTeam(teamId);
    if (team?.owner_address === memberAddress && newRole !== 'owner') {
      throw new Error('Cannot demote the original team owner');
    }

    const { data, error } = await this.supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('team_id', teamId)
      .eq('member_address', memberAddress)
      .select()
      .single();

    if (error) throw new Error(`Failed to change role: ${error.message}`);

    await this.logAction(teamId, changerAddress, 'role_changed', {
      member_address: memberAddress,
      new_role: newRole,
    });

    return data;
  }

  /**
   * Get pending invitations for a user
   */
  async getPendingInvitations(userAddress: string): Promise<(TeamMember & { team: Team })[]> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('*, team:teams(*)')
      .eq('member_address', userAddress)
      .eq('status', 'pending');

    if (error) throw new Error(`Failed to get invitations: ${error.message}`);

    return data || [];
  }

  // ============================================
  // Permission Checks
  // ============================================

  /**
   * Check if user is a team owner
   */
  async isTeamOwner(teamId: string, userAddress: string): Promise<boolean> {
    // Check if user is the original owner
    const team = await this.getTeam(teamId);
    if (team?.owner_address === userAddress) return true;

    // Check if user has owner role
    const { data } = await this.supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('member_address', userAddress)
      .eq('status', 'active')
      .eq('role', 'owner')
      .single();

    return !!data;
  }

  /**
   * Check if user is a team member
   */
  async isTeamMember(teamId: string, userAddress: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('member_address', userAddress)
      .eq('status', 'active')
      .single();

    return !!data;
  }

  /**
   * Get user's permissions for a team
   */
  async getPermissions(teamId: string, userAddress: string): Promise<TeamPermission> {
    const member = await this.supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('member_address', userAddress)
      .eq('status', 'active')
      .single();

    if (!member.data) {
      return { can_read: false, can_write: false, role: null };
    }

    const role = member.data.role as TeamRole;
    return {
      can_read: true,
      can_write: role === 'owner',
      role,
    };
  }

  // ============================================
  // Audit Logging
  // ============================================

  /**
   * Log an action to the audit log
   */
  private async logAction(
    teamId: string,
    userAddress: string,
    action: TeamAuditAction,
    details: Record<string, unknown>
  ): Promise<void> {
    await this.supabase.from('team_audit_logs').insert({
      team_id: teamId,
      user_address: userAddress,
      action,
      details,
    });
  }

  /**
   * Get audit logs for a team
   */
  async getAuditLogs(
    teamId: string,
    limit: number = 50
  ): Promise<TeamAuditLog[]> {
    const { data, error } = await this.supabase
      .from('team_audit_logs')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get audit logs: ${error.message}`);

    return data || [];
  }
}

// Export singleton instance
export const teamService = new TeamService();

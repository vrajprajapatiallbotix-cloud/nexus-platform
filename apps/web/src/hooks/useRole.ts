'use client';

import { useAuthStore } from '@/stores/auth.store';

export type AppRole = 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';

// Map system roles → app roles
const ROLE_MAP: Record<string, AppRole> = {
  SUPER_ADMIN: 'MANAGER',
  ADMIN:       'TEAM_LEAD',
  MANAGER:     'MANAGER',
  MEMBER:      'EMPLOYEE',
  VIEWER:      'EMPLOYEE',
  GUEST:       'EMPLOYEE',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  MANAGER:   'Manager',
  TEAM_LEAD: 'Team Lead',
  EMPLOYEE:  'Employee',
};

export const ROLE_COLORS: Record<AppRole, string> = {
  MANAGER:   'bg-purple-100 text-purple-700 border-purple-200',
  TEAM_LEAD: 'bg-blue-100 text-blue-700 border-blue-200',
  EMPLOYEE:  'bg-green-100 text-green-700 border-green-200',
};

// Hierarchy: MANAGER > TEAM_LEAD > EMPLOYEE
const ROLE_LEVEL: Record<AppRole, number> = {
  MANAGER:   3,
  TEAM_LEAD: 2,
  EMPLOYEE:  1,
};

export function useRole() {
  const { user } = useAuthStore();
  const appRole: AppRole = ROLE_MAP[user?.role ?? 'MEMBER'] ?? 'EMPLOYEE';

  return {
    role: appRole,
    systemRole: user?.role ?? 'MEMBER',
    label: ROLE_LABELS[appRole],
    colorClass: ROLE_COLORS[appRole],
    level: ROLE_LEVEL[appRole],

    // Convenience checks
    isManager:  appRole === 'MANAGER',
    isTeamLead: appRole === 'TEAM_LEAD',
    isEmployee: appRole === 'EMPLOYEE',

    // Capability flags
    canManageAll:     appRole === 'MANAGER',
    canManageTeam:    appRole === 'MANAGER' || appRole === 'TEAM_LEAD',
    canSeeAllTasks:   appRole === 'MANAGER',
    canSeeTeamTasks:  appRole === 'MANAGER' || appRole === 'TEAM_LEAD',
    canAssignTasks:   appRole === 'MANAGER' || appRole === 'TEAM_LEAD',
    canManageProjects: appRole === 'MANAGER',
    canInviteMembers: appRole === 'MANAGER' || appRole === 'TEAM_LEAD',
    canViewAnalytics: appRole === 'MANAGER' || appRole === 'TEAM_LEAD',
    canManageRoles:   appRole === 'MANAGER',
    canViewCRM:       appRole === 'MANAGER' || appRole === 'TEAM_LEAD',
    canViewHR:        appRole === 'MANAGER',
    canViewAutomation: appRole === 'MANAGER',
    canViewBilling:   appRole === 'MANAGER',

    // Compare with another role
    outranks: (other: AppRole) => ROLE_LEVEL[appRole] > ROLE_LEVEL[other],
    atLeast:  (minimum: AppRole) => ROLE_LEVEL[appRole] >= ROLE_LEVEL[minimum],
  };
}

'use client';

import { useRole, type AppRole } from '@/hooks/useRole';

interface RoleGateProps {
  allow: AppRole | AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only when the current user has one of the allowed roles.
 * Optionally renders fallback otherwise.
 */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { role } = useRole();
  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!allowed.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Renders children only when the user's role is at least `minimum` in the hierarchy.
 */
export function MinRoleGate({ minimum, children, fallback = null }: {
  minimum: AppRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { atLeast } = useRole();
  if (!atLeast(minimum)) return <>{fallback}</>;
  return <>{children}</>;
}

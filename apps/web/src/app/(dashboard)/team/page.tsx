'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Plus, Mail, Shield, Loader2, Crown, User, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useRole } from '@/hooks/useRole';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  role: string;
  isOwner: boolean;
  user: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
    status: string;
    role: string;
  };
  joinedAt: string;
}

// System roles → display config
const ROLE_CONFIG: Record<string, { label: string; appLabel: string; color: string; icon?: React.ComponentType<{ className?: string }> }> = {
  SUPER_ADMIN: { label: 'Super Admin', appLabel: 'Manager', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700', icon: Crown },
  ADMIN:       { label: 'Admin', appLabel: 'Team Lead', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700', icon: Shield },
  MANAGER:     { label: 'Manager', appLabel: 'Manager', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700', icon: Crown },
  MEMBER:      { label: 'Member', appLabel: 'Employee', color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700', icon: User },
  VIEWER:      { label: 'Viewer', appLabel: 'Employee', color: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600', icon: User },
  GUEST:       { label: 'Guest', appLabel: 'Employee', color: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600', icon: User },
};

const ASSIGNABLE_ROLES = [
  { value: 'MANAGER', label: 'Manager', description: 'Full access — all features, billing, HR' },
  { value: 'ADMIN', label: 'Team Lead', description: 'Projects, CRM, analytics, team management' },
  { value: 'MEMBER', label: 'Employee', description: 'Own tasks, chat, docs, time tracking' },
];

const STATUS_DOT: Record<string, string> = {
  ONLINE: 'bg-green-500',
  AWAY: 'bg-yellow-500',
  BUSY: 'bg-red-500',
  ACTIVE: 'bg-green-500',
  INACTIVE: 'bg-gray-400',
  OFFLINE: 'bg-gray-400',
};

export default function TeamPage() {
  const { isManager } = useRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

  const loadMembers = () => {
    api.get<{ data: { members: Member[] } }>('/organizations/members')
      .then(r => setMembers(r.data?.data?.members ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadMembers(); }, []);

  const handleRoleChange = async (member: Member, newRole: string) => {
    setChangingRole(member.user.id);
    setRoleDropdown(null);
    try {
      await api.patch(`/organizations/members/${member.user.id}/role`, { role: newRole });
      setMembers(prev => prev.map(m =>
        m.user.id === member.user.id
          ? { ...m, role: newRole, user: { ...m.user, role: newRole } }
          : m,
      ));
    } catch {
      // silently revert — keep old role
    } finally {
      setChangingRole(null);
    }
  };

  const filtered = members.filter(m =>
    m.user.displayName.toLowerCase().includes(search.toLowerCase()) ||
    m.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6" onClick={() => setRoleDropdown(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-muted-foreground text-sm mt-1">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isManager && (
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Role legend for manager */}
      {isManager && (
        <div className="grid grid-cols-3 gap-3">
          {ASSIGNABLE_ROLES.map(r => {
            const cfg = ROLE_CONFIG[r.value];
            return (
              <div key={r.value} className={cn('p-3 rounded-lg border text-sm', cfg.color)}>
                <div className="font-semibold">{r.label}</div>
                <div className="text-xs mt-0.5 opacity-75">{r.description}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">{search ? 'No members found' : 'No team members yet'}</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {search ? 'Try a different search.' : 'Invite your team to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Member</span>
            <span className="hidden sm:block">Role</span>
            <span className="hidden md:block">Joined</span>
            <span>Actions</span>
          </div>

          {/* Rows */}
          {filtered.map((member, i) => {
            const roleCfg = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.MEMBER;
            const RoleIcon = roleCfg.icon ?? User;
            const statusColor = STATUS_DOT[member.user.status] ?? STATUS_DOT.OFFLINE;
            const isChanging = changingRole === member.user.id;
            const showDropdown = roleDropdown === member.user.id;

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 border-b border-border last:border-0 hover:bg-accent/50 transition-colors items-center"
              >
                {/* Member info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.user.avatarUrl ?? ''} />
                      <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                        {member.user.displayName?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card', statusColor)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{member.user.displayName}</p>
                      {member.isOwner && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                </div>

                {/* Role — clickable dropdown for managers */}
                <div className="hidden sm:block relative" onClick={e => e.stopPropagation()}>
                  {isManager && !member.isOwner ? (
                    <>
                      <button
                        disabled={isChanging}
                        onClick={() => setRoleDropdown(showDropdown ? null : member.user.id)}
                        className={cn(
                          'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                          roleCfg.color,
                          isChanging && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        {isChanging ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RoleIcon className="h-3 w-3" />
                        )}
                        {roleCfg.appLabel}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </button>

                      {showDropdown && (
                        <div className="absolute top-full left-0 mt-1 z-50 w-52 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                          {ASSIGNABLE_ROLES.map(opt => {
                            const optCfg = ROLE_CONFIG[opt.value];
                            const isCurrentRole = member.role === opt.value ||
                              (opt.value === 'MANAGER' && (member.role === 'MANAGER' || member.role === 'SUPER_ADMIN'));
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleRoleChange(member, opt.value)}
                                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                              >
                                <div className={cn('mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center shrink-0', optCfg.color)}>
                                  {isCurrentRole && <Check className="h-2.5 w-2.5" />}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">{opt.label}</div>
                                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline" className={cn('text-xs', roleCfg.color)}>
                      <RoleIcon className="h-3 w-3 mr-1" />
                      {member.isOwner ? 'Owner' : roleCfg.appLabel}
                    </Badge>
                  )}
                </div>

                {/* Joined */}
                <span className="text-xs text-muted-foreground hidden md:block whitespace-nowrap">
                  {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>

                {/* Actions */}
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="hidden sm:block">Message</span>
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

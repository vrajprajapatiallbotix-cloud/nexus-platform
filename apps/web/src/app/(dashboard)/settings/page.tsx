'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, User, Bell, Shield, Palette, Globe, Key, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'language', label: 'Language & Region', icon: Globe },
  { id: 'api', label: 'API Keys', icon: Key },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    displayName: user?.displayName ?? '',
  });

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me', profile);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                )}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-card border border-border rounded-xl p-6"
          >
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Profile</h2>
                  <p className="text-sm text-muted-foreground">Update your personal information</p>
                </div>
                <Separator />

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.avatarUrl ?? ''} />
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm">Change photo</Button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF up to 5MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={profile.displayName}
                    onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email ?? ''} disabled />
                  <p className="text-xs text-muted-foreground">Contact support to change your email address.</p>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save changes
                  </Button>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Notifications</h2>
                  <p className="text-sm text-muted-foreground">Configure how you receive notifications</p>
                </div>
                <Separator />
                {[
                  { label: 'Task assignments', desc: 'When a task is assigned to you' },
                  { label: 'Task comments', desc: 'When someone comments on your tasks' },
                  { label: 'Mentions', desc: 'When someone @mentions you' },
                  { label: 'Due date reminders', desc: '24 hours before tasks are due' },
                  { label: 'Project updates', desc: 'Status changes in your projects' },
                  { label: 'Meeting invites', desc: 'When you are invited to a meeting' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-muted peer-focus:ring-2 ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Security</h2>
                  <p className="text-sm text-muted-foreground">Manage your password and account security</p>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Current password</Label>
                    <Input type="password" placeholder="Enter current password" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>New password</Label>
                    <Input type="password" placeholder="Enter new password" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm new password</Label>
                    <Input type="password" placeholder="Confirm new password" />
                  </div>
                  <Button className="gap-2"><Key className="h-4 w-4" /> Update password</Button>
                </div>
                <Separator />
                <div>
                  <h3 className="font-medium mb-1">Two-factor authentication</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {user?.twoFactorEnabled ? 'Two-factor authentication is enabled.' : 'Add an extra layer of security to your account.'}
                  </p>
                  <Button variant="outline" className="gap-2">
                    <Shield className="h-4 w-4" />
                    {user?.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                  </Button>
                </div>
              </div>
            )}

            {(activeSection === 'appearance' || activeSection === 'language' || activeSection === 'api') && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Settings className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="font-semibold">
                  {activeSection === 'appearance' ? 'Appearance' : activeSection === 'language' ? 'Language & Region' : 'API Keys'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">This section is coming soon.</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, fetchMe, logout } = useAuthStore();

  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      // Re-sync cookie in case it expired but Zustand persisted token survives
      document.cookie = `nexus_access_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
      fetchMe().catch(() => logout());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

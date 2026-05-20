import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

function setAuthCookie(token: string) {
  document.cookie = `nexus_access_token=${token}; path=/; max-age=900; SameSite=Lax`;
}

function clearAuthCookie() {
  document.cookie = 'nexus_access_token=; path=/; max-age=0; SameSite=Lax';
}

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
  status: string;
  twoFactorEnabled: boolean;
  onboardingCompleted: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ requiresTwoFactor?: boolean }>;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email, password, twoFactorCode) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{
            data: { accessToken: string; refreshToken: string; requiresTwoFactor?: boolean };
          }>('/auth/login', { email, password, twoFactorCode });

          const { accessToken, refreshToken, requiresTwoFactor } = response.data.data;

          if (requiresTwoFactor) {
            set({ isLoading: false });
            return { requiresTwoFactor: true };
          }

          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          setAuthCookie(accessToken);
          set({ accessToken, refreshToken, isAuthenticated: true });

          await get().fetchMe();
          return {};
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, firstName, lastName) => {
        set({ isLoading: true });
        try {
          const response = await api.post<{
            data: { accessToken: string; refreshToken: string };
          }>('/auth/register', { email, password, firstName, lastName });

          const { accessToken, refreshToken } = response.data.data;
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          setAuthCookie(accessToken);
          set({ accessToken, refreshToken, isAuthenticated: true });

          await get().fetchMe();
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          await api.post('/auth/logout', { refreshToken });
        } catch { /* ignore */ }
        delete api.defaults.headers.common['Authorization'];
        clearAuthCookie();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await api.post<{ data: { accessToken: string; refreshToken: string } }>(
          '/auth/refresh',
          { refreshToken },
        );
        const { accessToken, refreshToken: newRefresh } = response.data.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        setAuthCookie(accessToken);
        set({ accessToken, refreshToken: newRefresh });
      },

      setTokens: (accessToken, refreshToken) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        setAuthCookie(accessToken);
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      fetchMe: async () => {
        const response = await api.get<{ data: AuthUser }>('/auth/me');
        set({ user: response.data.data });
      },
    }),
    {
      name: 'nexus-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

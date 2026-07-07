import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserPublic, KeyPair } from '../types';
import { authApi, configureApi } from '../services/api';
import { cryptoService } from '../services/crypto';

interface AuthStore {
  user: UserPublic | null;
  token: string | null;
  refreshToken: string | null;
  keyPair: KeyPair | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<UserPublic>) => void;
  setToken: (token: string) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      keyPair: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.login(email, password);
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const keyPair = cryptoService.generateKeyPair();
          const data = await authApi.register(username, email, password, keyPair.publicKey);
          set({ user: data.user, token: data.token, refreshToken: data.refreshToken, keyPair, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        set({ user: null, token: null, refreshToken: null, keyPair: null });
      },

      updateUser: (partial) => {
        const { user } = get();
        if (user) set({ user: { ...user, ...partial } });
      },

      setToken: (token) => set({ token }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'blabberbox_auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        keyPair: state.keyPair,
      }),
    }
  )
);

// Wire up API with auth store
configureApi({
  getToken: () => useAuthStore.getState().token,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokenRefreshed: (token) => useAuthStore.getState().setToken(token),
  onLogout: () => useAuthStore.getState().logout(),
});

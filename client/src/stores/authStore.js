import { create } from 'zustand';
import { authApi, builderAuthApi } from '../utils/api';

const useAuthStore = create((set, get) => ({
  user: null,
  capabilities: null,
  loading: true,
  error: null,

  checkAuth: async () => {
    try {
      set({ loading: true, error: null });
      const data = await authApi.me();
      set({ user: data.user });
      try {
        const cap = await builderAuthApi.capabilities();
        set({
          capabilities: {
            isAdmin: !!cap.isAdmin,
            isSuperAdmin: !!cap.isSuperAdmin,
          },
        });
      } catch {
        set({
          capabilities: {
            isAdmin: data.user?.role === 'admin',
            isSuperAdmin: false,
          },
        });
      }
      set({ loading: false });
    } catch {
      set({ user: null, capabilities: null, loading: false });
    }
  },

  /**
   * @returns {{ ok: true, alreadySent?: boolean, notice?: string, expiresAt?: string } | { ok: false }}
   */
  requestCode: async (email) => {
    try {
      set({ error: null });
      const data = await authApi.requestCode(email);
      const notice = data.messageEn || data.message || '';
      return {
        ok: true,
        alreadySent: Boolean(data.alreadySent),
        notice,
        expiresAt: data.expiresAt,
      };
    } catch (err) {
      set({ error: err.message });
      return { ok: false };
    }
  },

  verifyCode: async (email, code) => {
    try {
      set({ error: null });
      const data = await authApi.verifyCode(email, code);
      set({ user: data.user });
      try {
        const cap = await builderAuthApi.capabilities();
        set({
          capabilities: {
            isAdmin: !!cap.isAdmin,
            isSuperAdmin: !!cap.isSuperAdmin,
          },
        });
      } catch {
        set({
          capabilities: {
            isAdmin: data.user?.role === 'admin',
            isSuperAdmin: false,
          },
        });
      }
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    set({ user: null, capabilities: null });
  },

  updateProfile: async (data) => {
    try {
      set({ error: null });
      const result = await authApi.updateProfile(data);
      set({ user: result.user });
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;

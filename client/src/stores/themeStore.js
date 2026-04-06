import { create } from 'zustand';

const STORAGE_KEY = 'rumi-theme';

const getInitialTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'dark';
};

const useThemeStore = create((set, get) => ({
  theme: getInitialTheme(),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    set({ theme: next });
  },

  setTheme: (theme) => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
    set({ theme });
  },
}));

export default useThemeStore;

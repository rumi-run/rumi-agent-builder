import React, { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useThemeStore from '../../stores/themeStore';

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const isCanvas = location.pathname.startsWith('/agent/');

  // Sync theme class to <html> root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen flex flex-col bg-rumi-dark">
      {/* Top header bar */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-rumi-border bg-rumi-shell shrink-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity">
            <span className="text-rumi-accent">RUMI</span>
            <span className="text-gray-500">Agent Builder</span>
          </Link>
          {!isCanvas && (
            <nav className="flex items-center gap-1 ml-4">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'bg-rumi-accent/10 text-rumi-accent'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                My Agents
              </Link>
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    location.pathname === '/admin'
                      ? 'bg-rumi-accent/10 text-rumi-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  Admin
                </Link>
              )}
              {location.pathname.startsWith('/org/') && (
                <span className="text-gray-600 text-xs ml-2">Team workspace</span>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-colors hover:bg-rumi-border/50"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>

          <div className="h-4 w-px bg-rumi-border" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rumi-accent/20 flex items-center justify-center">
              <span className="text-rumi-accent text-xs font-semibold">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <span className="text-gray-400 text-xs hidden sm:block">
              {user?.name || user?.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

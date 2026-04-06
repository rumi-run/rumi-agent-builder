import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/builder/',
  server: {
    proxy: {
      '/api/builder': {
        target: 'http://localhost:3020',
        changeOrigin: true,
      },
      '/api/auth-bridge': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth-bridge/, '') || '/',
      },
      '/api/rumi-auth': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rumi-auth/, '') || '/',
      },
      '/ws/collab': {
        target: 'ws://localhost:3020',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

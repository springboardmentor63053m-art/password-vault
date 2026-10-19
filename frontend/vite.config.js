import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    {
      name: 'root-admin-dashboard-jsx',
      enforce: 'pre',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/src/App.js')) {
          return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        }
      },
    },
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});

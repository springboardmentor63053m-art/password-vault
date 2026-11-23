import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: { rollupOptions: { input: { main: 'index.html', external: 'external.html' } } },
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:8080',
        // Preserve the browser-facing host so Spring recognizes same-origin API requests.
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyRequest, request) => {
            const clientAddress = request.socket?.remoteAddress;
            if (clientAddress) proxyRequest.setHeader('X-Forwarded-For', clientAddress);
          });
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
  },
});

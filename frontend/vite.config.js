import { defineConfig } from 'vite';

// The backend only accepts loopback hosts/origins, so proxy instead of enabling CORS.
const backend = `http://127.0.0.1:${process.env.BACKEND_PORT ?? 4310}`;

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': backend, '/health': backend }
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': backend, '/health': backend } }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the Vite dev server (5173) proxies API + WebSocket traffic to the
// backend (4317). In production the backend serves the built files from client/dist.
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        proxy: {
            '/api': 'http://localhost:4317',
            '/ws': { target: 'ws://localhost:4317', ws: true },
        },
    },
    build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});

// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api is proxied to the PHP server:
//   php -S localhost:8080 api/dev-router.php
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
  },
});

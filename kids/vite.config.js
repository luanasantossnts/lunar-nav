// AI-assisted: written with Claude (Anthropic) and reviewed by Luana Santos. See AI_DISCLOSURE.md.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static site: relative paths (works at the root of kids.lunarnav.space), no inlined data: URIs
// (the strict CSP allows only files from the site itself), no source maps in production.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { assetsInlineLimit: 0, sourcemap: false },
  test: { environment: 'node' },
});

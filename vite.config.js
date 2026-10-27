import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { BASE_PATH } from './server/config.js';

// The app is served by the Express server (server/index.js), which runs Vite inside it during
// development, so there is one address and no proxy.
export default defineConfig({
  // Built for the path it is served under (OPIOS_BASE_PATH, such as /opios).
  base: `${BASE_PATH}/`,
  plugins: [react()],
  // The visual template editor loads MJML (about 430 KB gzipped) when it opens, and no other
  // page does, so that one large chunk is expected.
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { BASE_PATH } from './server/config.js';

// The app is served by the Express server (server/index.js), which runs Vite inside it during
// development, so there is one address and no proxy.
export default defineConfig({
  // Built for the path it is served under (OPIOS_BASE_PATH, such as /opios).
  base: `${BASE_PATH}/`,
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});

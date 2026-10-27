import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is served by the Express server (server/index.js), which runs Vite inside it during
// development, so there is one address and no proxy.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});

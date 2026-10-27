// Starts Opios. In development the pages come from Vite (with live reload); in production
// (npm run build, then npm start) from the built files in dist/.
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createApp } from './app.js';
import { BASE_PATH, DATA_DIR, HOST, PORT, PRODUCTION, ROOT, SETUP_CODE, TRUST_PROXY } from './config.js';

const opios = createApp({ dataDir: DATA_DIR, production: PRODUCTION, basePath: BASE_PATH, setupCode: SETUP_CODE, trustProxy: TRUST_PROXY });
const server = http.createServer(opios.app);

if (PRODUCTION) {
  const dist = path.join(ROOT, 'dist');
  opios.app.use(`${BASE_PATH}/assets`, express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  opios.app.use(BASE_PATH || '/', express.static(dist, { index: false }));
  opios.app.get(BASE_PATH ? [BASE_PATH, `${BASE_PATH}/{*page}`] : '/{*page}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  opios.app.use(vite.middlewares);
}

server.listen(PORT, HOST, () => {
  console.log(`Opios is running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${BASE_PATH}/`);
  console.log(`Data folder: ${DATA_DIR}`);
});

const shutdown = async () => {
  server.close();
  await opios.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

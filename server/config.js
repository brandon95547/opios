import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Settings from a .env file, if there is one (see .env.example).
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

// The database and the key that protects the saved email password. Back this folder up.
export const DATA_DIR = path.resolve(process.env.OPIOS_DATA_DIR || path.join(ROOT, 'data'));

export const PORT = Number(process.env.PORT) || 5340;

// Only this computer can reach the app unless HOST says otherwise (behind a proxy it stays local).
export const HOST = process.env.HOST || '127.0.0.1';

export const PRODUCTION = process.env.NODE_ENV === 'production';

// The path Opios is served under on its domain, such as /opios; empty for the root. The app is
// built for it (vite.config.js), so change it before `npm run build`.
export const BASE_PATH = String(process.env.OPIOS_BASE_PATH || '').trim().replace(/\/+$/, '').replace(/^(?=[^/])/, '/');

// Needed to create the login in the browser on a server (see auth.js). Unused once it exists.
export const SETUP_CODE = process.env.OPIOS_SETUP_CODE || '';

// Which proxies' X-Forwarded-For and X-Forwarded-Proto to believe: this computer, and private
// networks such as Docker's (nginx reaches a container through its bridge).
export const TRUST_PROXY = process.env.OPIOS_TRUST_PROXY || 'loopback, uniquelocal';

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

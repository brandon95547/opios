// Keeps the saved email-account password encrypted in the database. The key comes from
// OPIOS_SECRET, or is made once and kept in the data folder (data/secret.key). Losing the key means
// entering the email password again in Settings; nothing else depends on it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function loadKey(dataDir) {
  if (process.env.OPIOS_SECRET) return crypto.createHash('sha256').update(process.env.OPIOS_SECRET).digest();
  const file = path.join(dataDir, 'secret.key');
  try {
    return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const key = crypto.randomBytes(32);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, `${key.toString('base64')}\n`, { mode: 0o600 });
    return key;
  }
}

export function encrypt(key, text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

// Null when the text was locked with another key.
export function decrypt(key, sealed) {
  if (!sealed?.startsWith('v1:')) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

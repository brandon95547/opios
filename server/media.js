// Pictures for emails: uploaded here, kept in data/media, and served publicly at /media/…,
// because every reader's mail app has to be able to load them. Only PNG, JPEG, GIF and WebP:
// mail apps don't show SVG, and a picture is checked by its first bytes, not its name.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { now } from './db.js';
import { fail, idParam } from './http.js';
import { publicBase } from './settings.js';

const KINDS = [
  { type: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { type: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

export const mediaDirOf = (dataDir) => path.join(dataDir, 'media');

// Public: the files themselves, cached for good (each upload gets a new name).
export function mediaFiles(dataDir) {
  const dir = mediaDirOf(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  return express.static(dir, { immutable: true, maxAge: '1y', index: false, dotfiles: 'deny', fallthrough: false });
}

export function mediaRouter({ db, dataDir, basePath, settings }) {
  const router = express.Router();
  const dir = mediaDirOf(dataDir);

  // The address mail apps load a picture from: the public web address in Settings, or else the
  // one this browser used.
  const urlOf = (req, file) => {
    const base = publicBase(settings.general().publicUrl) || `${req.protocol}://${req.get('host')}${basePath}`;
    return `${base}/media/${file}`;
  };
  const withUrl = (req, row) => ({ ...row, url: urlOf(req, row.file) });

  router.get('/media', (req, res) => {
    res.json(db.prepare('SELECT * FROM media ORDER BY id DESC').all().map((row) => withUrl(req, row)));
  });

  router.post('/media', express.raw({ type: () => true, limit: '8mb' }), (req, res) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length < 12) fail(400, 'Choose a picture to upload.');
    const kind = KINDS.find((k) => k.test(body)) || fail(415, 'Upload a PNG, JPEG, GIF or WebP picture.');
    const file = `${crypto.randomBytes(12).toString('base64url')}.${kind.ext}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), body);
    let name = 'picture';
    try { name = decodeURIComponent(req.get('x-file-name') || 'picture'); } catch { /* keep the default */ }
    name = name.replace(/[\r\n]/g, ' ').slice(0, 200);
    const { lastInsertRowid } = db.prepare('INSERT INTO media (file, name, type, size, created_at) VALUES (?, ?, ?, ?, ?)').run(file, name, kind.type, body.length, now());
    res.status(201).json(withUrl(req, db.prepare('SELECT * FROM media WHERE id = ?').get(Number(lastInsertRowid))));
  });

  // Emails already sent that show the picture lose it, so the page asks first.
  router.delete('/media/:id', (req, res) => {
    const row = db.prepare('SELECT file FROM media WHERE id = ?').get(idParam(req)) || fail(404, 'That picture is already gone.');
    fs.rmSync(path.join(dir, row.file), { force: true });
    db.prepare('DELETE FROM media WHERE file = ?').run(row.file);
    res.json({ ok: true });
  });

  return router;
}

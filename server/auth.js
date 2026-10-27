// Signing in. Opios has one login for now (the users table allows more later). The first visit,
// when no login exists yet, asks for one; after that the setup route is closed.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import { now } from './db.js';
import { fail, text } from './http.js';

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'opios_session';
const SESSION_DAYS = 30;
const DAY = 86_400_000;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(String(password), Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expected);
}

// Checked against when a username does not exist, so a wrong username takes as long as a wrong
// password and the two cannot be told apart.
const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString('hex'));

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

export function checkPassword(password) {
  const p = String(password ?? '');
  if (p.length < 8) fail(400, 'Use a password of at least 8 characters.');
  if (p.length > 200) fail(400, 'That password is too long.');
  return p;
}

function checkUsername(username) {
  const u = text(username, 100);
  if (!u) fail(400, 'Enter a username.');
  if (u.length > 64 || /[\s\p{C}]/u.test(u)) fail(400, 'Use a username of up to 64 letters, numbers or symbols, with no spaces.');
  return u;
}

export function createAuth(db) {
  const findSession = db.prepare(`
    SELECT s.token_hash, s.expires_at, u.id, u.username FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`);
  const failures = new Map();

  function startSession(req, res, userId) {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
    const token = crypto.randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + SESSION_DAYS * DAY);
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), userId, expires.toISOString());
    res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/', expires });
  }

  function currentUser(req) {
    const token = readCookie(req, COOKIE);
    if (!token) return null;
    const row = findSession.get(hashToken(token));
    if (!row || row.expires_at < now()) return null;
    // Keep a session in use alive: past halfway, it runs for another full term.
    if (Date.parse(row.expires_at) - Date.now() < (SESSION_DAYS / 2) * DAY) {
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(new Date(Date.now() + SESSION_DAYS * DAY).toISOString(), row.token_hash);
    }
    return { id: row.id, username: row.username };
  }

  function requireAuth(req, res, next) {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in.' });
    req.user = user;
    next();
  }

  // Ten wrong passwords from one address within 15 minutes, and it waits out the rest of them.
  function tooManyFailures(ip) {
    const f = failures.get(ip);
    if (f && Date.now() - f.since > 15 * 60_000) failures.delete(ip);
    return (failures.get(ip)?.count || 0) >= 10;
  }
  function noteFailure(ip) {
    const f = failures.get(ip) || { count: 0, since: Date.now() };
    f.count += 1;
    failures.set(ip, f);
  }

  const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

  const router = express.Router();

  router.get('/state', (req, res) => {
    const user = currentUser(req);
    res.json({ user, needsSetup: !user && userCount() === 0 });
  });

  router.post('/setup', async (req, res) => {
    if (userCount() > 0) fail(403, 'A login already exists. Sign in instead.');
    const username = checkUsername(req.body?.username);
    const hash = await hashPassword(checkPassword(req.body?.password));
    if (userCount() > 0) fail(403, 'A login already exists. Sign in instead.');
    const { lastInsertRowid } = db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, hash, now());
    startSession(req, res, Number(lastInsertRowid));
    res.status(201).json({ user: { id: Number(lastInsertRowid), username } });
  });

  router.post('/login', async (req, res) => {
    if (tooManyFailures(req.ip)) fail(429, 'Too many wrong passwords. Try again in 15 minutes.');
    const username = text(req.body?.username, 100);
    const password = String(req.body?.password ?? '');
    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
    const ok = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !ok) {
      noteFailure(req.ip);
      fail(401, 'That username and password don’t match.');
    }
    failures.delete(req.ip);
    startSession(req, res, user.id);
    res.json({ user: { id: user.id, username: user.username } });
  });

  router.post('/logout', (req, res) => {
    const token = readCookie(req, COOKIE);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  // Changing the username or password asks for the current password first. A new password signs
  // out every other browser.
  router.put('/account', requireAuth, async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(String(req.body?.currentPassword ?? ''), user.password_hash))) fail(400, 'Your current password isn’t right.');
    const username = checkUsername(req.body?.username ?? user.username);
    if (db.prepare('SELECT 1 FROM users WHERE username = ? AND id <> ?').get(username, user.id)) fail(409, 'That username is taken.');
    if (req.body?.newPassword) {
      const hash = await hashPassword(checkPassword(req.body.newPassword));
      db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      startSession(req, res, user.id);
    } else {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, user.id);
    }
    res.json({ user: { id: user.id, username } });
  });

  return { router, requireAuth };
}

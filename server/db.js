// The database: one SQLite file in the data folder.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { STARTER_TEMPLATES } from './starters.js';

export const now = () => new Date().toISOString();

const SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  token TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  unsubscribed_at TEXT
);
CREATE TABLE lists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL
);
CREATE TABLE contact_lists (
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, list_id)
);
CREATE INDEX contact_lists_by_list ON contact_lists(list_id);
CREATE TABLE templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- A message, from draft to sent. Once sending starts, the template is copied into template_html,
-- so editing the template later does not change what was sent.
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  body_html TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '{"type":"all"}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'paused', 'sent', 'cancelled')),
  template_html TEXT,
  pause_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);
-- Who a message goes to, and how each send went: pending, sending, sent, failed or skipped.
CREATE TABLE campaign_recipients (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TEXT,
  UNIQUE (campaign_id, email)
);
CREATE INDEX campaign_recipients_by_status ON campaign_recipients(campaign_id, status);
`;

// Brands (Phansora, Skylanex…), their products, and the product updates newsletters report.
// A contact is subscribed to each brand separately; contacts.status stays the switch for all of
// them ("unsubscribed from everything"). Templates gain a visual kind, built from blocks (design)
// and compiled to HTML when saved.
const BRANDS = `
CREATE TABLE brands (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  heading TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#2f6fed',
  logo_url TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  from_email TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (brand_id, name)
);
-- What changed in a product: new, improved or fixed. happened_at is the date shown in emails.
CREATE TABLE updates (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'new' CHECK (kind IN ('new', 'improved', 'fixed')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  source TEXT NOT NULL DEFAULT 'manual',
  happened_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX updates_by_product ON updates(product_id, happened_at);
CREATE TABLE subscriptions (
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('subscribed', 'unsubscribed')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (contact_id, brand_id)
);
CREATE INDEX subscriptions_by_brand ON subscriptions(brand_id, status);
ALTER TABLE templates ADD COLUMN kind TEXT NOT NULL DEFAULT 'html';
ALTER TABLE templates ADD COLUMN design TEXT;
ALTER TABLE templates ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE campaigns ADD COLUMN updates_mode TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE campaigns ADD COLUMN update_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN updates_html TEXT;
-- The updates a sent message carried, in order, so later messages don't repeat them.
CREATE TABLE campaign_updates (
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  update_id INTEGER NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, update_id)
);
-- Keys for adding updates from scripts (POST /api/v1/updates). Only a hash is kept.
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
-- Pictures uploaded for emails, kept in data/media and served publicly, as mail apps need.
CREATE TABLE media (
  id INTEGER PRIMARY KEY,
  file TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
`;

// Each entry upgrades the database by one version. Add to the end; never edit one that has shipped.
const MIGRATIONS = [
  (db) => {
    db.exec(SCHEMA);
    const add = db.prepare('INSERT INTO templates (name, html, created_at, updated_at) VALUES (?, ?, ?, ?)');
    const at = now();
    for (const t of STARTER_TEMPLATES) add.run(t.name, t.html, at, at);
  },
  (db) => db.exec(BRANDS),
];

function migrate(db) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = version; v < MIGRATIONS.length; v += 1) {
    db.exec('BEGIN');
    try {
      MIGRATIONS[v](db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'opios.sqlite3'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

// Runs fn inside one transaction: all of it is saved, or none.
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

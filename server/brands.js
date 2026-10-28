// Brands (Phansora, Skylanex…), their products, and product updates: what's new, improved or
// fixed, with the date it happened. Newsletters pull their updates from here. Scripts can add
// updates too, with an API key (POST /api/v1/updates).
import crypto from 'node:crypto';
import express from 'express';
import { isEmail, normalizeEmail } from '../shared/email.js';
import { KINDS } from '../shared/updates.js';
import { now, transaction } from './db.js';
import { fail, idParam, text } from './http.js';

const oneLine = (value, max) => text(value, max).replace(/[\r\n]+/g, ' ');
const webAddress = (value, label) => {
  const s = text(value, 2000);
  if (s && !/^https?:\/\/[^\s]+$/i.test(s)) fail(400, `${label} should be a web address starting with https://.`);
  return s;
};

const BRAND_LIST = `
  SELECT b.*,
    (SELECT COUNT(*) FROM subscriptions s JOIN contacts c ON c.id = s.contact_id
      WHERE s.brand_id = b.id AND s.status = 'subscribed' AND c.status = 'subscribed') AS subscribers,
    (SELECT COUNT(*) FROM updates u JOIN products p ON p.id = u.product_id WHERE p.brand_id = b.id) AS updates
  FROM brands b ORDER BY b.name COLLATE NOCASE`;

export function listBrands(db) {
  const products = db.prepare(`SELECT p.id, p.brand_id, p.name, p.url, p.description, p.version, p.image_url,
    (SELECT COUNT(*) FROM updates u WHERE u.product_id = p.id) AS updates
    FROM products p ORDER BY p.name COLLATE NOCASE`).all();
  return db.prepare(BRAND_LIST).all().map((b) => ({ ...b, products: products.filter((p) => p.brand_id === b.id) }));
}

export const getBrand = (db, id) => (id ? db.prepare('SELECT * FROM brands WHERE id = ?').get(id) || null : null);

const UPDATE_COLUMNS = `u.*, p.name AS product_name, p.url AS product_url, p.brand_id, b.name AS brand_name,
  (SELECT json_group_array(json_object('id', c.id, 'subject', c.subject)) FROM campaign_updates cu JOIN campaigns c ON c.id = cu.campaign_id
    WHERE cu.update_id = u.id AND c.status <> 'draft') AS sent_in`;

const asUpdate = (row) => {
  if (!row) return row;
  const sentIn = JSON.parse(row.sent_in || '[]');
  return { ...row, sent_in: sentIn, sent: sentIn.length > 0 };
};

// Every update of a brand, newest first, each marked `sent` once a newsletter has carried it.
export const updateCandidates = (db, brandId) => db.prepare(`SELECT ${UPDATE_COLUMNS} FROM updates u
  JOIN products p ON p.id = u.product_id JOIN brands b ON b.id = p.brand_id
  WHERE p.brand_id = ? ORDER BY u.happened_at DESC, u.id DESC`).all(brandId).map(asUpdate);

const getUpdate = (db, id) => asUpdate(db.prepare(`SELECT ${UPDATE_COLUMNS} FROM updates u
  JOIN products p ON p.id = u.product_id JOIN brands b ON b.id = p.brand_id WHERE u.id = ?`).get(id));

function cleanBrand(body) {
  const name = oneLine(body?.name, 80);
  if (!name) fail(400, 'Give the brand a name.');
  const color = text(body?.color, 7) || '#2f6fed';
  if (!/^#[0-9a-f]{6}$/i.test(color)) fail(400, 'The brand color is a hex color, such as #2f6fed.');
  const fromEmail = normalizeEmail(body?.from_email);
  if (fromEmail && !isEmail(fromEmail)) fail(400, 'The from address isn’t a valid email address.');
  const replyTo = normalizeEmail(body?.reply_to);
  if (replyTo && !isEmail(replyTo)) fail(400, 'The reply-to address isn’t a valid email address.');
  return {
    name,
    heading: oneLine(body?.heading, 120) || `${name} Updates`,
    color,
    logo_url: webAddress(body?.logo_url, 'The logo'),
    website: webAddress(body?.website, 'The website'),
    from_name: oneLine(body?.from_name, 100),
    from_email: fromEmail,
    reply_to: replyTo,
  };
}

function cleanUpdate(body) {
  const title = oneLine(body?.title, 200);
  if (!title) fail(400, 'Give the update a title.');
  const when = body?.happened_at ? new Date(body.happened_at) : new Date();
  if (Number.isNaN(when.getTime())) fail(400, 'The date isn’t a date.');
  return {
    title,
    body: text(body?.body, 2000),
    link: webAddress(body?.link, 'The link'),
    image_url: webAddress(body?.image_url, 'The picture'),
    kind: body?.kind in KINDS ? body.kind : 'new',
    status: body?.status === 'draft' ? 'draft' : 'published',
    happened_at: when.toISOString(),
  };
}

function insertUpdate(db, productId, u, source) {
  const { lastInsertRowid } = db.prepare(`INSERT INTO updates (product_id, title, body, link, image_url, kind, status, source, happened_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(productId, u.title, u.body, u.link, u.image_url, u.kind, u.status, source, u.happened_at, now(), now());
  return getUpdate(db, Number(lastInsertRowid));
}

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

export function brandsRouter({ db, onBrandChanged = () => {} }) {
  const router = express.Router();

  router.get('/brands', (req, res) => res.json(listBrands(db)));

  // A new brand. Everyone already subscribed can be subscribed to it too.
  router.post('/brands', (req, res) => {
    const b = cleanBrand(req.body);
    if (db.prepare('SELECT 1 FROM brands WHERE name = ?').get(b.name)) fail(409, `There’s already a brand called ${b.name}.`);
    const id = transaction(db, () => {
      const { lastInsertRowid } = db.prepare(`INSERT INTO brands (name, heading, color, logo_url, website, from_name, from_email, reply_to, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(b.name, b.heading, b.color, b.logo_url, b.website, b.from_name, b.from_email, b.reply_to, now(), now());
      const brandId = Number(lastInsertRowid);
      if (req.body?.subscribe_existing) {
        db.prepare(`INSERT OR IGNORE INTO subscriptions (contact_id, brand_id, status, updated_at)
          SELECT id, ?, 'subscribed', ? FROM contacts WHERE status = 'subscribed'`).run(brandId, now());
      }
      return brandId;
    });
    res.status(201).json(listBrands(db).find((x) => x.id === id));
  });

  router.put('/brands/:id', (req, res) => {
    const id = idParam(req);
    const b = cleanBrand(req.body);
    if (db.prepare('SELECT 1 FROM brands WHERE name = ? AND id <> ?').get(b.name, id)) fail(409, `There’s already a brand called ${b.name}.`);
    const { changes } = db.prepare(`UPDATE brands SET name = ?, heading = ?, color = ?, logo_url = ?, website = ?, from_name = ?, from_email = ?, reply_to = ?, updated_at = ?
      WHERE id = ?`).run(b.name, b.heading, b.color, b.logo_url, b.website, b.from_name, b.from_email, b.reply_to, now(), id);
    if (!changes) fail(404, 'That brand no longer exists.');
    onBrandChanged(id);
    res.json(listBrands(db).find((x) => x.id === id));
  });

  // Deleting a brand deletes its products, their updates and its subscriptions. Contacts stay.
  router.delete('/brands/:id', (req, res) => {
    const id = idParam(req);
    if (db.prepare("SELECT 1 FROM campaigns WHERE brand_id = ? AND status IN ('sending', 'paused')").get(id)) fail(409, 'A message of this brand is being sent. Wait until it finishes.');
    db.prepare('DELETE FROM brands WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  const cleanProduct = (body) => {
    const name = oneLine(body?.name, 80);
    if (!name) fail(400, 'Give the product a name.');
    return {
      name,
      url: webAddress(body?.url, 'The product’s web address'),
      description: text(body?.description, 400),
      version: oneLine(body?.version, 30),
      image_url: webAddress(body?.image_url, 'The picture'),
    };
  };

  router.post('/brands/:id/products', (req, res) => {
    const brandId = idParam(req);
    if (!getBrand(db, brandId)) fail(404, 'That brand no longer exists.');
    const p = cleanProduct(req.body);
    if (db.prepare('SELECT 1 FROM products WHERE brand_id = ? AND name = ?').get(brandId, p.name)) fail(409, `This brand already has ${p.name}.`);
    db.prepare('INSERT INTO products (brand_id, name, url, description, version, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(brandId, p.name, p.url, p.description, p.version, p.image_url, now());
    res.status(201).json(listBrands(db).find((x) => x.id === brandId));
  });

  router.put('/products/:id', (req, res) => {
    const id = idParam(req);
    const p = cleanProduct(req.body);
    const product = db.prepare('SELECT brand_id FROM products WHERE id = ?').get(id) || fail(404, 'That product no longer exists.');
    if (db.prepare('SELECT 1 FROM products WHERE brand_id = ? AND name = ? AND id <> ?').get(product.brand_id, p.name, id)) fail(409, `This brand already has ${p.name}.`);
    db.prepare('UPDATE products SET name = ?, url = ?, description = ?, version = ?, image_url = ? WHERE id = ?')
      .run(p.name, p.url, p.description, p.version, p.image_url, id);
    res.json(listBrands(db).find((x) => x.id === product.brand_id));
  });

  router.delete('/products/:id', (req, res) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  router.get('/updates', (req, res) => {
    const brandId = Number(req.query.brand_id) || 0;
    const rows = brandId ? updateCandidates(db, brandId) : db.prepare(`SELECT ${UPDATE_COLUMNS} FROM updates u
      JOIN products p ON p.id = u.product_id JOIN brands b ON b.id = p.brand_id ORDER BY u.happened_at DESC, u.id DESC`).all().map(asUpdate);
    res.json(rows);
  });

  router.post('/updates', (req, res) => {
    const productId = Number(req.body?.product_id);
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) fail(400, 'Choose the product this update is about.');
    res.status(201).json(insertUpdate(db, productId, cleanUpdate(req.body), 'manual'));
  });

  router.put('/updates/:id', (req, res) => {
    const id = idParam(req);
    const productId = Number(req.body?.product_id);
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) fail(400, 'Choose the product this update is about.');
    const u = cleanUpdate(req.body);
    const { changes } = db.prepare(`UPDATE updates SET product_id = ?, title = ?, body = ?, link = ?, image_url = ?, kind = ?, status = ?, happened_at = ?, updated_at = ?
      WHERE id = ?`).run(productId, u.title, u.body, u.link, u.image_url, u.kind, u.status, u.happened_at, now(), id);
    if (!changes) fail(404, 'That update no longer exists.');
    res.json(getUpdate(db, id));
  });

  router.delete('/updates/:id', (req, res) => {
    db.prepare('DELETE FROM updates WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  router.get('/api-keys', (req, res) => res.json(db.prepare('SELECT id, name, prefix, created_at, last_used_at FROM api_keys ORDER BY id DESC').all()));

  // The key itself is shown once, here; only its hash is kept.
  router.post('/api-keys', (req, res) => {
    const name = oneLine(req.body?.name, 80) || 'API key';
    const key = `opk_${crypto.randomBytes(24).toString('base64url')}`;
    const { lastInsertRowid } = db.prepare('INSERT INTO api_keys (name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?)').run(name, hashKey(key), key.slice(0, 8), now());
    res.status(201).json({ id: Number(lastInsertRowid), name, prefix: key.slice(0, 8), key });
  });

  router.delete('/api-keys/:id', (req, res) => {
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  return router;
}

// The API for scripts: Authorization: Bearer <key>. Brands and products are named, so a script
// needs no ids; a product it names that doesn't exist yet is added to the brand.
export function apiRouter({ db }) {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use((req, res, next) => {
    const key = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '')?.[1];
    const row = key && db.prepare('SELECT id FROM api_keys WHERE key_hash = ?').get(hashKey(key));
    if (!row) return res.status(401).json({ error: 'Send a valid API key as Authorization: Bearer <key>.' });
    db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), row.id);
    next();
  });

  const findBrand = (value) => {
    const brand = db.prepare('SELECT * FROM brands WHERE name = ? OR id = ?').get(String(value ?? ''), Number(value) || 0);
    if (!brand) fail(404, `There’s no brand called ${String(value ?? '')}. Add it in Opios first (Settings › Brands).`);
    return brand;
  };

  router.post('/updates', (req, res) => {
    const brand = findBrand(req.body?.brand);
    const productName = oneLine(req.body?.product, 80);
    if (!productName) fail(400, 'Name the product, such as "product": "Talari".');
    const update = cleanUpdate(req.body);
    const created = transaction(db, () => {
      let product = db.prepare('SELECT id FROM products WHERE brand_id = ? AND name = ?').get(brand.id, productName);
      if (!product) product = { id: Number(db.prepare('INSERT INTO products (brand_id, name, url, created_at) VALUES (?, ?, ?, ?)').run(brand.id, productName, '', now()).lastInsertRowid) };
      return insertUpdate(db, product.id, update, 'api');
    });
    res.status(201).json(created);
  });

  router.get('/updates', (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const rows = req.query.brand ? updateCandidates(db, findBrand(req.query.brand).id) : db.prepare(`SELECT ${UPDATE_COLUMNS} FROM updates u
      JOIN products p ON p.id = u.product_id JOIN brands b ON b.id = p.brand_id ORDER BY u.happened_at DESC, u.id DESC`).all().map(asUpdate);
    res.json(rows.filter((u) => u.status === 'published').slice(0, limit));
  });

  router.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  return router;
}

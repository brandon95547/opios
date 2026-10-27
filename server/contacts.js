// Contacts and the lists they belong to: adding one by hand, importing a CSV, exporting, and
// changing many at once. Each contact is subscribed to brands one by one (subscriptions); their
// status is the switch for all of them.
import crypto from 'node:crypto';
import express from 'express';
import { isEmail, normalizeEmail } from '../shared/email.js';
import { toCsv } from '../shared/csv.js';
import { now, transaction } from './db.js';
import { fail, idParam, ids, text } from './http.js';

export const newToken = () => crypto.randomBytes(18).toString('base64url');

const CONTACT_COLUMNS = `c.id, c.email, c.first_name, c.last_name, c.status, c.source, c.created_at, c.updated_at, c.unsubscribed_at,
  (SELECT json_group_array(list_id) FROM contact_lists WHERE contact_id = c.id) AS list_ids,
  (SELECT json_group_object(brand_id, status) FROM subscriptions WHERE contact_id = c.id) AS brands`;

const asContact = (row) => row && { ...row, list_ids: JSON.parse(row.list_ids), brands: JSON.parse(row.brands || '{}') };

// Sets a contact's subscription to some brands: { brandId: 'subscribed' | 'unsubscribed' }.
export function setSubscriptions(db, contactId, subs) {
  const upsert = db.prepare(`INSERT INTO subscriptions (contact_id, brand_id, status, updated_at)
    SELECT ?, id, ?, ? FROM brands WHERE id = ?
    ON CONFLICT (contact_id, brand_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
    WHERE subscriptions.status <> excluded.status`);
  for (const [brandId, status] of Object.entries(subs || {})) {
    if (status === 'subscribed' || status === 'unsubscribed') upsert.run(contactId, status, now(), Number(brandId));
  }
}

export function contactsRouter({ db }) {
  const router = express.Router();

  const getContact = (id) => asContact(db.prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts c WHERE c.id = ?`).get(id));

  const allLists = () => db.prepare(`
    SELECT l.id, l.name, l.created_at, COUNT(c.id) AS count, COALESCE(SUM(c.status = 'subscribed'), 0) AS subscribed
    FROM lists l LEFT JOIN contact_lists cl ON cl.list_id = l.id LEFT JOIN contacts c ON c.id = cl.contact_id
    GROUP BY l.id ORDER BY l.name COLLATE NOCASE`).all();

  const setLists = (contactId, listIds) => {
    db.prepare('DELETE FROM contact_lists WHERE contact_id = ?').run(contactId);
    db.prepare('INSERT OR IGNORE INTO contact_lists (contact_id, list_id) SELECT ?, id FROM lists WHERE id IN (SELECT value FROM json_each(?))')
      .run(contactId, JSON.stringify(listIds));
  };

  const listName = (value) => {
    const name = text(value, 80).replace(/[\r\n]+/g, ' ');
    if (!name) fail(400, 'Give the list a name.');
    return name;
  };

  const createList = (name) => {
    const existing = db.prepare('SELECT id FROM lists WHERE name = ?').get(name);
    if (existing) return existing.id;
    return Number(db.prepare('INSERT INTO lists (name, created_at) VALUES (?, ?)').run(name, now()).lastInsertRowid);
  };

  function cleanContact(body) {
    const email = normalizeEmail(body?.email);
    if (!isEmail(email)) fail(400, 'Enter a valid email address.');
    return {
      email,
      first_name: text(body?.first_name, 100).replace(/[\r\n]+/g, ' '),
      last_name: text(body?.last_name, 100).replace(/[\r\n]+/g, ' '),
    };
  }

  router.get('/contacts', (req, res) => {
    const contacts = db.prepare(`SELECT ${CONTACT_COLUMNS} FROM contacts c ORDER BY c.created_at DESC, c.id DESC`).all().map(asContact);
    const brands = db.prepare('SELECT id, name FROM brands ORDER BY name COLLATE NOCASE').all();
    res.json({ contacts, lists: allLists(), brands });
  });

  router.post('/contacts', (req, res) => {
    const c = cleanContact(req.body);
    if (db.prepare('SELECT 1 FROM contacts WHERE email = ?').get(c.email)) fail(409, `${c.email} is already in your contacts.`);
    const id = transaction(db, () => {
      const { lastInsertRowid } = db.prepare(`INSERT INTO contacts (email, first_name, last_name, token, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'manual', ?, ?)`).run(c.email, c.first_name, c.last_name, newToken(), now(), now());
      setLists(Number(lastInsertRowid), ids(req.body?.list_ids));
      setSubscriptions(db, Number(lastInsertRowid), Object.fromEntries(ids(req.body?.brand_ids).map((b) => [b, 'subscribed'])));
      return Number(lastInsertRowid);
    });
    res.status(201).json(getContact(id));
  });

  router.put('/contacts/:id', (req, res) => {
    const id = idParam(req);
    if (!getContact(id)) fail(404, 'That contact no longer exists.');
    const c = cleanContact(req.body);
    if (db.prepare('SELECT 1 FROM contacts WHERE email = ? AND id <> ?').get(c.email, id)) fail(409, `${c.email} is already another contact.`);
    const status = req.body?.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed';
    transaction(db, () => {
      db.prepare(`UPDATE contacts SET email = ?, first_name = ?, last_name = ?, status = ?, updated_at = ?,
        unsubscribed_at = CASE WHEN ? = 'unsubscribed' THEN COALESCE(unsubscribed_at, ?) ELSE NULL END WHERE id = ?`)
        .run(c.email, c.first_name, c.last_name, status, now(), status, now(), id);
      if (Array.isArray(req.body?.list_ids)) setLists(id, ids(req.body.list_ids));
      if (req.body?.brands && typeof req.body.brands === 'object') setSubscriptions(db, id, req.body.brands);
    });
    res.json(getContact(id));
  });

  router.delete('/contacts/:id', (req, res) => {
    db.prepare('DELETE FROM contacts WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  // Many contacts at once: delete, unsubscribe, resubscribe, or add to or take off a list.
  router.post('/contacts/bulk', (req, res) => {
    const chosen = JSON.stringify(ids(req.body?.ids));
    const listId = Number(req.body?.list_id) || 0;
    const action = req.body?.action;
    const changed = transaction(db, () => {
      switch (action) {
        case 'delete':
          return db.prepare('DELETE FROM contacts WHERE id IN (SELECT value FROM json_each(?))').run(chosen).changes;
        case 'unsubscribe':
          return db.prepare(`UPDATE contacts SET status = 'unsubscribed', unsubscribed_at = ?, updated_at = ?
            WHERE status = 'subscribed' AND id IN (SELECT value FROM json_each(?))`).run(now(), now(), chosen).changes;
        case 'resubscribe':
          return db.prepare(`UPDATE contacts SET status = 'subscribed', unsubscribed_at = NULL, updated_at = ?
            WHERE status = 'unsubscribed' AND id IN (SELECT value FROM json_each(?))`).run(now(), chosen).changes;
        case 'add_to_list':
          if (!db.prepare('SELECT 1 FROM lists WHERE id = ?').get(listId)) fail(404, 'That list no longer exists.');
          return db.prepare('INSERT OR IGNORE INTO contact_lists (contact_id, list_id) SELECT id, ? FROM contacts WHERE id IN (SELECT value FROM json_each(?))')
            .run(listId, chosen).changes;
        case 'remove_from_list':
          return db.prepare('DELETE FROM contact_lists WHERE list_id = ? AND contact_id IN (SELECT value FROM json_each(?))').run(listId, chosen).changes;
        case 'subscribe_brand':
        case 'unsubscribe_brand': {
          const brandId = Number(req.body?.brand_id) || 0;
          if (!db.prepare('SELECT 1 FROM brands WHERE id = ?').get(brandId)) fail(404, 'That brand no longer exists.');
          const status = action === 'subscribe_brand' ? 'subscribed' : 'unsubscribed';
          return db.prepare(`INSERT INTO subscriptions (contact_id, brand_id, status, updated_at)
            SELECT id, ?, ?, ? FROM contacts WHERE id IN (SELECT value FROM json_each(?))
            ON CONFLICT (contact_id, brand_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
            WHERE subscriptions.status <> excluded.status`).run(brandId, status, now(), chosen).changes;
        }
        default:
          return fail(400, 'Unknown action.');
      }
    });
    res.json({ changed: Number(changed) });
  });

  // An import never resubscribes someone who unsubscribed: they keep their choice.
  router.post('/contacts/import', (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : fail(400, 'There are no rows to import.');
    if (rows.length > 100_000) fail(413, 'Import up to 100,000 contacts at a time.');
    const updateNames = Boolean(req.body?.update_existing);
    const result = { added: 0, updated: 0, unchanged: 0, invalid: 0, duplicates: 0, keptUnsubscribed: 0, invalidExamples: [], listId: null };
    const brandIds = ids(req.body?.brand_ids).filter((b) => db.prepare('SELECT 1 FROM brands WHERE id = ?').get(b));
    // A brand someone unsubscribed from stays unsubscribed (INSERT OR IGNORE keeps their row).
    const subscribe = db.prepare("INSERT OR IGNORE INTO subscriptions (contact_id, brand_id, status, updated_at) VALUES (?, ?, 'subscribed', ?)");
    const brandStatus = db.prepare('SELECT status FROM subscriptions WHERE contact_id = ? AND brand_id = ?');
    transaction(db, () => {
      let listId = Number(req.body?.list_id) || null;
      if (req.body?.new_list) listId = createList(listName(req.body.new_list));
      else if (listId && !db.prepare('SELECT 1 FROM lists WHERE id = ?').get(listId)) fail(404, 'That list no longer exists.');
      result.listId = listId;
      const find = db.prepare('SELECT id, first_name, last_name, status FROM contacts WHERE email = ?');
      const insert = db.prepare(`INSERT INTO contacts (email, first_name, last_name, token, source, created_at, updated_at) VALUES (?, ?, ?, ?, 'import', ?, ?)`);
      const rename = db.prepare('UPDATE contacts SET first_name = ?, last_name = ?, updated_at = ? WHERE id = ?');
      const join = db.prepare('INSERT OR IGNORE INTO contact_lists (contact_id, list_id) VALUES (?, ?)');
      const seen = new Set();
      rows.forEach((row, i) => {
        const email = normalizeEmail(row?.email);
        if (!isEmail(email)) {
          result.invalid += 1;
          if (result.invalidExamples.length < 10) result.invalidExamples.push({ row: i + 1, email: String(row?.email ?? '').slice(0, 100) });
          return;
        }
        if (seen.has(email)) { result.duplicates += 1; return; }
        seen.add(email);
        const first = text(row.first_name, 100).replace(/[\r\n]+/g, ' ');
        const last = text(row.last_name, 100).replace(/[\r\n]+/g, ' ');
        const existing = find.get(email);
        let id;
        if (existing) {
          id = existing.id;
          if (existing.status === 'unsubscribed' || brandIds.some((b) => brandStatus.get(id, b)?.status === 'unsubscribed')) result.keptUnsubscribed += 1;
          if (updateNames && (first || last) && (first !== existing.first_name || last !== existing.last_name)) {
            rename.run(first || existing.first_name, last || existing.last_name, now(), id);
            result.updated += 1;
          } else result.unchanged += 1;
        } else {
          id = Number(insert.run(email, first, last, newToken(), now(), now()).lastInsertRowid);
          result.added += 1;
        }
        if (listId) join.run(id, listId);
        for (const b of brandIds) subscribe.run(id, b, now());
      });
    });
    res.json(result);
  });

  router.get('/contacts/export.csv', (req, res) => {
    const listId = Number(req.query.list_id) || 0;
    const status = ['subscribed', 'unsubscribed'].includes(req.query.status) ? req.query.status : '';
    const rows = db.prepare(`
      SELECT c.email, c.first_name, c.last_name, c.status, c.created_at, c.unsubscribed_at,
        (SELECT group_concat(l.name, '; ') FROM contact_lists cl JOIN lists l ON l.id = cl.list_id WHERE cl.contact_id = c.id) AS lists,
        (SELECT group_concat(b.name, '; ') FROM subscriptions s JOIN brands b ON b.id = s.brand_id WHERE s.contact_id = c.id AND s.status = 'subscribed') AS brands
      FROM contacts c
      WHERE (? = 0 OR c.id IN (SELECT contact_id FROM contact_lists WHERE list_id = ?)) AND (? = '' OR c.status = ?)
      ORDER BY c.email`).all(listId, listId, status, status);
    const csv = toCsv([
      ['email', 'first_name', 'last_name', 'status', 'subscribed_to', 'lists', 'added', 'unsubscribed'],
      ...rows.map((r) => [r.email, r.first_name, r.last_name, r.status, r.brands || '', r.lists || '', r.created_at.slice(0, 10), (r.unsubscribed_at || '').slice(0, 10)]),
    ]);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`opios-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(`﻿${csv}`);
  });

  router.post('/lists', (req, res) => {
    const name = listName(req.body?.name);
    if (db.prepare('SELECT 1 FROM lists WHERE name = ?').get(name)) fail(409, `There’s already a list called ${name}.`);
    const id = createList(name);
    res.status(201).json(allLists().find((l) => l.id === id));
  });

  router.put('/lists/:id', (req, res) => {
    const id = idParam(req);
    const name = listName(req.body?.name);
    if (db.prepare('SELECT 1 FROM lists WHERE name = ? AND id <> ?').get(name, id)) fail(409, `There’s already a list called ${name}.`);
    if (!db.prepare('UPDATE lists SET name = ? WHERE id = ?').run(name, id).changes) fail(404, 'That list no longer exists.');
    res.json(allLists().find((l) => l.id === id));
  });

  // Deleting a list keeps its contacts.
  router.delete('/lists/:id', (req, res) => {
    db.prepare('DELETE FROM lists WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  return router;
}

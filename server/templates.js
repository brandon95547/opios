// Newsletter templates: whole emails with a {{content}} spot where each message goes.
import express from 'express';
import { STARTER_TEMPLATES } from './starters.js';
import { now } from './db.js';
import { fail, idParam, text } from './http.js';

export function templatesRouter({ db }) {
  const router = express.Router();

  const all = () => db.prepare(`
    SELECT t.id, t.name, t.html, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM campaigns c WHERE c.template_id = t.id AND c.status = 'draft') AS drafts
    FROM templates t ORDER BY t.updated_at DESC, t.id`).all();
  const one = (id) => all().find((t) => t.id === id);

  function clean(body) {
    const name = text(body?.name, 100).replace(/[\r\n]+/g, ' ');
    if (!name) fail(400, 'Give the template a name.');
    const html = String(body?.html ?? '');
    if (html.length > 500_000) fail(413, 'That template is too large (over 500 KB).');
    if (!/\{\{\s*content\s*\}\}/.test(html)) fail(400, 'A template needs {{content}} where each message goes.');
    return { name, html };
  }

  router.get('/templates', (req, res) => res.json(all()));

  router.get('/templates/starters', (req, res) => res.json(STARTER_TEMPLATES));

  // A new template, from a starter, as a copy of another, or from what was sent.
  router.post('/templates', (req, res) => {
    let source = req.body;
    if (req.body?.starter) {
      const starter = STARTER_TEMPLATES.find((t) => t.key === req.body.starter) || fail(404, 'No such starter.');
      source = { name: req.body.name || starter.name, html: starter.html };
    } else if (req.body?.copy_of) {
      const original = db.prepare('SELECT name, html FROM templates WHERE id = ?').get(Number(req.body.copy_of)) || fail(404, 'That template no longer exists.');
      source = { name: `${original.name} (copy)`, html: original.html };
    }
    const t = clean(source);
    const { lastInsertRowid } = db.prepare('INSERT INTO templates (name, html, created_at, updated_at) VALUES (?, ?, ?, ?)').run(t.name, t.html, now(), now());
    res.status(201).json(one(Number(lastInsertRowid)));
  });

  router.get('/templates/:id', (req, res) => res.json(one(idParam(req)) || fail(404, 'That template no longer exists.')));

  router.put('/templates/:id', (req, res) => {
    const id = idParam(req);
    const t = clean(req.body);
    if (!db.prepare('UPDATE templates SET name = ?, html = ?, updated_at = ? WHERE id = ?').run(t.name, t.html, now(), id).changes) fail(404, 'That template no longer exists.');
    res.json(one(id));
  });

  // Messages already sent keep their own copy of the template, so deleting it changes none of them.
  router.delete('/templates/:id', (req, res) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  return router;
}

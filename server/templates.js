// Newsletter templates: whole emails with a {{content}} spot where each message goes, and
// optionally {{updates}} for product updates. Two kinds: HTML written by hand, and visual ones
// built from blocks (design), compiled to HTML with MJML whenever they're saved.
import express from 'express';
import { STARTER_TEMPLATES } from './starters.js';
import { STARTER_DESIGNS, designProblem, normalizeDesign } from '../shared/design.js';
import { now } from './db.js';
import { fail, idParam, text } from './http.js';
import { getBrand } from './brands.js';
import { compileDesign } from './designs.js';

export function templatesRouter({ db }) {
  const router = express.Router();

  const all = () => db.prepare(`
    SELECT t.id, t.name, t.html, t.kind, t.design, t.brand_id, b.name AS brand_name, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM campaigns c WHERE c.template_id = t.id AND c.status = 'draft') AS drafts
    FROM templates t LEFT JOIN brands b ON b.id = t.brand_id ORDER BY t.updated_at DESC, t.id`).all()
    .map((t) => ({ ...t, design: t.design ? JSON.parse(t.design) : null }));
  const one = (id) => all().find((t) => t.id === id);

  const nameOf = (value) => {
    const name = text(value, 100).replace(/[\r\n]+/g, ' ');
    if (!name) fail(400, 'Give the template a name.');
    return name;
  };
  const brandIdOf = (value) => {
    const id = Number(value) || null;
    if (id && !getBrand(db, id)) fail(404, 'That brand no longer exists.');
    return id;
  };
  function cleanHtml(value) {
    const html = String(value ?? '');
    if (html.length > 500_000) fail(413, 'That template is too large (over 500 KB).');
    if (!/\{\{\s*content\s*\}\}/.test(html)) fail(400, 'A template needs {{content}} where each message goes.');
    return html;
  }
  async function compiled(design, brandId) {
    const clean = normalizeDesign(design);
    const problem = designProblem(clean);
    if (problem) fail(400, problem);
    return { design: clean, html: await compileDesign(clean, getBrand(db, brandId)) };
  }

  const insert = (t) => Number(db.prepare(`INSERT INTO templates (name, html, kind, design, brand_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(t.name, t.html, t.kind, t.design ? JSON.stringify(t.design) : null, t.brand_id, now(), now()).lastInsertRowid);

  router.get('/templates', (req, res) => res.json(all()));

  // The starters, visual ones first, each compiled so the page can show it.
  router.get('/templates/starters', async (req, res) => {
    const visual = await Promise.all(Object.entries(STARTER_DESIGNS).map(async ([key, s]) => ({
      key, name: s.name, kind: 'blocks', html: await compileDesign(s.design, null),
    })));
    res.json([...visual, ...STARTER_TEMPLATES.map((t) => ({ ...t, kind: 'html' }))]);
  });

  // A new template, from a starter or as a copy of another.
  router.post('/templates', async (req, res) => {
    const brandId = brandIdOf(req.body?.brand_id);
    let t;
    if (req.body?.starter && STARTER_DESIGNS[req.body.starter]) {
      const s = STARTER_DESIGNS[req.body.starter];
      const { design, html } = await compiled(s.design, brandId);
      const brand = getBrand(db, brandId);
      const fallback = req.body.starter === 'updates' && brand ? `${brand.name} updates` : s.name;
      t = { name: text(req.body.name, 100) || fallback, kind: 'blocks', design, html, brand_id: brandId };
    } else if (req.body?.starter) {
      const starter = STARTER_TEMPLATES.find((x) => x.key === req.body.starter) || fail(404, 'No such starter.');
      t = { name: nameOf(req.body.name || starter.name), kind: 'html', design: null, html: starter.html, brand_id: brandId };
    } else if (req.body?.copy_of) {
      const original = one(Number(req.body.copy_of)) || fail(404, 'That template no longer exists.');
      t = { name: `${original.name} (copy)`, kind: original.kind, design: original.design, html: original.html, brand_id: original.brand_id };
    } else {
      t = { name: nameOf(req.body?.name), kind: 'html', design: null, html: cleanHtml(req.body?.html), brand_id: brandId };
    }
    res.status(201).json(one(insert(t)));
  });

  router.get('/templates/:id', (req, res) => res.json(one(idParam(req)) || fail(404, 'That template no longer exists.')));

  router.put('/templates/:id', async (req, res) => {
    const id = idParam(req);
    const current = one(id) || fail(404, 'That template no longer exists.');
    const name = nameOf(req.body?.name);
    const brandId = brandIdOf(req.body?.brand_id);
    if (current.kind === 'blocks') {
      const { design, html } = await compiled(req.body?.design, brandId);
      db.prepare('UPDATE templates SET name = ?, brand_id = ?, design = ?, html = ?, updated_at = ? WHERE id = ?').run(name, brandId, JSON.stringify(design), html, now(), id);
    } else {
      db.prepare('UPDATE templates SET name = ?, brand_id = ?, html = ?, updated_at = ? WHERE id = ?').run(name, brandId, cleanHtml(req.body?.html), now(), id);
    }
    res.json(one(id));
  });

  // Messages already sent keep their own copy of the template, so deleting it changes none of them.
  router.delete('/templates/:id', (req, res) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(idParam(req));
    res.json({ ok: true });
  });

  return router;
}

// A brand's color or logo changed: its visual templates are compiled again to show it.
export async function recompileBrandTemplates(db, brandId) {
  const brand = getBrand(db, brandId);
  const rows = db.prepare("SELECT id, design FROM templates WHERE kind = 'blocks' AND brand_id = ?").all(brandId);
  for (const row of rows) {
    const html = await compileDesign(JSON.parse(row.design), brand);
    db.prepare('UPDATE templates SET html = ? WHERE id = ?').run(html, row.id);
  }
}

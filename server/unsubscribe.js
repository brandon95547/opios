// The public unsubscribe pages, the only part of Opios that needs no login. A link in an email
// opens a page with an Unsubscribe button rather than unsubscribing at once, because some mail
// security scanners open every link in an email. Mail apps' own Unsubscribe buttons post here
// directly (one-click unsubscribe, RFC 8058).
import express from 'express';
import { now } from './db.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f5f7; color: #1d2433;
    font: 16px/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 16px; box-sizing: border-box; }
  main { background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(16, 24, 40, .1); padding: 32px; max-width: 440px; width: 100%; box-sizing: border-box; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p { margin: 0 0 16px; color: #475467; }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 8px; padding: 10px 18px; cursor: pointer; background: #2f6fed; color: #fff; }
  button.quiet { background: #eef0f4; color: #1d2433; }
  form { margin: 0; }
</style>
</head>
<body><main>${body}</main></body>
</html>`;

export function unsubscribeRouter({ db, settings }) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false, limit: '10kb' }));

  const find = (token) => (/^[A-Za-z0-9_-]{10,64}$/.test(token)
    ? db.prepare('SELECT id, email, status FROM contacts WHERE token = ?').get(token)
    : null);
  const from = () => settings.general().orgName || settings.smtp().fromName || 'this newsletter';
  // ?b=<brand> on a brand's emails: that brand's subscription is the one changed.
  const brandOf = (req) => (Number(req.query.b) ? db.prepare('SELECT id, name, heading FROM brands WHERE id = ?').get(Number(req.query.b)) || null : null);
  const brandStatus = (contact, brand) => db.prepare('SELECT status FROM subscriptions WHERE contact_id = ? AND brand_id = ?').get(contact.id, brand.id)?.status;
  const setBrand = (contact, brand, status) => db.prepare(`INSERT INTO subscriptions (contact_id, brand_id, status, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (contact_id, brand_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`).run(contact.id, brand.id, status, now());
  const stopAll = (contact) => db.prepare("UPDATE contacts SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, ?), updated_at = ? WHERE id = ?").run(now(), now(), contact.id);
  const allowAll = (contact) => db.prepare("UPDATE contacts SET status = 'subscribed', unsubscribed_at = NULL, updated_at = ? WHERE id = ?").run(now(), contact.id);
  const nameOf = (brand) => brand?.heading || brand?.name || from();
  const here = (token, brand, path = '') => `${esc(token)}${path}${brand ? `?b=${brand.id}` : ''}`;

  const unknown = (res, token) => res.status(token === 'test' ? 200 : 404).send(token === 'test'
    ? page('Unsubscribe link', '<h1>This was a test email</h1><p>In the emails you send, this link opens a page where the reader can unsubscribe.</p>')
    : page('Link not found', '<h1>This link doesn’t work</h1><p>It may be from an old email. To stop getting emails, reply to one and ask to be taken off the list.</p>'));

  const unsubscribedPage = (contact, token, brand, all) => page('Unsubscribed', `
    <h1>You’re unsubscribed</h1>
    <p>${esc(contact.email)} won’t get ${all || !brand ? `emails from ${esc(from())}` : esc(nameOf(brand))} anymore.</p>
    <form method="post" action="${here(token, all ? null : brand, '/resubscribe')}"><button class="quiet" type="submit">I changed my mind, subscribe me again</button></form>`);

  router.get('/:token', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    const brand = brandOf(req);
    const token = req.params.token;
    if (contact.status === 'unsubscribed') return res.send(unsubscribedPage(contact, token, brand, true));
    if (brand && brandStatus(contact, brand) === 'unsubscribed') return res.send(unsubscribedPage(contact, token, brand, false));
    res.send(page('Unsubscribe', `
      <h1>Unsubscribe?</h1>
      <p>Stop sending ${esc(nameOf(brand))} to ${esc(contact.email)}.</p>
      <form method="post" action="${here(token, brand)}"><button type="submit">Unsubscribe</button></form>
      ${brand ? `<form method="post" action="${esc(token)}/all" style="margin-top:12px"><button class="quiet" type="submit">Stop all emails from ${esc(from())}</button></form>` : ''}`));
  });

  // The page's button, and mail apps' one-click Unsubscribe (List-Unsubscribe-Post).
  router.post('/:token', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    const brand = brandOf(req);
    if (brand) setBrand(contact, brand, 'unsubscribed');
    else stopAll(contact);
    if (req.body?.['List-Unsubscribe'] === 'One-Click') return res.type('text').send('Unsubscribed.');
    res.send(unsubscribedPage(contact, req.params.token, brand, !brand));
  });

  router.post('/:token/all', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    stopAll(contact);
    res.send(unsubscribedPage(contact, req.params.token, null, true));
  });

  router.post('/:token/resubscribe', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    const brand = brandOf(req);
    allowAll(contact);
    if (brand) setBrand(contact, brand, 'subscribed');
    res.send(page('Subscribed', `<h1>You’re subscribed again</h1><p>${esc(contact.email)} will get ${brand ? esc(nameOf(brand)) : `emails from ${esc(from())}`}.</p>`));
  });

  return router;
}

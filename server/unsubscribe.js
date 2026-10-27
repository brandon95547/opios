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

  const unknown = (res, token) => res.status(token === 'test' ? 200 : 404).send(token === 'test'
    ? page('Unsubscribe link', '<h1>This was a test email</h1><p>In the emails you send, this link opens a page where the reader can unsubscribe.</p>')
    : page('Link not found', '<h1>This link doesn’t work</h1><p>It may be from an old email. To stop getting emails, reply to one and ask to be taken off the list.</p>'));

  const unsubscribedPage = (contact) => page('Unsubscribed', `
    <h1>You’re unsubscribed</h1>
    <p>${esc(contact.email)} won’t get emails from ${esc(from())} anymore.</p>
    <form method="post" action="${esc(contact.token)}/resubscribe"><button class="quiet" type="submit">I changed my mind, subscribe me again</button></form>`);

  router.get('/:token', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    contact.token = req.params.token;
    if (contact.status === 'unsubscribed') return res.send(unsubscribedPage(contact));
    res.send(page('Unsubscribe', `
      <h1>Unsubscribe?</h1>
      <p>Stop sending emails from ${esc(from())} to ${esc(contact.email)}.</p>
      <form method="post" action="${esc(req.params.token)}"><button type="submit">Unsubscribe</button></form>`));
  });

  router.post('/:token', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    db.prepare("UPDATE contacts SET status = 'unsubscribed', unsubscribed_at = COALESCE(unsubscribed_at, ?), updated_at = ? WHERE id = ?").run(now(), now(), contact.id);
    if (req.body?.['List-Unsubscribe'] === 'One-Click') return res.type('text').send('Unsubscribed.');
    contact.token = req.params.token;
    res.send(unsubscribedPage(contact));
  });

  router.post('/:token/resubscribe', (req, res) => {
    const contact = find(req.params.token);
    if (!contact) return unknown(res, req.params.token);
    db.prepare("UPDATE contacts SET status = 'subscribed', unsubscribed_at = NULL, updated_at = ? WHERE id = ?").run(now(), contact.id);
    res.send(page('Subscribed', `<h1>You’re subscribed again</h1><p>${esc(contact.email)} will get emails from ${esc(from())}.</p>`));
  });

  return router;
}

// Messages ("campaigns" in the database): written as drafts, tested, then sent to the chosen
// contacts by the sender (sender.js).
import express from 'express';
import { isEmail, normalizeEmail } from '../shared/email.js';
import { SAMPLE_CONTACT } from '../shared/render.js';
import { now, transaction } from './db.js';
import { fail, idParam, ids, text } from './http.js';
import { buildMessage, describeError } from './mailer.js';
import { sendNow } from './sender.js';
import { unsubscribeFor } from './settings.js';

const NEW_BODY = '<p>Hi {{first_name|there}},</p><p></p>';

const COUNTS = `COUNT(r.id) AS total,
  COALESCE(SUM(r.status = 'sent'), 0) AS sent,
  COALESCE(SUM(r.status = 'failed'), 0) AS failed,
  COALESCE(SUM(r.status = 'skipped'), 0) AS skipped,
  COALESCE(SUM(r.status IN ('pending', 'sending')), 0) AS waiting`;

// Who a message goes to: everyone subscribed, the subscribed people on some lists, or people
// picked one by one.
export function cleanAudience(a) {
  const type = ['all', 'lists', 'contacts'].includes(a?.type) ? a.type : 'all';
  return { type, listIds: type === 'lists' ? ids(a.listIds) : [], contactIds: type === 'contacts' ? ids(a.contactIds) : [] };
}

export function resolveAudience(db, audience) {
  const a = cleanAudience(audience);
  if (a.type === 'all') return db.prepare("SELECT id, email FROM contacts WHERE status = 'subscribed' ORDER BY id").all();
  if (a.type === 'lists') {
    return db.prepare(`SELECT DISTINCT c.id, c.email FROM contacts c JOIN contact_lists cl ON cl.contact_id = c.id
      WHERE c.status = 'subscribed' AND cl.list_id IN (SELECT value FROM json_each(?)) ORDER BY c.id`).all(JSON.stringify(a.listIds));
  }
  return db.prepare("SELECT id, email FROM contacts WHERE status = 'subscribed' AND id IN (SELECT value FROM json_each(?)) ORDER BY id")
    .all(JSON.stringify(a.contactIds));
}

const hasWords = (html) => /<img\b/i.test(html) || String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '') !== '';

export function campaignsRouter({ db, settings, sender }) {
  const router = express.Router();

  const list = () => db.prepare(`
    SELECT c.id, c.subject, c.status, c.template_id, c.pause_reason, c.created_at, c.updated_at, c.started_at, c.finished_at,
      t.name AS template_name, ${COUNTS}
    FROM campaigns c LEFT JOIN templates t ON t.id = c.template_id LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
    GROUP BY c.id ORDER BY COALESCE(c.started_at, c.updated_at) DESC, c.id DESC`).all();

  function get(id) {
    const c = db.prepare(`SELECT c.*, t.name AS template_name, t.html AS current_template_html, ${COUNTS}
      FROM campaigns c LEFT JOIN templates t ON t.id = c.template_id LEFT JOIN campaign_recipients r ON r.campaign_id = c.id
      WHERE c.id = ? GROUP BY c.id`).get(id);
    if (!c) fail(404, 'That message no longer exists.');
    const { current_template_html: current, ...rest } = c;
    return { ...rest, audience: cleanAudience(JSON.parse(c.audience)), template_html: c.template_html ?? current ?? null };
  }

  const draft = (id) => {
    const c = get(id);
    if (c.status !== 'draft') fail(409, 'This message has been sent, so it can’t be changed. Duplicate it to send it again.');
    return c;
  };

  router.get('/campaigns', (req, res) => res.json(list()));

  router.post('/campaigns', (req, res) => {
    // The template the last message used, or else the first one.
    const template = db.prepare(`SELECT t.id FROM campaigns c JOIN templates t ON t.id = c.template_id ORDER BY c.id DESC LIMIT 1`).get()
      || db.prepare('SELECT id FROM templates ORDER BY id LIMIT 1').get();
    const { lastInsertRowid } = db.prepare(`INSERT INTO campaigns (subject, template_id, body_html, created_at, updated_at)
      VALUES ('', ?, ?, ?, ?)`).run(template?.id ?? null, NEW_BODY, now(), now());
    res.status(201).json(get(Number(lastInsertRowid)));
  });

  router.post('/campaigns/audience', (req, res) => res.json({ count: resolveAudience(db, req.body?.audience).length }));

  // A test email to one address, of the message as it is on screen (saved or not).
  router.post('/campaigns/test', async (req, res) => {
    const to = normalizeEmail(req.body?.to);
    if (!isEmail(to)) fail(400, 'Enter the email address to send the test to.');
    const smtp = settings.smtp();
    if (!settings.smtpReady(smtp)) fail(400, 'Set up the email account in Settings first.');
    const template = db.prepare('SELECT html FROM templates WHERE id = ?').get(Number(req.body?.template_id));
    const general = settings.general();
    const contact = db.prepare('SELECT email, first_name, last_name FROM contacts WHERE email = ?').get(to) || { ...SAMPLE_CONTACT, email: to };
    const message = buildMessage({
      smtp,
      general,
      message: {
        subject: `[Test] ${text(req.body?.subject, 300) || '(no subject)'}`,
        preheader: text(req.body?.preheader, 300),
        bodyHtml: String(req.body?.body_html ?? ''),
        templateHtml: template?.html,
      },
      contact,
      unsubscribe: unsubscribeFor(general, smtp, 'test'),
    });
    try {
      await sendNow(smtp, message);
    } catch (err) {
      fail(502, describeError(err, smtp));
    }
    res.json({ ok: true });
  });

  router.get('/campaigns/:id', (req, res) => {
    const c = get(idParam(req));
    const recipients = c.status === 'draft' ? [] : db.prepare(
      'SELECT id, email, status, error, sent_at FROM campaign_recipients WHERE campaign_id = ? ORDER BY id',
    ).all(c.id);
    res.json({ ...c, recipients });
  });

  router.put('/campaigns/:id', (req, res) => {
    const c = draft(idParam(req));
    const b = req.body || {};
    const templateId = b.template_id == null ? c.template_id : Number(b.template_id) || null;
    if (templateId && !db.prepare('SELECT 1 FROM templates WHERE id = ?').get(templateId)) fail(404, 'That template no longer exists.');
    db.prepare(`UPDATE campaigns SET subject = ?, preheader = ?, template_id = ?, body_html = ?, audience = ?, updated_at = ? WHERE id = ?`).run(
      text(b.subject ?? c.subject, 300).replace(/[\r\n]+/g, ' '),
      text(b.preheader ?? c.preheader, 300).replace(/[\r\n]+/g, ' '),
      templateId,
      String(b.body_html ?? c.body_html).slice(0, 1_000_000),
      JSON.stringify(cleanAudience(b.audience ?? c.audience)),
      now(),
      c.id,
    );
    res.json(get(c.id));
  });

  router.delete('/campaigns/:id', (req, res) => {
    const c = get(idParam(req));
    if (c.status === 'sending') fail(409, 'Stop sending this message before deleting it.');
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(c.id);
    res.json({ ok: true });
  });

  // A new draft with the same subject, message, template and recipients.
  router.post('/campaigns/:id/duplicate', (req, res) => {
    const c = get(idParam(req));
    const templateId = c.template_id && db.prepare('SELECT 1 FROM templates WHERE id = ?').get(c.template_id) ? c.template_id : null;
    const { lastInsertRowid } = db.prepare(`INSERT INTO campaigns (subject, preheader, template_id, body_html, audience, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(c.subject, c.preheader, templateId, c.body_html, JSON.stringify(c.audience), now(), now());
    res.status(201).json(get(Number(lastInsertRowid)));
  });

  router.post('/campaigns/:id/send', (req, res) => {
    const c = draft(idParam(req));
    if (!c.subject.trim()) fail(400, 'Give the message a subject.');
    if (!hasWords(c.body_html)) fail(400, 'The message is empty.');
    const template = c.template_id && db.prepare('SELECT html FROM templates WHERE id = ?').get(c.template_id);
    if (!template) fail(400, 'Choose a template for this message.');
    if (!settings.smtpReady()) fail(400, 'Set up the email account in Settings first.');
    const people = resolveAudience(db, c.audience);
    if (!people.length) fail(400, 'No subscribed contacts match the recipients you chose.');
    transaction(db, () => {
      const add = db.prepare('INSERT OR IGNORE INTO campaign_recipients (campaign_id, contact_id, email) VALUES (?, ?, ?)');
      for (const p of people) add.run(c.id, p.id, p.email);
      db.prepare("UPDATE campaigns SET status = 'sending', template_html = ?, started_at = ?, updated_at = ? WHERE id = ?")
        .run(template.html, now(), now(), c.id);
    });
    sender.kick();
    res.json(get(c.id));
  });

  // Stops a message part way. Who has it, has it; the rest are marked as not sent.
  router.post('/campaigns/:id/cancel', (req, res) => {
    const c = get(idParam(req));
    if (!['sending', 'paused'].includes(c.status)) fail(409, 'This message isn’t being sent.');
    transaction(db, () => {
      db.prepare("UPDATE campaigns SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), c.id);
      db.prepare("UPDATE campaign_recipients SET status = 'skipped', error = 'Sending was stopped.' WHERE campaign_id = ? AND status = 'pending'").run(c.id);
    });
    res.json(get(c.id));
  });

  router.post('/campaigns/:id/resume', (req, res) => {
    const c = get(idParam(req));
    if (c.status !== 'paused') fail(409, 'This message isn’t paused.');
    if (!settings.smtpReady()) fail(400, 'Set up the email account in Settings first.');
    db.prepare("UPDATE campaigns SET status = 'sending', pause_reason = NULL, updated_at = ? WHERE id = ?").run(now(), c.id);
    sender.kick();
    res.json(get(c.id));
  });

  // Sends the ones that failed again, for instance after fixing a typo in an address.
  router.post('/campaigns/:id/retry', (req, res) => {
    const c = get(idParam(req));
    if (!['sent', 'cancelled', 'paused'].includes(c.status)) fail(409, 'Wait until this message has finished sending.');
    if (!settings.smtpReady()) fail(400, 'Set up the email account in Settings first.');
    transaction(db, () => {
      const { changes } = db.prepare("UPDATE campaign_recipients SET status = 'pending', error = NULL WHERE campaign_id = ? AND status = 'failed'").run(c.id);
      if (!changes) fail(400, 'Nothing failed, so there is nothing to send again.');
      db.prepare("UPDATE campaigns SET status = 'sending', pause_reason = NULL, finished_at = NULL, updated_at = ? WHERE id = ?").run(now(), c.id);
    });
    sender.kick();
    res.json(get(c.id));
  });

  return router;
}

// The Settings page's routes, the database download, and the overview on the home page.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { isEmail, normalizeEmail } from '../shared/email.js';
import { fail } from './http.js';
import { describeError } from './mailer.js';
import { sendNow, verifyAccount } from './sender.js';
import { publicBase } from './settings.js';

export function settingsRouter({ settings }) {
  const router = express.Router();

  router.get('/settings', (req, res) => res.json({ smtp: settings.smtpForBrowser(), general: settings.general() }));

  router.put('/settings/smtp', (req, res) => {
    settings.saveSmtp(settings.cleanSmtp(req.body));
    res.json({ smtp: settings.smtpForBrowser() });
  });

  router.put('/settings/general', (req, res) => res.json({ general: settings.saveGeneral(req.body) }));

  // Checks the account as it is in the form, before it is saved.
  router.post('/settings/smtp/verify', async (req, res) => {
    const smtp = settings.cleanSmtp(req.body);
    try {
      await verifyAccount(smtp);
    } catch (err) {
      fail(502, describeError(err, smtp));
    }
    res.json({ ok: true });
  });

  router.post('/settings/smtp/test', async (req, res) => {
    const smtp = settings.cleanSmtp(req.body);
    const to = normalizeEmail(req.body?.to || smtp.fromEmail);
    if (!isEmail(to)) fail(400, 'Enter the email address to send the test to.');
    try {
      await sendNow(smtp, {
        from: { name: smtp.fromName || 'Opios', address: smtp.fromEmail },
        to: { name: '', address: to },
        replyTo: smtp.replyTo || undefined,
        subject: 'Opios is ready to send',
        text: `This test came through ${smtp.host}, from ${smtp.fromEmail}. Your newsletters will be sent the same way.`,
      });
    } catch (err) {
      fail(502, describeError(err, smtp));
    }
    res.json({ ok: true });
  });

  return router;
}

// The whole database as one SQLite file: contacts and lists, templates, messages and their
// reports, and settings. It is a consistent copy taken while Opios runs. Sign-in sessions are
// left out, and the email password stays encrypted (its key, secret.key, isn't in the file), so
// a restored copy asks for that password again in Settings.
export function exportRouter({ db }) {
  const router = express.Router();
  router.get('/export/database', (req, res) => {
    const file = path.join(os.tmpdir(), `opios-export-${crypto.randomUUID()}.sqlite3`);
    try {
      db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      const copy = new DatabaseSync(file);
      copy.exec('DELETE FROM sessions; VACUUM;');
      copy.close();
    } catch (err) {
      fs.rmSync(file, { force: true });
      throw err;
    }
    res.download(file, `opios-database-${new Date().toISOString().slice(0, 10)}.sqlite3`, () => fs.rmSync(file, { force: true }));
  });
  return router;
}

export function overviewRouter({ db, settings }) {
  const router = express.Router();
  router.get('/overview', (req, res) => {
    const contacts = db.prepare(`SELECT COALESCE(SUM(status = 'subscribed'), 0) AS subscribed,
      COALESCE(SUM(status = 'unsubscribed'), 0) AS unsubscribed FROM contacts`).get();
    const campaigns = db.prepare(`SELECT COALESCE(SUM(status = 'draft'), 0) AS drafts,
      COALESCE(SUM(status IN ('sending', 'paused')), 0) AS sending,
      COALESCE(SUM(status IN ('sent', 'cancelled')), 0) AS sent FROM campaigns`).get();
    const emailsSent = db.prepare("SELECT COUNT(*) AS n FROM campaign_recipients WHERE status = 'sent'").get().n;
    const general = settings.general();
    res.json({
      contacts,
      campaigns,
      emailsSent,
      lists: db.prepare('SELECT COUNT(*) AS n FROM lists').get().n,
      templates: db.prepare('SELECT COUNT(*) AS n FROM templates').get().n,
      setup: {
        account: settings.smtpReady(),
        address: Boolean(general.address.trim()),
        publicUrl: Boolean(publicBase(general.publicUrl)),
        contacts: contacts.subscribed + contacts.unsubscribed > 0,
      },
    });
  });
  return router;
}

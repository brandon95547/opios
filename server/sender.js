// Sends messages in the background, one email at a time at the speed set in Settings, so a long
// list never trips the email account's limits. It picks up where it left off after a restart.
import { now } from './db.js';
import { createTransport, buildMessage, isAccountProblem, describeError } from './mailer.js';
import { unsubscribeFor } from './settings.js';

export function createSender({ db, settings, log = console }) {
  const q = {
    nextCampaign: db.prepare("SELECT * FROM campaigns WHERE status = 'sending' ORDER BY started_at, id LIMIT 1"),
    nextRecipient: db.prepare(`
      SELECT r.id, COALESCE(c.email, r.email) AS email, c.first_name, c.last_name, c.status AS contact_status, c.token,
        (SELECT s.status FROM subscriptions s WHERE s.contact_id = c.id AND s.brand_id = ?) AS brand_status
      FROM campaign_recipients r LEFT JOIN contacts c ON c.id = r.contact_id
      WHERE r.campaign_id = ? AND r.status = 'pending' ORDER BY r.id LIMIT 1`),
    brand: db.prepare('SELECT * FROM brands WHERE id = ?'),
    mark: db.prepare('UPDATE campaign_recipients SET status = ?, error = ?, sent_at = ? WHERE id = ?'),
    finish: db.prepare("UPDATE campaigns SET status = 'sent', finished_at = ?, updated_at = ? WHERE id = ? AND status = 'sending'"),
    pause: db.prepare("UPDATE campaigns SET status = 'paused', pause_reason = ?, updated_at = ? WHERE id = ? AND status = 'sending'"),
  };

  // An email that was going out when the app stopped may or may not have arrived. It is marked
  // failed, with that said, rather than sent a second time.
  db.prepare("UPDATE campaign_recipients SET status = 'failed', error = ? WHERE status = 'sending'")
    .run('Opios stopped while this email was being sent, so it may or may not have arrived.');

  let transport = null;
  let transportFor = '';
  let running = null;
  let stopped = false;
  let wake = null;

  // One connection is kept open while a message goes out, and opened again if Settings change.
  function connection(smtp) {
    const key = JSON.stringify([smtp.host, smtp.port, smtp.security, smtp.user, smtp.pass]);
    if (!transport || key !== transportFor) {
      transport?.close();
      transport = createTransport(smtp, { pool: true });
      transportFor = key;
    }
    return transport;
  }
  function disconnect() {
    transport?.close();
    transport = null;
    transportFor = '';
  }

  const pauseFor = (ms) => new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    wake = () => { clearTimeout(timer); resolve(); };
  });

  async function sendNext() {
    const campaign = q.nextCampaign.get();
    if (!campaign) return false;
    const r = q.nextRecipient.get(campaign.brand_id, campaign.id);
    if (!r) {
      q.finish.run(now(), now(), campaign.id);
      return true;
    }
    if (!r.token) {
      q.mark.run('skipped', 'The contact was deleted before this was sent.', null, r.id);
      return true;
    }
    if (r.contact_status !== 'subscribed' || (campaign.brand_id && r.brand_status !== 'subscribed')) {
      q.mark.run('skipped', 'Unsubscribed before this was sent.', null, r.id);
      return true;
    }
    const brand = campaign.brand_id ? q.brand.get(campaign.brand_id) || null : null;
    const smtp = settings.smtp();
    if (!settings.smtpReady(smtp)) {
      q.pause.run('The email account in Settings isn’t set up.', now(), campaign.id);
      return true;
    }
    const general = settings.general();
    q.mark.run('sending', null, null, r.id);
    try {
      await connection(smtp).sendMail(buildMessage({
        smtp,
        general,
        brand,
        message: { subject: campaign.subject, preheader: campaign.preheader, bodyHtml: campaign.body_html, templateHtml: campaign.template_html, updatesHtml: campaign.updates_html },
        contact: { email: r.email, first_name: r.first_name, last_name: r.last_name },
        unsubscribe: unsubscribeFor(general, smtp, r.token, brand),
      }));
      q.mark.run('sent', null, now(), r.id);
    } catch (err) {
      if (isAccountProblem(err)) {
        // Every email after this one would fail the same way: stop, and say why.
        q.mark.run('pending', null, null, r.id);
        q.pause.run(describeError(err, smtp), now(), campaign.id);
        disconnect();
        return true;
      }
      q.mark.run('failed', describeError(err, smtp), null, r.id);
    }
    await pauseFor(60_000 / Math.max(1, general.ratePerMinute));
    return true;
  }

  async function loop() {
    try {
      while (!stopped && await sendNext());
    } catch (err) {
      log.error('Sending stopped:', err);
    } finally {
      disconnect();
      wake = null;
      running = null;
    }
  }

  return {
    // Starts sending if there is anything to send and it isn't already going.
    kick() {
      if (!running && !stopped) running = loop();
      return running;
    },
    // Resolves once nothing is left to send (for tests).
    idle: () => running || Promise.resolve(),
    async stop() {
      stopped = true;
      wake?.();
      await running;
    },
  };
}

// One email straight away, outside the queue: a test send, or the Settings check.
export async function sendNow(smtp, message) {
  const transport = createTransport(smtp);
  try {
    return await transport.sendMail(message);
  } finally {
    transport.close();
  }
}

export async function verifyAccount(smtp) {
  const transport = createTransport(smtp);
  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

// Settings: the email account messages are sent from, and the newsletter's own details. The
// account password is kept encrypted (secrets.js) and never sent back to the browser.
import { PROVIDERS, SECURITY } from '../shared/providers.js';
import { isEmail, normalizeEmail } from '../shared/email.js';
import { encrypt, decrypt } from './secrets.js';
import { fail, text } from './http.js';

const DEFAULT_SMTP = {
  provider: 'gmail', host: PROVIDERS.gmail.host, port: PROVIDERS.gmail.port, security: PROVIDERS.gmail.security,
  user: '', passSealed: '', fromName: '', fromEmail: '', replyTo: '',
};
const DEFAULT_GENERAL = { orgName: '', address: '', publicUrl: '', ratePerMinute: 20 };

const oneLine = (value, max) => text(value, max).replace(/[\r\n]+/g, ' ');

// A web address recipients can reach, or '' for one only this computer can (localhost and the like).
export function publicBase(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return '';
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (/^(localhost|0\.0\.0\.0|::1?|127(\.\d+){3})$/i.test(host) || host.endsWith('.localhost') || host.endsWith('.local')) return '';
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

export function createSettings(db, key) {
  const read = (name, defaults) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(name);
    return { ...defaults, ...(row ? JSON.parse(row.value) : {}) };
  };
  const write = (name, value) => db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(name, JSON.stringify(value));

  // The account as the mailer needs it, password included.
  function smtp() {
    const { passSealed, ...rest } = read('smtp', DEFAULT_SMTP);
    return { ...rest, pass: passSealed ? decrypt(key, passSealed) : '', passUnreadable: Boolean(passSealed) && decrypt(key, passSealed) === null };
  }

  // The account as the Settings page shows it.
  function smtpForBrowser() {
    const { pass, passUnreadable, ...rest } = smtp();
    return { ...rest, hasPassword: Boolean(pass), passUnreadable };
  }

  const general = () => read('general', DEFAULT_GENERAL);

  // Checks what the Settings page sent. An empty password keeps the saved one.
  function cleanSmtp(input) {
    const provider = input?.provider in PROVIDERS ? input.provider : 'other';
    const host = text(input?.host, 253).toLowerCase();
    if (!host || !/^[a-z0-9.-]+$/.test(host)) fail(400, 'Enter the mail server’s address, such as smtp.example.com.');
    const port = Number(input?.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail(400, 'The port is a number from 1 to 65535.');
    const security = input?.security in SECURITY ? input.security : 'starttls';
    const fromEmail = normalizeEmail(input?.fromEmail);
    if (!isEmail(fromEmail)) fail(400, 'Enter the email address messages come from.');
    const replyTo = normalizeEmail(input?.replyTo);
    if (replyTo && !isEmail(replyTo)) fail(400, 'The reply-to address isn’t a valid email address.');
    const saved = smtp();
    const pass = typeof input?.pass === 'string' && input.pass !== '' ? input.pass : saved.pass;
    return {
      provider, host, port, security,
      user: oneLine(input?.user, 254),
      pass,
      fromName: oneLine(input?.fromName, 100),
      fromEmail,
      replyTo,
    };
  }

  function saveSmtp(clean) {
    const { pass, ...rest } = clean;
    write('smtp', { ...rest, passSealed: pass ? encrypt(key, pass) : '' });
  }

  function saveGeneral(input) {
    const publicUrl = text(input?.publicUrl, 300);
    if (publicUrl) {
      let u;
      try { u = new URL(publicUrl); } catch { fail(400, 'The app’s web address should look like https://news.example.com.'); }
      if (!/^https?:$/.test(u.protocol)) fail(400, 'The app’s web address starts with https:// or http://.');
    }
    const rate = Number(input?.ratePerMinute);
    if (!Number.isInteger(rate) || rate < 1 || rate > 600) fail(400, 'Sending speed is a whole number from 1 to 600 emails a minute.');
    const value = {
      orgName: oneLine(input?.orgName, 100),
      address: text(input?.address, 500),
      publicUrl: publicUrl.replace(/\/+$/, ''),
      ratePerMinute: rate,
    };
    write('general', value);
    return value;
  }

  const smtpReady = (s = smtp()) => Boolean(s.host && s.fromEmail && (!s.user || s.pass));

  return { smtp, smtpForBrowser, general, cleanSmtp, saveSmtp, saveGeneral, smtpReady };
}

// Where a contact's unsubscribe link points, and the List-Unsubscribe headers that put an
// Unsubscribe button in Gmail, Apple Mail and others. Until the app is at a public web address,
// the link opens an email to the sender instead, and the unsubscribe is done by hand.
export function unsubscribeFor(general, smtp, token) {
  const base = publicBase(general.publicUrl);
  const to = smtp.replyTo || smtp.fromEmail;
  const mailto = `mailto:${to}?subject=${encodeURIComponent('Unsubscribe')}&body=${encodeURIComponent('Please take me off this list.')}`;
  if (!base) return { url: mailto, headers: { 'List-Unsubscribe': `<${mailto}>` } };
  const url = `${base}/u/${token}`;
  const headers = { 'List-Unsubscribe': `<${url}>, <${mailto}>` };
  if (base.startsWith('https://')) headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  return { url, headers };
}

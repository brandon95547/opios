// Building and sending one email through the account in Settings.
import nodemailer from 'nodemailer';
import juice from 'juice';
import { renderEmail, renderSubject, htmlToText } from '../shared/render.js';

export function createTransport(smtp, { pool = false } = {}) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.security === 'ssl',
    requireTLS: smtp.security === 'starttls',
    ignoreTLS: smtp.security === 'none',
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    pool,
    maxConnections: 1,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

// One email for one contact. The style sheet is copied onto each tag (juice), because several
// mail apps, Outlook among them, ignore style sheets. A brand can send under its own name and
// address (the account has to be allowed to send as it: a Gmail "Send mail as" alias, say).
export function buildMessage({ smtp, general, brand = null, message, contact, unsubscribe }) {
  const html = juice(renderEmail({
    templateHtml: message.templateHtml,
    bodyHtml: message.bodyHtml,
    updatesHtml: message.updatesHtml,
    subject: message.subject,
    preheader: message.preheader,
    contact,
    general,
    brand,
    unsubscribeUrl: unsubscribe.url,
  }), { preserveImportant: true });
  return {
    from: { name: brand?.from_name || brand?.name || smtp.fromName || general.orgName || '', address: brand?.from_email || smtp.fromEmail },
    to: { name: '', address: contact.email },
    replyTo: brand?.reply_to || smtp.replyTo || undefined,
    subject: renderSubject(message.subject, contact, general, brand).replace(/[\r\n]+/g, ' '),
    html,
    text: htmlToText(html),
    headers: unsubscribe.headers,
  };
}

// A failure that will happen to every email (the password is wrong, the server can't be reached,
// the account's daily limit is used up), so sending stops instead of failing each one in turn.
export function isAccountProblem(err) {
  if (['EAUTH', 'ENOAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'ECONNREFUSED', 'EPROTOCOL'].includes(err?.code)) return true;
  if ([421, 454].includes(err?.responseCode)) return true;
  return /5\.4\.5|quota|limit exceeded|rate limit|too many (messages|emails|connections|login)/i.test(err?.response || '');
}

// What went wrong, in words someone can act on.
export function describeError(err, smtp = {}) {
  const where = smtp.host ? `${smtp.host}:${smtp.port}` : 'the mail server';
  if (err?.code === 'EAUTH' || err?.code === 'ENOAUTH') {
    return smtp.provider === 'gmail'
      ? 'Gmail turned down the email address and password. Use an App Password, not your Google password.'
      : 'The mail server turned down the username and password.';
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED'].includes(err?.code)) {
    return `Couldn’t connect to ${where}. Check the server, the port and the security setting.`;
  }
  if (err?.code === 'ETLS') return `The secure connection to ${where} failed. Try the other security setting for this port.`;
  if (/5\.4\.5|quota|limit exceeded/i.test(err?.response || '')) {
    return 'The email account has reached its sending limit. Wait a few hours, or until tomorrow, then resume.';
  }
  return String(err?.response || err?.message || err).slice(0, 500);
}

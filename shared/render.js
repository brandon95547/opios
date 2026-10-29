// Turning a template and a message into the email one contact receives. The browser uses this for
// previews and the server for sending, so what is previewed is what is sent.
import { INNER } from './layout.js';

export const MERGE_TAGS = [
  { tag: 'first_name', label: 'First name' },
  { tag: 'last_name', label: 'Last name' },
  { tag: 'full_name', label: 'Full name' },
  { tag: 'email', label: 'Email address' },
  { tag: 'org_name', label: 'Newsletter name' },
  { tag: 'brand_heading', label: 'Brand heading' },
  { tag: 'brand_name', label: 'Brand name' },
  { tag: 'brand_url', label: 'Brand website' },
  { tag: 'address', label: 'Mailing address' },
  { tag: 'unsubscribe_url', label: 'Unsubscribe link' },
  { tag: 'subject', label: 'Subject' },
  { tag: 'date', label: 'Today’s date' },
  { tag: 'year', label: 'Year' },
];

export const TEMPLATE_TAGS = [{ tag: 'content', label: 'Message' }, { tag: 'updates', label: 'Product updates' }, { tag: 'products', label: 'Products' }, { tag: 'preheader', label: 'Preview text' }, ...MERGE_TAGS];

export const SAMPLE_CONTACT = { first_name: 'Alex', last_name: 'Rivera', email: 'alex@example.com' };

export const SAMPLE_BODY = '<h2>This month at a glance</h2><p>Hi {{first_name|there}},</p><p>This is where your message goes. Each newsletter you write is set into this template, in place of <strong>{{content}}</strong>.</p><ul><li>Headings, lists and links</li><li>Pictures by web address</li><li>Personal touches, such as the reader’s first name</li></ul><blockquote>A quote stands out like this.</blockquote><p>Thanks for reading,<br>The team</p>';

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const TAG = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;
const hasTag = (html, name) => new RegExp(`\\{\\{\\s*${name}\\s*(\\|[^}]*)?\\}\\}`).test(html);

// Replaces {{tag}} and {{tag|fallback}} with values. Tags it has no value for are left as they are.
// In HTML the values are escaped, and line breaks (a mailing address) become <br>.
export function fillTags(text, values, { html = true } = {}) {
  return String(text ?? '').replace(TAG, (whole, name, fallback) => {
    if (!(name in values)) return whole;
    const value = String(values[name] ?? '').trim() || (fallback ?? '').trim();
    return html ? escapeHtml(value).replace(/\r?\n/g, '<br>') : value;
  });
}

export const DEFAULT_LAYOUT = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#222">{{content}}</body></html>';

const insertAfterBodyStart = (html, piece) => (/<body[^>]*>/i.test(html)
  ? html.replace(/<body[^>]*>/i, (tag) => `${tag}${piece}`)
  : piece + html);

const insertBeforeBodyEnd = (html, piece) => (/<\/body>/i.test(html)
  ? html.replace(/<\/body>/i, `${piece}</body>`)
  : html + piece);

const PREHEADER = '<div data-preheader style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">{{preheader}}</div>';
const UNSUBSCRIBE_FOOTER = '<p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#777;text-align:center">Don’t want these emails? <a href="{{unsubscribe_url}}" style="color:#777">Unsubscribe</a>.</p>';

// The day an email is sent, such as "October 28, 2026", in the time zone in Settings.
export function today(timeZone) {
  const options = { month: 'long', day: 'numeric', year: 'numeric' };
  try {
    return new Date().toLocaleDateString('en-US', { ...options, timeZone: timeZone || undefined });
  } catch {
    return new Date().toLocaleDateString('en-US', options);
  }
}

export function mergeValues({ contact = {}, general = {}, brand = null, subject = '', preheader = '', unsubscribeUrl = '#' }) {
  const first = contact.first_name || '';
  const last = contact.last_name || '';
  const values = {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' '),
    email: contact.email || '',
    org_name: brand?.name || general.orgName || '',
    brand_name: brand?.name || general.orgName || '',
    brand_heading: brand?.heading || brand?.name || general.orgName || '',
    brand_url: brand?.website || '',
    address: general.address || '',
    unsubscribe_url: unsubscribeUrl,
    date: today(general.timeZone),
    year: String(new Date().getFullYear()),
  };
  // The subject and preview text can hold tags of their own ("{{first_name}}, your May update").
  values.subject = fillTags(subject, values, { html: false });
  values.preheader = fillTags(preheader, values, { html: false });
  return values;
}

// The message's pictures, never wider than the column: Outlook for Windows ignores CSS and draws
// a picture at its width attribute, so one uploaded at 1200 px (twice the column, for sharp
// screens) is given the column's width and its height to match. Every other mail app scales it
// down with max-width. A picture with a style of its own is left as it is.
export function fitImages(html, max = INNER) {
  return String(html || '').replace(/<img\b[^>]*>/gi, (tag) => {
    const num = (name) => Number(new RegExp(`\\s${name}\\s*=\\s*["']?(\\d+)`, 'i').exec(tag)?.[1]) || 0;
    const set = (t, name, value) => (new RegExp(`\\s${name}\\s*=`, 'i').test(t)
      ? t.replace(new RegExp(`(\\s${name}\\s*=\\s*)(["']?)\\d+\\2`, 'i'), `$1"${value}"`)
      : t.replace(/^<img\b/i, `<img ${name}="${value}"`));
    let out = tag;
    const width = num('width');
    if (width > max) {
      const height = num('height');
      out = set(out, 'width', max);
      if (height) out = set(out, 'height', Math.round((height * max) / width));
    }
    if (!/\sstyle\s*=/i.test(out)) out = out.replace(/^<img\b/i, '<img style="display:block;max-width:100%;height:auto;border:0"');
    return out;
  });
}

// The full HTML of one email. Every email gets an unsubscribe link: a template without one has a
// line added at the bottom. updatesHtml (from renderUpdatesHtml) goes where it says {{updates}},
// and productsHtml (renderProductsHtml) where it says {{products}}.
export function renderEmail({ templateHtml, bodyHtml, updatesHtml = '', productsHtml = '', subject, preheader, contact, general, brand, unsubscribeUrl }) {
  let html = templateHtml || DEFAULT_LAYOUT;
  if (!hasTag(html, 'content')) html = insertBeforeBodyEnd(html, '{{content}}');
  html = html.replace(/\{\{\s*content\s*\}\}/g, () => fitImages(bodyHtml));
  html = html.replace(/\{\{\s*updates\s*\}\}/g, () => updatesHtml || '');
  html = html.replace(/\{\{\s*products\s*\}\}/g, () => productsHtml || '');
  if (preheader && !hasTag(html, 'preheader')) html = insertAfterBodyStart(html, PREHEADER);
  if (!hasTag(html, 'unsubscribe_url')) html = insertBeforeBodyEnd(html, UNSUBSCRIBE_FOOTER);
  const values = mergeValues({ contact, general, brand, subject, preheader, unsubscribeUrl });
  return fillTags(html, values);
}

export const renderSubject = (subject, contact, general, brand) => mergeValues({ contact, general, brand, subject }).subject;

export const templateHasUpdates = (html) => hasTag(html || '', 'updates');
export const templateHasProducts = (html) => hasTag(html || '', 'products');

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•', rarr: '→', larr: '←',
  times: '×', deg: '°', euro: '€', pound: '£', zwnj: '', shy: '',
};
const decodeEntities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
  if (code[0] === '#') {
    const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
  }
  return ENTITIES[code.toLowerCase()] ?? whole;
});

// The plain-text version sent alongside the HTML, for mail apps that show text only. It also
// helps the email past spam filters.
export function htmlToText(html) {
  let s = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|style|script|title)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<div[^>]*data-preheader[^>]*>[\s\S]*?<\/div>/gi, '');
  s = s.replace(/<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (whole, q, href, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').trim();
    const url = decodeEntities(href.trim());
    if (!url || url.startsWith('#') || decodeEntities(label) === url) return label || url;
    return label ? `${label} (${url})` : url;
  });
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n\n----\n\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|blockquote|ul|ol|table|tr)>/gi, '\n\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

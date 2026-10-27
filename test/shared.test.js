import test from 'node:test';
import assert from 'node:assert/strict';
import { guessColumns, mapRows, parseCsv, toCsv } from '../shared/csv.js';
import { isEmail } from '../shared/email.js';
import { fillTags, htmlToText, renderEmail, renderSubject } from '../shared/render.js';

test('CSV: quotes, doubled quotes, line breaks inside quotes, CRLF and a byte-order mark', () => {
  const rows = parseCsv('﻿email,name\r\n"a@x.com","Smith, ""Jo"""\r\n"b@x.com","two\nlines"\r\n\r\n');
  assert.deepEqual(rows, [['email', 'name'], ['a@x.com', 'Smith, "Jo"'], ['b@x.com', 'two\nlines']]);
});

test('CSV: files saved with semicolons or tabs', () => {
  assert.deepEqual(parseCsv('email;first\na@x.com;Ann\n'), [['email', 'first'], ['a@x.com', 'Ann']]);
  assert.deepEqual(parseCsv('email\tfirst\na@x.com\tAnn'), [['email', 'first'], ['a@x.com', 'Ann']]);
});

test('CSV: columns are found by their names, or by their cells when there are no names', () => {
  const named = guessColumns([['Name', 'E-mail Address'], ['Ada Lovelace', 'ada@x.com']]);
  assert.equal(named.hasHeader, true);
  assert.equal(named.email, 1);
  assert.equal(named.name, 0);
  assert.deepEqual(mapRows([['Name', 'E-mail Address'], ['Ada King Lovelace', 'ada@x.com']], named), [
    { email: 'ada@x.com', first_name: 'Ada', last_name: 'King Lovelace' },
  ]);
  const bare = guessColumns([['Ann', 'ann@x.com'], ['Bo', 'bo@x.com']]);
  assert.equal(bare.hasHeader, false);
  assert.equal(bare.email, 1);
});

test('CSV export keeps formulas from running in spreadsheets', () => {
  assert.equal(toCsv([['=1+1', 'plain', 'a,b']]), "'=1+1,plain,\"a,b\"\r\n");
});

test('email addresses: plain ones pass, anything that could hide a second recipient fails', () => {
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.org', ' Mixed@Example.COM ']) assert.equal(isEmail(ok), true, ok);
  for (const bad of ['', 'a', 'a@b', 'a b@c.com', '"a"@b.com', 'a@b.com,c@d.com', 'a@b.com>x', 'a..b@c.com', 'a@-b.com']) assert.equal(isEmail(bad), false, bad);
});

test('tags are filled and escaped, with fallbacks for empty values', () => {
  assert.equal(fillTags('Hi {{first_name|there}}, {{ email }} {{unknown}}', { first_name: '', email: '<a@b.c>' }), 'Hi there, &lt;a@b.c&gt; {{unknown}}');
  assert.equal(fillTags('{{address}}', { address: '1 Main\nTown' }), '1 Main<br>Town');
  assert.equal(fillTags('{{first_name}} & co', { first_name: 'A&B' }, { html: false }), 'A&B & co');
});

test('an email has the message in the template, the preview text, and always an unsubscribe link', () => {
  const html = renderEmail({
    templateHtml: '<html><body><main>{{content}}</main></body></html>',
    bodyHtml: '<p>Hi {{first_name}}</p>',
    subject: 'News for {{first_name}}',
    preheader: 'Quick update',
    contact: { first_name: 'Ann', email: 'ann@x.com' },
    general: { orgName: 'Acme' },
    unsubscribeUrl: 'https://n.example.com/u/abc',
  });
  assert.match(html, /<main><p>Hi Ann<\/p><\/main>/);
  assert.match(html, /data-preheader[^>]*>Quick update</);
  assert.match(html, /href="https:\/\/n\.example\.com\/u\/abc"/);
  assert.equal(renderSubject('News for {{first_name|you}}', { first_name: '' }), 'News for you');
});

test('the plain-text version keeps words and links, and drops styles and the preview text', () => {
  const text = htmlToText('<style>p{color:red}</style><div data-preheader>hidden</div><h2>Title</h2><p>See <a href="https://x.com/a?b=1&amp;c=2">this</a> &middot; now &rarr;</p><ul><li>One</li><li>Two</li></ul>');
  assert.equal(text, 'Title\n\nSee this (https://x.com/a?b=1&c=2) · now →\n\n• One\n• Two');
});

test('a visual design compiles to email HTML with places for the message and the updates', async () => {
  const { default: mjml } = await import('mjml');
  const { STARTER_DESIGNS, designProblem, designToMjml, normalizeDesign } = await import('../shared/design.js');
  const design = normalizeDesign({ ...STARTER_DESIGNS.updates.design, blocks: [...STARTER_DESIGNS.updates.design.blocks, { type: 'nope' }, { type: 'spacer', height: 9999 }] });
  assert.equal(design.blocks.at(-1).height, 120, 'values are kept in range');
  assert.equal(design.blocks.some((b) => b.type === 'nope'), false, 'unknown blocks are dropped');
  const { html, errors } = await mjml(designToMjml(design, { brand: { color: '#7c3aed' } }), { validationLevel: 'soft' });
  assert.deepEqual(errors, []);
  for (const tag of ['{{content}}', '{{updates}}', '{{brand_heading}}', '{{unsubscribe_url}}', '{{preheader}}']) assert.ok(html.includes(tag), tag);
  assert.match(html, /#7c3aed/i);
  assert.equal(designProblem({ blocks: [] }), 'A template needs a Message block, where each message goes.');
});

test('updates as email HTML: escaped, only web links, dated in the chosen time zone', async () => {
  const { renderUpdatesHtml, autoUpdates } = await import('../shared/updates.js');
  const html = renderUpdatesHtml([{ id: 1, kind: 'fixed', title: '<b>Bold</b> claim', body: 'Line one\nLine two', link: 'javascript:alert(1)', product_name: 'Talari', happened_at: '2026-10-27T03:00:00Z' }], { timeZone: 'America/New_York' });
  assert.match(html, /&lt;b&gt;Bold&lt;\/b&gt; claim/);
  assert.match(html, /Line one<br>Line two/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /Oct 26, 2026/, 'still the 26th in New York');
  assert.equal(renderUpdatesHtml([]), '');
  const picked = autoUpdates([
    { id: 1, status: 'published', sent: false, happened_at: '2026-10-01' },
    { id: 2, status: 'published', sent: true, happened_at: '2026-10-05' },
    { id: 3, status: 'draft', sent: false, happened_at: '2026-10-06' },
    { id: 4, status: 'published', sent: false, happened_at: '2026-10-04' },
  ], 5);
  assert.deepEqual(picked.map((u) => u.id), [4, 1]);
});

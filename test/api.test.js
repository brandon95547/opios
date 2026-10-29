// The server end to end: a real Opios on a temporary data folder, sending through a real (local)
// SMTP server.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SMTPServer } from 'smtp-server';
import sharp from 'sharp';
import { createApp } from '../server/app.js';

const quiet = { error() {} };

async function startSmtp({ user = 'mailer', pass = 'right-password' } = {}) {
  const received = [];
  const server = new SMTPServer({
    allowInsecureAuth: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onAuth(auth, session, done) {
      if (auth.username === user && auth.password === pass) done(null, { user });
      else done(new Error('Invalid username or password'));
    },
    onData(stream, session, done) {
      let raw = '';
      stream.on('data', (chunk) => { raw += chunk; });
      stream.on('end', () => {
        // Long headers are wrapped onto a second line; unwrapped here to match them whole.
        received.push({ to: session.envelope.rcptTo.map((r) => r.address), raw: raw.replace(/\r\n[ \t]+/g, ' '), text: decode(raw) });
        done();
      });
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, received, port: server.server.address().port, close: () => new Promise((r) => server.close(r)) };
}

// Undoes quoted-printable and base64 bodies well enough to search the text.
function decode(raw) {
  const qp = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  const b64 = [...raw.matchAll(/Content-Transfer-Encoding: base64\r?\n(?:[^\r\n]+\r?\n)*\r?\n([A-Za-z0-9+/=\r\n]+)/g)]
    .map((m) => Buffer.from(m[1].replace(/\s/g, ''), 'base64').toString('utf8')).join('\n');
  return Buffer.from(qp, 'latin1').toString('utf8') + b64;
}

async function startOpios(options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opios-test-'));
  const opios = createApp({ dataDir, log: quiet, ...options });
  const server = await new Promise((resolve) => { const s = opios.app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    const reply = type.includes('json') ? await res.json() : /^text\//.test(type) ? await res.text() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body: reply };
  };
  // A request with a raw body (an upload), signed in like call().
  const callRaw = async (method, url, buffer, headers = {}) => {
    const res = await fetch(base + url, { method, headers: { ...(cookie ? { cookie } : {}), ...headers }, body: buffer });
    const type = res.headers.get('content-type') || '';
    return { status: res.status, body: type.includes('json') ? await res.json() : await res.text() };
  };
  const waitUntilSent = async (id) => {
    for (let i = 0; i < 200; i += 1) {
      const c = await call('GET', `/api/campaigns/${id}`);
      if (c.body.status !== 'sending') return c.body;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('Sending did not finish');
  };
  return {
    opios, base, call, callRaw, dataDir, waitUntilSent,
    forgetCookie: () => { cookie = ''; },
    async close() {
      server.closeAllConnections();
      server.close();
      await opios.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

test('the login: set up once, then sign in; wrong passwords and other sites are turned away', async () => {
  const o = await startOpios();
  try {
    assert.deepEqual((await o.call('GET', '/api/auth/state')).body, { user: null, needsSetup: true, setup: 'open' });
    assert.equal((await o.call('GET', '/api/contacts')).status, 401);
    assert.equal((await o.call('POST', '/api/auth/setup', { username: 'me', password: 'short' })).status, 400);
    assert.equal((await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' })).status, 201);
    assert.equal((await o.call('GET', '/api/contacts')).status, 200);
    assert.equal((await o.call('POST', '/api/auth/setup', { username: 'other', password: 'long-enough-2' })).status, 403);

    // Another site's page can't make changes, even with the cookie.
    const forged = await o.call('POST', '/api/contacts', { email: 'x@y.com' }, { origin: 'https://evil.example' });
    assert.equal(forged.status, 403);

    await o.call('POST', '/api/auth/logout');
    assert.equal((await o.call('GET', '/api/contacts')).status, 401);
    assert.equal((await o.call('POST', '/api/auth/login', { username: 'me', password: 'wrong-password' })).status, 401);
    assert.equal((await o.call('POST', '/api/auth/login', { username: 'nobody', password: 'wrong-password' })).status, 401);
    assert.equal((await o.call('POST', '/api/auth/login', { username: 'ME', password: 'long-enough-1' })).status, 200);

    // A new password signs out other browsers.
    assert.equal((await o.call('PUT', '/api/auth/account', { currentPassword: 'nope', newPassword: 'another-one-3' })).status, 400);
    assert.equal((await o.call('PUT', '/api/auth/account', { currentPassword: 'long-enough-1', newPassword: 'another-one-3' })).status, 200);
    assert.equal((await o.call('GET', '/api/contacts')).status, 200);
  } finally {
    await o.close();
  }
});

test('on a server: served under its path, and the first login needs the setup code', async () => {
  const o = await startOpios({ basePath: '/opios', setupCode: 'four-word-setup-code', production: true });
  try {
    assert.equal((await o.call('GET', '/api/auth/state')).status, 404);
    assert.deepEqual((await o.call('GET', '/opios/api/auth/state')).body, { user: null, needsSetup: true, setup: 'code' });
    const login = { username: 'me', password: 'long-enough-1' };
    assert.equal((await o.call('POST', '/opios/api/auth/setup', login)).status, 403);
    assert.equal((await o.call('POST', '/opios/api/auth/setup', { ...login, setupCode: 'wrong' })).status, 403);
    const made = await o.call('POST', '/opios/api/auth/setup', { ...login, setupCode: ' four-word-setup-code ' });
    assert.equal(made.status, 201);
    assert.match(made.headers.get('set-cookie'), /; Path=\/opios;/);
    assert.equal((await o.call('GET', '/opios/api/contacts')).status, 200);
    // Once the login exists, the code opens nothing.
    assert.equal((await o.call('POST', '/opios/api/auth/setup', { username: 'x', password: 'long-enough-2', setupCode: 'four-word-setup-code' })).status, 403);
    assert.match((await o.call('GET', '/opios/u/not-a-real-token-at-all')).body, /This link doesn’t work/);
  } finally {
    await o.close();
  }

  // On a server with no setup code, the login can only be made there (npm run reset-password).
  const closed = await startOpios({ production: true });
  try {
    assert.equal((await closed.call('GET', '/api/auth/state')).body.setup, 'closed');
    assert.equal((await closed.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' })).status, 403);
  } finally {
    await closed.close();
  }
});

test('contacts: added by hand, imported from rows, exported; an import keeps unsubscribes', async () => {
  const o = await startOpios();
  try {
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    const ann = await o.call('POST', '/api/contacts', { email: ' Ann@Example.com ', first_name: 'Ann' });
    assert.equal(ann.status, 201);
    assert.equal(ann.body.email, 'ann@example.com');
    assert.equal((await o.call('POST', '/api/contacts', { email: 'ann@example.com' })).status, 409);
    assert.equal((await o.call('POST', '/api/contacts', { email: 'not an email' })).status, 400);
    await o.call('PUT', `/api/contacts/${ann.body.id}`, { ...ann.body, status: 'unsubscribed' });

    const imported = await o.call('POST', '/api/contacts/import', {
      new_list: 'Customers',
      update_existing: true,
      rows: [
        { email: 'bo@example.com', first_name: 'Bo', last_name: 'Diaz' },
        { email: 'BO@example.com', first_name: 'Again' },
        { email: 'ann@example.com', first_name: 'Annie' },
        { email: 'broken', first_name: 'X' },
        { email: 'cy@example.com' },
      ],
    });
    assert.equal(imported.status, 200);
    assert.deepEqual(
      { added: imported.body.added, updated: imported.body.updated, invalid: imported.body.invalid, duplicates: imported.body.duplicates, keptUnsubscribed: imported.body.keptUnsubscribed },
      { added: 2, updated: 1, invalid: 1, duplicates: 1, keptUnsubscribed: 1 },
    );
    assert.deepEqual(imported.body.invalidExamples, [{ row: 4, email: 'broken' }]);

    const { body } = await o.call('GET', '/api/contacts');
    const annNow = body.contacts.find((c) => c.email === 'ann@example.com');
    assert.equal(annNow.status, 'unsubscribed');
    assert.equal(annNow.first_name, 'Annie');
    assert.equal(body.lists[0].name, 'Customers');
    assert.equal(body.lists[0].count, 3);
    assert.equal(body.lists[0].subscribed, 2);

    const csv = await o.call('GET', '/api/contacts/export.csv');
    assert.match(csv.headers.get('content-disposition'), /attachment; filename="?opios-contacts-\d{4}-\d\d-\d\d\.csv/);
    assert.match(csv.body, /bo@example.com,Bo,Diaz,subscribed,,Customers/);

    const bulk = await o.call('POST', '/api/contacts/bulk', { action: 'delete', ids: [annNow.id] });
    assert.equal(bulk.body.changed, 1);
  } finally {
    await o.close();
  }
});

test('the whole database downloads as a SQLite copy, without sign-in sessions', async () => {
  const o = await startOpios();
  try {
    assert.equal((await o.call('GET', '/api/export/database')).status, 401);
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    await o.call('POST', '/api/contacts', { email: 'ann@example.com', first_name: 'Ann' });
    await o.call('PUT', '/api/settings/smtp', { provider: 'gmail', host: 'smtp.gmail.com', port: 465, security: 'ssl', user: 'me@gmail.com', pass: 'app-password-1', fromEmail: 'me@gmail.com' });

    const { status, headers, body } = await o.call('GET', '/api/export/database');
    assert.equal(status, 200);
    assert.match(headers.get('content-disposition'), /attachment; filename="?opios-database-\d{4}-\d\d-\d\d\.sqlite3/);

    // Read the downloaded file back as a database.
    const file = path.join(o.dataDir, 'downloaded.sqlite3');
    fs.writeFileSync(file, body);
    assert.equal(fs.readFileSync(file).subarray(0, 15).toString(), 'SQLite format 3');
    const copy = new DatabaseSync(file);
    assert.deepEqual(copy.prepare('SELECT email, first_name FROM contacts').all().map((r) => ({ ...r })), [{ email: 'ann@example.com', first_name: 'Ann' }]);
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM templates').get().n, 3);
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    assert.equal(copy.prepare("SELECT value FROM settings WHERE key = 'smtp'").get().value.includes('app-password-1'), false);
    copy.close();
    const leftover = () => fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('opios-export-'));
    for (let i = 0; i < 40 && leftover().length; i += 1) await new Promise((r) => setTimeout(r, 25));
    assert.deepEqual(leftover(), [], 'the temporary copy is removed');
  } finally {
    await o.close();
  }
});

test('the email password is stored encrypted and never sent back', async () => {
  const o = await startOpios();
  try {
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    const saved = await o.call('PUT', '/api/settings/smtp', {
      provider: 'gmail', host: 'smtp.gmail.com', port: 465, security: 'ssl', user: 'me@gmail.com', pass: 'abcd efgh ijkl mnop', fromEmail: 'me@gmail.com',
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.smtp.hasPassword, true);
    assert.equal(JSON.stringify(saved.body).includes('abcd'), false);
    const raw = o.opios.db.prepare("SELECT value FROM settings WHERE key = 'smtp'").get().value;
    assert.equal(raw.includes('abcd'), false);
    assert.equal(o.opios.settings.smtp().pass, 'abcd efgh ijkl mnop');
    // Saving again without a password keeps the one saved.
    await o.call('PUT', '/api/settings/smtp', { ...saved.body.smtp, fromName: 'Me' });
    assert.equal(o.opios.settings.smtp().pass, 'abcd efgh ijkl mnop');
  } finally {
    await o.close();
  }
});

test('a message is sent to its list, personalized, with an unsubscribe link and header', async () => {
  const smtp = await startSmtp();
  const o = await startOpios();
  try {
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    await o.call('PUT', '/api/settings/smtp', {
      provider: 'other', host: '127.0.0.1', port: smtp.port, security: 'none', user: 'mailer', pass: 'right-password', fromName: 'Acme News', fromEmail: 'news@acme.test',
    });
    await o.call('PUT', '/api/settings/general', { orgName: 'Acme', address: '1 Main St', publicUrl: 'https://news.acme.test', ratePerMinute: 600 });
    const { body: imported } = await o.call('POST', '/api/contacts/import', {
      new_list: 'Friends',
      rows: [{ email: 'ann@example.com', first_name: 'Ann' }, { email: 'bo@example.com', first_name: '' }, { email: 'cy@example.com', first_name: 'Cy' }],
    });
    await o.call('POST', '/api/contacts', { email: 'not-on-list@example.com' });
    const cy = (await o.call('GET', '/api/contacts')).body.contacts.find((c) => c.email === 'cy@example.com');
    await o.call('POST', '/api/contacts/bulk', { action: 'unsubscribe', ids: [cy.id] });

    const draft = (await o.call('POST', '/api/campaigns')).body;
    assert.equal(draft.status, 'draft');
    const template = (await o.call('GET', '/api/templates')).body.find((t) => t.name === 'Classic');
    await o.call('PUT', `/api/campaigns/${draft.id}`, {
      subject: 'Hello {{first_name|friend}}',
      preheader: 'This month',
      template_id: template.id,
      body_html: '<p>Hi {{first_name|there}}, <a href="https://acme.test/sale">see the sale</a>.</p>',
      audience: { type: 'lists', listIds: [imported.listId] },
    });
    assert.equal((await o.call('POST', '/api/campaigns/audience', { audience: { type: 'lists', listIds: [imported.listId] } })).body.count, 2);

    const started = await o.call('POST', `/api/campaigns/${draft.id}/send`);
    assert.equal(started.status, 200);
    assert.equal(started.body.status, 'sending');
    assert.equal((await o.call('PUT', `/api/campaigns/${draft.id}`, { subject: 'changed' })).status, 409);

    const done = await o.waitUntilSent(draft.id);
    assert.equal(done.status, 'sent');
    assert.deepEqual({ sent: done.sent, failed: done.failed, total: done.total }, { sent: 2, failed: 0, total: 2 });
    assert.deepEqual(smtp.received.map((m) => m.to[0]).sort(), ['ann@example.com', 'bo@example.com']);

    const toAnn = smtp.received.find((m) => m.to[0] === 'ann@example.com');
    assert.match(toAnn.raw, /^Subject: Hello Ann$/m);
    assert.match(toAnn.raw, /^From: Acme News <news@acme\.test>$/m);
    assert.match(toAnn.raw, /^List-Unsubscribe: <https:\/\/news\.acme\.test\/u\/[A-Za-z0-9_-]+>, <mailto:news@acme\.test/m);
    assert.match(toAnn.raw, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
    assert.match(toAnn.text, /Hi Ann, <a href="https:\/\/acme\.test\/sale"/);
    assert.match(toAnn.text, /see the sale \(https:\/\/acme\.test\/sale\)/, 'plain-text part');
    assert.match(toAnn.text, /1 Main St/);
    assert.match(toAnn.text, /<td class="content" style="[^"]*font-family/, 'styles copied onto the tags');
    const toBo = smtp.received.find((m) => m.to[0] === 'bo@example.com');
    assert.match(toBo.raw, /^Subject: Hello friend$/m);
    assert.match(toBo.text, /Hi there,/);

    // The unsubscribe link in the email works.
    const link = toAnn.raw.match(/https:\/\/news\.acme\.test\/u\/([A-Za-z0-9_-]+)/)[1];
    const pageBefore = await o.call('GET', `/u/${link}`);
    assert.match(pageBefore.body, /Unsubscribe\?/);
    const after = await fetch(`${o.base}/u/${link}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    assert.equal(after.status, 200);
    const ann = (await o.call('GET', '/api/contacts')).body.contacts.find((c) => c.email === 'ann@example.com');
    assert.equal(ann.status, 'unsubscribed');
    assert.equal((await o.call('GET', '/u/not-a-real-token-at-all')).status, 404);

    // A duplicate is a fresh draft; it now goes only to Bo.
    const copy = (await o.call('POST', `/api/campaigns/${draft.id}/duplicate`)).body;
    assert.equal(copy.status, 'draft');
    assert.equal((await o.call('POST', '/api/campaigns/audience', { audience: copy.audience })).body.count, 1);
  } finally {
    await o.close();
    await smtp.close();
  }
});

test('a wrong email password pauses sending; resume once it is fixed', async () => {
  const smtp = await startSmtp();
  const o = await startOpios();
  try {
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    const account = { provider: 'other', host: '127.0.0.1', port: smtp.port, security: 'none', user: 'mailer', pass: 'wrong-password', fromEmail: 'news@acme.test' };
    await o.call('PUT', '/api/settings/smtp', account);
    await o.call('PUT', '/api/settings/general', { ratePerMinute: 600 });
    await o.call('POST', '/api/contacts', { email: 'ann@example.com' });
    await o.call('POST', '/api/contacts', { email: 'bo@example.com' });

    const verify = await o.call('POST', '/api/settings/smtp/verify', account);
    assert.equal(verify.status, 502);
    assert.match(verify.body.error, /turned down the username and password/);

    const draft = (await o.call('POST', '/api/campaigns')).body;
    await o.call('PUT', `/api/campaigns/${draft.id}`, { subject: 'Hi', body_html: '<p>Hello</p>' });
    await o.call('POST', `/api/campaigns/${draft.id}/send`);
    const paused = await o.waitUntilSent(draft.id);
    assert.equal(paused.status, 'paused');
    assert.match(paused.pause_reason, /turned down the username and password/);
    assert.equal(paused.waiting, 2);
    assert.equal(smtp.received.length, 0);

    await o.call('PUT', '/api/settings/smtp', { ...account, pass: 'right-password' });
    assert.equal((await o.call('POST', `/api/campaigns/${draft.id}/resume`)).status, 200);
    const done = await o.waitUntilSent(draft.id);
    assert.equal(done.status, 'sent');
    assert.equal(done.sent, 2);

    // A test email goes straight out, marked as a test.
    const sent = await o.call('POST', '/api/campaigns/test', { to: 'me@acme.test', subject: 'Draft', body_html: '<p>Body</p>' });
    assert.equal(sent.status, 200);
    assert.match(smtp.received.at(-1).raw, /^Subject: \[Test\] Draft$/m);
  } finally {
    await o.close();
    await smtp.close();
  }
});

test('an email cut off by a restart is marked failed, not sent twice', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opios-test-'));
  try {
    const first = createApp({ dataDir, log: quiet });
    first.db.prepare("INSERT INTO campaigns (subject, body_html, status, created_at, updated_at) VALUES ('x', '<p>x</p>', 'cancelled', '', '')").run();
    first.db.prepare("INSERT INTO campaign_recipients (campaign_id, email, status) VALUES (1, 'a@b.co', 'sending')").run();
    await first.close();
    const again = createApp({ dataDir, log: quiet });
    const row = again.db.prepare('SELECT status, error FROM campaign_recipients').get();
    assert.equal(row.status, 'failed');
    assert.match(row.error, /may or may not have arrived/);
    await again.close();
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('brands: updates go into the brand’s newsletter once, to its subscribers, who unsubscribe from it alone', async () => {
  const smtp = await startSmtp();
  const o = await startOpios();
  try {
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    await o.call('PUT', '/api/settings/smtp', { provider: 'other', host: '127.0.0.1', port: smtp.port, security: 'none', user: 'mailer', pass: 'right-password', fromEmail: 'news@acme.test' });
    await o.call('PUT', '/api/settings/general', { publicUrl: 'https://news.acme.test', ratePerMinute: 600, timeZone: 'America/New_York' });

    const phansora = (await o.call('POST', '/api/brands', { name: 'Phansora', color: '#7c3aed', from_name: 'Phansora' })).body;
    assert.equal(phansora.heading, 'Phansora Updates');
    const skylanex = (await o.call('POST', '/api/brands', { name: 'Skylanex' })).body;
    const talari = (await o.call('POST', `/api/brands/${phansora.id}/products`, { name: 'Talari' })).body.products[0];
    await o.call('POST', '/api/updates', { product_id: talari.id, title: 'Spine templates', body: 'Five layouts\nfor every frame.', link: 'https://phansora.com/talari', happened_at: '2026-10-20T15:00:00Z' });
    await o.call('POST', '/api/updates', { product_id: talari.id, title: 'Not ready yet', status: 'draft' });
    assert.equal((await o.call('POST', '/api/updates', { product_id: talari.id, title: 'Bad link', link: 'javascript:alert(1)' })).status, 400);

    // A script adds an update with an API key, naming a product that doesn't exist yet.
    const key = (await o.call('POST', '/api/api-keys', { name: 'Deploys' })).body.key;
    assert.match(key, /^opk_/);
    const post = (k, body) => fetch(`${o.base}/api/v1/updates`, { method: 'POST', headers: { authorization: `Bearer ${k}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('opk_wrong', { brand: 'Phansora', product: 'X', title: 'Y' })).status, 401);
    const viaApi = await post(key, { brand: 'Phansora', product: 'Narrava Studio', title: 'Lyric captions', kind: 'improved' });
    assert.equal(viaApi.status, 201);
    assert.equal((await viaApi.json()).product_name, 'Narrava Studio');
    assert.equal((await post(key, { brand: 'Nope', product: 'X', title: 'Y' })).status, 404);

    await o.call('POST', '/api/contacts', { email: 'ann@example.com', first_name: 'Ann', brand_ids: [phansora.id, skylanex.id] });
    await o.call('POST', '/api/contacts', { email: 'bo@example.com', brand_ids: [skylanex.id] });
    const cy = (await o.call('POST', '/api/contacts', { email: 'cy@example.com', brand_ids: [phansora.id] })).body;
    await o.call('POST', '/api/contacts/bulk', { action: 'unsubscribe_brand', brand_id: phansora.id, ids: [cy.id] });

    const template = (await o.call('POST', '/api/templates', { starter: 'updates', brand_id: phansora.id })).body;
    assert.equal(template.kind, 'blocks');
    assert.equal(template.name, 'Phansora updates');
    assert.match(template.html, /\{\{updates\}\}/);
    assert.match(template.html, /#7c3aed/i);
    const noMessage = { ...template.design, blocks: template.design.blocks.filter((b) => b.type !== 'content') };
    assert.equal((await o.call('PUT', `/api/templates/${template.id}`, { name: 'x', brand_id: phansora.id, design: noMessage })).status, 400);

    const send = async (subject) => {
      const draft = (await o.call('POST', '/api/campaigns', { brand_id: phansora.id })).body;
      assert.equal(draft.template_id, template.id, 'the brand’s own template');
      await o.call('PUT', `/api/campaigns/${draft.id}`, { subject, body_html: '<p>Hi {{first_name}}</p>' });
      assert.equal((await o.call('POST', '/api/campaigns/audience', { audience: draft.audience, brand_id: phansora.id })).body.count, 1);
      assert.equal((await o.call('POST', `/api/campaigns/${draft.id}/send`)).status, 200);
      return o.waitUntilSent(draft.id);
    };
    const first = await send('October');
    assert.equal(first.sent, 1);
    const mail = smtp.received.at(-1);
    assert.deepEqual(mail.to, ['ann@example.com']);
    assert.match(mail.raw, /^From: Phansora <news@acme\.test>$/m);
    assert.match(mail.text, /Phansora Updates/);
    assert.match(mail.text, /Spine templates/);
    assert.match(mail.text, /Lyric captions/);
    assert.match(mail.text, /Oct 20, 2026/);
    assert.doesNotMatch(mail.text, /Not ready yet/);
    const link = mail.raw.match(/https:\/\/news\.acme\.test\/u\/([A-Za-z0-9_-]+)\?b=(\d+)/);
    assert.equal(Number(link[2]), phansora.id);

    // Both updates went out, so the next newsletter has none to repeat.
    const updates = (await o.call('GET', `/api/updates?brand_id=${phansora.id}`)).body;
    assert.deepEqual(updates.filter((u) => u.sent).map((u) => u.title).sort(), ['Lyric captions', 'Spine templates']);
    await send('November');
    assert.doesNotMatch(smtp.received.at(-1).text, /Spine templates/);

    // Unsubscribing from Phansora leaves Skylanex alone.
    await fetch(`${o.base}/u/${link[1]}?b=${phansora.id}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    const ann = (await o.call('GET', '/api/contacts')).body.contacts.find((c) => c.email === 'ann@example.com');
    assert.equal(ann.status, 'subscribed');
    assert.deepEqual(ann.brands, { [phansora.id]: 'unsubscribed', [skylanex.id]: 'subscribed' });
  } finally {
    await o.close();
    await smtp.close();
  }
});

test('pictures upload, are checked by their bytes, and are served publicly for mail apps', async () => {
  const o = await startOpios();
  try {
    await o.call('POST', '/api/auth/setup', { username: 'me', password: 'long-enough-1' });
    const png = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 20, g: 90, b: 200, alpha: 0.5 } } }).png().toBuffer();
    const anonymous = await fetch(`${o.base}/api/media`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png });
    assert.equal(anonymous.status, 401, 'needs the login');
    assert.equal((await o.callRaw('POST', '/api/media', Buffer.alloc(0), { 'content-type': 'image/png' })).status, 400, 'an empty upload is turned away');
    const sent = await o.callRaw('POST', '/api/media', png, { 'content-type': 'image/png', 'x-file-name': 'logo.png' });
    assert.equal(sent.status, 201);
    assert.match(sent.body.url, /\/media\/[A-Za-z0-9_-]+\.png$/);
    const file = await fetch(sent.body.url.replace(/^https?:\/\/[^/]+/, o.base));
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/png');
    const notPicture = await o.callRaw('POST', '/api/media', Buffer.from('<svg onload="alert(1)"></svg>'), { 'content-type': 'image/png' });
    assert.equal(notPicture.status, 415);
    // Only a PNG's first bytes, and nothing a picture could be drawn from.
    const header = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    assert.equal((await o.callRaw('POST', '/api/media', header, { 'content-type': 'image/png' })).status, 415);
    assert.deepEqual([sent.body.width, sent.body.height], [40, 20]);

    // A phone photo is made 1200 px wide, as a JPEG, and the library knows its size.
    const photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).png().toBuffer();
    const big = await o.callRaw('POST', '/api/media', photo, { 'content-type': 'image/png', 'x-file-name': 'IMG_0001.png' });
    assert.equal(big.status, 201);
    assert.match(big.body.url, /\.jpg$/);
    assert.deepEqual([big.body.width, big.body.height, big.body.type], [1200, 800, 'image/jpeg']);
    const kept = fs.readFileSync(path.join(o.dataDir, 'media', big.body.file));
    assert.deepEqual([(await sharp(kept).metadata()).width, big.body.size], [1200, kept.length]);
    assert.ok(kept.length < photo.length / 4);
  } finally {
    await o.close();
  }
});

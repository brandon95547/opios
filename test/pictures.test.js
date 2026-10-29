// Pictures as an email carries them (server/pictures.js): never wider than 1200 px, as JPEG,
// PNG or GIF, never WebP; and a message's pictures never wider than its column (render.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { forEmail, fitUploadedPictures, EMAIL_MAX_WIDTH } from '../server/pictures.js';
import { openDb } from '../server/db.js';
import { fitImages, renderEmail } from '../shared/render.js';

const photo = (width, height, channels = 3) => sharp({ create: { width, height, channels, noise: { type: 'gaussian', mean: 128, sigma: 40 } } });
const flat = (width, height, alpha = 1) => sharp({ create: { width, height, channels: 4, background: { r: 200, g: 30, b: 60, alpha } } });
const facts = async (out) => ({ ext: out.ext, type: out.type, width: out.width, height: out.height, format: (await sharp(out.buf).metadata()).format });

test('a large photo is made 1200 px wide, as a JPEG, whatever it came as', async () => {
  for (const buf of [await photo(2400, 1800).jpeg().toBuffer(), await photo(2400, 1800).webp().toBuffer(), await photo(2400, 1800).png().toBuffer()]) {
    assert.deepEqual(await facts(await forEmail(buf)), { ext: 'jpg', type: 'image/jpeg', width: EMAIL_MAX_WIDTH, height: 900, format: 'jpeg' });
  }
});

test('a picture with transparency stays a PNG, and a logo in flat colors does too', async () => {
  const logo = await forEmail(await flat(2400, 600, 0.6).png().toBuffer());
  assert.deepEqual(await facts(logo), { ext: 'png', type: 'image/png', width: 1200, height: 300, format: 'png' });
  const wordmark = await forEmail(await flat(500, 120).png().toBuffer());
  assert.deepEqual(await facts(wordmark), { ext: 'png', type: 'image/png', width: 500, height: 120, format: 'png' });
  // A WebP with transparency, which Outlook could not show, becomes a PNG.
  assert.equal((await forEmail(await flat(300, 300, 0.5).webp().toBuffer())).ext, 'png');
});

test('a small picture keeps its size, and loses what a phone wrote into it', async () => {
  const tagged = await photo(800, 600).withExif({ IFD0: { Copyright: 'Someone', Make: 'Phone' } }).jpeg().toBuffer();
  assert.ok((await sharp(tagged).metadata()).exif);
  const out = await forEmail(tagged);
  assert.deepEqual([out.width, out.height, out.ext], [800, 600, 'jpg']);
  assert.equal((await sharp(out.buf).metadata()).exif, undefined);
});

test('a photo is turned the way it was held', async () => {
  // Stored 1600 × 1200 and marked "turn a quarter": it is a portrait, 1200 wide.
  const sideways = await photo(1600, 1200).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const out = await forEmail(sideways);
  assert.deepEqual([out.width, out.height], [1200, 1600]);
});

test('an animated GIF stays a GIF, every frame, and is made smaller only when too wide', async () => {
  const animated = async (width) => {
    const frame = (background) => sharp({ create: { width, height: width / 4, channels: 4, background } }).png().toBuffer();
    return sharp([await frame('#3366cc'), await frame('#cc6633')], { join: { animated: true } }).gif({ loop: 0 }).toBuffer();
  };
  const wide = await forEmail(await animated(1600));
  assert.deepEqual([wide.ext, wide.width, wide.height, (await sharp(wide.buf, { animated: true }).metadata()).pages], ['gif', 1200, 300, 2]);
  const small = await animated(400);
  assert.equal((await forEmail(small)).buf, small);
});

test('pictures uploaded before are sized once, and made 1200 px wide in place', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opios-pictures-'));
  try {
    const db = openDb(dataDir);
    fs.mkdirSync(path.join(dataDir, 'media'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'media', 'big.png'), await flat(2000, 1000, 0.5).png().toBuffer());
    fs.writeFileSync(path.join(dataDir, 'media', 'small.jpg'), await photo(600, 400).jpeg().toBuffer());
    fs.writeFileSync(path.join(dataDir, 'media', 'broken.png'), Buffer.from('not a picture'));
    const add = db.prepare("INSERT INTO media (file, name, type, size, created_at) VALUES (?, ?, 'image/png', 1, 'now')");
    for (const f of ['big.png', 'small.jpg', 'broken.png']) add.run(f, f);

    assert.equal(await fitUploadedPictures({ db, dataDir, log: {} }), 3);
    const rows = Object.fromEntries(db.prepare('SELECT file, width, height, size FROM media').all().map((r) => [r.file, r]));
    assert.deepEqual([rows['big.png'].width, rows['big.png'].height], [1200, 600]);
    assert.equal((await sharp(path.join(dataDir, 'media', 'big.png')).metadata()).width, 1200);
    assert.equal((await sharp(path.join(dataDir, 'media-originals', 'big.png')).metadata()).width, 2000);
    assert.deepEqual([rows['small.jpg'].width, rows['small.jpg'].height], [600, 400]);
    assert.equal(fs.existsSync(path.join(dataDir, 'media-originals', 'small.jpg')), false);
    assert.deepEqual([rows['broken.png'].width, rows['broken.png'].height], [0, 0]);
    // Once: nothing is left to size.
    assert.equal(await fitUploadedPictures({ db, dataDir, log: {} }), 0);
    db.close();
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('a message’s pictures are never wider than the column, in Outlook too', () => {
  assert.equal(fitImages('<img src="a.jpg" alt="" width="1200" height="800">'),
    '<img style="display:block;max-width:100%;height:auto;border:0" src="a.jpg" alt="" width="536" height="357">');
  // A small one keeps its size; one without a size scales down where CSS works.
  assert.match(fitImages('<img src="b.png" width="300" height="100">'), /width="300" height="100"/);
  assert.match(fitImages('<img src="c.png">'), /max-width:100%/);
  // One styled by hand is left as it is, but still not wider than the column for Outlook.
  assert.equal(fitImages('<img src="d.png" width="900" style="width:50%">'), '<img src="d.png" width="536" style="width:50%">');
  const html = renderEmail({ templateHtml: '<html><body>{{content}} {{unsubscribe_url}}</body></html>', bodyHtml: '<p><img src="e.jpg" width="1200" height="600"></p>', contact: {}, general: {} });
  assert.match(html, /<img [^>]*width="536" height="268"/);
});

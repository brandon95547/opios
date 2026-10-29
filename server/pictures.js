// A picture as an email carries it. An email's column is 600 px, so no picture needs to be
// wider than 1200 px (twice that, sharp on a phone or a retina screen); one uploaded larger is
// made 1200 px wide. It is kept as JPEG or PNG, never WebP, which Outlook for Windows cannot
// show: a photo as JPEG, and a picture with transparency, or a logo or diagram whose flat colors
// a JPEG would smear, as PNG. An animated GIF stays a GIF. What a phone writes into a photo
// (where it was taken, the camera) is left out, and a photo is turned the way it was held.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const EMAIL_MAX_WIDTH = 1200;
const JPEG = { quality: 82, mozjpeg: true };
// Over this, a lossless PNG is made again with at most 256 colors, as small as most logos are.
const PNG_LOSSLESS_MAX = 150 * 1024;
const PIXELS_MAX = 100_000_000;

const TYPES = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };

// `buf` is a PNG, JPEG, GIF or WebP (media.js has checked its first bytes). The picture as it is
// kept: its bytes, extension, type and size in pixels.
export async function forEmail(buf) {
  const meta = await sharp(buf, { animated: true, limitInputPixels: PIXELS_MAX }).metadata();
  const animated = meta.format === 'gif' && (meta.pages || 1) > 1;
  const turned = (meta.orientation || 1) >= 5;
  const width = turned ? meta.height : meta.width;
  const resize = width > EMAIL_MAX_WIDTH ? { width: EMAIL_MAX_WIDTH } : null;
  const done = async (pipeline, ext) => {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { buf: data, ext, type: TYPES[ext], width: info.width, height: info.pageHeight || info.height };
  };

  if (animated) {
    if (!resize) return { buf, ext: 'gif', type: TYPES.gif, width: meta.width, height: meta.pageHeight || meta.height };
    return done(sharp(buf, { animated: true, limitInputPixels: PIXELS_MAX }).resize(resize).gif(), 'gif');
  }

  const picture = () => {
    const p = sharp(buf, { limitInputPixels: PIXELS_MAX }).rotate();
    return resize ? p.resize(resize) : p;
  };
  const { isOpaque } = await sharp(buf, { limitInputPixels: PIXELS_MAX }).stats();
  if (!isOpaque) return png(picture);
  if (meta.format === 'jpeg' || meta.format === 'webp') return done(picture().jpeg(JPEG), 'jpg');
  // An opaque PNG or GIF: a photo saved as PNG comes out at a fraction of the size as JPEG; a
  // logo or a diagram does not, and keeps its crisp edges as PNG.
  const [asPng, asJpeg] = await Promise.all([png(picture), done(picture().jpeg(JPEG), 'jpg')]);
  return asJpeg.buf.length < asPng.buf.length * 0.5 ? asJpeg : asPng;
}

async function png(picture) {
  const lossless = await picture().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true });
  let out = lossless;
  if (lossless.data.length > PNG_LOSSLESS_MAX) {
    const fewer = await picture().png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer({ resolveWithObject: true });
    if (fewer.data.length < lossless.data.length) out = fewer;
  }
  return { buf: out.data, ext: 'png', type: TYPES.png, width: out.info.width, height: out.info.height };
}

// Pictures uploaded before this, once: each is given its size and, if it is wider than an email
// needs, made 1200 px wide in place, in the format its address names (so the emails and
// templates that show it get the smaller one). The original is kept in data/media-originals,
// which is not served. One that cannot be read is given 0 × 0 and left as it is.
export async function fitUploadedPictures({ db, dataDir, log = console }) {
  const rows = db.prepare('SELECT id, file FROM media WHERE width IS NULL').all();
  for (const row of rows) {
    const file = path.join(dataDir, 'media', row.file);
    try {
      const before = fs.readFileSync(file);
      const gif = row.file.endsWith('.gif');
      const meta = await sharp(before, { animated: gif, limitInputPixels: PIXELS_MAX }).metadata();
      const turned = (meta.orientation || 1) >= 5;
      let size = { width: turned ? meta.height : meta.width, height: turned ? meta.width : meta.pageHeight || meta.height, bytes: before.length };
      if (size.width > EMAIL_MAX_WIDTH) {
        const p = sharp(before, { animated: gif, limitInputPixels: PIXELS_MAX }).rotate().resize({ width: EMAIL_MAX_WIDTH });
        const kept = row.file.endsWith('.png') ? p.png({ compressionLevel: 9, adaptiveFiltering: true }) : gif ? p.gif() : p.jpeg(JPEG);
        const { data, info } = await kept.toBuffer({ resolveWithObject: true });
        fs.mkdirSync(path.join(dataDir, 'media-originals'), { recursive: true });
        fs.copyFileSync(file, path.join(dataDir, 'media-originals', row.file));
        fs.writeFileSync(file, data);
        log.info?.(`Opios: ${row.file} made ${info.width} px wide for email (${before.length} → ${data.length} bytes).`);
        size = { width: info.width, height: info.pageHeight || info.height, bytes: data.length };
      }
      db.prepare('UPDATE media SET width = ?, height = ?, size = ? WHERE id = ?').run(size.width, size.height, size.bytes, row.id);
    } catch (err) {
      log.warn?.(`Opios: ${row.file} could not be read: ${err.message}`);
      db.prepare('UPDATE media SET width = 0, height = 0 WHERE id = ?').run(row.id);
    }
  }
  return rows.length;
}

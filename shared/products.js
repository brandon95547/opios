// A brand's products in a newsletter: cards with a picture, the name, the version, a few words
// and a link, two or three to a row (one on a phone). Filled in when a message is sent, from the
// products in Settings › Brands, so a new version shows in the next email without editing it.
import { capsLink, esc, fluidGrid, safeHref } from './layout.js';

export const DEFAULT_PRODUCTS_BLOCK = { productIds: [], columns: 3, showVersions: true, showImages: true, linkLabel: 'Learn more' };

export const SAMPLE_PRODUCTS = [
  { id: -1, name: 'First product', version: '1.0', description: 'A sentence on what it does and who it’s for.', url: '#', image_url: '' },
  { id: -2, name: 'Second product', version: '2.3', description: 'A sentence on what it does and who it’s for.', url: '#', image_url: '' },
  { id: -3, name: 'Third product', version: '0.9', description: 'A sentence on what it does and who it’s for.', url: '#', image_url: '' },
];

// The products a block shows: the ones it names, in its order, or else all of them.
export function pickProducts(products, ids) {
  if (!ids?.length) return products;
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export function renderProductsHtml(products, options = {}) {
  if (!products?.length) return '';
  const o = { ...DEFAULT_PRODUCTS_BLOCK, ...options };
  const c = { heading: '#101828', text: '#344054', muted: '#667085', rule: '#e4e7ec', ...o.colors };
  const font = o.font || 'Arial, Helvetica, sans-serif';
  const headingFont = o.headingFont || font;
  const columns = o.columns === 2 ? 2 : 3;
  const grid = fluidGrid(products, { columns, gap: 20, align: 'center' }, (p, width) => {
    const picture = o.showImages && safeHref(p.image_url)
      ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;margin:0 0 14px">`
      : '';
    const version = o.showVersions && p.version ? `<p style="margin:0 0 10px;font-family:${font};font-size:14px;line-height:1.4;letter-spacing:2px;text-align:center;color:${c.muted}">${esc(/^v/i.test(p.version) ? p.version : `v${p.version}`)}</p>` : '';
    return `<div style="padding:0 0 28px">${picture}`
      + `<p style="margin:0 0 4px;font-family:${headingFont};font-size:19px;line-height:1.25;letter-spacing:1px;text-transform:uppercase;text-align:center;color:${c.heading}">${esc(p.name)}</p>`
      + version
      + (p.description ? `<p style="margin:0 0 14px;font-family:${font};font-size:15px;line-height:1.55;color:${c.text}">${esc(p.description)}</p>` : '')
      + (safeHref(p.url) ? `<p style="margin:0">${capsLink(p.url, o.linkLabel || 'Learn more', c.heading, font)}</p>` : '')
      + '</div>';
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 32px 0">${grid}</td></tr></table>`;
}

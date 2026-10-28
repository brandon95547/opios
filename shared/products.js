// A brand's products in a newsletter: a picture, the name, the version, a few words and a link.
// Either rows (the picture on the left, its words beside it, as the Cards block does) or a grid
// of two or three cards to a row; one to a row on a phone. Filled in when a message is sent, from
// the products in Settings › Brands, so a new version shows in the next email without editing it.
import { INNER, capsLink, esc, fluidGrid, safeHref, twoColumns } from './layout.js';

export const DEFAULT_PRODUCTS_BLOCK = { productIds: [], layout: 'rows', columns: 3, showVersions: true, showImages: true, linkLabel: 'Learn more' };

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
  const version = (p, align) => (o.showVersions && p.version ? `<p style="margin:0 0 10px;font-family:${font};font-size:13px;line-height:1.4;letter-spacing:2px;text-align:${align};color:${c.muted}">${esc(/^v/i.test(p.version) ? p.version : `v${p.version}`)}</p>` : '');
  const more = (p) => (safeHref(p.url) ? `<p style="margin:0">${capsLink(p.url, o.linkLabel || 'Learn more', c.heading, font)}</p>` : '');

  if (o.layout !== 'grid') {
    const PICTURE = 188;
    const rows = products.map((p) => {
      const words = `<p style="margin:0 0 2px;font-family:${headingFont};font-size:21px;line-height:1.2;letter-spacing:1px;text-transform:uppercase;color:${c.heading}">${esc(p.name)}</p>`
        + version(p, 'left')
        + (p.description ? `<p style="margin:0 0 12px;font-family:${font};font-size:15px;line-height:1.55;color:${c.text}">${esc(p.description)}</p>` : '')
        + more(p);
      // In the editor's preview, a product without a picture shows where its picture goes.
      const picture = o.showImages && safeHref(p.image_url)
        ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="${PICTURE}" style="display:block;width:100%;max-width:${PICTURE}px;height:auto;border:0;margin:0 0 12px">`
        : o.showImages && o.placeholders
          ? `<div style="height:110px;line-height:110px;margin:0 0 12px;background:#e6e6e2;text-align:center;font-family:Arial,sans-serif;font-size:14px;color:#8a8f98">Product picture</div>`
          : '';
      return `<div style="padding:0 0 22px">${picture ? twoColumns([PICTURE, picture], [INNER - PICTURE - 20, words]) : words}</div>`;
    }).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 32px 0">${rows}</td></tr></table>`;
  }

  const columns = o.columns === 2 ? 2 : 3;
  const grid = fluidGrid(products, { columns, gap: 20, align: 'center' }, (p, width) => {
    const picture = o.showImages && safeHref(p.image_url)
      ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;margin:0 0 14px">`
      : '';
    return `<div style="padding:0 0 28px">${picture}`
      + `<p style="margin:0 0 4px;font-family:${headingFont};font-size:19px;line-height:1.25;letter-spacing:1px;text-transform:uppercase;text-align:center;color:${c.heading}">${esc(p.name)}</p>`
      + version(p, 'center')
      + (p.description ? `<p style="margin:0 0 14px;font-family:${font};font-size:15px;line-height:1.55;color:${c.text}">${esc(p.description)}</p>` : '')
      + more(p)
      + '</div>';
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:8px 32px 0">${grid}</td></tr></table>`;
}

// Pieces of email HTML the dynamic blocks share (updates, products): escaping, safe links, and a
// grid whose columns sit side by side where there's room and stack on a phone. The grid is the
// "fluid hybrid" kind: inline-block columns for most mail apps, plus a table only Outlook for
// Windows reads (inside <!--[if mso]> comments), since it ignores inline-block.

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const safeHref = (url) => {
  const u = String(url || '').trim();
  return /^(https?:|mailto:)/i.test(u) || /^\{\{\s*[a-z_]+\s*\}\}$/.test(u) ? u : '';
};

// The width inside the email's side margins: 600 less 32 on each side.
export const INNER = 536;

// Items in `columns` columns, `gap` pixels apart. render(item, width) gives one item's HTML.
export function fluidGrid(items, { columns, gap = 24, align = 'left' }, render) {
  if (!items.length) return '';
  const n = Math.max(1, Math.min(columns, items.length));
  const width = Math.floor((INNER - gap * (n - 1)) / n);
  const rows = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  const cell = (item, i, count) => `<div class="ob-col" style="display:inline-block;width:100%;max-width:${width}px;vertical-align:top;font-size:16px;text-align:left${i < count - 1 ? `;margin-right:${gap}px` : ''}">${render(item, width)}</div>`;
  const body = rows.map((row) => {
    const outlookCells = row.map((item, i) => `${i ? '<!--[if mso]></td><td width="' + width + '" valign="top" style="padding-left:' + gap + 'px"><![endif]-->' : ''}${cell(item, i, row.length)}`).join('');
    return `<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}"><tr><td width="${width}" valign="top"><![endif]-->${outlookCells}<!--[if mso]></td></tr></table><![endif]-->`;
  }).join('');
  return `<div style="font-size:0;text-align:${align}">${body}</div>`;
}

// Two columns of set widths (a picture and its words, say), side by side where there's room
// and stacked on a phone, with Outlook's table around them.
export function twoColumns([leftWidth, leftHtml], [rightWidth, rightHtml], gap = 20) {
  const col = (width, html, last) => `<div class="ob-col" style="display:inline-block;width:100%;max-width:${width}px;vertical-align:top;font-size:16px;text-align:left${last ? '' : `;margin-right:${gap}px`}">${html}</div>`;
  return `<div style="font-size:0;text-align:left"><!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="${leftWidth}" valign="top"><![endif]-->`
    + col(leftWidth, leftHtml, false)
    + `<!--[if mso]></td><td width="${rightWidth}" valign="top" style="padding-left:${gap}px"><![endif]-->`
    + col(rightWidth, rightHtml, true)
    + '<!--[if mso]></td></tr></table><![endif]--></div>';
}

// A thin line across, made of a border so every mail app draws it the same.
export const line = (color, margin = '0') => `<div style="border-top:1px solid ${color};font-size:1px;line-height:1px;margin:${margin}">&nbsp;</div>`;

// "READ MORE →": small capitals with a line under them.
export const capsLink = (href, label, color, font) => `<a href="${esc(href)}" style="font-family:${font};font-size:13px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:${color};text-decoration:none;border-bottom:1px solid ${color};padding-bottom:2px">${esc(label)}&nbsp;&rarr;</a>`;

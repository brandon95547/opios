// Product updates in a newsletter: which ones go in, and the HTML they're shown with. The browser
// uses this for previews and the server for sending, so the preview matches what goes out.

export const KINDS = { new: 'New', improved: 'Improved', fixed: 'Fixed' };

export const DEFAULT_UPDATES_BLOCK = { title: 'What’s new', limit: 5, showDates: true, showProducts: true, showImages: true };

export const SAMPLE_UPDATES = [
  { id: -1, kind: 'new', product_name: 'Your product', title: 'A new feature, in a few words', body: 'One or two sentences on what changed and why it helps.', link: '#', image_url: '', happened_at: new Date().toISOString() },
  { id: -2, kind: 'improved', product_name: 'Another product', title: 'Something that got better', body: 'What is faster, clearer or easier now.', link: '', image_url: '', happened_at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
];

// In automatic mode: the newest published updates that no earlier newsletter of the brand carried.
export function autoUpdates(candidates, limit = DEFAULT_UPDATES_BLOCK.limit) {
  return candidates
    .filter((u) => u.status === 'published' && !u.sent)
    .sort((a, b) => b.happened_at.localeCompare(a.happened_at) || b.id - a.id)
    .slice(0, Math.max(1, limit));
}

// In "choose" mode: the chosen ones, in the chosen order (any since deleted are dropped).
export function pickedUpdates(candidates, ids) {
  const byId = new Map(candidates.map((u) => [u.id, u]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export const selectUpdates = (candidates, { mode, ids, limit }) => (mode === 'pick' ? pickedUpdates(candidates, ids) : autoUpdates(candidates, limit));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeHref = (url) => (/^(https?:|mailto:)/i.test(String(url || '').trim()) ? String(url).trim() : '');

export function formatDay(iso, timeZone) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timeZone || undefined });
  } catch {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// The updates as email HTML: a table, styles on each tag, about 600 pixels wide, as every mail
// app (Outlook included) lays it out. Nothing at all when there are no updates.
export function renderUpdatesHtml(updates, options = {}) {
  if (!updates?.length) return '';
  const o = { ...DEFAULT_UPDATES_BLOCK, ...options };
  const c = { heading: '#101828', text: '#344054', muted: '#667085', accent: '#2f6fed', rule: '#e4e7ec', ...o.colors };
  const font = o.font || 'Arial, Helvetica, sans-serif';
  const rows = updates.map((u, i) => {
    const href = safeHref(u.link);
    const meta = [
      `<span style="color:${c.accent};font-weight:bold;text-transform:uppercase;letter-spacing:0.04em">${esc(KINDS[u.kind] || 'New')}</span>`,
      o.showProducts && u.product_name ? esc(u.product_name) : '',
      o.showDates && u.happened_at ? esc(formatDay(u.happened_at, o.timeZone)) : '',
    ].filter(Boolean).join(' &middot; ');
    const image = o.showImages && safeHref(u.image_url)
      ? `<img src="${esc(u.image_url)}" alt="${esc(u.title)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:6px;margin:0 0 12px">`
      : '';
    const title = href
      ? `<a href="${esc(href)}" style="color:${c.heading};text-decoration:none">${esc(u.title)}</a>`
      : esc(u.title);
    return `<tr><td style="padding:16px 32px;${i ? `border-top:1px solid ${c.rule};` : ''}font-family:${font}">`
      + (image && href ? `<a href="${esc(href)}">${image}</a>` : image)
      + `<p style="margin:0 0 6px;font-size:13px;line-height:1.4;color:${c.muted}">${meta}</p>`
      + `<p style="margin:0 0 6px;font-size:18px;line-height:1.35;font-weight:bold;color:${c.heading}">${title}</p>`
      + (u.body ? `<p style="margin:0;font-size:15px;line-height:1.6;color:${c.text}">${esc(u.body).replace(/\r?\n/g, '<br>')}</p>` : '')
      + (href ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.4"><a href="${esc(href)}" style="color:${c.accent};font-weight:bold;text-decoration:none">Learn more &rarr;</a></p>` : '')
      + '</td></tr>';
  }).join('');
  const heading = o.title
    ? `<tr><td style="padding:24px 32px 4px;font-family:${font};font-size:21px;line-height:1.3;font-weight:bold;color:${c.heading}">${esc(o.title)}</td></tr>`
    : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">${heading}${rows}</table>`;
}

// Visual templates: a design is a list of blocks (header, text, picture, button, updates…) and
// a few colors. It becomes MJML here, and MJML turns it into email HTML: tables, styles on each
// tag, and the extra markup Outlook needs. The browser does this for the live preview
// (mjml-browser) and the server when a template is saved (mjml), from this same code.
//
// The result is an ordinary template: {{content}} is where each message goes, {{updates}} where
// its product updates go, and the other {{tags}} are filled in for each reader.

import { DEFAULT_UPDATES_BLOCK } from './updates.js';

export const BLOCK_TYPES = {
  header: 'Header',
  text: 'Text',
  content: 'Message',
  updates: 'Updates',
  image: 'Picture',
  button: 'Button',
  columns: 'Two columns',
  divider: 'Divider line',
  spacer: 'Space',
  footer: 'Footer',
};

export const DEFAULT_SETTINGS = {
  background: '#f2f4f7',
  contentBackground: '#ffffff',
  textColor: '#344054',
  headingColor: '#101828',
  mutedColor: '#667085',
  accent: 'brand',
  font: 'Arial, Helvetica, sans-serif',
};

export const FONTS = {
  'Arial, Helvetica, sans-serif': 'Arial',
  "'Helvetica Neue', Helvetica, Arial, sans-serif": 'Helvetica',
  'Verdana, Geneva, sans-serif': 'Verdana',
  "'Trebuchet MS', Tahoma, sans-serif": 'Trebuchet',
  "Georgia, 'Times New Roman', serif": 'Georgia',
  "'Times New Roman', Times, serif": 'Times',
};

const DEFAULTS = {
  header: { text: '{{brand_heading}}', logo: true, align: 'center', background: 'brand', color: '#ffffff', size: 26, padding: 32 },
  text: { html: '<p>Write something here.</p>', align: 'left', padding: 16 },
  content: { padding: 16 },
  updates: { ...DEFAULT_UPDATES_BLOCK },
  image: { src: '', alt: '', href: '', width: 0, align: 'center', padding: 16 },
  button: { text: 'Learn more', href: '', background: 'brand', color: '#ffffff', align: 'center', radius: 6, padding: 16 },
  columns: { left: '<p>The left column.</p>', right: '<p>The right column.</p>', leftImage: '', rightImage: '', padding: 16 },
  divider: { color: '#e4e7ec', thickness: 1, padding: 16 },
  spacer: { height: 24 },
  footer: { html: '<p>You’re getting this because you subscribed to {{brand_heading}}.<br>{{address}}</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>', padding: 24 },
};

const newId = () => Math.random().toString(36).slice(2, 10);

export const newBlock = (type) => ({ id: newId(), type, ...structuredClone(DEFAULTS[type]) });

export const STARTER_DESIGNS = {
  updates: {
    name: 'Product updates',
    design: {
      settings: { ...DEFAULT_SETTINGS },
      blocks: [
        { ...newBlock('header') },
        { ...newBlock('content') },
        { ...newBlock('updates') },
        { ...newBlock('divider') },
        { ...newBlock('footer') },
      ],
    },
  },
};

const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const color = (value, fallback) => (value === 'brand' || HEX.test(value || '') ? value : fallback);
const num = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const str = (value, max, fallback = '') => (typeof value === 'string' ? value.slice(0, max) : fallback);
const align = (value) => (['left', 'center', 'right'].includes(value) ? value : 'center');

// A design as sent by the editor, cleaned: unknown blocks dropped, every field in range.
export function normalizeDesign(input) {
  const s = { ...DEFAULT_SETTINGS, ...(input?.settings || {}) };
  const settings = {
    background: color(s.background, DEFAULT_SETTINGS.background),
    contentBackground: color(s.contentBackground, DEFAULT_SETTINGS.contentBackground),
    textColor: color(s.textColor, DEFAULT_SETTINGS.textColor),
    headingColor: color(s.headingColor, DEFAULT_SETTINGS.headingColor),
    mutedColor: color(s.mutedColor, DEFAULT_SETTINGS.mutedColor),
    accent: color(s.accent, 'brand'),
    font: s.font in FONTS ? s.font : DEFAULT_SETTINGS.font,
  };
  const blocks = (Array.isArray(input?.blocks) ? input.blocks : []).slice(0, 60).filter((b) => b && b.type in DEFAULTS).map((b) => {
    const d = DEFAULTS[b.type];
    const block = { id: /^[a-z0-9]{4,16}$/.test(b.id) ? b.id : newId(), type: b.type };
    switch (b.type) {
      case 'header': return { ...block, text: str(b.text, 200, d.text), logo: b.logo !== false, align: align(b.align), background: color(b.background, d.background), color: color(b.color, d.color), size: num(b.size, 16, 48, d.size), padding: num(b.padding, 0, 80, d.padding) };
      case 'text': return { ...block, html: str(b.html, 50_000, d.html), align: align(b.align === undefined ? 'left' : b.align), padding: num(b.padding, 0, 80, d.padding) };
      case 'content': return { ...block, padding: num(b.padding, 0, 80, d.padding) };
      case 'updates': return { ...block, title: str(b.title, 120, d.title), limit: num(b.limit, 1, 20, d.limit), showDates: b.showDates !== false, showProducts: b.showProducts !== false, showImages: b.showImages !== false };
      case 'image': return { ...block, src: str(b.src, 2000), alt: str(b.alt, 300), href: str(b.href, 2000), width: num(b.width, 0, 600, 0), align: align(b.align), padding: num(b.padding, 0, 80, d.padding) };
      case 'button': return { ...block, text: str(b.text, 120, d.text), href: str(b.href, 2000), background: color(b.background, d.background), color: color(b.color, d.color), align: align(b.align), radius: num(b.radius, 0, 30, d.radius), padding: num(b.padding, 0, 80, d.padding) };
      case 'columns': return { ...block, left: str(b.left, 20_000, d.left), right: str(b.right, 20_000, d.right), leftImage: str(b.leftImage, 2000), rightImage: str(b.rightImage, 2000), padding: num(b.padding, 0, 80, d.padding) };
      case 'divider': return { ...block, color: color(b.color, d.color), thickness: num(b.thickness, 1, 8, d.thickness), padding: num(b.padding, 0, 80, d.padding) };
      case 'spacer': return { ...block, height: num(b.height, 4, 120, d.height) };
      case 'footer': return { ...block, html: str(b.html, 20_000, d.html), padding: num(b.padding, 0, 80, d.padding) };
      default: return null;
    }
  }).filter(Boolean);
  return { settings, blocks };
}

const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (url) => (/^(https?:|mailto:|tel:|#|\{\{)/i.test(String(url || '').trim()) ? String(url).trim() : '');

// The updates block's settings and colors, for renderUpdatesHtml.
export function updatesOptions(design, brand) {
  const d = normalizeDesign(design);
  const block = d.blocks.find((b) => b.type === 'updates') || DEFAULT_UPDATES_BLOCK;
  const accent = d.settings.accent === 'brand' ? brand?.color || '#2f6fed' : d.settings.accent;
  return {
    title: block.title,
    limit: block.limit,
    showDates: block.showDates,
    showProducts: block.showProducts,
    showImages: block.showImages,
    font: d.settings.font,
    colors: { heading: d.settings.headingColor, text: d.settings.textColor, muted: d.settings.mutedColor, accent, rule: '#e4e7ec' },
  };
}

// A design as MJML. With preview on, empty pictures show as a gray box to click, and every
// block carries a class (obk-<id>) the editor uses to find it.
export function designToMjml(design, { brand, preview = false } = {}) {
  const { settings: s, blocks } = normalizeDesign(design);
  const brandColor = HEX.test(brand?.color || '') ? brand.color : '#2f6fed';
  const paint = (value) => (value === 'brand' ? brandColor : value);
  const accent = paint(s.accent);
  const section = (b, inner, { background = s.contentBackground, padding = 0 } = {}) => `<mj-section css-class="ob obk-${b.id}" background-color="${attr(background)}" padding="${padding}px 0">${inner}</mj-section>`;
  const placeholder = (label) => `<mj-text align="center" color="#98a2b3" font-size="14px" padding="24px 32px" container-background-color="#eef0f3">${text(label)}</mj-text>`;

  const parts = blocks.map((b) => {
    switch (b.type) {
      case 'header': {
        const logo = b.logo && link(brand?.logo_url) ? `<mj-image src="${attr(brand.logo_url)}" alt="${attr(brand.name || '')}" width="180px" align="${b.align}" padding="0 0 12px" />` : '';
        return section(b, `<mj-column background-color="${attr(paint(b.background))}" padding="${b.padding}px 32px">${logo}<mj-text align="${b.align}" color="${attr(paint(b.color))}" font-size="${b.size}px" font-weight="bold" line-height="1.25" padding="0">${text(b.text)}</mj-text></mj-column>`);
      }
      case 'text':
        return section(b, `<mj-column><mj-text css-class="ob-rich" align="${b.align}">${b.html}</mj-text></mj-column>`, { padding: b.padding });
      case 'content':
        return section(b, '<mj-column><mj-text css-class="ob-rich content">{{content}}</mj-text></mj-column>', { padding: b.padding });
      case 'updates':
        return section(b, '<mj-column><mj-text padding="0">{{updates}}</mj-text></mj-column>');
      case 'image': {
        if (!link(b.src)) return preview ? section(b, `<mj-column>${placeholder('Picture: choose one in the block’s settings')}</mj-column>`, { padding: b.padding }) : '';
        const width = b.width ? ` width="${b.width}px"` : '';
        const href = link(b.href) ? ` href="${attr(link(b.href))}"` : '';
        return section(b, `<mj-column><mj-image src="${attr(b.src)}" alt="${attr(b.alt)}"${href}${width} align="${b.align}" padding="0 32px" /></mj-column>`, { padding: b.padding });
      }
      case 'button':
        return section(b, `<mj-column><mj-button href="${attr(link(b.href) || '#')}" background-color="${attr(paint(b.background))}" color="${attr(paint(b.color))}" align="${b.align}" border-radius="${b.radius}px" font-size="16px" font-weight="bold" inner-padding="12px 26px" padding="0 32px">${text(b.text)}</mj-button></mj-column>`, { padding: b.padding });
      case 'columns': {
        const col = (html, image, side) => {
          const img = link(image) ? `<mj-image src="${attr(image)}" alt="" padding="${side === 'left' ? '0 12px 12px 32px' : '0 32px 12px 12px'}" />` : '';
          return `<mj-column>${img}<mj-text css-class="ob-rich" padding="${side === 'left' ? '0 12px 0 32px' : '0 32px 0 12px'}">${html}</mj-text></mj-column>`;
        };
        return section(b, col(b.left, b.leftImage, 'left') + col(b.right, b.rightImage, 'right'), { padding: b.padding });
      }
      case 'divider':
        return section(b, `<mj-column><mj-divider border-color="${attr(b.color)}" border-width="${b.thickness}px" padding="0 32px" /></mj-column>`, { padding: b.padding });
      case 'spacer':
        return section(b, `<mj-column><mj-spacer height="${b.height}px" /></mj-column>`);
      case 'footer':
        return section(b, `<mj-column><mj-text css-class="ob-rich ob-footer" align="center" color="${attr(s.mutedColor)}" font-size="13px" line-height="1.6">${b.html}</mj-text></mj-column>`, { background: s.background, padding: b.padding });
      default:
        return '';
    }
  }).join('\n');

  return `<mjml>
<mj-head>
  <mj-title>{{subject}}</mj-title>
  <mj-attributes>
    <mj-all font-family="${attr(s.font)}" />
    <mj-text font-size="16px" line-height="1.6" color="${attr(s.textColor)}" padding="0 32px" />
    <mj-section padding="0" />
    <mj-column padding="0" />
  </mj-attributes>
  <mj-style>
    .ob-rich p { margin: 0 0 16px; }
    .ob-rich p:last-child { margin-bottom: 0; }
    .ob-rich h1 { margin: 8px 0 12px; font-size: 28px; line-height: 1.25; color: ${s.headingColor}; }
    .ob-rich h2 { margin: 8px 0 10px; font-size: 22px; line-height: 1.3; color: ${s.headingColor}; }
    .ob-rich h3 { margin: 8px 0 8px; font-size: 18px; line-height: 1.35; color: ${s.headingColor}; }
    .ob-rich a { color: ${accent}; }
    .ob-rich img { max-width: 100%; height: auto; border: 0; }
    .ob-rich ul, .ob-rich ol { margin: 0 0 16px; padding-left: 24px; }
    .ob-rich li { margin: 0 0 6px; }
    .ob-rich li p { margin: 0; }
    .ob-rich blockquote { margin: 0 0 16px; padding: 2px 0 2px 16px; border-left: 3px solid #d0d5dd; font-style: italic; }
    .ob-rich hr { border: 0; border-top: 1px solid #e4e7ec; margin: 20px 0; }
    .ob-footer a { color: ${s.mutedColor}; }
  </mj-style>
</mj-head>
<mj-body background-color="${attr(s.background)}" width="600px">
  <mj-raw><div data-preheader style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">{{preheader}}</div></mj-raw>
  <mj-wrapper padding="24px 0">
${parts}
  </mj-wrapper>
</mj-body>
</mjml>`;
}

// A design ready to use has exactly one place for the message.
export const designProblem = (design) => {
  const n = normalizeDesign(design).blocks.filter((b) => b.type === 'content').length;
  if (n === 0) return 'A template needs a Message block, where each message goes.';
  if (n > 1) return 'A template can have only one Message block.';
  return '';
};

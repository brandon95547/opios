// Visual templates: a design is a list of blocks (masthead, text, picture, button, updates,
// products…) and a few colors and fonts. It becomes MJML here, and MJML turns it into email HTML:
// a 600-pixel layout of tables, styles on each tag, and the extra markup Outlook for Windows needs.
// The browser does this for the live preview (mjml-browser) and the server when a template is
// saved (mjml), from this same code.
//
// The result is an ordinary template: {{content}} is where each message goes, {{updates}} and
// {{products}} where those go when it's sent, and the other {{tags}} are filled in for each reader.

import { DEFAULT_UPDATES_BLOCK } from './updates.js';
import { DEFAULT_PRODUCTS_BLOCK } from './products.js';

export const BLOCK_TYPES = {
  masthead: 'Masthead',
  header: 'Header',
  section: 'Section heading',
  text: 'Text',
  content: 'Message',
  updates: 'Updates',
  products: 'Products',
  cards: 'Cards',
  callout: 'Callout',
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
  ruleColor: '#e4e7ec',
  accent: 'brand',
  font: 'Arial, Helvetica, sans-serif',
  headingFont: '',
};

// Fonts every computer and phone has, and web fonts that mail apps able to load them show (Apple
// Mail, iOS, many Android apps); the rest, Gmail among them, show the font named after them.
export const FONTS = {
  'Arial, Helvetica, sans-serif': 'Arial',
  "'Helvetica Neue', Helvetica, Arial, sans-serif": 'Helvetica',
  'Verdana, Geneva, sans-serif': 'Verdana',
  "'Trebuchet MS', Tahoma, sans-serif": 'Trebuchet',
  "Georgia, 'Times New Roman', serif": 'Georgia',
  "'Times New Roman', Times, serif": 'Times',
  "'Cormorant Garamond', Georgia, 'Times New Roman', serif": 'Cormorant Garamond (web font; Georgia where it can’t load)',
};

const WEB_FONTS = {
  'Cormorant Garamond': 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
};

const DEFAULTS = {
  masthead: { eyebrow: 'News ✦ Ideas ✦ Updates', image: '', imageWidth: 520, title: '{{brand_name}}', tagline: '{{brand_heading}}', size: 60, padding: 28 },
  header: { text: '{{brand_heading}}', logo: true, align: 'center', background: 'brand', color: '#ffffff', size: 26, padding: 32 },
  section: { title: 'Latest updates', tagline: 'News ✦ Features ✦ Improvements', rule: true, padding: 20 },
  text: { html: '<p>Write something here.</p>', align: 'left', padding: 16 },
  content: { padding: 16 },
  updates: { ...DEFAULT_UPDATES_BLOCK },
  products: { ...DEFAULT_PRODUCTS_BLOCK },
  cards: {
    items: [
      { title: 'Something new', eyebrow: 'Coming soon', text: 'A sentence or two about what’s on the way.', footnote: 'Est. release: soon', image: '', href: '' },
    ],
    padding: 8,
  },
  callout: { image: '', title: 'Support our mission', html: '<p>A sentence or two on why it matters, and what support makes possible.</p>', buttonText: 'Make a contribution', buttonHref: '', padding: 28 },
  image: { src: '', alt: '', href: '', width: 0, align: 'center', padding: 16 },
  button: { text: 'Learn more', href: '', background: 'brand', color: '#ffffff', align: 'center', radius: 6, padding: 16 },
  columns: { left: '<p>The left column.</p>', right: '<p>The right column.</p>', leftImage: '', rightImage: '', padding: 16 },
  divider: { color: '#e4e7ec', thickness: 1, padding: 16 },
  spacer: { height: 24 },
  footer: {
    style: 'text',
    html: '<p>You’re getting this because you subscribed to {{brand_heading}}.<br>{{address}}</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
    logo: '',
    ornament: '',
    links: [{ label: 'Visit our website', url: '{{brand_url}}' }, { label: 'Unsubscribe', url: '{{unsubscribe_url}}' }],
    padding: 24,
  },
};

const newId = () => Math.random().toString(36).slice(2, 10);

export const newBlock = (type) => ({ id: newId(), type, ...structuredClone(DEFAULTS[type]) });
const block = (type, patch = {}) => ({ ...newBlock(type), ...patch });

const CLASSIC_SETTINGS = {
  background: '#f6f5f1',
  contentBackground: '#f6f5f1',
  textColor: '#2b2b2b',
  headingColor: '#111111',
  mutedColor: '#5f5f5f',
  ruleColor: '#1a1a1a',
  accent: '#111111',
  font: "Georgia, 'Times New Roman', serif",
  headingFont: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
};

export const STARTER_DESIGNS = {
  classic: {
    name: 'Classic',
    design: {
      settings: CLASSIC_SETTINGS,
      blocks: [
        block('masthead'),
        block('section', { title: 'Latest updates', tagline: 'News ✦ Features ✦ Improvements', rule: false }),
        block('content', { padding: 8 }),
        block('updates', { title: '', layout: 'featured', limit: 3, showProducts: false }),
        block('section', { title: 'Our products', tagline: 'What we make' }),
        block('products'),
        block('section', { title: 'Coming soon', tagline: 'On the horizon' }),
        block('cards', {
          items: [
            { title: 'Something new', eyebrow: 'A new tool', text: 'A sentence or two about what’s on the way.', footnote: 'Est. release: soon', image: '', href: '' },
            { title: 'More features', eyebrow: 'Coming to a product', text: 'What you’re adding, and what it will let people do.', footnote: 'Details coming soon', image: '', href: '' },
          ],
        }),
        block('callout'),
        block('footer', {
          style: 'links',
          html: '<p>© {{year}} {{brand_name}}. All rights reserved.<br>{{address}}</p>',
          links: [{ label: 'Visit our website', url: '{{brand_url}}' }, { label: 'Unsubscribe', url: '{{unsubscribe_url}}' }],
        }),
      ],
    },
  },
  updates: {
    name: 'Product updates',
    design: {
      settings: { ...DEFAULT_SETTINGS },
      blocks: [block('header'), block('content'), block('updates'), block('divider'), block('footer')],
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
const font = (value, fallback) => (value in FONTS ? value : fallback);
const idList = (value) => (Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 30) : []);

// A design as sent by the editor, cleaned: unknown blocks dropped, every field in range.
export function normalizeDesign(input) {
  const s = { ...DEFAULT_SETTINGS, ...(input?.settings || {}) };
  const settings = {
    background: color(s.background, DEFAULT_SETTINGS.background),
    contentBackground: color(s.contentBackground, DEFAULT_SETTINGS.contentBackground),
    textColor: color(s.textColor, DEFAULT_SETTINGS.textColor),
    headingColor: color(s.headingColor, DEFAULT_SETTINGS.headingColor),
    mutedColor: color(s.mutedColor, DEFAULT_SETTINGS.mutedColor),
    ruleColor: color(s.ruleColor, DEFAULT_SETTINGS.ruleColor),
    accent: color(s.accent, 'brand'),
    font: font(s.font, DEFAULT_SETTINGS.font),
    headingFont: s.headingFont ? font(s.headingFont, '') : '',
  };
  const blocks = (Array.isArray(input?.blocks) ? input.blocks : []).slice(0, 60).filter((b) => b && b.type in DEFAULTS).map((b) => {
    const d = DEFAULTS[b.type];
    const base = { id: /^[a-z0-9]{4,16}$/.test(b.id) ? b.id : newId(), type: b.type };
    const padding = num(b.padding, 0, 80, d.padding);
    switch (b.type) {
      case 'masthead': return { ...base, eyebrow: str(b.eyebrow, 120), image: str(b.image, 2000), imageWidth: num(b.imageWidth, 120, 536, d.imageWidth), title: str(b.title, 80, d.title), tagline: str(b.tagline, 120), size: num(b.size, 24, 80, d.size), padding };
      case 'header': return { ...base, text: str(b.text, 200, d.text), logo: b.logo !== false, align: align(b.align), background: color(b.background, d.background), color: color(b.color, d.color), size: num(b.size, 16, 48, d.size), padding };
      case 'section': return { ...base, title: str(b.title, 60, d.title), tagline: str(b.tagline, 80), rule: b.rule !== false, padding };
      case 'text': return { ...base, html: str(b.html, 50_000, d.html), align: align(b.align === undefined ? 'left' : b.align), padding };
      case 'content': return { ...base, padding };
      case 'updates': return { ...base, title: str(b.title, 120, d.title), limit: num(b.limit, 1, 20, d.limit), showDates: b.showDates !== false, showProducts: b.showProducts !== false, showImages: b.showImages !== false, layout: b.layout === 'featured' ? 'featured' : 'list', linkLabel: str(b.linkLabel, 40, d.linkLabel) || d.linkLabel };
      case 'products': return { ...base, productIds: idList(b.productIds), columns: b.columns === 2 ? 2 : 3, showVersions: b.showVersions !== false, showImages: b.showImages !== false, linkLabel: str(b.linkLabel, 40, d.linkLabel) || d.linkLabel };
      case 'cards': return {
        ...base,
        items: (Array.isArray(b.items) ? b.items : []).slice(0, 8).map((i) => ({
          title: str(i?.title, 120), eyebrow: str(i?.eyebrow, 80), text: str(i?.text, 1000), footnote: str(i?.footnote, 120), image: str(i?.image, 2000), href: str(i?.href, 2000),
        })),
        padding,
      };
      case 'callout': return { ...base, image: str(b.image, 2000), title: str(b.title, 120, d.title), html: str(b.html, 20_000, d.html), buttonText: str(b.buttonText, 80, d.buttonText), buttonHref: str(b.buttonHref, 2000), padding };
      case 'image': return { ...base, src: str(b.src, 2000), alt: str(b.alt, 300), href: str(b.href, 2000), width: num(b.width, 0, 600, 0), align: align(b.align), padding };
      case 'button': return { ...base, text: str(b.text, 120, d.text), href: str(b.href, 2000), background: color(b.background, d.background), color: color(b.color, d.color), align: align(b.align), radius: num(b.radius, 0, 30, d.radius), padding };
      case 'columns': return { ...base, left: str(b.left, 20_000, d.left), right: str(b.right, 20_000, d.right), leftImage: str(b.leftImage, 2000), rightImage: str(b.rightImage, 2000), padding };
      case 'divider': return { ...base, color: color(b.color, d.color), thickness: num(b.thickness, 1, 8, d.thickness), padding };
      case 'spacer': return { ...base, height: num(b.height, 4, 120, d.height) };
      case 'footer': return {
        ...base,
        style: b.style === 'links' ? 'links' : 'text',
        html: str(b.html, 20_000, d.html),
        logo: str(b.logo, 2000),
        ornament: str(b.ornament, 2000),
        links: (Array.isArray(b.links) ? b.links : d.links).slice(0, 6).map((l) => ({ label: str(l?.label, 40), url: str(l?.url, 2000) })),
        padding,
      };
      default: return null;
    }
  }).filter(Boolean);
  return { settings, blocks };
}

const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const text = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (url) => (/^(https?:|mailto:|tel:|#|\{\{)/i.test(String(url || '').trim()) ? String(url).trim() : '');

// The colors and fonts the dynamic blocks are drawn in, from the design and the brand.
function theme(d, brand) {
  const accent = d.settings.accent === 'brand' ? brand?.color || '#2f6fed' : d.settings.accent;
  return {
    font: d.settings.font,
    headingFont: d.settings.headingFont || d.settings.font,
    colors: { heading: d.settings.headingColor, text: d.settings.textColor, muted: d.settings.mutedColor, accent, rule: d.settings.ruleColor },
  };
}

// The updates block's settings, colors and fonts, for renderUpdatesHtml.
export function updatesOptions(design, brand) {
  const d = normalizeDesign(design);
  const b = d.blocks.find((x) => x.type === 'updates') || DEFAULT_UPDATES_BLOCK;
  return { title: b.title, limit: b.limit, showDates: b.showDates, showProducts: b.showProducts, showImages: b.showImages, layout: b.layout, linkLabel: b.linkLabel, ...theme(d, brand) };
}

// The products block's settings, colors and fonts, for renderProductsHtml.
export function productsOptions(design, brand) {
  const d = normalizeDesign(design);
  const b = d.blocks.find((x) => x.type === 'products') || DEFAULT_PRODUCTS_BLOCK;
  return { productIds: b.productIds, columns: b.columns, showVersions: b.showVersions, showImages: b.showImages, linkLabel: b.linkLabel, ...theme(d, brand) };
}

// A design as MJML. With preview on, empty pictures show as gray boxes to click, and every
// block carries a class (obk-<id>) the editor uses to find it.
export function designToMjml(design, { brand, preview = false } = {}) {
  const { settings: s, blocks } = normalizeDesign(design);
  const brandColor = HEX.test(brand?.color || '') ? brand.color : '#2f6fed';
  const paint = (value) => (value === 'brand' ? brandColor : value);
  const accent = paint(s.accent);
  const headingFont = s.headingFont || s.font;
  const rule = (margin = '0') => `<div style="border-top:1px solid ${s.ruleColor};font-size:1px;line-height:1px;margin:${margin}">&nbsp;</div>`;
  const caps = (size, spacing) => `font-size:${size}px;letter-spacing:${spacing}px;text-transform:uppercase`;
  const section = (b, inner, { background = s.contentBackground, padding = 0, bottom = padding } = {}) => `<mj-section css-class="ob obk-${b.id}" background-color="${attr(background)}" padding="${padding}px 0 ${bottom}px">${inner}</mj-section>`;
  const placeholder = (label, height = 120) => `<mj-text align="center" color="#8a8f98" font-size="14px" line-height="1.4" padding="${Math.max(12, Math.round(height / 2) - 12)}px 16px" container-background-color="#e6e6e2">${text(label)}</mj-text>`;
  const picture = (src, { alt = '', width, padding = '0 32px', href = '', label = 'Picture', height } = {}) => {
    if (link(src)) return `<mj-image src="${attr(src)}" alt="${attr(alt)}"${width ? ` width="${width}px"` : ''}${link(href) ? ` href="${attr(link(href))}"` : ''} padding="${padding}" />`;
    return preview ? placeholder(label, height).replace('<mj-text ', `<mj-text css-class="ob-placeholder" `) : '';
  };

  const parts = blocks.map((b) => {
    switch (b.type) {
      case 'masthead': {
        const eyebrow = b.eyebrow
          ? `<mj-text align="center" color="${attr(s.textColor)}" padding="0 32px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="18%" valign="middle">${rule()}</td><td align="center" style="padding:0 12px;font-family:${s.font};${caps(13, 4)};color:${s.textColor}">${text(b.eyebrow)}</td><td width="18%" valign="middle">${rule()}</td></tr></table></mj-text>`
          : '';
        const mark = link(b.image)
          ? `<mj-image src="${attr(b.image)}" alt="${attr(b.title || '{{brand_name}}')}" width="${b.imageWidth}px" padding="0 32px" />`
          : `<mj-text align="center" font-family="${attr(headingFont)}" color="${attr(s.headingColor)}" font-size="${b.size}px" line-height="1.05" letter-spacing="3px" text-transform="uppercase" padding="0 32px" css-class="ob-masthead-title">${text(b.title)}</mj-text>`;
        const tagline = b.tagline
          ? `<mj-text align="center" color="${attr(s.textColor)}" padding="10px 32px 0"><span style="font-family:${s.font};${caps(13, 5)}">${text(b.tagline)}</span></mj-text>`
          : '';
        return section(b, `<mj-column>${eyebrow}${mark}${tagline}<mj-divider border-color="${attr(s.ruleColor)}" border-width="1px" padding="22px 32px 0" /></mj-column>`, { padding: b.padding, bottom: 0 });
      }
      case 'header': {
        const logo = b.logo && link(brand?.logo_url) ? `<mj-image src="${attr(brand.logo_url)}" alt="${attr(brand.name || '')}" width="180px" align="${b.align}" padding="0 0 12px" />` : '';
        return section(b, `<mj-column background-color="${attr(paint(b.background))}" padding="${b.padding}px 32px">${logo}<mj-text align="${b.align}" color="${attr(paint(b.color))}" font-family="${attr(headingFont)}" font-size="${b.size}px" font-weight="bold" line-height="1.25" padding="0">${text(b.text)}</mj-text></mj-column>`);
      }
      case 'section': {
        // A short tagline sits on the line beside the heading; a longer one, which wouldn't fit
        // in 600 pixels, goes under the line at the right. Phones leave it out.
        const inline = b.tagline && b.title.length + b.tagline.length <= 30;
        const tag = `font-family:${s.font};${caps(13, 2)};color:${s.textColor}`;
        const cells = `<td class="ob-section-title" valign="middle" style="white-space:nowrap;padding-right:14px;font-family:${headingFont};font-size:28px;line-height:1.1;letter-spacing:3px;text-transform:uppercase;color:${s.headingColor}">${text(b.title)}</td>`
          + `<td class="ob-hide-small" width="100%" valign="middle">${rule()}</td>`
          + (inline ? `<td class="ob-hide-small" align="right" valign="middle" style="white-space:nowrap;padding-left:14px;${tag}">${text(b.tagline)}</td>` : '');
        const below = b.tagline && !inline ? `<p class="ob-hide-small" style="margin:8px 0 0;text-align:right;${tag}">${text(b.tagline)}</p>` : '';
        const top = b.rule ? `<mj-divider border-color="${attr(s.ruleColor)}" border-width="1px" padding="0 32px 18px" />` : '';
        return section(b, `<mj-column>${top}<mj-text padding="0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>${below}</mj-text></mj-column>`, { padding: b.padding, bottom: 8 });
      }
      case 'text':
        return section(b, `<mj-column><mj-text css-class="ob-rich" align="${b.align}">${b.html}</mj-text></mj-column>`, { padding: b.padding });
      case 'content':
        return section(b, '<mj-column><mj-text css-class="ob-rich content">{{content}}</mj-text></mj-column>', { padding: b.padding });
      case 'updates':
        return section(b, '<mj-column><mj-text padding="0">{{updates}}</mj-text></mj-column>');
      case 'products':
        return section(b, '<mj-column><mj-text padding="0">{{products}}</mj-text></mj-column>');
      case 'cards':
        return b.items.map((item, i) => {
          const words = `${item.title ? `<p style="margin:0 0 2px;font-family:${headingFont};font-size:21px;line-height:1.2;letter-spacing:1px;text-transform:uppercase;color:${s.headingColor}">${text(item.title)}</p>` : ''}`
            + `${item.eyebrow ? `<p style="margin:0 0 8px;font-family:${s.font};${caps(13, 2)};color:${s.mutedColor}">${text(item.eyebrow)}</p>` : ''}`
            + `${item.text ? `<p style="margin:0 0 10px;font-family:${s.font};font-size:15px;line-height:1.55;color:${s.textColor}">${text(item.text).replace(/\r?\n/g, '<br>')}</p>` : ''}`
            + `${item.footnote ? `<p style="margin:0"><span style="font-family:${s.font};${caps(13, 2)};color:${s.headingColor};border-bottom:1px solid ${s.ruleColor};padding-bottom:2px">${link(item.href) ? `<a href="${attr(link(item.href))}" style="color:${s.headingColor};text-decoration:none">${text(item.footnote)}</a>` : text(item.footnote)}</span></p>` : ''}`;
          const image = picture(item.image, { alt: item.title, padding: '0 8px 12px 32px', href: item.href, label: 'Card picture', height: 110 });
          const columns = image
            ? `<mj-column width="38%" vertical-align="top">${image}</mj-column><mj-column width="62%" vertical-align="top"><mj-text padding="0 32px 0 12px">${words}</mj-text></mj-column>`
            : `<mj-column><mj-text padding="0 32px">${words}</mj-text></mj-column>`;
          return section(b, columns, { padding: i ? 4 : b.padding, bottom: 18 });
        }).join('\n');
      case 'callout': {
        const image = picture(b.image, { alt: '', padding: '0 8px 16px 32px', label: 'Callout picture', height: 160 });
        const words = `<mj-text padding="${image ? '0 32px 0 12px' : '0 32px'}"><p style="margin:0 0 10px;font-family:${headingFont};font-size:30px;line-height:1.15;letter-spacing:3px;text-transform:uppercase;color:${s.headingColor}">${text(b.title)}</p><div class="ob-rich">${b.html}</div></mj-text>`
          + (b.buttonText ? `<mj-button href="${attr(link(b.buttonHref) || '#')}" align="${image ? 'left' : 'center'}" background-color="${attr(s.headingColor)}" color="${attr(s.contentBackground)}" font-family="${attr(s.font)}" font-size="13px" letter-spacing="3px" text-transform="uppercase" border="1px solid ${attr(s.headingColor)}" border-radius="0" inner-padding="14px 28px" padding="${image ? '16px 32px 0 12px' : '16px 32px 0'}">${text(b.buttonText)} &rarr;</mj-button>` : '');
        const columns = image
          ? `<mj-column width="34%" vertical-align="middle">${image}</mj-column><mj-column width="66%" vertical-align="middle">${words}</mj-column>`
          : `<mj-column>${words}</mj-column>`;
        return section(b, `${columns}`, { padding: b.padding }) ;
      }
      case 'image': {
        const shown = picture(b.src, { alt: b.alt, width: b.width || 0, href: b.href, label: 'Picture' });
        if (!shown) return '';
        return section(b, `<mj-column>${shown.replace('<mj-image ', `<mj-image align="${b.align}" `)}</mj-column>`, { padding: b.padding });
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
      case 'footer': {
        const note = `<mj-text css-class="ob-rich ob-footer" align="center" color="${attr(s.mutedColor)}" font-size="13px" line-height="1.6" padding="${b.style === 'links' ? '16px 32px 0' : '0 32px'}">${b.html}</mj-text>`;
        if (b.style !== 'links') return section(b, `<mj-column>${note}</mj-column>`, { background: s.background, padding: b.padding });
        const cells = [
          link(b.logo) ? `<img src="${attr(b.logo)}" alt="${attr(brand?.name || '')}" height="22" style="display:block;height:22px;width:auto;border:0;margin:0 auto">` : (preview ? '<span style="color:#98a2b3">Logo</span>' : ''),
          ...b.links.filter((l) => l.label && link(l.url)).map((l) => `<a href="${attr(link(l.url))}" style="font-family:${s.font};${caps(13, 3)};color:${s.headingColor};text-decoration:none">${text(l.label)}</a>`),
          link(b.ornament) ? `<img src="${attr(b.ornament)}" alt="" height="22" style="display:block;height:22px;width:auto;border:0;margin:0 auto">` : '',
        ].filter(Boolean);
        const row = cells.map((c, i) => `<td class="ob-footer-cell" align="center" valign="middle" style="padding:6px 16px;${i ? `border-left:1px solid ${s.ruleColor};` : ''}">${c}</td>`).join('');
        return section(b, `<mj-column><mj-divider border-color="${attr(s.ruleColor)}" border-width="1px" padding="0 32px 16px" /><mj-text align="center" padding="0 32px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto"><tr>${row}</tr></table></mj-text>${note}</mj-column>`, { background: s.background, padding: b.padding });
      }
      default:
        return '';
    }
  }).join('\n');

  const webFonts = Object.entries(WEB_FONTS).filter(([name]) => `${s.font} ${headingFont}`.includes(name))
    .map(([name, href]) => `<mj-font name="${attr(name)}" href="${attr(href)}" />`).join('');

  return `<mjml lang="en">
<mj-head>
  <mj-title>{{subject}}</mj-title>
  ${webFonts}
  <mj-raw><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"></mj-raw>
  <mj-attributes>
    <mj-all font-family="${attr(s.font)}" />
    <mj-text font-size="16px" line-height="1.6" color="${attr(s.textColor)}" padding="0 32px" />
    <mj-section padding="0" />
    <mj-column padding="0" />
  </mj-attributes>
  <mj-style>
    .ob-rich p { margin: 0 0 16px; }
    .ob-rich p:last-child { margin-bottom: 0; }
    .ob-rich h1, .ob-rich h2, .ob-rich h3 { font-family: ${headingFont}; color: ${s.headingColor}; }
    .ob-rich h1 { margin: 8px 0 12px; font-size: 30px; line-height: 1.2; }
    .ob-rich h2 { margin: 8px 0 10px; font-size: 24px; line-height: 1.25; }
    .ob-rich h3 { margin: 8px 0 8px; font-size: 19px; line-height: 1.3; }
    .ob-rich a { color: ${accent}; }
    .ob-rich img { max-width: 100%; height: auto; border: 0; }
    .ob-rich ul, .ob-rich ol { margin: 0 0 16px; padding-left: 24px; }
    .ob-rich li { margin: 0 0 6px; }
    .ob-rich li p { margin: 0; }
    .ob-rich blockquote { margin: 0 0 16px; padding: 2px 0 2px 16px; border-left: 3px solid ${s.ruleColor}; font-style: italic; }
    .ob-rich hr { border: 0; border-top: 1px solid ${s.ruleColor}; margin: 20px 0; }
    .ob-footer a { color: ${s.mutedColor}; }
  </mj-style>
  <mj-style>
    @media only screen and (max-width: 480px) {
      .ob-col { max-width: 100% !important; margin-right: 0 !important; }
      .ob-hide-small { display: none !important; }
      .ob-section-title { font-size: 24px !important; letter-spacing: 2px !important; white-space: normal !important; }
      .ob-masthead-title div { font-size: 40px !important; }
      .ob-footer-cell { display: block !important; border-left: 0 !important; }
    }
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

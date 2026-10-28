// The settings of one block in the visual template editor, and of the template as a whole.
import { useId } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { FONTS } from '../../shared/design.js';
import Editor from './Editor.jsx';
import MediaPicker from './MediaPicker.jsx';

export function ColorField({ label, value, onChange, allowBrand = false, brandColor = '#2f6fed' }) {
  const isBrand = value === 'brand';
  const shown = isBrand ? brandColor : value;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="color-field">
        <input type="color" value={shown} onChange={(e) => onChange(e.target.value)} disabled={isBrand} aria-label={`${label}: pick a color`} />
        <input value={shown} onChange={(e) => onChange(e.target.value)} disabled={isBrand} maxLength={7} aria-label={`${label} as hex`} />
        {allowBrand && (
          <label className="check check-small">
            <input type="checkbox" checked={isBrand} onChange={(e) => onChange(e.target.checked ? 'brand' : brandColor)} />
            Brand color
          </label>
        )}
      </span>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, unit = 'px' }) {
  const id = useId();
  return (
    <div className="field field-number">
      <label className="field-label" htmlFor={id}>{label}</label>
      <span className="number-field">
        <input id={id} type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} />
        {unit && <span className="muted">{unit}</span>}
      </span>
    </div>
  );
}

function AlignField({ value, onChange }) {
  const options = [['left', AlignLeft, 'Left'], ['center', AlignCenter, 'Center'], ['right', AlignRight, 'Right']];
  return (
    <div className="field">
      <span className="field-label">Alignment</span>
      <div className="segmented" role="group" aria-label="Alignment">
        {options.map(([key, Icon, label]) => (
          <button key={key} type="button" aria-pressed={value === key} aria-label={label} title={label} onClick={() => onChange(key)}><Icon size={16} /></button>
        ))}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, hint, ...rest }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

const Check = ({ label, checked, onChange }) => (
  <label className="check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
);

function Segmented({ label, value, options, onChange }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(([key, name]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}>{name}</button>)}
      </div>
    </div>
  );
}

// A list the block holds (cards, footer links): each item edited in place, moved, removed.
function ItemList({ items, onChange, blank, render, addLabel, max = 8 }) {
  const set = (i, patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const copy = [...items];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div className="item-list">
      {items.map((item, i) => (
        <div key={i} className="item-card">
          <div className="item-tools">
            <span className="muted">{i + 1}</span>
            <button type="button" className="icon-button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className="icon-button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className="icon-button" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
          </div>
          {render(item, (patch) => set(i, patch))}
        </div>
      ))}
      {items.length < max && <button type="button" className="button button-small" onClick={() => onChange([...items, blank()])}><Plus size={15} aria-hidden="true" />{addLabel}</button>}
    </div>
  );
}

// Which of the brand's products a Products block shows, in what order.
function ProductPicker({ products, ids, onChange }) {
  if (!products.length) return <p className="muted">This brand has no products yet. Add them in Settings › Brands.</p>;
  const chosen = ids.length ? ids.filter((id) => products.some((p) => p.id === id)) : products.map((p) => p.id);
  const toggle = (id) => onChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const move = (id, by) => {
    const i = chosen.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= chosen.length) return;
    const copy = [...chosen];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const ordered = [...chosen.map((id) => products.find((p) => p.id === id)), ...products.filter((p) => !chosen.includes(p.id))];
  return (
    <ul className="updates-pick">
      {ordered.map((p) => (
        <li key={p.id} className={chosen.includes(p.id) ? 'update-option' : 'update-option update-option-off'}>
          <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggle(p.id)} aria-label={`Show ${p.name}`} />
          <span className="update-option-text">
            <span className="update-option-title">{p.name}</span>
            <span className="muted update-option-meta">{[p.version && `v${p.version.replace(/^v/i, '')}`, p.description ? 'described' : 'no description yet', p.image_url ? 'with a picture' : 'no picture yet'].filter(Boolean).join(' · ')}</span>
          </span>
          {chosen.includes(p.id) && (
            <span className="update-order">
              <button type="button" className="icon-button" aria-label={`Move ${p.name} up`} onClick={() => move(p.id, -1)}><ArrowUp size={15} /></button>
              <button type="button" className="icon-button" aria-label={`Move ${p.name} down`} onClick={() => move(p.id, 1)}><ArrowDown size={15} /></button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function BlockSettings({ block, onChange, brand }) {
  const set = (patch) => onChange({ ...block, ...patch });
  const brandColor = brand?.color || '#2f6fed';
  const padding = <NumberField label="Space above and below" value={block.padding} min={0} max={80} onChange={(padding) => set({ padding })} />;

  switch (block.type) {
    case 'masthead':
      return (
        <div className="stack">
          <TextField label="Line above" value={block.eyebrow} onChange={(eyebrow) => set({ eyebrow })} maxLength={120} hint="Small capitals between two lines. ✦ makes a star." />
          <MediaPicker label="Wordmark picture (optional)" value={block.image} onChange={(image) => set({ image })} hint="Your name as artwork, used instead of the title. A PNG twice as wide as it shows (about 1040 pixels) stays sharp." />
          {block.image
            ? <NumberField label="Wordmark width" value={block.imageWidth} min={120} max={536} onChange={(imageWidth) => set({ imageWidth })} />
            : (
              <div className="field-row">
                <TextField label="Title" value={block.title} onChange={(title) => set({ title })} maxLength={80} />
                <NumberField label="Title size" value={block.size} min={24} max={80} onChange={(size) => set({ size })} />
              </div>
            )}
          <TextField label="Line below" value={block.tagline} onChange={(tagline) => set({ tagline })} maxLength={120} />
          {padding}
        </div>
      );
    case 'section':
      return (
        <div className="stack">
          <TextField label="Heading" value={block.title} onChange={(title) => set({ title })} maxLength={60} hint="Shown in capitals." />
          <TextField label="Small words on the right (optional)" value={block.tagline} onChange={(tagline) => set({ tagline })} maxLength={80} hint="Hidden on phones, where there’s no room." />
          <Check label="A line above the heading" checked={block.rule} onChange={(rule) => set({ rule })} />
          {padding}
        </div>
      );
    case 'products':
      return (
        <div className="stack">
          <p className="muted">The brand’s products, with the picture, version and description set for each in Settings › Brands. Untick the ones to leave out; the arrows set the order.</p>
          <ProductPicker products={brand?.products || []} ids={block.productIds} onChange={(productIds) => set({ productIds })} />
          <Segmented label="Cards in a row" value={block.columns} options={[[2, 'Two'], [3, 'Three']]} onChange={(columns) => set({ columns })} />
          <Check label="Show versions" checked={block.showVersions} onChange={(showVersions) => set({ showVersions })} />
          <Check label="Show pictures" checked={block.showImages} onChange={(showImages) => set({ showImages })} />
          <TextField label="Link words" value={block.linkLabel} onChange={(linkLabel) => set({ linkLabel })} maxLength={40} />
        </div>
      );
    case 'cards':
      return (
        <div className="stack">
          <p className="muted">Each card: a picture beside its words. Good for what’s coming soon.</p>
          <ItemList
            items={block.items}
            onChange={(items) => set({ items })}
            blank={() => ({ title: '', eyebrow: '', text: '', footnote: '', image: '', href: '' })}
            addLabel="Add a card"
            render={(item, change) => (
              <div className="stack">
                <MediaPicker label="Picture" value={item.image} onChange={(image) => change({ image })} />
                <TextField label="Title" value={item.title} onChange={(title) => change({ title })} maxLength={120} />
                <TextField label="Small line under it" value={item.eyebrow} onChange={(eyebrow) => change({ eyebrow })} maxLength={80} />
                <div className="field">
                  <span className="field-label">Words</span>
                  <textarea rows={3} value={item.text} onChange={(e) => change({ text: e.target.value })} maxLength={1000} />
                </div>
                <div className="field-row">
                  <TextField label="Last line" value={item.footnote} onChange={(footnote) => change({ footnote })} maxLength={120} placeholder="Est. release: Q1 2027" />
                  <TextField label="Link (optional)" value={item.href} onChange={(href) => change({ href })} placeholder="https://" />
                </div>
              </div>
            )}
          />
          {padding}
        </div>
      );
    case 'callout':
      return (
        <div className="stack">
          <MediaPicker label="Picture beside it (optional)" value={block.image} onChange={(image) => set({ image })} />
          <TextField label="Heading" value={block.title} onChange={(title) => set({ title })} maxLength={120} />
          <div className="card-editor inset-editor"><Editor key={block.id} value={block.html} onChange={(html) => set({ html })} label="Callout text" /></div>
          <div className="field-row">
            <TextField label="Button words" value={block.buttonText} onChange={(buttonText) => set({ buttonText })} maxLength={80} />
            <TextField label="Button link" value={block.buttonHref} onChange={(buttonHref) => set({ buttonHref })} placeholder="https://" />
          </div>
          {padding}
        </div>
      );
    case 'header':
      return (
        <div className="stack">
          <TextField label="Heading" value={block.text} onChange={(text) => set({ text })} maxLength={200} hint="{{brand_heading}} shows the brand’s heading, such as “Phansora Updates”." />
          <Check label={brand?.logo_url ? 'Show the brand’s logo' : 'Show the brand’s logo (add one in Settings › Brands)'} checked={block.logo} onChange={(logo) => set({ logo })} />
          <AlignField value={block.align} onChange={(align) => set({ align })} />
          <div className="field-row">
            <ColorField label="Background" value={block.background} onChange={(background) => set({ background })} allowBrand brandColor={brandColor} />
            <ColorField label="Text color" value={block.color} onChange={(color) => set({ color })} allowBrand brandColor={brandColor} />
          </div>
          <div className="field-row">
            <NumberField label="Text size" value={block.size} min={16} max={48} onChange={(size) => set({ size })} />
            {padding}
          </div>
        </div>
      );
    case 'text':
      return (
        <div className="stack">
          <div className="card-editor inset-editor"><Editor key={block.id} value={block.html} onChange={(html) => set({ html })} label="Block text" /></div>
          {padding}
        </div>
      );
    case 'content':
      return (
        <div className="stack">
          <p className="muted">Each message you write goes here. Its text, pictures and links are set in the template’s colors and font.</p>
          {padding}
        </div>
      );
    case 'updates':
      return (
        <div className="stack">
          <p className="muted">The brand’s product updates: the newest ones no newsletter has carried yet, or the ones you choose when writing the message.</p>
          <Segmented label="Layout" value={block.layout} options={[['list', 'List'], ['featured', 'Featured']]} onChange={(layout) => set({ layout })} />
          {block.layout === 'featured' && <p className="field-hint">The newest large, with its picture beside it; the rest in two columns below.</p>}
          <TextField label="Title (optional)" value={block.title} onChange={(title) => set({ title })} maxLength={120} />
          <NumberField label="At most, automatically" value={block.limit} min={1} max={20} unit="updates" onChange={(limit) => set({ limit })} />
          <TextField label="Link words" value={block.linkLabel} onChange={(linkLabel) => set({ linkLabel })} maxLength={40} />
          <Check label="Show each update’s date" checked={block.showDates} onChange={(showDates) => set({ showDates })} />
          <Check label="Show the product’s name" checked={block.showProducts} onChange={(showProducts) => set({ showProducts })} />
          <Check label="Show pictures" checked={block.showImages} onChange={(showImages) => set({ showImages })} />
        </div>
      );
    case 'image':
      return (
        <div className="stack">
          <MediaPicker label="Picture" value={block.src} onChange={(src) => set({ src })} />
          <TextField label="Description" value={block.alt} onChange={(alt) => set({ alt })} maxLength={300} hint="Shown when pictures are off, and read aloud by screen readers." />
          <TextField label="Link (optional)" value={block.href} onChange={(href) => set({ href })} placeholder="https://" />
          <div className="field-row">
            <NumberField label="Width (0 = full)" value={block.width} min={0} max={600} onChange={(width) => set({ width })} />
            {padding}
          </div>
          <AlignField value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case 'button':
      return (
        <div className="stack">
          <TextField label="Button text" value={block.text} onChange={(text) => set({ text })} maxLength={120} />
          <TextField label="Link" value={block.href} onChange={(href) => set({ href })} placeholder="https://" />
          <div className="field-row">
            <ColorField label="Button color" value={block.background} onChange={(background) => set({ background })} allowBrand brandColor={brandColor} />
            <ColorField label="Text color" value={block.color} onChange={(color) => set({ color })} allowBrand brandColor={brandColor} />
          </div>
          <AlignField value={block.align} onChange={(align) => set({ align })} />
          <div className="field-row">
            <NumberField label="Corner roundness" value={block.radius} min={0} max={30} onChange={(radius) => set({ radius })} />
            {padding}
          </div>
        </div>
      );
    case 'columns':
      return (
        <div className="stack">
          <p className="muted">Side by side on a computer; one above the other on a phone.</p>
          <MediaPicker label="Left picture (optional)" value={block.leftImage} onChange={(leftImage) => set({ leftImage })} />
          <div className="card-editor inset-editor"><Editor key={`${block.id}-l`} value={block.left} onChange={(left) => set({ left })} label="Left column" /></div>
          <MediaPicker label="Right picture (optional)" value={block.rightImage} onChange={(rightImage) => set({ rightImage })} />
          <div className="card-editor inset-editor"><Editor key={`${block.id}-r`} value={block.right} onChange={(right) => set({ right })} label="Right column" /></div>
          {padding}
        </div>
      );
    case 'divider':
      return (
        <div className="stack">
          <ColorField label="Line color" value={block.color} onChange={(color) => set({ color })} />
          <div className="field-row">
            <NumberField label="Thickness" value={block.thickness} min={1} max={8} onChange={(thickness) => set({ thickness })} />
            {padding}
          </div>
        </div>
      );
    case 'spacer':
      return <NumberField label="Height" value={block.height} min={4} max={120} onChange={(height) => set({ height })} />;
    case 'footer':
      return (
        <div className="stack">
          <Segmented label="Style" value={block.style} options={[['text', 'Text'], ['links', 'A row of links']]} onChange={(style) => set({ style })} />
          {block.style === 'links' && (
            <>
              <MediaPicker label="Small logo on the left (optional)" value={block.logo} onChange={(logo) => set({ logo })} />
              <ItemList
                items={block.links}
                onChange={(links) => set({ links })}
                blank={() => ({ label: '', url: '' })}
                addLabel="Add a link"
                max={6}
                render={(l, change) => (
                  <div className="field-row">
                    <TextField label="Words" value={l.label} onChange={(label) => change({ label })} maxLength={40} />
                    <TextField label="Link" value={l.url} onChange={(url) => change({ url })} placeholder="https:// or {{unsubscribe_url}}" />
                  </div>
                )}
              />
              <MediaPicker label="Small picture on the right (optional)" value={block.ornament} onChange={(ornament) => set({ ornament })} />
            </>
          )}
          <div className="card-editor inset-editor"><Editor key={block.id} value={block.html} onChange={(html) => set({ html })} label="Footer text" /></div>
          <p className="field-hint">Keep {'{{address}}'} (your mailing address) and an Unsubscribe link to {'{{unsubscribe_url}}'}: the law asks for both, and without the link Opios adds one.</p>
          {padding}
        </div>
      );
    default:
      return null;
  }
}

export function StyleSettings({ settings, onChange, brand }) {
  const set = (patch) => onChange({ ...settings, ...patch });
  const brandColor = brand?.color || '#2f6fed';
  return (
    <div className="stack">
      <ColorField label="Links and highlights" value={settings.accent} onChange={(accent) => set({ accent })} allowBrand brandColor={brandColor} />
      <div className="field-row">
        <ColorField label="Page background" value={settings.background} onChange={(background) => set({ background })} />
        <ColorField label="Content background" value={settings.contentBackground} onChange={(contentBackground) => set({ contentBackground })} />
      </div>
      <div className="field-row">
        <ColorField label="Text" value={settings.textColor} onChange={(textColor) => set({ textColor })} />
        <ColorField label="Headings" value={settings.headingColor} onChange={(headingColor) => set({ headingColor })} />
      </div>
      <div className="field-row">
        <ColorField label="Quiet text (dates, footer)" value={settings.mutedColor} onChange={(mutedColor) => set({ mutedColor })} />
        <ColorField label="Lines" value={settings.ruleColor} onChange={(ruleColor) => set({ ruleColor })} />
      </div>
      <label className="field">
        <span className="field-label">Font</span>
        <select value={settings.font} onChange={(e) => set({ font: e.target.value })}>
          {Object.entries(FONTS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Headings font</span>
        <select value={settings.headingFont} onChange={(e) => set({ headingFont: e.target.value })}>
          <option value="">The same as the text</option>
          {Object.entries(FONTS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
        <span className="field-hint">Web fonts show in Apple Mail and on iPhones; Gmail and Outlook show the font after them, such as Georgia.</span>
      </label>
    </div>
  );
}

// The settings of one block in the visual template editor, and of the template as a whole.
import { useId } from 'react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
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

export function BlockSettings({ block, onChange, brand }) {
  const set = (patch) => onChange({ ...block, ...patch });
  const brandColor = brand?.color || '#2f6fed';
  const padding = <NumberField label="Space above and below" value={block.padding} min={0} max={80} onChange={(padding) => set({ padding })} />;

  switch (block.type) {
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
          <TextField label="Title" value={block.title} onChange={(title) => set({ title })} maxLength={120} />
          <NumberField label="At most, automatically" value={block.limit} min={1} max={20} unit="updates" onChange={(limit) => set({ limit })} />
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
      <ColorField label="Quiet text (dates, footer)" value={settings.mutedColor} onChange={(mutedColor) => set({ mutedColor })} />
      <label className="field">
        <span className="field-label">Font</span>
        <select value={settings.font} onChange={(e) => set({ font: e.target.value })}>
          {Object.entries(FONTS).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
        <span className="field-hint">Fonts every computer and phone has, so the email looks the same everywhere.</span>
      </label>
    </div>
  );
}

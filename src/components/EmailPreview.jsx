// An email shown as it will look, in a sealed frame: scripts in it never run (the sandbox has no
// allow-scripts, so its same origin gives nothing a way in), forms can't be sent, and links open
// in a new tab.
import { Monitor, Smartphone } from 'lucide-react';

const withBase = (html) => (/<head[^>]*>/i.test(html)
  ? html.replace(/<head[^>]*>/i, (tag) => `${tag}<base target="_blank">`)
  : `<base target="_blank">${html}`);

export function EmailFrame({ html, title = 'Email preview', className = 'preview-frame' }) {
  return <iframe className={className} title={title} srcDoc={withBase(html)} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" />;
}

export function SizeToggle({ size, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Preview size">
      <button type="button" aria-pressed={size === 'desktop'} onClick={() => onChange('desktop')}><Monitor size={16} aria-hidden="true" />Desktop</button>
      <button type="button" aria-pressed={size === 'phone'} onClick={() => onChange('phone')}><Smartphone size={16} aria-hidden="true" />Phone</button>
    </div>
  );
}

export default function EmailPreview({ html, size, onSize, note, subject }) {
  return (
    <div className="preview">
      <div className="preview-bar">
        <span className="preview-label">Preview</span>
        {note && <span className="muted preview-note">{note}</span>}
        <SizeToggle size={size} onChange={onSize} />
      </div>
      {subject !== undefined && <div className="preview-subject"><span className="muted">Subject</span> {subject || <em className="muted">No subject yet</em>}</div>}
      <div className={size === 'phone' ? 'preview-stage preview-phone' : 'preview-stage'}>
        <EmailFrame html={html} />
      </div>
    </div>
  );
}

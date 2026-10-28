// An email shown as it will look, in a sealed frame: scripts in it never run (the sandbox has no
// allow-scripts, so its same origin gives nothing a way in), forms can't be sent, and links open
// in a new tab.
import { useLayoutEffect, useRef, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

// The width the desktop preview is drawn at: the email's 600 pixels and a little page around
// them, as a mail app on a computer shows it.
const DESKTOP = 640;

// A desktop preview narrower than that is drawn at full width and scaled down to fit, so it
// shows the real layout (three cards to a row, say) rather than a squeezed one.
export function FitStage({ size, children }) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || size === 'phone') return undefined;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / DESKTOP)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [size]);
  if (size === 'phone') return <div className="preview-stage preview-phone">{children}</div>;
  return (
    <div className="preview-stage preview-desktop" ref={ref}>
      <div className="preview-scaled" style={{ width: DESKTOP, transform: `scale(${scale})`, height: `calc(max(520px, 100vh - 220px) / ${scale})` }}>{children}</div>
    </div>
  );
}

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
      <FitStage size={size}><EmailFrame html={html} /></FitStage>
    </div>
  );
}

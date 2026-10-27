// Editing a template's HTML, beside a live preview with a sample message in it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '../api.js';
import { SAMPLE_BODY, SAMPLE_CONTACT, TEMPLATE_TAGS, renderEmail } from '../../shared/render.js';
import { Dialog, ErrorNote, Loading, PageHeader, insertAtCursor, useLoad, useToast } from '../ui.jsx';
import EmailPreview from '../components/EmailPreview.jsx';

const has = (html, tag) => new RegExp(`\\{\\{\\s*${tag}\\s*(\\|[^}]*)?\\}\\}`).test(html);

function Form({ template, general }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: template.name, html: template.html });
  const [saved, setSaved] = useState({ name: template.name, html: template.html });
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState('desktop');
  const [view, setView] = useState('code');
  const code = useRef(null);
  const dirty = form.name !== saved.name || form.html !== saved.html;
  const missingContent = !has(form.html, 'content');

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    const warn = (e) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const preview = useMemo(() => renderEmail({
    templateHtml: form.html, bodyHtml: SAMPLE_BODY, subject: 'Sample subject', preheader: 'Sample preview text', contact: SAMPLE_CONTACT, general, unsubscribeUrl: '#',
  }), [form.html, general]);

  async function save() {
    if (busy || missingContent) return;
    setBusy(true);
    try {
      const t = await api.put(`/api/templates/${template.id}`, form);
      setSaved({ name: t.name, html: t.html });
      toast('Template saved.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // Cmd-S or Ctrl-S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <PageHeader title={form.name || 'Template'} back={<Link to="/templates" className="back" aria-label="Templates"><ChevronLeft size={20} /></Link>}>
        <span className={dirty ? 'save-state save-unsaved' : 'save-state save-saved'} aria-live="polite">{dirty ? 'Not saved' : 'Saved'}</span>
        <button type="button" className="button button-primary" onClick={save} disabled={busy || !dirty || missingContent}>{busy ? 'Saving…' : 'Save'}</button>
      </PageHeader>
      <div className="segmented compose-tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === 'code'} onClick={() => setView('code')}>HTML</button>
        <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
      </div>
      <div className="compose">
        <div className={view === 'code' ? 'compose-write' : 'compose-write hide-narrow'}>
          <section className="card stack">
            <label className="field">
              <span className="field-label">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} />
            </label>
            <div className="field">
              <div className="code-head">
                <label className="field-label" htmlFor="template-html">HTML</label>
                <select
                  className="tool-select"
                  aria-label="Insert a tag"
                  value=""
                  onChange={(e) => e.target.value && insertAtCursor(code.current, form.html, `{{${e.target.value}}}`, (html) => setForm({ ...form, html }))}
                >
                  <option value="">Insert a tag…</option>
                  {TEMPLATE_TAGS.map((t) => <option key={t.tag} value={t.tag}>{t.label} {`{{${t.tag}}}`}</option>)}
                </select>
              </div>
              <textarea id="template-html" ref={code} className="code code-tall" value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} spellCheck="false" />
            </div>
            {missingContent && <p className="note note-error" role="alert">Put <code>{'{{content}}'}</code> where each message should go. The template can’t be saved without it.</p>}
            {!has(form.html, 'unsubscribe_url') && <p className="note note-warn">There’s no <code>{'{{unsubscribe_url}}'}</code> link, so Opios adds an unsubscribe line at the bottom of each email.</p>}
            {!has(form.html, 'address') && <p className="note note-warn">Laws such as CAN-SPAM ask for your postal address in every newsletter. Add <code>{'{{address}}'}</code> to the footer (the address itself is set in Settings).</p>}
            <details className="hint-box">
              <summary>Tips for email HTML</summary>
              <ul>
                <li>Lay out with tables: many mail apps ignore flexbox, grid and floats.</li>
                <li>Styles in the <code>&lt;style&gt;</code> block are copied onto each tag when sending, so Outlook and Gmail show them.</li>
                <li>Keep it about 600 pixels wide, and use pictures by their full web address.</li>
                <li>A tag can have a fallback for when it’s empty: <code>{'{{first_name|there}}'}</code>.</li>
              </ul>
            </details>
          </section>
        </div>
        <div className={view === 'preview' ? 'compose-preview' : 'compose-preview hide-narrow'}>
          <EmailPreview html={preview} size={size} onSize={setSize} note="With a sample message" />
        </div>
      </div>
      <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} title="Leave without saving?">
        <p className="dialog-text">Your changes to this template haven’t been saved.</p>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={() => blocker.reset?.()}>Stay</button>
          <button type="button" className="button button-danger" onClick={() => blocker.proceed?.()}>Leave without saving</button>
        </div>
      </Dialog>
    </>
  );
}

export default function TemplateEditor() {
  const { id } = useParams();
  const data = useLoad(() => Promise.all([api.get(`/api/templates/${id}`), api.get('/api/settings')]), [id]);
  if (data.error) return <ErrorNote error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading />;
  const [template, settings] = data.data;
  return <Form key={template.id} template={template} general={settings.general} />;
}

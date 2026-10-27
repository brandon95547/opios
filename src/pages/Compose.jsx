// Writing a message: subject, template, the message itself and who it goes to, with a live
// preview. Changes are saved as you go.
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, MailCheck, Send } from 'lucide-react';
import { api } from '../api.js';
import { SAMPLE_CONTACT, renderEmail, renderSubject } from '../../shared/render.js';
import { isEmail } from '../../shared/email.js';
import { Dialog, ErrorNote, Loading, PageHeader, insertAtCursor, number, plural, useLoad, useToast } from '../ui.jsx';
import Editor from '../components/Editor.jsx';
import EmailPreview from '../components/EmailPreview.jsx';
import Recipients, { audienceSize } from '../components/Recipients.jsx';

const SAVE_LABELS = { saved: 'Saved', unsaved: 'Not saved yet', saving: 'Saving…', error: 'Couldn’t save' };

function TestDialog({ open, onClose, defaultTo, draft }) {
  const toast = useToast();
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!isEmail(to)) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await api.post('/api/campaigns/test', { ...draft, to });
      toast(`Test sent to ${to}.`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Send a test">
      <form onSubmit={submit}>
        <p className="dialog-text">See the message in a real inbox before it goes out. The subject starts with [Test].</p>
        <label className="field">
          <span className="field-label">Send the test to</span>
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send test'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function SendDialog({ open, onClose, onSend, count, subject, settings }) {
  const [busy, setBusy] = useState(false);
  const rate = settings.general.ratePerMinute || 20;
  const minutes = Math.ceil(count / rate);
  return (
    <Dialog open={open} onClose={onClose} title="Send this message?">
      <p className="dialog-text">“{subject}” goes to <strong>{plural(count, 'person', 'people')}</strong>, from {settings.smtp.fromName ? `${settings.smtp.fromName} <${settings.smtp.fromEmail}>` : settings.smtp.fromEmail}.</p>
      <p className="dialog-text muted">
        At {number(rate)} emails a minute, this takes {minutes <= 1 ? 'about a minute' : `about ${number(minutes)} minutes`}. You can leave this page while it sends.
      </p>
      {settings.smtp.provider === 'gmail' && count > 500 && (
        <p className="note note-warn">A regular Gmail account sends about 500 emails a day (Google Workspace, 2,000). If the limit is reached, sending pauses, and you can resume it the next day.</p>
      )}
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose}>Not yet</button>
        <button type="button" className="button button-primary" disabled={busy} onClick={async () => { setBusy(true); await onSend(); setBusy(false); }}>
          <Send size={17} aria-hidden="true" />{busy ? 'Starting…' : `Send to ${plural(count, 'person', 'people')}`}
        </button>
      </div>
    </Dialog>
  );
}

export default function Compose({ message, onSent }) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => ({
    subject: message.subject,
    preheader: message.preheader,
    template_id: message.template_id,
    body_html: message.body_html,
    audience: message.audience,
  }));
  const [saveState, setSaveState] = useState('saved');
  const [size, setSize] = useState('desktop');
  const [view, setView] = useState('write');
  const [dialog, setDialog] = useState(null);
  const subjectRef = useRef(null);
  const data = useLoad(() => Promise.all([api.get('/api/templates'), api.get('/api/contacts'), api.get('/api/settings')])
    .then(([templates, c, settings]) => ({ templates, contacts: c.contacts, lists: c.lists, settings })));

  // Saving: a short pause after the last change, one save at a time, and whatever is left when
  // the page closes.
  const latest = useRef(draft);
  latest.current = draft;
  const timer = useRef(null);
  const queue = useRef(Promise.resolve());
  const save = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    const body = latest.current;
    setSaveState('saving');
    const done = queue.current.catch(() => {}).then(() => api.put(`/api/campaigns/${message.id}`, body));
    queue.current = done;
    done.then(() => { if (latest.current === body) setSaveState('saved'); }, () => setSaveState('error'));
    return done;
  }, [message.id]);

  useEffect(() => () => { if (timer.current) save(); }, [save]);
  useEffect(() => {
    const warn = (e) => { if (timer.current) { save(); e.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  const update = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaveState('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  };

  const d = data.data;
  const template = d?.templates.find((t) => t.id === draft.template_id);
  const general = d?.settings.general;
  const body = useDeferredValue(draft.body_html);
  const html = useMemo(() => (d ? renderEmail({
    templateHtml: template?.html,
    bodyHtml: body,
    subject: draft.subject,
    preheader: draft.preheader,
    contact: SAMPLE_CONTACT,
    general,
    unsubscribeUrl: '#',
  }) : ''), [d, template, general, body, draft.subject, draft.preheader]);

  if (data.error) return <ErrorNote error={data.error} onRetry={data.reload} />;
  if (!d) return <Loading />;
  const accountReady = d.settings.smtp.fromEmail && d.settings.smtp.host && (!d.settings.smtp.user || d.settings.smtp.hasPassword);

  async function openSend() {
    try {
      await save();
    } catch (err) {
      return toast(err.message, 'error');
    }
    if (!draft.subject.trim()) return toast('Give the message a subject first.', 'error');
    if (!template) return toast('Choose a template first.', 'error');
    if (!audienceSize(draft.audience, d.contacts)) return toast('Choose who to send it to first.', 'error');
    try {
      const { count } = await api.post('/api/campaigns/audience', { audience: draft.audience });
      setDialog({ kind: 'send', count });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function send() {
    try {
      await api.post(`/api/campaigns/${message.id}/send`);
      toast('Sending has started.');
      setDialog(null);
      onSent();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <PageHeader title={draft.subject || 'New message'} back={<Link to="/messages" className="back" aria-label="All messages"><ChevronLeft size={20} /></Link>}>
        <span className={`save-state save-${saveState}`} aria-live="polite">{SAVE_LABELS[saveState]}</span>
        <button type="button" className="button" onClick={() => setDialog({ kind: 'test' })} disabled={!accountReady}><MailCheck size={17} aria-hidden="true" />Send test</button>
        <button type="button" className="button button-primary" onClick={openSend} disabled={!accountReady}><Send size={17} aria-hidden="true" />Send…</button>
      </PageHeader>
      {!accountReady && (
        <p className="note note-warn">Connect the email account you send from in <Link to="/settings" className="link">Settings</Link> before testing or sending. Your draft is saved meanwhile.</p>
      )}
      <div className="segmented compose-tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === 'write'} onClick={() => setView('write')}>Write</button>
        <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
      </div>
      <div className="compose">
        <div className={view === 'write' ? 'compose-write' : 'compose-write hide-narrow'}>
          <section className="card stack">
            <div className="field">
              <label className="field-label" htmlFor="subject">Subject</label>
              <div className="input-with">
                <input id="subject" ref={subjectRef} value={draft.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="What’s this email about?" maxLength={300} />
                <select
                  className="tool-select"
                  aria-label="Insert into the subject"
                  value=""
                  onChange={(e) => e.target.value && insertAtCursor(subjectRef.current, draft.subject, e.target.value, (subject) => update({ subject }))}
                >
                  <option value="">Insert…</option>
                  <option value="{{first_name}}">First name</option>
                  <option value="{{org_name}}">Newsletter name</option>
                </select>
              </div>
            </div>
            <label className="field">
              <span className="field-label">Preview text</span>
              <input value={draft.preheader} onChange={(e) => update({ preheader: e.target.value })} placeholder="A short line shown after the subject in the inbox" maxLength={300} />
            </label>
            <label className="field">
              <span className="field-label">Template</span>
              <select value={draft.template_id ?? ''} onChange={(e) => update({ template_id: Number(e.target.value) || null })}>
                {!template && <option value="">Choose a template</option>}
                {d.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="field-hint"><Link to="/templates" className="link">Make or change templates</Link></span>
            </label>
          </section>
          <section className="card card-editor">
            <Editor value={message.body_html} onChange={(body_html) => update({ body_html })} />
          </section>
          <section className="card">
            <h2 className="card-title">Recipients</h2>
            <Recipients audience={draft.audience} onChange={(audience) => update({ audience })} contacts={d.contacts} lists={d.lists} />
          </section>
        </div>
        <div className={view === 'preview' ? 'compose-preview' : 'compose-preview hide-narrow'}>
          <EmailPreview
            html={html}
            size={size}
            onSize={setSize}
            note={`As ${SAMPLE_CONTACT.first_name} ${SAMPLE_CONTACT.last_name} would see it`}
            subject={renderSubject(draft.subject, SAMPLE_CONTACT, general)}
          />
        </div>
      </div>
      {dialog?.kind === 'test' && <TestDialog open onClose={() => setDialog(null)} defaultTo={d.settings.smtp.fromEmail} draft={draft} />}
      {dialog?.kind === 'send' && (
        <SendDialog open onClose={() => setDialog(null)} onSend={send} count={dialog.count} subject={draft.subject} settings={d.settings} />
      )}
    </>
  );
}

// A message that has been sent, or is being sent: how far it has got, who got it, and what went
// wrong for whom.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Play, RotateCcw, Search, Square, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { SAMPLE_CONTACT, renderEmail, renderSubject } from '../../shared/render.js';
import { Badge, Loading, PageHeader, formatDateTime, number, useConfirm, useLoad, useToast } from '../ui.jsx';
import EmailPreview from '../components/EmailPreview.jsx';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'pending', label: 'Waiting' },
  { key: 'skipped', label: 'Not sent' },
];
const PAGE = 100;

export default function Report({ message: m, reload }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmElement, confirm] = useConfirm();
  const [tab, setTab] = useState('recipients');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [size, setSize] = useState('desktop');
  const settings = useLoad(() => api.get('/api/settings'));

  // While it sends, the report keeps up.
  useEffect(() => {
    if (m.status !== 'sending') return undefined;
    const timer = setInterval(reload, 2500);
    return () => clearInterval(timer);
  }, [m.status, reload]);

  const done = m.sent + m.failed + m.skipped;
  const percent = m.total ? Math.round((done / m.total) * 100) : 0;
  const counts = useMemo(() => {
    const c = { all: m.recipients.length, sent: 0, failed: 0, pending: 0, skipped: 0 };
    for (const r of m.recipients) c[r.status === 'sending' ? 'pending' : r.status] += 1;
    return c;
  }, [m.recipients]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return m.recipients.filter((r) => (filter === 'all' || (filter === 'pending' ? ['pending', 'sending'].includes(r.status) : r.status === filter))
      && (!q || r.email.includes(q)));
  }, [m.recipients, filter, query]);

  const general = settings.data?.general;
  const html = useMemo(() => renderEmail({
    templateHtml: m.template_html,
    bodyHtml: m.body_html,
    subject: m.subject,
    preheader: m.preheader,
    contact: SAMPLE_CONTACT,
    general,
    unsubscribeUrl: '#',
  }), [m, general]);

  async function act(path, success) {
    try {
      await api.post(`/api/campaigns/${m.id}/${path}`);
      if (success) toast(success);
      reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function stop() {
    const yes = await confirm({
      title: 'Stop sending?',
      message: `${number(m.sent)} people already have it. The other ${number(m.total - done)} won’t get it. This can’t be undone, but you can duplicate the message and send it again.`,
      confirm: 'Stop sending',
      danger: true,
    });
    if (yes) act('cancel', 'Sending stopped.');
  }

  async function duplicate() {
    try {
      const copy = await api.post(`/api/campaigns/${m.id}/duplicate`);
      navigate(`/messages/${copy.id}`);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove() {
    const yes = await confirm({ title: 'Delete this message?', message: 'Its sending report is deleted too. The emails already sent stay sent.', confirm: 'Delete', danger: true });
    if (!yes) return;
    try {
      await api.del(`/api/campaigns/${m.id}`);
      toast('Message deleted.');
      navigate('/messages');
    } catch (err) { toast(err.message, 'error'); }
  }

  const finished = ['sent', 'cancelled'].includes(m.status);

  return (
    <>
      <PageHeader title={m.subject} back={<Link to="/messages" className="back" aria-label="All messages"><ChevronLeft size={20} /></Link>}>
        {m.status === 'paused' && <button type="button" className="button button-primary" onClick={() => act('resume', 'Sending again.')}><Play size={17} aria-hidden="true" />Resume</button>}
        {['sending', 'paused'].includes(m.status) && <button type="button" className="button" onClick={stop}><Square size={16} aria-hidden="true" />Stop sending</button>}
        {(finished || m.status === 'paused') && m.failed > 0 && (
          <button type="button" className="button" onClick={() => act('retry', 'Sending the failed ones again.')}><RotateCcw size={17} aria-hidden="true" />Send failed again</button>
        )}
        <button type="button" className="button" onClick={duplicate}><Copy size={17} aria-hidden="true" />Duplicate</button>
        {m.status !== 'sending' && <button type="button" className="icon-button" onClick={remove} aria-label="Delete message" title="Delete"><Trash2 size={18} /></button>}
      </PageHeader>

      {m.status === 'paused' && (
        <div className="note note-warn" role="alert">
          <strong>Sending is paused.</strong> {m.pause_reason}{' '}
          <Link to="/settings" className="link">Check Settings</Link>, then resume.
        </div>
      )}

      <section className="card">
        <div className="report-head">
          <Badge status={m.status} />
          <span className="muted">
            {m.status === 'sending' && `Started ${formatDateTime(m.started_at)}`}
            {m.status === 'paused' && `Started ${formatDateTime(m.started_at)}`}
            {m.status === 'sent' && `Finished ${formatDateTime(m.finished_at)}`}
            {m.status === 'cancelled' && `Stopped ${formatDateTime(m.finished_at)}`}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Sending progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <dl className="report-numbers">
          <div><dt>Sent</dt><dd>{number(m.sent)}</dd></div>
          <div><dt>Waiting</dt><dd>{number(m.waiting)}</dd></div>
          <div><dt>Failed</dt><dd className={m.failed ? 'text-red' : ''}>{number(m.failed)}</dd></div>
          <div><dt>Not sent</dt><dd>{number(m.skipped)}</dd></div>
          <div><dt>Total</dt><dd>{number(m.total)}</dd></div>
        </dl>
      </section>

      <div className="segmented" role="group" aria-label="Show">
        <button type="button" aria-pressed={tab === 'recipients'} onClick={() => setTab('recipients')}>Recipients</button>
        <button type="button" aria-pressed={tab === 'message'} onClick={() => setTab('message')}>Message</button>
      </div>

      {tab === 'recipients' ? (
        <section className="card card-flush">
          <div className="table-bar">
            <div className="chips" role="group" aria-label="Filter by status">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" className={filter === f.key ? 'chip chip-on' : 'chip'} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setShown(PAGE); }}>
                  {f.label} <span className="muted">{number(counts[f.key])}</span>
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Find an email address" aria-label="Find an email address" />
            </label>
          </div>
          <table className="table">
            <thead><tr><th scope="col">Email</th><th scope="col">Status</th><th scope="col" className="hide-small">Sent</th></tr></thead>
            <tbody>
              {rows.slice(0, shown).map((r) => (
                <tr key={r.id}>
                  <td className="break">{r.email}{r.error && <span className="table-sub text-red">{r.error}</span>}</td>
                  <td><Badge status={r.status === 'sending' ? 'pending' : r.status} /></td>
                  <td className="hide-small nowrap">{formatDateTime(r.sent_at)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={3} className="muted">No one here.</td></tr>}
            </tbody>
          </table>
          {rows.length > shown && (
            <div className="table-more"><button type="button" className="button" onClick={() => setShown((n) => n + PAGE)}>Show more ({number(rows.length - shown)} left)</button></div>
          )}
        </section>
      ) : !settings.data ? <Loading /> : (
        <EmailPreview html={html} size={size} onSize={setSize} note="The message as sent, shown with a sample name" subject={renderSubject(m.subject, SAMPLE_CONTACT, general)} />
      )}
      {confirmElement}
    </>
  );
}

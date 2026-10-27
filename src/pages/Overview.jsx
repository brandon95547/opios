// The home page: what to set up first, a few numbers, and the latest messages.
import { Link } from 'react-router-dom';
import { CircleCheck, Mail, Plus } from 'lucide-react';
import { api } from '../api.js';
import { Badge, ErrorNote, Loading, PageHeader, formatDate, number, plural, useLoad } from '../ui.jsx';
import { useNewMessage } from './Messages.jsx';

const STEPS = [
  { key: 'account', title: 'Connect the email account you send from', detail: 'Gmail, or any SMTP account.', to: '/settings' },
  { key: 'address', title: 'Add your mailing address', detail: 'Laws such as CAN-SPAM ask for a postal address at the bottom of every newsletter.', to: '/settings#details' },
  { key: 'contacts', title: 'Add your contacts', detail: 'Import a CSV file, or add people one by one.', to: '/contacts' },
  { key: 'publicUrl', title: 'Give Opios a public web address', detail: 'Until then, unsubscribe links open an email to you instead of a page. Needed once Opios is online.', to: '/settings#details', optional: true },
];

export default function Overview() {
  const overview = useLoad(() => api.get('/api/overview'));
  const messages = useLoad(() => api.get('/api/campaigns'));
  const [creating, newMessage] = useNewMessage();
  const o = overview.data;
  const todo = o ? STEPS.filter((s) => !o.setup[s.key]) : [];

  return (
    <>
      <PageHeader title="Overview">
        <button type="button" className="button button-primary" onClick={newMessage} disabled={creating}><Plus size={18} aria-hidden="true" />New message</button>
      </PageHeader>
      <ErrorNote error={overview.error} onRetry={overview.reload} />
      {!o ? <Loading /> : (
        <>
          {todo.length > 0 && (
            <section className="card setup">
              <h2>Getting started</h2>
              <ol className="steps">
                {STEPS.map((s) => {
                  const done = o.setup[s.key];
                  return (
                    <li key={s.key} className={done ? 'step step-done' : 'step'}>
                      <span className="step-mark" aria-hidden="true">{done ? <CircleCheck size={20} /> : null}</span>
                      <div>
                        {done ? <span className="step-title">{s.title}</span> : <Link className="step-title" to={s.to}>{s.title}</Link>}
                        {s.optional && !done && <span className="tag">Later</span>}
                        <span className="sr-only">{done ? ' (done)' : ''}</span>
                        {!done && <p className="muted">{s.detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          <section className="stats" aria-label="Numbers">
            <Link to="/contacts" className="stat"><span className="stat-value">{number(o.contacts.subscribed)}</span><span className="stat-label">Subscribed contacts</span></Link>
            <Link to="/contacts?status=unsubscribed" className="stat"><span className="stat-value">{number(o.contacts.unsubscribed)}</span><span className="stat-label">Unsubscribed</span></Link>
            <Link to="/messages" className="stat"><span className="stat-value">{number(o.campaigns.sent)}</span><span className="stat-label">Messages sent</span></Link>
            <Link to="/messages" className="stat"><span className="stat-value">{number(o.emailsSent)}</span><span className="stat-label">Emails delivered</span></Link>
          </section>
        </>
      )}
      <section className="card">
        <div className="card-head">
          <h2>Latest messages</h2>
          <Link to="/messages" className="link">All messages</Link>
        </div>
        {!messages.data ? <Loading /> : messages.data.length === 0 ? (
          <p className="muted">No messages yet. <button type="button" className="link-button" onClick={newMessage}>Write your first one.</button></p>
        ) : (
          <ul className="rows">
            {messages.data.slice(0, 5).map((m) => (
              <li key={m.id}>
                <Link to={`/messages/${m.id}`} className="row-link">
                  <Mail size={18} aria-hidden="true" className="row-icon" />
                  <span className="row-main">
                    <span className="row-title">{m.subject || 'Untitled draft'}</span>
                    <span className="muted">{m.status === 'draft' ? `Edited ${formatDate(m.updated_at)}` : `${plural(m.sent, 'email')} sent · ${formatDate(m.started_at)}`}</span>
                  </span>
                  <Badge status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

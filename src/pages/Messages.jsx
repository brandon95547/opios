// Every message: drafts, those going out, and those sent.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Mail, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Badge, Empty, ErrorNote, Loading, PageHeader, formatDateTime, number, useConfirm, useLoad, useToast } from '../ui.jsx';

// Starts a draft and opens it.
export function useNewMessage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const m = await api.post('/api/campaigns');
      navigate(`/messages/${m.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };
  return [busy, start];
}

export function progressText(m) {
  if (m.status === 'draft') return 'Not sent yet';
  if (m.status === 'sending' || m.status === 'paused') return `${number(m.sent)} of ${number(m.total)} sent`;
  const failed = m.failed ? ` · ${number(m.failed)} failed` : '';
  return `Sent to ${number(m.sent)}${failed}`;
}

export default function Messages() {
  const messages = useLoad(() => api.get('/api/campaigns'));
  const [creating, newMessage] = useNewMessage();
  const [confirmElement, confirm] = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const { reload } = messages;
  const sending = messages.data?.some((m) => m.status === 'sending');

  // While something is going out, the numbers keep up.
  useEffect(() => {
    if (!sending) return undefined;
    const timer = setInterval(reload, 3000);
    return () => clearInterval(timer);
  }, [sending, reload]);

  async function duplicate(m) {
    try {
      const copy = await api.post(`/api/campaigns/${m.id}/duplicate`);
      navigate(`/messages/${copy.id}`);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(m) {
    const yes = await confirm({
      title: 'Delete this message?',
      message: m.status === 'draft' ? `“${m.subject || 'Untitled draft'}” will be deleted.` : `“${m.subject}” and its sending report will be deleted. The emails already sent stay sent.`,
      confirm: 'Delete',
      danger: true,
    });
    if (!yes) return;
    try {
      await api.del(`/api/campaigns/${m.id}`);
      messages.setData((list) => list.filter((x) => x.id !== m.id));
      toast('Message deleted.');
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <>
      <PageHeader title="Messages">
        <button type="button" className="button button-primary" onClick={newMessage} disabled={creating}><Plus size={18} aria-hidden="true" />New message</button>
      </PageHeader>
      <ErrorNote error={messages.error} onRetry={messages.reload} />
      {!messages.data ? <Loading /> : messages.data.length === 0 ? (
        <Empty icon={Mail} title="No messages yet" action={<button type="button" className="button button-primary" onClick={newMessage} disabled={creating}>Write a message</button>}>
          Write a message, set it in a template, and send it to your contacts.
        </Empty>
      ) : (
        <div className="card card-flush">
          <table className="table">
            <thead>
              <tr><th scope="col">Message</th><th scope="col">Status</th><th scope="col" className="hide-small">Recipients</th><th scope="col" className="hide-small">Date</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {messages.data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link to={`/messages/${m.id}`} className="table-title">{m.subject || 'Untitled draft'}</Link>
                    <span className="muted table-sub">{m.template_name || 'No template'}</span>
                  </td>
                  <td><Badge status={m.status} /></td>
                  <td className="hide-small">{progressText(m)}</td>
                  <td className="hide-small nowrap">{formatDateTime(m.started_at || m.updated_at)}</td>
                  <td className="table-actions">
                    <button type="button" className="icon-button" onClick={() => duplicate(m)} aria-label={`Duplicate ${m.subject || 'draft'}`} title="Duplicate"><Copy size={17} /></button>
                    {m.status !== 'sending' && (
                      <button type="button" className="icon-button" onClick={() => remove(m)} aria-label={`Delete ${m.subject || 'draft'}`} title="Delete"><Trash2 size={17} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmElement}
    </>
  );
}

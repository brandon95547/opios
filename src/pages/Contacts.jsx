// Contacts: everyone you can send to, filed in lists. Add one by hand, import a CSV, export, or
// select several and change them together.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ListMinus, Pencil, Plus, Search, Trash2, Upload, UserCheck, UserMinus, Users } from 'lucide-react';
import { api, apiUrl } from '../api.js';
import { Badge, Dialog, Empty, ErrorNote, Loading, PageHeader, formatDate, number, plural, useConfirm, useLoad, useToast } from '../ui.jsx';

const PAGE = 50;
const nameOf = (c) => [c.first_name, c.last_name].filter(Boolean).join(' ');

function ContactDialog({ contact, lists, onClose, onSaved, onDelete }) {
  const editing = Boolean(contact?.id);
  const [form, setForm] = useState(() => ({
    email: contact?.email || '',
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    status: contact?.status || 'subscribed',
    list_ids: contact?.list_ids || [],
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleList = (id) => set({ list_ids: form.list_ids.includes(id) ? form.list_ids.filter((x) => x !== id) : [...form.list_ids, id] });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const saved = editing ? await api.put(`/api/contacts/${contact.id}`, form) : await api.post('/api/contacts', form);
      onSaved(saved, editing);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={editing ? 'Edit contact' : 'Add a contact'}>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span className="field-label">Email address</span>
          <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">First name</span>
            <input value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Last name</span>
            <input value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} autoComplete="off" />
          </label>
        </div>
        {lists.length > 0 && (
          <fieldset className="field">
            <legend className="field-label">Lists</legend>
            <div className="chips">
              {lists.map((l) => (
                <label key={l.id} className={form.list_ids.includes(l.id) ? 'chip chip-on' : 'chip'}>
                  <input type="checkbox" checked={form.list_ids.includes(l.id)} onChange={() => toggleList(l.id)} />
                  {l.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {editing && (
          <label className="field">
            <span className="field-label">Status</span>
            <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="subscribed">Subscribed</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
            {contact.status === 'unsubscribed' && form.status === 'subscribed' && (
              <span className="field-hint">Only subscribe someone again if they asked you to.</span>
            )}
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          {editing && <button type="button" className="button button-quiet-danger dialog-actions-start" onClick={() => onDelete(contact)}><Trash2 size={16} aria-hidden="true" />Delete</button>}
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>{editing ? 'Save' : 'Add contact'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ListDialog({ list, onClose, onSaved }) {
  const [name, setName] = useState(list?.name || '');
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try {
      onSaved(list ? await api.put(`/api/lists/${list.id}`, { name }) : await api.post('/api/lists', { name }));
    } catch (err) { setError(err.message); }
  }
  return (
    <Dialog open onClose={onClose} title={list ? 'Rename list' : 'New list'}>
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customers, Friends, Volunteers…" required maxLength={80} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary">{list ? 'Rename' : 'Create list'}</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function Contacts() {
  const data = useLoad(() => api.get('/api/contacts'));
  const toast = useToast();
  const [confirmElement, confirm] = useConfirm();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(() => new Set());
  const [dialog, setDialog] = useState(null);
  const [page, setPage] = useState(0);
  const listId = Number(params.get('list')) || 0;
  const status = params.get('status') || '';
  const query = params.get('q') || '';

  const setFilter = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace: true });
    setPage(0);
  };

  const contacts = data.data?.contacts;
  const lists = data.data?.lists || [];
  const list = lists.find((l) => l.id === listId);
  const shown = useMemo(() => {
    if (!contacts) return [];
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => (!listId || c.list_ids.includes(listId))
      && (!status || c.status === status)
      && (!q || c.email.includes(q) || nameOf(c).toLowerCase().includes(q)));
  }, [contacts, listId, status, query]);
  const pageRows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const allOnPage = pageRows.length > 0 && pageRows.every((c) => selected.has(c.id));
  const listName = (id) => lists.find((l) => l.id === id)?.name;

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const togglePage = () => setSelected((s) => {
    const n = new Set(s);
    for (const c of pageRows) { if (allOnPage) n.delete(c.id); else n.add(c.id); }
    return n;
  });

  async function bulk(action, extra = {}) {
    const ids = [...selected];
    if (action === 'delete') {
      const yes = await confirm({ title: `Delete ${plural(ids.length, 'contact')}?`, message: 'They’re removed from Opios and from every list. Sending reports keep their addresses.', confirm: 'Delete', danger: true });
      if (!yes) return;
    }
    try {
      const { changed } = await api.post('/api/contacts/bulk', { action, ids, ...extra });
      const done = { delete: 'deleted', unsubscribe: 'unsubscribed', resubscribe: 'subscribed again', add_to_list: 'added to the list', remove_from_list: 'taken off the list' }[action];
      toast(`${plural(changed, 'contact')} ${done}.`);
      if (action === 'delete') setSelected(new Set());
      data.reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteOne(contact) {
    const yes = await confirm({ title: 'Delete this contact?', message: `${contact.email} is removed from Opios and from every list.`, confirm: 'Delete', danger: true });
    if (!yes) return;
    try {
      await api.del(`/api/contacts/${contact.id}`);
      setDialog(null);
      toast('Contact deleted.');
      data.reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteList(l) {
    const yes = await confirm({ title: `Delete the list “${l.name}”?`, message: 'Its contacts stay in Opios; only the list goes.', confirm: 'Delete list', danger: true });
    if (!yes) return;
    try {
      await api.del(`/api/lists/${l.id}`);
      if (listId === l.id) setFilter({ list: '' });
      toast('List deleted.');
      data.reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  const exportUrl = `/api/contacts/export.csv?${new URLSearchParams({ ...(listId ? { list_id: listId } : {}), ...(status ? { status } : {}) })}`;

  return (
    <>
      <PageHeader title="Contacts">
        <a className="button" href={apiUrl(exportUrl)} download><Download size={17} aria-hidden="true" />Export</a>
        <Link className="button" to={listId ? `/contacts/import?list=${listId}` : '/contacts/import'}><Upload size={17} aria-hidden="true" />Import CSV</Link>
        <button type="button" className="button button-primary" onClick={() => setDialog({ kind: 'contact', contact: listId ? { list_ids: [listId] } : null })}><Plus size={18} aria-hidden="true" />Add contact</button>
      </PageHeader>
      <ErrorNote error={data.error} onRetry={data.reload} />
      {!contacts ? <Loading /> : contacts.length === 0 && !lists.length ? (
        <Empty
          icon={Users}
          title="No contacts yet"
          action={(
            <div className="row-gap">
              <Link className="button button-primary" to="/contacts/import"><Upload size={17} aria-hidden="true" />Import a CSV file</Link>
              <button type="button" className="button" onClick={() => setDialog({ kind: 'contact' })}><Plus size={18} aria-hidden="true" />Add one by hand</button>
            </div>
          )}
        >
          Import the people you already have from a spreadsheet, or add them one at a time.
        </Empty>
      ) : (
        <div className="contacts">
          <nav className="lists card" aria-label="Lists">
            <button type="button" className={!listId ? 'list-link list-on' : 'list-link'} onClick={() => setFilter({ list: '' })}>
              <span>All contacts</span><span className="muted">{number(contacts.length)}</span>
            </button>
            <div className="lists-head">
              <h2>Lists</h2>
              <button type="button" className="icon-button" onClick={() => setDialog({ kind: 'list' })} aria-label="New list" title="New list"><Plus size={18} /></button>
            </div>
            {lists.map((l) => (
              <div key={l.id} className={listId === l.id ? 'list-item list-on' : 'list-item'}>
                <button type="button" className="list-link" onClick={() => setFilter({ list: String(l.id) })}>
                  <span className="list-name">{l.name}</span><span className="muted">{number(l.count)}</span>
                </button>
                <span className="list-tools">
                  <button type="button" className="icon-button" onClick={() => setDialog({ kind: 'list', list: l })} aria-label={`Rename ${l.name}`} title="Rename"><Pencil size={15} /></button>
                  <button type="button" className="icon-button" onClick={() => deleteList(l)} aria-label={`Delete ${l.name}`} title="Delete"><Trash2 size={15} /></button>
                </span>
              </div>
            ))}
            {!lists.length && <p className="muted lists-empty">Lists group contacts, so a message can go to some of them.</p>}
          </nav>

          <section className="card card-flush contacts-main">
            <div className="table-bar">
              <label className="search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setFilter({ q: e.target.value })} placeholder="Find by name or email" aria-label="Find contacts" />
              </label>
              <select value={status} onChange={(e) => setFilter({ status: e.target.value })} aria-label="Status">
                <option value="">Everyone</option>
                <option value="subscribed">Subscribed</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
              <span className="muted table-count">{list ? `${list.name}: ` : ''}{plural(shown.length, 'contact')}</span>
            </div>

            {selected.size > 0 && (
              <div className="bulk-bar" role="region" aria-label="Selected contacts">
                <strong>{number(selected.size)} selected</strong>
                {lists.length > 0 && (
                  <select aria-label="Add the selected contacts to a list" value="" onChange={(e) => e.target.value && bulk('add_to_list', { list_id: Number(e.target.value) })}>
                    <option value="">Add to list…</option>
                    {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                {list && <button type="button" className="button button-small" onClick={() => bulk('remove_from_list', { list_id: list.id })}><ListMinus size={15} aria-hidden="true" />Take off {list.name}</button>}
                <button type="button" className="button button-small" onClick={() => bulk('unsubscribe')}><UserMinus size={15} aria-hidden="true" />Unsubscribe</button>
                <button type="button" className="button button-small" onClick={() => bulk('resubscribe')}><UserCheck size={15} aria-hidden="true" />Subscribe again</button>
                <button type="button" className="button button-small button-quiet-danger" onClick={() => bulk('delete')}><Trash2 size={15} aria-hidden="true" />Delete</button>
                <button type="button" className="link-button" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            )}

            {shown.length === 0 ? (
              <p className="muted table-none">{contacts.length ? 'No contacts match.' : 'No contacts yet.'}</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" className="check-cell"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="Select everyone on this page" /></th>
                    <th scope="col">Contact</th>
                    <th scope="col" className="hide-small">Lists</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="hide-small">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => (
                    <tr key={c.id} className={selected.has(c.id) ? 'row-selected' : ''}>
                      <td className="check-cell"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.email}`} /></td>
                      <td className="cell-main">
                        <button type="button" className="table-title link-button" onClick={() => setDialog({ kind: 'contact', contact: c })}>{nameOf(c) || c.email}</button>
                        {nameOf(c) && <span className="muted table-sub break">{c.email}</span>}
                      </td>
                      <td className="hide-small">
                        <span className="tags">{c.list_ids.map((id) => <span key={id} className="tag">{listName(id)}</span>)}</span>
                      </td>
                      <td><Badge status={c.status} /></td>
                      <td className="hide-small nowrap">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {shown.length > PAGE && (
              <div className="pager">
                <button type="button" className="button button-small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span className="muted">{number(page * PAGE + 1)}–{number(Math.min(shown.length, page * PAGE + PAGE))} of {number(shown.length)}</span>
                <button type="button" className="button button-small" disabled={(page + 1) * PAGE >= shown.length} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </section>
        </div>
      )}

      {dialog?.kind === 'contact' && (
        <ContactDialog
          contact={dialog.contact}
          lists={lists}
          onClose={() => setDialog(null)}
          onDelete={deleteOne}
          onSaved={(saved, editing) => {
            setDialog(null);
            toast(editing ? 'Contact saved.' : `${saved.email} added.`);
            data.reload();
          }}
        />
      )}
      {dialog?.kind === 'list' && (
        <ListDialog
          list={dialog.list}
          onClose={() => setDialog(null)}
          onSaved={(l) => {
            setDialog(null);
            toast(dialog.list ? 'List renamed.' : `List “${l.name}” created.`);
            data.reload();
          }}
        />
      )}
      {confirmElement}
    </>
  );
}

// Product updates: what's new, improved or fixed in each product, with its date. A brand's
// newsletter takes the ones it hasn't sent yet (or the ones you choose). Scripts can add them
// too, with an API key from Settings.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { KINDS } from '../../shared/updates.js';
import { Dialog, Empty, ErrorNote, Loading, PageHeader, formatDate, plural, useConfirm, useLoad, useToast } from '../ui.jsx';
import MediaPicker from '../components/MediaPicker.jsx';

const KIND_COLORS = { new: 'blue', improved: 'green', fixed: 'amber' };

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function UpdateDialog({ update, brands, defaultBrandId, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(update?.id);
  const [brandId, setBrandId] = useState(update?.brand_id || defaultBrandId || brands[0]?.id);
  const [form, setForm] = useState(() => ({
    product_id: update?.product_id || '',
    title: update?.title || '',
    body: update?.body || '',
    link: update?.link || '',
    image_url: update?.image_url || '',
    kind: update?.kind || 'new',
    status: update?.status || 'published',
    happened_at: toLocalInput(update?.happened_at),
  }));
  const [newProduct, setNewProduct] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const brand = brands.find((b) => b.id === Number(brandId));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      let productId = Number(form.product_id);
      if (form.product_id === 'new') {
        const saved = await api.post(`/api/brands/${brand.id}/products`, { name: newProduct });
        productId = saved.products.find((p) => p.name.toLowerCase() === newProduct.trim().toLowerCase())?.id;
      }
      const body = { ...form, product_id: productId, happened_at: new Date(form.happened_at).toISOString() };
      const saved = editing ? await api.put(`/api/updates/${update.id}`, body) : await api.post('/api/updates', body);
      toast(editing ? 'Update saved.' : 'Update added.');
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={editing ? 'Edit update' : 'Add an update'}>
      <form className="stack" onSubmit={submit}>
        <div className="field-row">
          {brands.length > 1 && (
            <label className="field">
              <span className="field-label">Brand</span>
              <select value={brandId} onChange={(e) => { setBrandId(Number(e.target.value)); set({ product_id: '' }); }}>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="field-label">Product</span>
            <select value={form.product_id} onChange={(e) => set({ product_id: e.target.value })} required>
              <option value="" disabled>Choose a product</option>
              {brand?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="new">A new product…</option>
            </select>
          </label>
        </div>
        {form.product_id === 'new' && (
          <label className="field">
            <span className="field-label">New product’s name</span>
            <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} required maxLength={80} />
          </label>
        )}
        <label className="field">
          <span className="field-label">What changed</span>
          <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Spine templates for every frame" required maxLength={200} />
        </label>
        <label className="field">
          <span className="field-label">Details <span className="muted">(optional)</span></span>
          <textarea rows={3} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder="A sentence or two on what it does and why it helps." maxLength={2000} />
        </label>
        <div className="field">
          <span className="field-label">Kind</span>
          <div className="segmented" role="group" aria-label="Kind">
            {Object.entries(KINDS).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={form.kind === key} onClick={() => set({ kind: key })}>{label}</button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Link <span className="muted">(optional)</span></span>
            <input type="url" value={form.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" />
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input type="datetime-local" value={form.happened_at} onChange={(e) => set({ happened_at: e.target.value })} required />
          </label>
        </div>
        <MediaPicker label="Picture (optional)" value={form.image_url} onChange={(image_url) => set({ image_url })} />
        <label className="check">
          <input type="checkbox" checked={form.status === 'draft'} onChange={(e) => set({ status: e.target.checked ? 'draft' : 'published' })} />
          Draft: keep it out of newsletters for now
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>{editing ? 'Save' : 'Add update'}</button>
        </div>
      </form>
    </Dialog>
  );
}

export default function Updates() {
  const data = useLoad(() => Promise.all([api.get('/api/updates'), api.get('/api/brands')]).then(([updates, brands]) => ({ updates, brands })));
  const [params, setParams] = useSearchParams();
  const [dialog, setDialog] = useState(null);
  const [confirmElement, confirm] = useConfirm();
  const toast = useToast();
  const brandId = Number(params.get('brand')) || 0;
  const show = params.get('show') || '';
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const d = data.data;
  const shown = useMemo(() => (d ? d.updates.filter((u) => (!brandId || u.brand_id === brandId)
    && (!show || (show === 'draft' ? u.status === 'draft' : show === 'sent' ? u.sent : u.status === 'published' && !u.sent))) : []), [d, brandId, show]);

  async function remove(u) {
    const yes = await confirm({ title: 'Delete this update?', message: `“${u.title}” is deleted. Newsletters already sent keep it.`, confirm: 'Delete', danger: true });
    if (!yes) return;
    try {
      await api.del(`/api/updates/${u.id}`);
      data.reload();
      toast('Update deleted.');
    } catch (err) { toast(err.message, 'error'); }
  }

  const noProducts = d && !d.brands.some((b) => b.products.length);

  return (
    <>
      <PageHeader title="Updates">
        {d?.brands.length > 0 && <button type="button" className="button button-primary" onClick={() => setDialog({ update: null })}><Plus size={18} aria-hidden="true" />Add update</button>}
      </PageHeader>
      <ErrorNote error={data.error} onRetry={data.reload} />
      {!d ? <Loading /> : d.brands.length === 0 ? (
        <Empty icon={Sparkles} title="Add your brands first" action={<Link className="button button-primary" to="/settings#brands">Go to Settings › Brands</Link>}>
          Updates belong to products, and products to brands, such as Phansora and Skylanex.
        </Empty>
      ) : (
        <>
          <p className="muted page-intro">What’s new, improved or fixed in your products. A brand’s newsletter shows the updates it hasn’t sent yet, or the ones you choose when you write it.</p>
          <div className="table-bar card filters-bar">
            <div className="chips" role="group" aria-label="Brand">
              <button type="button" className={!brandId ? 'chip chip-on' : 'chip'} aria-pressed={!brandId} onClick={() => setFilter('brand', '')}>All brands</button>
              {d.brands.map((b) => (
                <button key={b.id} type="button" className={brandId === b.id ? 'chip chip-on' : 'chip'} aria-pressed={brandId === b.id} onClick={() => setFilter('brand', String(b.id))}>
                  <span className="dot" style={{ background: b.color }} aria-hidden="true" />{b.name}
                </button>
              ))}
            </div>
            <select value={show} onChange={(e) => setFilter('show', e.target.value)} aria-label="Show">
              <option value="">Every update</option>
              <option value="new">Not sent yet</option>
              <option value="sent">Already sent</option>
              <option value="draft">Drafts</option>
            </select>
            <span className="muted table-count">{plural(shown.length, 'update')}</span>
          </div>
          {noProducts && <p className="note note-warn">Your brands have no products yet. Add one when you add an update, or in <Link to="/settings#brands" className="link">Settings › Brands</Link>.</p>}
          {shown.length === 0 ? (
            <Empty icon={Sparkles} title={d.updates.length ? 'No updates match' : 'No updates yet'} action={<button type="button" className="button button-primary" onClick={() => setDialog({ update: null })}>Add the first one</button>}>
              Each time you ship something, add it here. Your next newsletter picks it up.
            </Empty>
          ) : (
            <ul className="updates">
              {shown.map((u) => (
                <li key={u.id} className="card update">
                  <div className="update-meta">
                    <span className={`badge badge-${KIND_COLORS[u.kind]}`}>{KINDS[u.kind]}</span>
                    <span className="muted">{u.brand_name} › {u.product_name} · {formatDate(u.happened_at)}</span>
                    {u.status === 'draft' ? <span className="badge badge-gray">Draft</span>
                      : u.sent ? <span className="badge badge-green" title={u.sent_in.map((c) => c.subject).join(', ')}>Sent in {u.sent_in[0].subject || 'a newsletter'}</span>
                        : <span className="badge badge-blue">Not sent yet</span>}
                    {u.source === 'api' && <span className="tag">From the API</span>}
                    <span className="update-tools">
                      <button type="button" className="icon-button" aria-label={`Edit ${u.title}`} title="Edit" onClick={() => setDialog({ update: u })}><Pencil size={16} /></button>
                      <button type="button" className="icon-button" aria-label={`Delete ${u.title}`} title="Delete" onClick={() => remove(u)}><Trash2 size={16} /></button>
                    </span>
                  </div>
                  <h2 className="update-title">{u.title}</h2>
                  {u.body && <p className="update-body">{u.body}</p>}
                  {(u.link || u.image_url) && (
                    <p className="muted update-extra">{u.link && <a className="link" href={u.link} target="_blank" rel="noreferrer">{u.link}</a>}{u.link && u.image_url && ' · '}{u.image_url && 'With a picture'}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {dialog && (
        <UpdateDialog
          update={dialog.update}
          brands={d.brands}
          defaultBrandId={brandId}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); data.reload(); }}
        />
      )}
      {confirmElement}
    </>
  );
}

// Settings › Brands (each with its products) and Settings › API keys.
import { useState } from 'react';
import { Copy, KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { BASE, api } from '../api.js';
import { Dialog, Loading, formatDate, formatDateTime, number, plural, useConfirm, useLoad, useToast } from '../ui.jsx';
import MediaPicker from '../components/MediaPicker.jsx';

function BrandDialog({ brand, onClose, onSaved, onDelete }) {
  const editing = Boolean(brand);
  const [form, setForm] = useState(() => ({
    name: brand?.name || '',
    heading: brand?.heading || '',
    color: brand?.color || '#2f6fed',
    logo_url: brand?.logo_url || '',
    website: brand?.website || '',
    from_name: brand?.from_name || '',
    from_email: brand?.from_email || '',
    reply_to: brand?.reply_to || '',
    subscribe_existing: false,
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      onSaved(editing ? await api.put(`/api/brands/${brand.id}`, form) : await api.post('/api/brands', form));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={editing ? `Edit ${brand.name}` : 'Add a brand'}>
      <form className="stack" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Phansora" required maxLength={80} />
          </label>
          <label className="field">
            <span className="field-label">Heading in emails</span>
            <input value={form.heading} onChange={(e) => set({ heading: e.target.value })} placeholder={`${form.name || 'Brand'} Updates`} maxLength={120} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Brand color</span>
            <span className="color-field">
              <input type="color" value={form.color} onChange={(e) => set({ color: e.target.value })} aria-label="Pick the brand color" />
              <input value={form.color} onChange={(e) => set({ color: e.target.value })} maxLength={7} aria-label="Brand color as hex" />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Website <span className="muted">(optional)</span></span>
            <input type="url" value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
          </label>
        </div>
        <MediaPicker label="Logo (optional)" value={form.logo_url} onChange={(logo_url) => set({ logo_url })} hint="Shown above the heading in visual templates. A PNG about 360 pixels wide looks sharp." />
        <div className="field-row field-row-3">
          <label className="field">
            <span className="field-label">From name</span>
            <input value={form.from_name} onChange={(e) => set({ from_name: e.target.value })} placeholder={form.name || 'Phansora'} maxLength={100} />
          </label>
          <label className="field">
            <span className="field-label">From email <span className="muted">(optional)</span></span>
            <input type="email" value={form.from_email} onChange={(e) => set({ from_email: e.target.value })} placeholder="The account’s address" />
          </label>
          <label className="field">
            <span className="field-label">Reply-to <span className="muted">(optional)</span></span>
            <input type="email" value={form.reply_to} onChange={(e) => set({ reply_to: e.target.value })} />
          </label>
        </div>
        <p className="field-hint">A different From email needs the email account’s permission to send as it: in Gmail, add it under Settings › Accounts › Send mail as.</p>
        {!editing && (
          <label className="check">
            <input type="checkbox" checked={form.subscribe_existing} onChange={(e) => set({ subscribe_existing: e.target.checked })} />
            Subscribe everyone who’s subscribed now to this brand
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          {editing && <button type="button" className="button button-quiet-danger dialog-actions-start" onClick={() => onDelete(brand)}><Trash2 size={16} aria-hidden="true" />Delete</button>}
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={busy}>{editing ? 'Save' : 'Add brand'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ProductDialog({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product.name,
    url: product.url || '',
    version: product.version || '',
    description: product.description || '',
    image_url: product.image_url || '',
  });
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  async function submit(e) {
    e.preventDefault();
    try {
      onSaved(await api.put(`/api/products/${product.id}`, form));
    } catch (err) { setError(err.message); }
  }
  return (
    <Dialog open onClose={onClose} title="Edit product">
      <form className="stack" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Name</span>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={80} />
          </label>
          <label className="field">
            <span className="field-label">Version <span className="muted">(optional)</span></span>
            <input value={form.version} onChange={(e) => set({ version: e.target.value })} placeholder="1.2.0" maxLength={30} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Web address <span className="muted">(optional)</span></span>
          <input type="url" value={form.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" />
          <span className="field-hint">Where “Learn more” goes in the newsletter’s Products block.</span>
        </label>
        <label className="field">
          <span className="field-label">Description <span className="muted">(optional)</span></span>
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={400} placeholder="A sentence on what it does and who it’s for." />
        </label>
        <MediaPicker label="Picture (optional)" value={form.image_url} onChange={(image_url) => set({ image_url })} hint="Shown on the product’s card. Three by two (such as 600 × 400 pixels) suits the card." />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button-primary">Save</button>
        </div>
      </form>
    </Dialog>
  );
}

function AddProduct({ brand, onAdded }) {
  const [name, setName] = useState('');
  const toast = useToast();
  async function submit(e) {
    e.preventDefault();
    try {
      onAdded(await api.post(`/api/brands/${brand.id}/products`, { name }));
      setName('');
    } catch (err) { toast(err.message, 'error'); }
  }
  return (
    <form className="add-product" onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a product" aria-label={`Add a product to ${brand.name}`} maxLength={80} required />
      <button type="submit" className="button button-small"><Plus size={15} aria-hidden="true" />Add</button>
    </form>
  );
}

export function BrandsSection() {
  const brands = useLoad(() => api.get('/api/brands'));
  const [dialog, setDialog] = useState(null);
  const [confirmElement, confirm] = useConfirm();
  const toast = useToast();

  async function deleteBrand(b) {
    const yes = await confirm({
      title: `Delete ${b.name}?`,
      message: `Its ${plural(b.products.length, 'product')} and ${plural(b.updates, 'update')} are deleted, and its subscriptions too. Contacts and sent messages stay.`,
      confirm: 'Delete brand',
      danger: true,
    });
    if (!yes) return;
    try {
      await api.del(`/api/brands/${b.id}`);
      setDialog(null);
      brands.reload();
      toast(`${b.name} deleted.`);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteProduct(p) {
    const yes = await confirm({ title: `Delete ${p.name}?`, message: p.updates ? `Its ${plural(p.updates, 'update')} are deleted with it.` : 'It has no updates.', confirm: 'Delete', danger: true });
    if (!yes) return;
    try {
      await api.del(`/api/products/${p.id}`);
      brands.reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <section className="card stack" id="brands" aria-labelledby="brands-title">
      <div className="card-head">
        <div>
          <h2 id="brands-title" className="card-title">Brands</h2>
          <p className="muted">Each brand has its own subscribers, products, updates and heading, such as “Phansora Updates”.</p>
        </div>
        <button type="button" className="button" onClick={() => setDialog({ kind: 'brand' })}><Plus size={17} aria-hidden="true" />Add brand</button>
      </div>
      {!brands.data ? <Loading /> : brands.data.length === 0 ? (
        <p className="muted">No brands yet. Add one for each newsletter you send, such as Phansora and Skylanex.</p>
      ) : (
        <ul className="brands">
          {brands.data.map((b) => (
            <li key={b.id} className="brand-item">
              <div className="brand-head">
                {b.logo_url ? <img className="brand-logo" src={b.logo_url} alt="" /> : <span className="brand-swatch" style={{ background: b.color }} aria-hidden="true" />}
                <div className="brand-text">
                  <strong>{b.name}</strong>
                  <span className="muted">{b.heading} · {plural(b.subscribers, 'subscriber')} · {plural(b.updates, 'update')}</span>
                </div>
                <button type="button" className="icon-button" aria-label={`Edit ${b.name}`} title="Edit" onClick={() => setDialog({ kind: 'brand', brand: b })}><Pencil size={16} /></button>
              </div>
              <div className="products">
                {b.products.map((p) => (
                  <span key={p.id} className="product-chip">
                    <button type="button" className="link-button" onClick={() => setDialog({ kind: 'product', product: p })} title="Edit">{p.name}</button>
                    <span className="muted">{number(p.updates)}</span>
                    <button type="button" className="icon-button" aria-label={`Delete ${p.name}`} onClick={() => deleteProduct(p)}><X size={14} /></button>
                  </span>
                ))}
                <AddProduct brand={b} onAdded={() => brands.reload()} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog?.kind === 'brand' && (
        <BrandDialog
          brand={dialog.brand}
          onClose={() => setDialog(null)}
          onDelete={deleteBrand}
          onSaved={(saved) => { setDialog(null); brands.reload(); toast(dialog.brand ? 'Brand saved.' : `${saved.name} added.`); }}
        />
      )}
      {dialog?.kind === 'product' && <ProductDialog product={dialog.product} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); brands.reload(); }} />}
      {confirmElement}
    </section>
  );
}

export function ApiKeysSection() {
  const keys = useLoad(() => api.get('/api/api-keys'));
  const [made, setMade] = useState(null);
  const [name, setName] = useState('');
  const [confirmElement, confirm] = useConfirm();
  const toast = useToast();
  const endpoint = `${window.location.origin}${BASE}/api/v1/updates`;

  async function create(e) {
    e.preventDefault();
    try {
      setMade(await api.post('/api/api-keys', { name }));
      setName('');
      keys.reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function revoke(k) {
    const yes = await confirm({ title: `Turn off “${k.name}”?`, message: 'Scripts using this key stop working.', confirm: 'Turn off', danger: true });
    if (!yes) return;
    await api.del(`/api/api-keys/${k.id}`).catch((err) => toast(err.message, 'error'));
    keys.reload();
  }

  const example = (key) => `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"brand": "Phansora", "product": "Talari", "title": "Spine templates", "body": "Five layouts for every frame.", "link": "https://phansora.com/talari", "kind": "new"}'`;

  return (
    <section className="card stack" id="api" aria-labelledby="api-title">
      <div>
        <h2 id="api-title" className="card-title">Adding updates from elsewhere</h2>
        <p className="muted">A deploy script, or Claude after shipping a feature, can add updates with a key. <code>kind</code> is new, improved or fixed; a product that doesn’t exist yet is added to the brand.</p>
      </div>
      <form className="add-product" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What the key is for, such as Deploys" aria-label="Name for the new key" maxLength={80} />
        <button type="submit" className="button"><KeyRound size={16} aria-hidden="true" />Create a key</button>
      </form>
      {keys.data?.length > 0 && (
        <ul className="rows">
          {keys.data.map((k) => (
            <li key={k.id} className="key-row">
              <span className="row-main">
                <span className="row-title">{k.name}</span>
                <span className="muted">{k.prefix}… · made {formatDate(k.created_at)} · {k.last_used_at ? `last used ${formatDateTime(k.last_used_at)}` : 'not used yet'}</span>
              </span>
              <button type="button" className="icon-button" aria-label={`Turn off ${k.name}`} title="Turn off" onClick={() => revoke(k)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <details className="hint-box">
        <summary>How a script adds an update</summary>
        <pre className="code-block">{example('opk_…')}</pre>
      </details>
      {made && (
        <Dialog open onClose={() => setMade(null)} title="Your new key" wide>
          <p className="dialog-text">Copy it now: it isn’t shown again. Anyone with it can add updates, so keep it out of public code.</p>
          <div className="key-show">
            <code>{made.key}</code>
            <button type="button" className="button button-small" onClick={() => navigator.clipboard.writeText(made.key).then(() => toast('Key copied.'))}><Copy size={15} aria-hidden="true" />Copy</button>
          </div>
          <pre className="code-block">{example(made.key)}</pre>
          <div className="dialog-actions"><button type="button" className="button button-primary" onClick={() => setMade(null)}>Done</button></div>
        </Dialog>
      )}
      {confirmElement}
    </section>
  );
}

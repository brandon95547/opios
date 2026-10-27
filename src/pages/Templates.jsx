// Templates: the design each message is set into. Start from one of the starters or a copy.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { SAMPLE_BODY, SAMPLE_CONTACT, renderEmail } from '../../shared/render.js';
import { SAMPLE_UPDATES, renderUpdatesHtml } from '../../shared/updates.js';
import { updatesOptions } from '../../shared/design.js';
import { Dialog, Empty, ErrorNote, Loading, PageHeader, formatDate, plural, useConfirm, useLoad, useToast } from '../ui.jsx';
import { EmailFrame } from '../components/EmailPreview.jsx';

export function Thumb({ html, design, brand, general, title }) {
  const page = renderEmail({
    templateHtml: html,
    bodyHtml: SAMPLE_BODY,
    updatesHtml: renderUpdatesHtml(SAMPLE_UPDATES, updatesOptions(design, brand)),
    subject: 'Sample',
    contact: SAMPLE_CONTACT,
    general,
    brand,
    unsubscribeUrl: '#',
  });
  return (
    <div className="thumb" aria-hidden="true">
      <EmailFrame html={page} title={title} className="thumb-frame" />
    </div>
  );
}

function NewDialog({ onClose, general, brands }) {
  const starters = useLoad(() => api.get('/api/templates/starters'));
  const navigate = useNavigate();
  const toast = useToast();
  const [brandId, setBrandId] = useState(brands[0]?.id || '');
  const brand = brands.find((b) => b.id === Number(brandId)) || null;
  async function pick(key) {
    try {
      const t = await api.post('/api/templates', { starter: key, brand_id: brandId || null });
      navigate(`/templates/${t.id}`);
    } catch (err) { toast(err.message, 'error'); }
  }
  return (
    <Dialog open onClose={onClose} title="Start a new template from…" wide>
      {brands.length > 0 && (
        <label className="field field-narrow">
          <span className="field-label">For brand</span>
          <select value={brandId} onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : '')}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value="">Any brand</option>
          </select>
        </label>
      )}
      {!starters.data ? <Loading /> : (
        <div className="template-grid">
          {starters.data.map((s) => (
            <button key={s.key} type="button" className="template-card template-pick" onClick={() => pick(s.key)}>
              <Thumb html={s.html} brand={brand} general={general} title={`${s.name} starter`} />
              <span className="template-name">{s.name} <span className="tag">{s.kind === 'blocks' ? 'Visual' : 'HTML'}</span></span>
            </button>
          ))}
        </div>
      )}
      <p className="field-hint">Visual templates are built from blocks, with a live preview to click on. HTML ones are edited as code.</p>
      <p className="field-hint">To start from one of your own, use Duplicate on its card instead.</p>
    </Dialog>
  );
}

export default function Templates() {
  const data = useLoad(() => Promise.all([api.get('/api/templates'), api.get('/api/settings'), api.get('/api/brands')])
    .then(([templates, settings, brands]) => ({ templates, general: settings.general, brands })));
  const [creating, setCreating] = useState(false);
  const [confirmElement, confirm] = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();

  async function duplicate(t) {
    try {
      const copy = await api.post('/api/templates', { copy_of: t.id });
      navigate(`/templates/${copy.id}`);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(t) {
    const yes = await confirm({
      title: `Delete “${t.name}”?`,
      message: t.drafts ? `${plural(t.drafts, 'draft')} use${t.drafts === 1 ? 's' : ''} it and will need another template. Messages already sent keep their own copy.` : 'Messages already sent keep their own copy of it.',
      confirm: 'Delete',
      danger: true,
    });
    if (!yes) return;
    try {
      await api.del(`/api/templates/${t.id}`);
      toast('Template deleted.');
      data.reload();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <>
      <PageHeader title="Templates">
        <button type="button" className="button button-primary" onClick={() => setCreating(true)}><Plus size={18} aria-hidden="true" />New template</button>
      </PageHeader>
      <p className="muted page-intro">A template is the design around each message: the header, the colors, the footer with your address and the unsubscribe link. Your message goes where the template says <code>{'{{content}}'}</code>.</p>
      <ErrorNote error={data.error} onRetry={data.reload} />
      {!data.data ? <Loading /> : data.data.templates.length === 0 ? (
        <Empty icon={LayoutTemplate} title="No templates" action={<button type="button" className="button button-primary" onClick={() => setCreating(true)}>Make one from a starter</button>} />
      ) : (
        <div className="template-grid">
          {data.data.templates.map((t) => (
            <article key={t.id} className="template-card">
              <Link to={`/templates/${t.id}`} className="template-open" aria-label={`Edit ${t.name}`}>
                <Thumb html={t.html} design={t.design} brand={data.data.brands.find((b) => b.id === t.brand_id)} general={data.data.general} title={`${t.name} preview`} />
              </Link>
              <div className="template-foot">
                <div>
                  <Link to={`/templates/${t.id}`} className="template-name">{t.name}</Link>
                  <span className="muted template-date">{t.kind === 'blocks' ? 'Visual' : 'HTML'} · {t.brand_name || 'Any brand'} · edited {formatDate(t.updated_at)}</span>
                </div>
                <div className="template-tools">
                  <Link to={`/templates/${t.id}`} className="icon-button" aria-label={`Edit ${t.name}`} title="Edit"><Pencil size={16} /></Link>
                  <button type="button" className="icon-button" onClick={() => duplicate(t)} aria-label={`Duplicate ${t.name}`} title="Duplicate"><Copy size={16} /></button>
                  <button type="button" className="icon-button" onClick={() => remove(t)} aria-label={`Delete ${t.name}`} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && data.data && <NewDialog onClose={() => setCreating(false)} general={data.data.general} brands={data.data.brands} />}
      {confirmElement}
    </>
  );
}

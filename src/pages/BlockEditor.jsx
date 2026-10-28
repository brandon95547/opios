// The visual template editor: the email as it will look, built from blocks. Click a block in the
// preview (or the list) to change it; add, move and remove blocks; set the colors and font.
// The preview is the real email, compiled with MJML as it is when the template is saved.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, Copy, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { BLOCK_TYPES, designProblem, designToMjml, newBlock, normalizeDesign, productsOptions, updatesOptions } from '../../shared/design.js';
import { SAMPLE_UPDATES, renderUpdatesHtml } from '../../shared/updates.js';
import { SAMPLE_PRODUCTS, pickProducts, renderProductsHtml } from '../../shared/products.js';
import { SAMPLE_CONTACT, renderEmail } from '../../shared/render.js';
import { Dialog, PageHeader, useToast } from '../ui.jsx';
import { FitStage, SizeToggle } from '../components/EmailPreview.jsx';
import { BlockSettings, StyleSettings } from '../components/BlockSettings.jsx';

const SAMPLE_MESSAGE = '<p>Hi {{first_name|there}},</p><p><em>Sample text.</em> Each newsletter’s own words go here: you write them in Messages › New message, each time you send one. The template keeps the design; the message changes every issue.</p>';
const ADDABLE = ['text', 'image', 'button', 'section', 'updates', 'products', 'cards', 'callout', 'columns', 'divider', 'spacer', 'masthead', 'header', 'footer'];

const summary = (b) => {
  const plain = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  switch (b.type) {
    case 'header': return b.text;
    case 'masthead': return b.image ? 'Wordmark picture' : b.title;
    case 'section': return b.title;
    case 'products': return b.productIds.length ? `${b.productIds.length} chosen` : 'All the brand’s products';
    case 'cards': return b.items.map((i) => i.title).filter(Boolean).join(', ') || 'No cards yet';
    case 'callout': return b.title;
    case 'text': case 'footer': return plain(b.html);
    case 'columns': return plain(b.left);
    case 'image': return b.alt || (b.src ? 'Picture' : 'No picture yet');
    case 'button': return b.text;
    case 'updates': return b.title;
    case 'content': return 'Each message goes here';
    default: return '';
  }
};

// The email in a frame. Clicking a block selects it; the chosen one is outlined. The frame runs
// no scripts of its own: this page listens to it from outside.
function BlockPreview({ html, selected, onSelect, size }) {
  const frame = useRef(null);
  const scroll = useRef(0);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  const mark = (doc, id, reveal) => {
    if (!doc) return;
    doc.querySelectorAll('.ob-selected').forEach((el) => el.classList.remove('ob-selected'));
    const el = id && doc.querySelector(`.obk-${id}`);
    if (el) {
      el.classList.add('ob-selected');
      if (reveal) el.scrollIntoView({ block: 'nearest' });
    }
  };

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const style = doc.createElement('style');
    // Outlined just outside the block, and drawn above its neighbors, so a block's own
    // background can't hide it.
    style.textContent = '.ob{cursor:pointer;position:relative}.ob:hover{outline:2px dashed #9db8f5;outline-offset:0;z-index:1}.ob-selected,.ob-selected:hover{outline:3px solid #2f6fed;outline-offset:0;z-index:2}';
    doc.head.appendChild(style);
    doc.addEventListener('click', (e) => {
      e.preventDefault();
      const el = e.target.closest('.ob');
      const id = el && [...el.classList].find((c) => c.startsWith('obk-'))?.slice(4);
      if (id) selectRef.current(id);
    });
    mark(doc, selected, false);
    frame.current.contentWindow.scrollTo(0, scroll.current);
    frame.current.contentWindow.addEventListener('scroll', () => { scroll.current = frame.current?.contentWindow?.scrollY || 0; });
  };

  useEffect(() => mark(frame.current?.contentDocument, selected, true), [selected]);

  return (
    <FitStage size={size}>
      <iframe ref={frame} className="preview-frame" title="Template preview" srcDoc={html} onLoad={onLoad} sandbox="allow-same-origin" />
    </FitStage>
  );
}

export default function BlockEditor({ template, brands, general }) {
  const toast = useToast();
  const [name, setName] = useState(template.name);
  const [brandId, setBrandId] = useState(template.brand_id || '');
  const [design, setDesign] = useState(() => normalizeDesign(template.design));
  const [saved, setSaved] = useState(() => JSON.stringify({ name: template.name, brandId: template.brand_id || '', design: normalizeDesign(template.design) }));
  const [selected, setSelected] = useState(() => normalizeDesign(template.design).blocks[0]?.id || null);
  const [tab, setTab] = useState('blocks');
  const [view, setView] = useState('edit');
  const [size, setSize] = useState('desktop');
  const [engine, setEngine] = useState(null);
  const [html, setHtml] = useState('');
  const [updates, setUpdates] = useState([]);
  const [busy, setBusy] = useState(false);

  const brand = brands.find((b) => b.id === Number(brandId)) || null;
  const dirty = JSON.stringify({ name, brandId, design }) !== saved;
  const problem = designProblem(design);
  const block = design.blocks.find((b) => b.id === selected);

  // MJML for the browser is large, so it loads with this page only.
  useEffect(() => {
    import('mjml-browser').then((m) => setEngine(() => m.default));
  }, []);

  // The brand's latest updates fill the preview; until there are some, examples do.
  useEffect(() => {
    if (!brand) return setUpdates(SAMPLE_UPDATES);
    let live = true;
    api.get(`/api/updates?brand_id=${brand.id}`).then((list) => {
      const published = list.filter((u) => u.status === 'published');
      if (live) setUpdates(published.length ? published : SAMPLE_UPDATES);
    }).catch(() => live && setUpdates(SAMPLE_UPDATES));
    return () => { live = false; };
  }, [brand]);

  useEffect(() => {
    if (!engine) return undefined;
    const timer = setTimeout(async () => {
      try {
        const { html: compiled } = await engine(designToMjml(design, { brand, preview: true }), { validationLevel: 'soft' });
        const options = updatesOptions(design, brand);
        const productOptions = productsOptions(design, brand);
        const products = brand?.products?.length ? pickProducts(brand.products, productOptions.productIds) : SAMPLE_PRODUCTS;
        setHtml(renderEmail({
          templateHtml: compiled,
          bodyHtml: SAMPLE_MESSAGE,
          updatesHtml: renderUpdatesHtml(updates.slice(0, options.limit), { ...options, timeZone: general.timeZone }),
          productsHtml: renderProductsHtml(products, { ...productOptions, placeholders: true }),
          subject: 'Sample subject',
          preheader: 'Sample preview text',
          contact: SAMPLE_CONTACT,
          general,
          brand,
          unsubscribeUrl: '#',
        }));
      } catch (err) {
        toast(`The preview couldn’t be drawn: ${err.message}`, 'error');
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [engine, design, brand, updates, general, toast]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    const warn = (e) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setBlocks = (fn) => setDesign((d) => ({ ...d, blocks: fn(d.blocks) }));
  const updateBlock = (next) => setBlocks((blocks) => blocks.map((b) => (b.id === next.id ? next : b)));
  const move = (id, by) => setBlocks((blocks) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= blocks.length) return blocks;
    const copy = [...blocks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const add = (type) => {
    const b = newBlock(type);
    setBlocks((blocks) => {
      const i = blocks.findIndex((x) => x.id === selected);
      const copy = [...blocks];
      copy.splice(i < 0 ? copy.length : i + 1, 0, b);
      return copy;
    });
    setSelected(b.id);
  };
  const duplicate = (id) => {
    const original = design.blocks.find((b) => b.id === id);
    const b = { ...structuredClone(original), id: newBlock(original.type).id };
    setBlocks((blocks) => {
      const copy = [...blocks];
      copy.splice(blocks.findIndex((x) => x.id === id) + 1, 0, b);
      return copy;
    });
    setSelected(b.id);
  };
  const remove = (id) => {
    const i = design.blocks.findIndex((b) => b.id === id);
    setBlocks((blocks) => blocks.filter((b) => b.id !== id));
    setSelected(design.blocks[i + 1]?.id || design.blocks[i - 1]?.id || null);
  };

  async function save() {
    if (busy || problem) return;
    setBusy(true);
    try {
      const t = await api.put(`/api/templates/${template.id}`, { name, brand_id: brandId || null, design });
      const clean = normalizeDesign(t.design);
      setDesign(clean);
      setSaved(JSON.stringify({ name: t.name, brandId: t.brand_id || '', design: clean }));
      toast('Template saved.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const blocksList = useMemo(() => design.blocks, [design.blocks]);

  return (
    <>
      <PageHeader title={name || 'Template'} back={<Link to="/templates" className="back" aria-label="Templates"><ChevronLeft size={20} /></Link>}>
        <span className={dirty ? 'save-state save-unsaved' : 'save-state save-saved'} aria-live="polite">{dirty ? 'Not saved' : 'Saved'}</span>
        <button type="button" className="button button-primary" onClick={save} disabled={busy || !dirty || Boolean(problem)}>{busy ? 'Saving…' : 'Save'}</button>
      </PageHeader>
      {problem && <p className="note note-error" role="alert">{problem}</p>}
      <div className="segmented compose-tabs" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
        <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
      </div>
      <div className="compose builder">
        <div className={view === 'edit' ? 'compose-write' : 'compose-write hide-narrow'}>
          <section className="card stack">
            <div className="field-row">
              <label className="field">
                <span className="field-label">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </label>
              <label className="field">
                <span className="field-label">Brand</span>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Any brand</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            </div>
          </section>
          <section className="card stack">
            <div className="segmented" role="group" aria-label="Edit">
              <button type="button" aria-pressed={tab === 'blocks'} onClick={() => setTab('blocks')}>Blocks</button>
              <button type="button" aria-pressed={tab === 'style'} onClick={() => setTab('style')}>Colors and font</button>
            </div>
            {tab === 'style' ? (
              <StyleSettings settings={design.settings} onChange={(settings) => setDesign((d) => ({ ...d, settings }))} brand={brand} />
            ) : (
              <>
                <ol className="block-list" aria-label="Blocks, top to bottom">
                  {blocksList.map((b, i) => (
                    <li key={b.id} className={b.id === selected ? 'block-row block-on' : 'block-row'}>
                      <button type="button" className="block-pick" onClick={() => setSelected(b.id)} aria-current={b.id === selected ? 'true' : undefined}>
                        <span className="block-type">{BLOCK_TYPES[b.type]}</span>
                        <span className="block-summary muted">{summary(b)}</span>
                      </button>
                      <span className="block-tools">
                        <button type="button" className="icon-button" aria-label={`Move ${BLOCK_TYPES[b.type]} up`} title="Move up" disabled={i === 0} onClick={() => move(b.id, -1)}><ArrowUp size={15} /></button>
                        <button type="button" className="icon-button" aria-label={`Move ${BLOCK_TYPES[b.type]} down`} title="Move down" disabled={i === blocksList.length - 1} onClick={() => move(b.id, 1)}><ArrowDown size={15} /></button>
                        {b.type !== 'content' && <button type="button" className="icon-button" aria-label={`Duplicate ${BLOCK_TYPES[b.type]}`} title="Duplicate" onClick={() => duplicate(b.id)}><Copy size={15} /></button>}
                        {b.type !== 'content' && <button type="button" className="icon-button" aria-label={`Delete ${BLOCK_TYPES[b.type]}`} title="Delete" onClick={() => remove(b.id)}><Trash2 size={15} /></button>}
                      </span>
                    </li>
                  ))}
                </ol>
                <label className="field add-block">
                  <span className="field-label"><Plus size={15} aria-hidden="true" /> Add a block {block ? `below “${BLOCK_TYPES[block.type]}”` : ''}</span>
                  <select value="" onChange={(e) => e.target.value && add(e.target.value)}>
                    <option value="">Choose a block…</option>
                    {ADDABLE.map((t) => <option key={t} value={t}>{BLOCK_TYPES[t]}</option>)}
                  </select>
                </label>
                {block && (
                  <div className="block-settings">
                    <h2 className="card-title">{BLOCK_TYPES[block.type]}</h2>
                    <BlockSettings key={block.id} block={block} onChange={updateBlock} brand={brand} />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
        <div className={view === 'preview' ? 'compose-preview' : 'compose-preview hide-narrow'}>
          <div className="preview">
            <div className="preview-bar">
              <span className="preview-label">Preview</span>
              <span className="muted preview-note">Click a block to change it</span>
              <SizeToggle size={size} onChange={setSize} />
            </div>
            {html ? <BlockPreview html={html} selected={selected} onSelect={(id) => { setSelected(id); setTab('blocks'); }} size={size} /> : <div className="loading">Drawing the email…</div>}
          </div>
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

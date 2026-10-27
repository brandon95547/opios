// Choosing a picture: upload one, pick one uploaded before, or paste a web address. Pictures in
// emails need a public address, which uploads get from Opios.
import { useId, useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, Upload, X } from 'lucide-react';
import { api, uploadPicture } from '../api.js';
import { Dialog, Loading, useConfirm, useLoad, useToast } from '../ui.jsx';

function Library({ onPick, onClose }) {
  const media = useLoad(() => api.get('/api/media'));
  const toast = useToast();
  const [confirmElement, confirm] = useConfirm();
  async function remove(m) {
    const yes = await confirm({ title: 'Delete this picture?', message: 'Emails already sent that show it will show an empty box instead.', confirm: 'Delete', danger: true });
    if (!yes) return;
    try {
      await api.del(`/api/media/${m.id}`);
      media.setData((list) => list.filter((x) => x.id !== m.id));
    } catch (err) { toast(err.message, 'error'); }
  }
  return (
    <Dialog open onClose={onClose} title="Uploaded pictures" wide>
      {!media.data ? <Loading /> : media.data.length === 0 ? <p className="muted">Nothing uploaded yet.</p> : (
        <ul className="library">
          {media.data.map((m) => (
            <li key={m.id}>
              <button type="button" className="library-pick" onClick={() => onPick(m.url)} title={m.name}>
                <img src={m.url} alt="" loading="lazy" />
                <span className="library-name">{m.name}</span>
              </button>
              <button type="button" className="icon-button library-delete" aria-label={`Delete ${m.name}`} onClick={() => remove(m)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      {confirmElement}
    </Dialog>
  );
}

export default function MediaPicker({ label = 'Picture', value, onChange, hint }) {
  const id = useId();
  const input = useRef(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [library, setLibrary] = useState(false);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      onChange((await uploadPicture(file)).url);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
      input.current.value = '';
    }
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="media-picker">
        {value ? <img className="media-thumb" src={value} alt="" /> : <span className="media-thumb media-empty" aria-hidden="true"><ImageIcon size={18} /></span>}
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload one" />
        {value && <button type="button" className="icon-button" aria-label="Remove the picture" onClick={() => onChange('')}><X size={16} /></button>}
      </div>
      <div className="row-gap">
        <button type="button" className="button button-small" onClick={() => input.current.click()} disabled={busy}><Upload size={15} aria-hidden="true" />{busy ? 'Uploading…' : 'Upload'}</button>
        <button type="button" className="button button-small" onClick={() => setLibrary(true)}>Uploaded pictures</button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => upload(e.target.files[0])} />
      </div>
      {hint && <span className="field-hint">{hint}</span>}
      {library && <Library onPick={(url) => { onChange(url); setLibrary(false); }} onClose={() => setLibrary(false)} />}
    </div>
  );
}

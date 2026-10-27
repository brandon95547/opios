// Which product updates a message carries: automatically, the newest the brand hasn't sent yet,
// or the ones chosen here, in the order chosen.
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { KINDS, autoUpdates } from '../../shared/updates.js';
import { formatDate, plural } from '../ui.jsx';

export default function UpdatesPicker({ brand, candidates, mode, ids, limit, onChange }) {
  const published = candidates.filter((u) => u.status === 'published');
  const auto = autoUpdates(published, limit);
  const chosen = ids.map((id) => published.find((u) => u.id === id)).filter(Boolean);
  const rest = published.filter((u) => !ids.includes(u.id));

  const choose = () => onChange({ updates_mode: 'pick', update_ids: auto.map((u) => u.id) });
  const toggle = (id) => onChange({ update_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  const move = (id, by) => {
    const i = ids.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    const copy = [...ids];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange({ update_ids: copy });
  };

  const row = (u, { checked, order }) => (
    <li key={u.id} className={mode === 'auto' || checked ? 'update-option' : 'update-option update-option-off'}>
      {mode === 'pick' && <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} aria-label={`Include ${u.title}`} />}
      <span className="update-option-text">
        <span className="update-option-title">{u.title}</span>
        <span className="muted update-option-meta">{KINDS[u.kind]} · {u.product_name} · {formatDate(u.happened_at)}{u.sent ? ` · sent in ${u.sent_in[0]?.subject || 'a newsletter'}` : ''}</span>
      </span>
      {order && (
        <span className="update-order">
          <button type="button" className="icon-button" aria-label={`Move ${u.title} up`} onClick={() => move(u.id, -1)} disabled={order === 1}><ArrowUp size={15} /></button>
          <button type="button" className="icon-button" aria-label={`Move ${u.title} down`} onClick={() => move(u.id, 1)} disabled={order === ids.length}><ArrowDown size={15} /></button>
        </span>
      )}
    </li>
  );

  return (
    <div className="stack">
      <fieldset className="recipients">
        <legend className="sr-only">Which updates</legend>
        <label className="choice">
          <input type="radio" name="updates-mode" checked={mode === 'auto'} onChange={() => onChange({ updates_mode: 'auto' })} />
          <span>Automatic: the newest {plural(limit, 'update')} {brand.name} hasn’t sent yet</span>
        </label>
        <label className="choice">
          <input type="radio" name="updates-mode" checked={mode === 'pick'} onChange={choose} />
          <span>Choose them</span>
        </label>
      </fieldset>
      {mode === 'auto' ? (
        auto.length ? <ul className="updates-pick">{auto.map((u) => row(u, {}))}</ul>
          : <p className="muted">No new updates since {brand.name}’s last newsletter, so this email has none. <Link to="/updates" className="link">Add an update</Link></p>
      ) : published.length === 0 ? (
        <p className="muted">{brand.name} has no published updates yet. <Link to="/updates" className="link">Add one</Link></p>
      ) : (
        <ul className="updates-pick">
          {chosen.map((u, i) => row(u, { checked: true, order: i + 1 }))}
          {rest.map((u) => row(u, { checked: false }))}
        </ul>
      )}
      <p className="field-hint">The updates are fixed when the message is sent, and marked as sent, so the next newsletter doesn’t repeat them.</p>
    </div>
  );
}

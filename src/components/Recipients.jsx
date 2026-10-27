// Choosing who a message goes to: everyone subscribed, the people on some lists, or people picked
// one by one. Only subscribed contacts are counted or sent to: for a brand's message, those
// subscribed to that brand.
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { number, plural } from '../ui.jsx';

const SHOWN = 200;
const nameOf = (c) => [c.first_name, c.last_name].filter(Boolean).join(' ');

const reachable = (contacts, brandId) => contacts.filter((c) => c.status === 'subscribed' && (!brandId || c.brands?.[brandId] === 'subscribed'));

export function audienceSize(audience, contacts, brandId = null) {
  const subscribed = reachable(contacts, brandId);
  if (audience.type === 'lists') {
    const lists = new Set(audience.listIds);
    return subscribed.filter((c) => c.list_ids.some((id) => lists.has(id))).length;
  }
  if (audience.type === 'contacts') {
    const chosen = new Set(audience.contactIds);
    return subscribed.filter((c) => chosen.has(c.id)).length;
  }
  return subscribed.length;
}

export default function Recipients({ audience, onChange, contacts, lists, brand = null }) {
  const name = useId();
  const [query, setQuery] = useState('');
  const subscribed = useMemo(() => reachable(contacts, brand?.id), [contacts, brand]);
  const onList = (listId) => subscribed.filter((c) => c.list_ids.includes(listId)).length;
  const chosen = useMemo(() => new Set(audience.contactIds), [audience.contactIds]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? subscribed.filter((c) => c.email.includes(q) || nameOf(c).toLowerCase().includes(q)) : subscribed;
  }, [subscribed, query]);
  const count = audienceSize(audience, contacts, brand?.id);

  const set = (patch) => onChange({ ...audience, ...patch });
  const toggleList = (id) => set({ listIds: audience.listIds.includes(id) ? audience.listIds.filter((x) => x !== id) : [...audience.listIds, id] });
  const toggleContact = (id) => set({ contactIds: chosen.has(id) ? audience.contactIds.filter((x) => x !== id) : [...audience.contactIds, id] });
  const chooseShown = () => set({ contactIds: [...new Set([...audience.contactIds, ...matches.slice(0, SHOWN).map((c) => c.id)])] });

  if (!contacts.length) {
    return <p className="muted">You have no contacts yet. <Link to="/contacts" className="link">Add or import some</Link> before sending.</p>;
  }

  return (
    <fieldset className="recipients">
      <legend className="sr-only">Send to</legend>
      <label className="choice">
        <input type="radio" name={name} checked={audience.type === 'all'} onChange={() => set({ type: 'all' })} />
        <span>Everyone subscribed{brand ? ` to ${brand.name}` : ''} <span className="muted">({number(subscribed.length)})</span></span>
      </label>
      <label className="choice">
        <input type="radio" name={name} checked={audience.type === 'lists'} onChange={() => set({ type: 'lists' })} disabled={!lists.length} />
        <span>People on some lists {!lists.length && <span className="muted">(you have no lists yet)</span>}</span>
      </label>
      {audience.type === 'lists' && (
        <div className="choice-detail chips">
          {lists.map((l) => (
            <label key={l.id} className={audience.listIds.includes(l.id) ? 'chip chip-on' : 'chip'}>
              <input type="checkbox" checked={audience.listIds.includes(l.id)} onChange={() => toggleList(l.id)} />
              {l.name} <span className="muted">{number(onList(l.id))}</span>
            </label>
          ))}
        </div>
      )}
      <label className="choice">
        <input type="radio" name={name} checked={audience.type === 'contacts'} onChange={() => set({ type: 'contacts' })} />
        <span>People I choose</span>
      </label>
      {audience.type === 'contacts' && (
        <div className="choice-detail">
          <div className="picker-bar">
            <label className="search">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find by name or email" aria-label="Find contacts" />
            </label>
            <button type="button" className="button button-small" onClick={chooseShown} disabled={!matches.length}>Choose all {matches.length > SHOWN ? `${SHOWN} shown` : 'shown'}</button>
            <button type="button" className="button button-small" onClick={() => set({ contactIds: [] })} disabled={!audience.contactIds.length}>Clear</button>
          </div>
          <ul className="picker" aria-label="Contacts">
            {matches.slice(0, SHOWN).map((c) => (
              <li key={c.id}>
                <label className="picker-row">
                  <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggleContact(c.id)} />
                  <span className="picker-name">{nameOf(c) || c.email}</span>
                  {nameOf(c) && <span className="muted picker-email">{c.email}</span>}
                </label>
              </li>
            ))}
            {!matches.length && <li className="muted picker-none">No subscribed contacts match.</li>}
          </ul>
          {matches.length > SHOWN && <p className="field-hint">Showing {SHOWN} of {number(matches.length)}. Search to find others.</p>}
        </div>
      )}
      <p className="recipients-total" aria-live="polite">This message goes to <strong>{plural(count, 'person', 'people')}</strong>.</p>
    </fieldset>
  );
}

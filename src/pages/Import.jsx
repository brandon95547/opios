// Importing contacts from a CSV file (or text pasted from a spreadsheet): read it, say which
// column is which, choose a list, import.
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileSpreadsheet, Upload } from 'lucide-react';
import { api } from '../api.js';
import { guessColumns, mapRows, parseCsv } from '../../shared/csv.js';
import { isEmail, normalizeEmail } from '../../shared/email.js';
import { ErrorNote, Loading, PageHeader, number, plural, useLoad } from '../ui.jsx';

const FIELDS = [
  { key: 'email', label: 'Email address', required: true },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'name', label: 'Full name', hint: 'Used when there are no first and last name columns: split at the first space.' },
];

function Choose({ onRows }) {
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef(null);

  async function read(file) {
    setError('');
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setError('That file is over 20 MB. Split it into smaller files.');
    const rows = parseCsv(await file.text());
    if (!rows.length) return setError('That file has no rows.');
    onRows(rows, file.name);
  }

  return (
    <div className="stack">
      <div
        className={over ? 'drop drop-over' : 'drop'}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files[0]); }}
      >
        <FileSpreadsheet size={32} strokeWidth={1.5} aria-hidden="true" />
        <p><strong>Drop a CSV file here</strong>, or</p>
        <button type="button" className="button button-primary" onClick={() => input.current.click()}><Upload size={17} aria-hidden="true" />Choose a file</button>
        <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={(e) => read(e.target.files[0])} />
        <p className="field-hint">From Excel, Numbers or Google Sheets: File › Export (or Download) › CSV. It needs a column of email addresses; names are optional.</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <details className="card">
        <summary>Or paste the rows instead</summary>
        <label className="field">
          <span className="sr-only">Rows to import</span>
          <textarea className="code" rows={8} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'email,first name,last name\nada@example.com,Ada,Lovelace'} />
        </label>
        <button type="button" className="button" disabled={!pasted.trim()} onClick={() => onRows(parseCsv(pasted), 'Pasted rows')}>Use these rows</button>
      </details>
    </div>
  );
}

export default function Import() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const lists = useLoad(() => api.get('/api/contacts').then((d) => d.lists));
  const brands = useLoad(() => api.get('/api/brands'));
  const [brandIds, setBrandIds] = useState(null);
  const chosenBrands = brandIds ?? (brands.data || []).map((b) => b.id);
  const toggleBrand = (id) => setBrandIds(chosenBrands.includes(id) ? chosenBrands.filter((x) => x !== id) : [...chosenBrands, id]);
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState(null);
  const [target, setTarget] = useState(params.get('list') || '');
  const [newList, setNewList] = useState('');
  const [updateNames, setUpdateNames] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const header = file?.rows[0] || [];
  const width = useMemo(() => Math.max(0, ...(file?.rows.slice(0, 50).map((r) => r.length) || [0])), [file]);
  const mapped = useMemo(() => (file && columns ? mapRows(file.rows, columns) : []), [file, columns]);
  const summary = useMemo(() => {
    const seen = new Set();
    let valid = 0;
    let invalid = 0;
    let dupes = 0;
    for (const r of mapped) {
      const e = normalizeEmail(r.email);
      if (!isEmail(e)) invalid += 1;
      else if (seen.has(e)) dupes += 1;
      else { seen.add(e); valid += 1; }
    }
    return { valid, invalid, dupes };
  }, [mapped]);

  const columnName = (i) => {
    const sample = file.rows[columns.hasHeader ? 1 : 0]?.[i];
    const head = columns.hasHeader ? header[i]?.trim() : '';
    return `${head || `Column ${i + 1}`}${sample ? ` (${sample.slice(0, 30)})` : ''}`;
  };

  function start(rows, name) {
    setFile({ rows, name });
    setColumns(guessColumns(rows));
    setResult(null);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const body = { rows: mapped, update_existing: updateNames, brand_ids: chosenBrands };
      if (target === 'new') body.new_list = newList;
      else if (target) body.list_id = Number(target);
      setResult(await api.post('/api/contacts/import', body));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const back = <Link to="/contacts" className="back" aria-label="Contacts"><ChevronLeft size={20} /></Link>;

  if (result) {
    const listId = result.listId;
    return (
      <>
        <PageHeader title="Import finished" back={back} />
        <section className="card stack">
          <ul className="result-list">
            <li><strong>{plural(result.added, 'new contact')}</strong> added</li>
            {result.updated > 0 && <li><strong>{plural(result.updated, 'contact')}</strong> already here, names updated</li>}
            {result.unchanged > 0 && <li><strong>{plural(result.unchanged, 'contact')}</strong> already here{listId ? ', added to the list' : ''}</li>}
            {result.keptUnsubscribed > 0 && <li><strong>{plural(result.keptUnsubscribed, 'person', 'people')}</strong> had unsubscribed, and stay unsubscribed</li>}
            {result.duplicates > 0 && <li><strong>{plural(result.duplicates, 'row')}</strong> repeated an address higher up, and {result.duplicates === 1 ? 'was' : 'were'} skipped</li>}
            {result.invalid > 0 && (
              <li>
                <strong>{plural(result.invalid, 'row')}</strong> had no valid email address, and {result.invalid === 1 ? 'was' : 'were'} skipped
                <ul className="muted">{result.invalidExamples.map((x) => <li key={x.row}>Row {number(x.row + (columns.hasHeader ? 1 : 0))}: {x.email || '(empty)'}</li>)}</ul>
              </li>
            )}
          </ul>
          <div className="row-gap">
            <button type="button" className="button button-primary" onClick={() => navigate(listId ? `/contacts?list=${listId}` : '/contacts')}>See the contacts</button>
            <button type="button" className="button" onClick={() => { setFile(null); setResult(null); }}>Import another file</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Import contacts" back={back} />
      {!file ? <Choose onRows={start} /> : !lists.data ? <Loading /> : (
        <div className="stack">
          <section className="card stack">
            <div className="card-head">
              <h2>Which column is which?</h2>
              <button type="button" className="link-button" onClick={() => setFile(null)}>Choose another file</button>
            </div>
            <p className="muted">{file.name}: {plural(file.rows.length - (columns.hasHeader ? 1 : 0), 'row')}.</p>
            <label className="check">
              <input type="checkbox" checked={columns.hasHeader} onChange={(e) => setColumns({ ...columns, hasHeader: e.target.checked })} />
              The first row holds column names, not a contact
            </label>
            <div className="map-grid">
              {FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span className="field-label">{f.label}{f.required && <span className="muted"> (needed)</span>}</span>
                  <select value={columns[f.key]} onChange={(e) => setColumns({ ...columns, [f.key]: Number(e.target.value) })}>
                    <option value={-1}>{f.required ? 'Choose a column' : 'None'}</option>
                    {Array.from({ length: width }, (_, i) => <option key={i} value={i}>{columnName(i)}</option>)}
                  </select>
                  {f.hint && <span className="field-hint">{f.hint}</span>}
                </label>
              ))}
            </div>
          </section>

          <section className="card card-flush">
            <div className="table-bar">
              <h2 className="card-title">First rows</h2>
              <span className="muted table-count">
                {plural(summary.valid, 'contact')} to import
                {summary.invalid > 0 && ` · ${plural(summary.invalid, 'row')} without a valid email`}
                {summary.dupes > 0 && ` · ${plural(summary.dupes, 'repeat')}`}
              </span>
            </div>
            <table className="table">
              <thead><tr><th scope="col">Email</th><th scope="col">First name</th><th scope="col">Last name</th></tr></thead>
              <tbody>
                {mapped.slice(0, 6).map((r, i) => (
                  <tr key={i}>
                    <td className="break">{r.email || <span className="muted">(empty)</span>}{r.email && !isEmail(r.email) && <span className="table-sub text-red">Not a valid email address</span>}</td>
                    <td>{r.first_name}</td>
                    <td>{r.last_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card stack">
            <h2 className="card-title">Where they go</h2>
            {brands.data?.length > 0 && (
              <fieldset className="field">
                <legend className="field-label">Subscribe them to</legend>
                <div className="chips">
                  {brands.data.map((b) => (
                    <label key={b.id} className={chosenBrands.includes(b.id) ? 'chip chip-on' : 'chip'}>
                      <input type="checkbox" checked={chosenBrands.includes(b.id)} onChange={() => toggleBrand(b.id)} />
                      {b.name}
                    </label>
                  ))}
                </div>
                <span className="field-hint">Someone who unsubscribed from a brand stays unsubscribed from it.</span>
              </fieldset>
            )}
            <label className="field">
              <span className="field-label">Add them to a list</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">No list, just contacts</option>
                {lists.data.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="new">A new list…</option>
              </select>
            </label>
            {target === 'new' && (
              <label className="field">
                <span className="field-label">New list’s name</span>
                <input value={newList} onChange={(e) => setNewList(e.target.value)} maxLength={80} autoFocus />
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={updateNames} onChange={(e) => setUpdateNames(e.target.checked)} />
              Update the names of contacts who are already here
            </label>
            <p className="field-hint">People who unsubscribed stay unsubscribed, even if they’re in this file. Only import people who agreed to get your emails.</p>
            <ErrorNote error={error} />
            <div>
              <button type="button" className="button button-primary" onClick={submit} disabled={busy || columns.email < 0 || !summary.valid || (target === 'new' && !newList.trim()) || (brands.data?.length > 0 && !chosenBrands.length)}>
                <Upload size={17} aria-hidden="true" />{busy ? 'Importing…' : `Import ${plural(summary.valid, 'contact')}`}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

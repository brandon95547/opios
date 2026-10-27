// Reading and writing CSV, used by the contact import (in the browser) and export (on the server).
// Handles quoted fields, doubled quotes, line breaks inside quotes, a byte-order mark, and files
// saved with semicolons or tabs instead of commas (as Excel does in some countries).

export function detectDelimiter(text) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of text.slice(0, 10000)) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch] += 1;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
  }
  const [best, hits] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return hits > 0 ? best : ',';
}

export function parseCsv(text, delimiter = detectDelimiter(text)) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // Blank lines (often at the end of a file) are not rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// A cell that starts with = + - or @ is read as a formula by spreadsheet apps, so it is written
// with a leading apostrophe, which they show as plain text.
const quoteCell = (value) => {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows) => `${rows.map((r) => r.map(quoteCell).join(',')).join('\r\n')}\r\n`;

// Which column holds what, guessed from the header row, or from the cells when there is none.
const HEADER_NAMES = {
  email: ['email', 'e-mail', 'email address', 'e-mail address', 'mail', 'emailaddress'],
  first_name: ['first name', 'firstname', 'first', 'given name', 'fname', 'forename'],
  last_name: ['last name', 'lastname', 'last', 'surname', 'family name', 'lname'],
  name: ['name', 'full name', 'fullname', 'display name', 'contact name'],
};

const normalizeHeader = (s) => s.trim().toLowerCase().replace(/[_\s]+/g, ' ');
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

export function guessColumns(rows) {
  const first = rows[0] || [];
  const hasHeader = !first.some(looksLikeEmail);
  const map = { email: -1, first_name: -1, last_name: -1, name: -1 };
  if (hasHeader) {
    first.forEach((cell, i) => {
      const h = normalizeHeader(cell);
      for (const [key, names] of Object.entries(HEADER_NAMES)) {
        if (map[key] === -1 && names.includes(h)) map[key] = i;
      }
    });
  }
  if (map.email === -1) {
    // No header named the email column: take the column that most often holds one.
    const sample = rows.slice(hasHeader ? 1 : 0, 50);
    let best = 0;
    for (let i = 0; i < first.length; i += 1) {
      const hits = sample.filter((r) => looksLikeEmail(r[i] || '')).length;
      if (hits > best) { best = hits; map.email = i; }
    }
  }
  return { hasHeader, ...map };
}

// "Ada Lovelace" → first "Ada", last "Lovelace"; "Ada" → first "Ada".
export function splitName(full) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: '', last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

// The rows to import, from the parsed file and the chosen columns.
export function mapRows(rows, columns) {
  const body = columns.hasHeader ? rows.slice(1) : rows;
  const cell = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  return body.map((r) => {
    let first = cell(r, columns.first_name);
    let last = cell(r, columns.last_name);
    if (!first && !last && columns.name >= 0) ({ first_name: first, last_name: last } = splitName(cell(r, columns.name)));
    return { email: cell(r, columns.email), first_name: first, last_name: last };
  });
}

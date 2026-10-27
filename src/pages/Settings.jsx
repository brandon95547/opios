// Settings: the email account messages go out from, the newsletter's details, and the login.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CircleAlert, CircleCheck, Download } from 'lucide-react';
import { BASE, api, apiUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import { PROVIDERS, SECURITY } from '../../shared/providers.js';
import { ErrorNote, Loading, PageHeader, useLoad, useToast } from '../ui.jsx';
import { ApiKeysSection, BrandsSection } from './SettingsBrands.jsx';

const BROWSER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const ZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [BROWSER_ZONE];

const isLocal = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return /^(localhost|0\.0\.0\.0|::1?|127(\.\d+){3})$/i.test(host) || host.endsWith('.localhost') || host.endsWith('.local');
  } catch {
    return false;
  }
};

function Result({ result }) {
  if (!result) return null;
  const Icon = result.ok ? CircleCheck : CircleAlert;
  return <p className={result.ok ? 'result result-ok' : 'result result-error'} role="status"><Icon size={18} aria-hidden="true" />{result.message}</p>;
}

function AccountForm({ smtp, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...smtp, pass: '' });
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState(null);
  const preset = PROVIDERS[form.provider] || PROVIDERS.other;
  const isOther = form.provider === 'other';
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setResult(null); };

  function chooseProvider(provider) {
    const p = PROVIDERS[provider];
    set(provider === 'other'
      ? { provider, host: form.provider === 'other' ? form.host : '', port: p.port, security: p.security }
      : { provider, host: p.host, port: p.port, security: p.security });
  }

  // For Gmail and the like, the sign-in address is also the one messages come from.
  function setUser(user) {
    const follow = !isOther && (!form.fromEmail || form.fromEmail === form.user);
    set(follow ? { user, fromEmail: user } : { user });
  }

  async function run(kind) {
    setBusy(kind);
    setResult(null);
    try {
      if (kind === 'save') {
        const { smtp: saved } = await api.put('/api/settings/smtp', form);
        setForm({ ...saved, pass: '' });
        onSaved(saved);
        toast('Email account saved.');
      } else if (kind === 'verify') {
        await api.post('/api/settings/smtp/verify', form);
        setResult({ ok: true, message: 'Connected and signed in. Save to use this account.' });
      } else {
        await api.post('/api/settings/smtp/test', { ...form, to: form.fromEmail });
        setResult({ ok: true, message: `Test email sent to ${form.fromEmail}. Check that inbox (and its spam folder).` });
      }
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="card stack" aria-labelledby="account-title">
      <div>
        <h2 id="account-title" className="card-title">Email account</h2>
        <p className="muted">Messages are sent through this account, one at a time, and show up in its Sent folder only if the provider files them there.</p>
      </div>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); run('save'); }} autoComplete="off">
        <label className="field">
          <span className="field-label">Provider</span>
          <select value={form.provider} onChange={(e) => chooseProvider(e.target.value)}>
            {Object.entries(PROVIDERS).map(([key, p]) => <option key={key} value={key}>{p.name}</option>)}
          </select>
          <span className="field-hint">{preset.help}</span>
        </label>
        {isOther && (
          <div className="field-row field-row-3">
            <label className="field field-grow">
              <span className="field-label">SMTP server</span>
              <input value={form.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.example.com" required />
            </label>
            <label className="field">
              <span className="field-label">Port</span>
              <input type="number" min={1} max={65535} value={form.port} onChange={(e) => set({ port: Number(e.target.value) })} required />
            </label>
            <label className="field">
              <span className="field-label">Security</span>
              <select value={form.security} onChange={(e) => set({ security: e.target.value })}>
                {Object.entries(SECURITY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="field-row">
          <label className="field">
            <span className="field-label">{isOther ? 'Username' : `${preset.name} address`}</span>
            <input value={form.user} onChange={(e) => setUser(e.target.value)} autoComplete="off" placeholder={isOther ? 'Often your email address' : 'you@example.com'} required={!isOther} />
          </label>
          <label className="field">
            <span className="field-label">{isOther ? 'Password' : 'App password'}</span>
            <input
              type="password"
              value={form.pass}
              onChange={(e) => set({ pass: e.target.value })}
              autoComplete="new-password"
              placeholder={smtp.hasPassword ? 'Saved. Type a new one to replace it.' : ''}
              required={!isOther && !smtp.hasPassword}
            />
          </label>
        </div>
        {smtp.passUnreadable && <p className="note note-warn">The saved password can’t be read any more (the key in the data folder changed). Enter it again.</p>}
        <div className="field-row field-row-3">
          <label className="field">
            <span className="field-label">From name</span>
            <input value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} placeholder="Your name or business" maxLength={100} />
          </label>
          <label className="field">
            <span className="field-label">From email</span>
            <input type="email" value={form.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field-label">Reply-to <span className="muted">(optional)</span></span>
            <input type="email" value={form.replyTo} onChange={(e) => set({ replyTo: e.target.value })} placeholder="Where replies go" />
          </label>
        </div>
        <Result result={result} />
        <div className="row-gap">
          <button type="submit" className="button button-primary" disabled={Boolean(busy)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
          <button type="button" className="button" disabled={Boolean(busy)} onClick={() => run('verify')}>{busy === 'verify' ? 'Checking…' : 'Check connection'}</button>
          <button type="button" className="button" disabled={Boolean(busy) || !form.fromEmail} onClick={() => run('test')}>{busy === 'test' ? 'Sending…' : 'Send me a test email'}</button>
        </div>
      </form>
    </section>
  );
}

function DetailsForm({ general, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({ ...general, timeZone: general.timeZone || BROWSER_ZONE }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const here = window.location.origin + BASE;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { general: saved } = await api.put('/api/settings/general', form);
      setForm(saved);
      onSaved(saved);
      toast('Newsletter details saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" id="details" aria-labelledby="details-title">
      <h2 id="details-title" className="card-title">Newsletter details</h2>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Newsletter name</span>
          <input value={form.orgName} onChange={(e) => set({ orgName: e.target.value })} placeholder="Shown in the templates’ header and footer" maxLength={100} />
        </label>
        <label className="field">
          <span className="field-label">Mailing address</span>
          <textarea rows={3} value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder={'123 Main Street\nSpringfield, IL 62701'} maxLength={500} />
          <span className="field-hint">Laws such as CAN-SPAM ask for a postal address (a P.O. box is fine) at the bottom of every newsletter. Templates show it where they say {'{{address}}'}.</span>
        </label>
        <label className="field">
          <span className="field-label">Opios’s public web address</span>
          <input type="url" value={form.publicUrl} onChange={(e) => set({ publicUrl: e.target.value })} placeholder="https://news.example.com" />
          <span className="field-hint">
            Unsubscribe links point here, so readers can unsubscribe with one click. Until Opios is online at an address like this, the links open an email to you instead, and you unsubscribe the person by hand.
            {!form.publicUrl && !isLocal(here) && <> <button type="button" className="link-button" onClick={() => set({ publicUrl: here })}>Use {here}</button></>}
          </span>
          {form.publicUrl && isLocal(form.publicUrl) && <span className="field-hint text-amber">That address only works on this computer, so readers couldn’t open it. The links will open an email to you instead.</span>}
        </label>
        <label className="field field-narrow">
          <span className="field-label">Time zone</span>
          <select value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
            {(ZONES.includes(form.timeZone) ? ZONES : [form.timeZone, ...ZONES]).map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </select>
          <span className="field-hint">For the dates on updates in your emails.</span>
        </label>
        <label className="field field-narrow">
          <span className="field-label">Sending speed (emails a minute)</span>
          <input type="number" min={1} max={600} value={form.ratePerMinute} onChange={(e) => set({ ratePerMinute: Number(e.target.value) })} required />
          <span className="field-hint">Slower is safer: providers may block an account that sends too fast. 20 a minute suits Gmail.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </section>
  );
}

function LoginForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ username: user.username, currentPassword: '', newPassword: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword && form.newPassword !== form.again) return setError('The two new passwords don’t match.');
    setBusy(true);
    try {
      const { user: saved } = await api.put('/api/auth/account', { username: form.username, currentPassword: form.currentPassword, newPassword: form.newPassword || undefined });
      setUser(saved);
      setForm({ username: saved.username, currentPassword: '', newPassword: '', again: '' });
      toast(form.newPassword ? 'Password changed. Other browsers are signed out.' : 'Login saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack" aria-labelledby="login-title">
      <h2 id="login-title" className="card-title">Your login</h2>
      <form className="stack" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Username</span>
            <input value={form.username} onChange={(e) => set({ username: e.target.value })} autoComplete="username" required />
          </label>
          <label className="field">
            <span className="field-label">Current password</span>
            <input type="password" value={form.currentPassword} onChange={(e) => set({ currentPassword: e.target.value })} autoComplete="current-password" required />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">New password <span className="muted">(optional)</span></span>
            <input type="password" value={form.newPassword} onChange={(e) => set({ newPassword: e.target.value })} autoComplete="new-password" minLength={8} />
          </label>
          <label className="field">
            <span className="field-label">New password again</span>
            <input type="password" value={form.again} onChange={(e) => set({ again: e.target.value })} autoComplete="new-password" />
          </label>
        </div>
        <p className="field-hint">Forgot it? On the computer Opios runs on, run <code>npm run reset-password</code> in its folder.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save login'}</button></div>
      </form>
    </section>
  );
}

// Copies to keep. Contacts and the database live only where Opios runs, never in its code or on
// GitHub, so these downloads are how they leave it.
function DataSection() {
  return (
    <section className="card stack" id="data" aria-labelledby="data-title">
      <div>
        <h2 id="data-title" className="card-title">Your data</h2>
        <p className="muted">Your contacts and messages are kept only where Opios runs. Download copies now and then to keep them safe.</p>
      </div>
      <div className="downloads">
        <div className="download">
          <div>
            <h3>Contacts</h3>
            <p className="muted">A CSV file of every contact, with their names, lists and whether they’re subscribed. It opens in Excel or Google Sheets, and Import CSV takes it back.</p>
          </div>
          <a className="button" href={apiUrl('/api/contacts/export.csv')} download><Download size={17} aria-hidden="true" />Export contacts</a>
        </div>
        <div className="download">
          <div>
            <h3>Everything</h3>
            <p className="muted">The whole database as one SQLite file: contacts and lists, templates, messages and their sending reports, and settings. The saved email password stays locked in it, so after a restore you enter it again.</p>
          </div>
          <a className="button" href={apiUrl('/api/export/database')} download><Download size={17} aria-hidden="true" />Download database</a>
        </div>
      </div>
    </section>
  );
}

export default function Settings() {
  const data = useLoad(() => api.get('/api/settings'));
  const location = useLocation();
  const loaded = Boolean(data.data);
  useEffect(() => {
    if (loaded && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [loaded, location.hash]);

  return (
    <>
      <PageHeader title="Settings" />
      <ErrorNote error={data.error} onRetry={data.reload} />
      {!data.data ? <Loading /> : (
        <div className="stack settings">
          <AccountForm smtp={data.data.smtp} onSaved={(smtp) => data.setData((d) => ({ ...d, smtp }))} />
          <DetailsForm general={data.data.general} onSaved={(general) => data.setData((d) => ({ ...d, general }))} />
          <BrandsSection />
          <ApiKeysSection />
          <DataSection />
          <LoginForm />
        </div>
      )}
    </>
  );
}

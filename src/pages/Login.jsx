// Signing in, or, the very first time, choosing the username and password.
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Loading } from '../ui.jsx';

export default function Login() {
  const auth = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.loading) return <Loading />;
  if (auth.user) return <Navigate to={location.state?.from || '/'} replace />;
  const setup = auth.needsSetup;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (setup && password !== again) return setError('The two passwords don’t match.');
    setBusy(true);
    try {
      if (setup) await auth.setUp(username, password);
      else await auth.signIn(username, password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true"><Mail size={20} strokeWidth={2.25} /></span>
          Opios
        </div>
        <h1>{setup ? 'Create your login' : 'Sign in'}</h1>
        {setup && <p className="muted">This is the only login for this Opios. Choose a password of at least 8 characters.</p>}
        <label className="field">
          <span className="field-label">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 8 : undefined} required />
        </label>
        {setup && (
          <label className="field">
            <span className="field-label">Password again</span>
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary button-block" disabled={busy}>
          {busy ? 'One moment…' : setup ? 'Create login' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

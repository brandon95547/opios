// Pieces every page uses: loading data, messages that pop up, dialogs, headers and badges.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Loads data when the page opens (and again on reload()).
export function useLoad(load, deps = []) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    run().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error) => live && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => { live = false; };
  }, [run]);
  useEffect(() => reload(), [reload]);
  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next })), []);
  return { ...state, reload, setData };
}

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.message}</span>
            <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Dialog({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) {
      d.showModal();
      // The dialog opens after its fields mount, so focus goes in here: to the field marked for
      // it, or else the first one (not the close button).
      (d.querySelector('[data-autofocus]') || d.querySelector('.dialog-body input, .dialog-body select, .dialog-body textarea'))?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog dialog-wide' : 'dialog'}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {open && (
        <div className="dialog-body">
          <div className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ask({ title, message, confirm, danger }) opens a dialog and resolves true or false.
export function useConfirm() {
  const [pending, setPending] = useState(null);
  const ask = useCallback((options) => new Promise((resolve) => setPending({ ...options, resolve })), []);
  const answer = (yes) => {
    pending?.resolve(yes);
    setPending(null);
  };
  const element = (
    <Dialog open={Boolean(pending)} onClose={() => answer(false)} title={pending?.title || 'Are you sure?'}>
      {pending?.message && <p className="dialog-text">{pending.message}</p>}
      <div className="dialog-actions">
        <button type="button" className="button" onClick={() => answer(false)}>Cancel</button>
        <button type="button" className={pending?.danger ? 'button button-danger' : 'button button-primary'} onClick={() => answer(true)} data-autofocus>
          {pending?.confirm || 'OK'}
        </button>
      </div>
    </Dialog>
  );
  return [element, ask];
}

export function PageHeader({ title, children, back }) {
  return (
    <header className="page-header">
      <div className="page-title">
        {back}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size={32} strokeWidth={1.5} aria-hidden="true" />}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

const BADGES = {
  draft: ['Draft', 'gray'],
  sending: ['Sending', 'blue'],
  paused: ['Paused', 'amber'],
  sent: ['Sent', 'green'],
  cancelled: ['Stopped', 'gray'],
  subscribed: ['Subscribed', 'green'],
  unsubscribed: ['Unsubscribed', 'gray'],
  pending: ['Waiting', 'blue'],
  failed: ['Failed', 'red'],
  skipped: ['Not sent', 'gray'],
};

export function Badge({ status }) {
  const [label, color] = BADGES[status] || [status, 'gray'];
  return <span className={`badge badge-${color}`}>{label}</span>;
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading" role="status">{label}</div>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="note note-error" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && <button type="button" className="button button-small" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export const number = (n) => Number(n || 0).toLocaleString('en-US');
export const plural = (n, one, many = `${one}s`) => `${number(n)} ${n === 1 ? one : many}`;

export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
export const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');

// Puts text where the cursor is in an input or textarea, and leaves the cursor after it.
export function insertAtCursor(input, value, piece, onChange) {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? value.length;
  onChange(value.slice(0, start) + piece + value.slice(end));
  requestAnimationFrame(() => {
    input?.focus();
    input?.setSelectionRange(start + piece.length, start + piece.length);
  });
}

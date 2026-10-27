// Talking to the Opios server. Every call returns the JSON reply, or throws an Error whose message
// is the server's own explanation.

// The path Opios is served under ('' or, say, '/opios'), set when it was built.
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const apiUrl = (url) => BASE + url;

let signedOut = () => {};
export const onSignedOut = (fn) => { signedOut = fn; };

async function request(method, url, body) {
  const res = await fetch(apiUrl(url), {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (res.status === 401 && !url.startsWith('/api/auth/')) signedOut();
  if (!res.ok) {
    const err = new Error(data?.error || `Something went wrong (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};

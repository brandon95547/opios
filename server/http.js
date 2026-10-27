// Small helpers shared by the API routes.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const fail = (status, message) => { throw new HttpError(status, message); };

// A route's numeric :id, or a 404.
export function idParam(req, name = 'id') {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) fail(404, 'Not found.');
  return id;
}

// A trimmed string field from a request body, cut to a sane length.
export const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);

// A list of positive whole numbers (ids) from a request body.
export const ids = (value) => (Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);

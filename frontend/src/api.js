const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

let tokenGetter = () => localStorage.getItem('token');

export function setTokenGetter(fn) { tokenGetter = fn; }

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const t = tokenGetter();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const e = new Error('Could not reach the server');
    e.cause = err;
    throw e;
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch {}
  }

  if (!res.ok) {
    const message = data?.error || data?.errors?.join?.(', ') || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data   = data;
    throw err;
  }

  return data;
}

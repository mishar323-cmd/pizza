/* eslint-disable */
import React from 'react';

const TOKEN_KEY = 'dvp_session';

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function writeToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data || {}; }
}

export function formatPhone(p) {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return p || '';
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}`;
}

// Mirrors the server rule (handlers/loyalty.go) for the checkout preview.
export function pizzaGift(pizzasBefore, items) {
  const prices = [];
  (items || []).forEach(it => {
    if (it.cat !== 'pizza' || !(it.price > 0)) return;
    for (let i = 0; i < Math.min(it.qty, 100); i++) prices.push(it.price);
  });
  if (!prices.length) return { qty: 0, discount: 0 };
  const qty = Math.floor((pizzasBefore + prices.length) / 8) - Math.floor(pizzasBefore / 8);
  if (qty <= 0) return { qty: 0, discount: 0 };
  prices.sort((a, b) => a - b);
  return { qty, discount: Math.round(prices.slice(0, qty).reduce((s, p) => s + p, 0)) };
}

export function useAuth() {
  const [token, setToken] = React.useState(readToken);
  const [me, setMe] = React.useState(null);
  const [loading, setLoading] = React.useState(!!readToken());
  const tokenRef = React.useRef(token);
  tokenRef.current = token;

  const logoutLocal = React.useCallback(() => {
    writeToken('');
    setToken('');
    setMe(null);
  }, []);

  const api = React.useCallback(async (method, path, body) => {
    const headers = { 'Content-Type': 'application/json' };
    if (tokenRef.current) headers.Authorization = 'Bearer ' + tokenRef.current;
    let r;
    try {
      r = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError('Нет связи с сервером', 0);
    }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && tokenRef.current && path.startsWith('/api/me')) logoutLocal();
    if (!r.ok) throw new ApiError(data.error || 'Ошибка ' + r.status, r.status, data);
    return data;
  }, [logoutLocal]);

  const refresh = React.useCallback(async () => {
    if (!tokenRef.current) { setMe(null); setLoading(false); return null; }
    try {
      const data = await api('GET', '/api/me');
      setMe(data);
      return data;
    } catch (e) {
      return null; // network blip keeps the session; 401 already logged out
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => { refresh(); }, [token]);

  const requestCode = (phone) => api('POST', '/api/auth/request-code', { phone });

  const verify = async (phone, code, importAddresses) => {
    const data = await api('POST', '/api/auth/verify', { phone, code });
    writeToken(data.token);
    tokenRef.current = data.token;
    setToken(data.token);
    let fresh = await refresh();
    // First login on this device: carry over addresses saved as a guest.
    if (fresh && fresh.addresses.length === 0 && importAddresses?.length) {
      for (const a of importAddresses.slice(0, 10)) {
        try { await api('POST', '/api/me/addresses', { label: a.label || '', text: a.text }); } catch {}
      }
      fresh = await refresh();
    }
    return data;
  };

  const logout = async () => {
    try { await api('POST', '/api/auth/logout'); } catch {}
    logoutLocal();
  };

  const mutate = (fn) => async (...args) => {
    const res = await fn(...args);
    await refresh();
    return res;
  };

  return {
    token, me, user: me?.user || null, loading, isLoggedIn: !!token && !!me,
    authHeader: () => (tokenRef.current ? { Authorization: 'Bearer ' + tokenRef.current } : {}),
    requestCode, verify, logout, refresh,
    updateName: mutate((name) => api('PUT', '/api/me', { name })),
    addAddress: mutate((text, label) => api('POST', '/api/me/addresses', { text, label: label || '' })),
    updateAddress: mutate((a) => api('PUT', `/api/me/addresses/${a.id}`, { label: a.label || '', text: a.text, isFavorite: !!a.isFavorite })),
    removeAddress: mutate((id) => api('DELETE', `/api/me/addresses/${id}`)),
  };
}

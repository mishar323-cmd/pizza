/* eslint-disable */
// Admin store — backed by REST API. JWT in localStorage, settings/orders fetched on init.

const API_BASE = '/api/admin';
const TOKEN_KEY = 'dvp_admin_token_v1';
const SESSION_KEY = 'dvp_admin_session_v1';

const NOW = () => new Date().toISOString();
const TODAY_KEY = () => new Date().toISOString().slice(0, 10);

const DEFAULT_PROMOS = [
  { id: 'p1', enabled: true, kind: 'big',    tag: 'главная акция', title: '2 пиццы 30 см = 1 290 ₽', body: 'Любые две классические пиццы среднего размера. До конца недели.', cta: 'Собрать комбо' },
  { id: 'p2', enabled: true, kind: 'accent', tag: '−15%',           title: 'На первый заказ',          body: 'Промокод ПЕРВЫЙ при оформлении.', cta: 'Скопировать' },
  { id: 'p3', enabled: true, kind: 'dark',   tag: 'каждый 5-й',     title: 'Бесплатно',                body: 'Маргарита 25 см в подарок к каждому пятому заказу.', cta: 'Подробнее' },
];

const DEFAULT_ZONES = [
  { id: 'A', name: 'Зона А · ЖК «Новая Рига»',           color: '#DC2828', deliveryPrice: 0,   freeFrom: 500,  eta: 30,
    polygon: [[55.7690,37.2340],[55.7715,37.2380],[55.7722,37.2430],[55.7718,37.2475],[55.7705,37.2495],[55.7685,37.2500],[55.7665,37.2495],[55.7650,37.2480],[55.7642,37.2450],[55.7640,37.2420],[55.7644,37.2385],[55.7652,37.2355],[55.7665,37.2335],[55.7680,37.2330]] },
  { id: 'B', name: 'Зона Б · Глухово и окрестности',     color: '#1B4DBF', deliveryPrice: 300, freeFrom: 3000, eta: 60,
    polygon: [[55.7955,37.2050],[55.7950,37.2300],[55.7935,37.2545],[55.7900,37.2750],[55.7720,37.2800],[55.7400,37.2820],[55.7280,37.2700],[55.7250,37.2400],[55.7270,37.2100],[55.7330,37.1900],[55.7555,37.1700],[55.7755,37.1655],[55.7900,37.1755]] },
  { id: 'C', name: 'Зона В · 10 км от пиццерии',         color: '#666666', deliveryPrice: 600, freeFrom: 5000, eta: 60, polygon: null },
];

const DEFAULT_COURIERS = [
  { id: 'c1', name: 'Иван Петров',   phone: '+7 916 100-22-11', transport: 'Авто · Renault Logan', note: 'Зона А и Б · смена 10:00–18:00' },
  { id: 'c2', name: 'Денис Кузьмин', phone: '+7 925 770-44-89', transport: 'Скутер',                note: 'Зона А · вечерняя смена' },
];

const DEFAULT_STORE = {
  cookTimeMinutes: 35,
  promos: DEFAULT_PROMOS,
  stopList: [],
  stopCategories: [],
  zones: DEFAULT_ZONES,
  menu: null,
  orders: [],
  couriers: DEFAULT_COURIERS,
};

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const tok = getToken();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    setToken(null);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    if (!path.startsWith('/login')) location.reload();
    const err = await r.json().catch(() => ({error: 'unauthorized'}));
    throw new Error(err.error || 'unauthorized');
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({error: 'request failed'}));
    throw new Error(err.error || ('HTTP ' + r.status));
  }
  if (r.status === 204) return null;
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

// Map server order → admin store shape (legacy expectations from UI).
function transformOrder(o) {
  return {
    id: 'o' + o.id,
    dbId: o.id,
    number: o.number,
    createdAt: o.createdAt,
    customer: { name: o.customerName, phone: o.customerPhone },
    address: o.address || '',
    zone: o.zone || '',
    items: o.items || [],
    total: o.total,
    delivery: o.delivery || 0,
    payment: o.payMethod === 'online' ? 'СБП' : (o.payMethod === 'cash' ? 'Наличные' : o.payMethod),
    status: o.status,
    etaMinutes: o.etaMinutes,
    assignedTo: o.assignedTo || '',
    receiveMethod: o.receiveMethod,
    deliveryTime: o.deliveryTime,
    comment: o.comment,
  };
}

let _lastStore = null;

export const AdminStore = {
  DEFAULT_STORE,
  TODAY_KEY,

  // Session / Auth
  async login(loginVal, password) {
    const data = await api('POST', '/login', { login: loginVal, password });
    setToken(data.token);
    const session = {
      adminId: data.admin.id, login: data.admin.login,
      name: data.admin.name, role: data.admin.role, loginAt: NOW(),
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
    return session;
  },

  loadSession() {
    if (!getToken()) return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clearSession() {
    setToken(null);
    try { localStorage.removeItem(SESSION_KEY); } catch {}
  },

  // Bulk load
  async init() {
    try {
      const [promos, zones, stop, cook, couriers, orders] = await Promise.all([
        api('GET', '/settings/promos').catch(() => null),
        api('GET', '/settings/zones').catch(() => null),
        api('GET', '/settings/stop').catch(() => null),
        api('GET', '/settings/cook').catch(() => null),
        api('GET', '/settings/couriers').catch(() => null),
        api('GET', '/orders').catch(() => []),
      ]);
      const next = {
        ...DEFAULT_STORE,
        promos: Array.isArray(promos) && promos.length ? promos : DEFAULT_STORE.promos,
        zones: Array.isArray(zones) && zones.length ? zones : DEFAULT_STORE.zones,
        stopList: stop?.items || [],
        stopCategories: stop?.categories || [],
        cookTimeMinutes: cook?.cookTimeMinutes ?? 35,
        couriers: Array.isArray(couriers) && couriers.length ? couriers : DEFAULT_STORE.couriers,
        orders: (orders || []).map(transformOrder),
      };
      _lastStore = next;
      return next;
    } catch (e) {
      console.error('Admin store init failed:', e);
      _lastStore = { ...DEFAULT_STORE, orders: [] };
      return _lastStore;
    }
  },

  // Persist settings slices. Diff against last known to avoid extra writes.
  save(next) {
    const prev = _lastStore || {};
    const tasks = [];
    if (next.promos !== prev.promos) tasks.push(api('PUT', '/settings/promos', next.promos));
    if (next.zones !== prev.zones) tasks.push(api('PUT', '/settings/zones', next.zones));
    if (next.stopList !== prev.stopList || next.stopCategories !== prev.stopCategories) {
      tasks.push(api('PUT', '/settings/stop', { items: next.stopList || [], categories: next.stopCategories || [] }));
    }
    if (next.cookTimeMinutes !== prev.cookTimeMinutes) {
      tasks.push(api('PUT', '/settings/cook', { cookTimeMinutes: next.cookTimeMinutes }));
    }
    if (next.couriers !== prev.couriers) tasks.push(api('PUT', '/settings/couriers', next.couriers));
    _lastStore = next;
    Promise.all(tasks).catch(e => console.warn('Settings save partial fail:', e));
  },

  // Order helpers
  async updateOrder(dbId, patch) {
    return api('PUT', `/orders/${dbId}`, patch);
  },

  async refreshOrders() {
    const orders = await api('GET', '/orders').catch(() => []);
    return (orders || []).map(transformOrder);
  },
};

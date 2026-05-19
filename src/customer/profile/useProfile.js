/* eslint-disable */
import React from 'react';

export const LEVELS = [
  { id: 'novice',  name: 'Новичок',          min: 0,     color: '#9CA3AF' },
  { id: 'fan',     name: 'Любитель',         min: 3000,  color: '#10B981' },
  { id: 'eater',   name: 'Пиццаед',          min: 10000, color: '#F59E0B' },
  { id: 'mega',    name: 'Мощнейший пиццаед',min: 25000, color: '#DC2828' },
];

export function getLevel(total) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (total >= l.min) cur = l;
  const idx = LEVELS.indexOf(cur);
  const next = LEVELS[idx + 1] || null;
  return { current: cur, next, progress: next ? Math.min(100, Math.round(((total - cur.min) / (next.min - cur.min)) * 100)) : 100 };
}

const PROFILE_KEY = 'dvp_profile_v1';
const DEFAULT_PROFILE = {
  name: 'Александр',
  phone: '+7 915 488-94-19',
  orders: [],
  pizzaCount: 0, // сквозной счётчик пицц для механики 8-я бесплатно
  addresses: [
    { id: 'home', label: 'Дом',   text: 'Красногорск, ул. Глуховская 12, кв. 45',   favorite: true },
    { id: 'work', label: 'Работа', text: 'Красногорск, ул. Ленина 33, оф. 210',     favorite: false },
  ],
};

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch { return DEFAULT_PROFILE; }
}
function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

export function useProfile() {
  const [profile, setProfile] = React.useState(() => loadProfile());
  React.useEffect(() => { saveProfile(profile); }, [profile]);
  const totalSum = profile.orders.reduce((s, o) => s + o.total, 0);
  const level = getLevel(totalSum);
  const pizzaCount = profile.pizzaCount || 0;
  const inCycle = pizzaCount % 8;
  const freeAvailable = inCycle === 0 && pizzaCount > 0; // 8 заказанных пицц = следующая бесплатна

  const placeOrder = (items, total, addressId) => {
    const numPizzas = items.filter(it => it.cat === 'pizza' || /пицц/i.test(it.name)).reduce((s, it) => s + it.qty, 0);
    const order = {
      id: 'o' + Date.now().toString(36),
      date: new Date().toISOString(),
      items: items.map(it => ({ name: it.name, qty: it.qty, price: it.price })),
      total,
      addressId,
    };
    setProfile(p => ({ ...p, orders: [order, ...p.orders].slice(0, 50), pizzaCount: (p.pizzaCount || 0) + numPizzas }));
  };

  const setFavoriteAddress = (id) => setProfile(p => ({ ...p, addresses: p.addresses.map(a => ({ ...a, favorite: a.id === id })) }));
  const addAddress = (text, label) => setProfile(p => ({ ...p, addresses: [...p.addresses, { id: 'a' + Date.now().toString(36), label: label || '', text, favorite: false }] }));
  const removeAddress = (id) => setProfile(p => ({ ...p, addresses: p.addresses.filter(a => a.id !== id) }));

  return { profile, totalSum, level, pizzaCount, inCycle, freeAvailable, placeOrder, setFavoriteAddress, addAddress, removeAddress, setProfile };
}

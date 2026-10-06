/* eslint-disable */
import React from 'react';
import { getCookieConsent } from './consent.js';

// Разовое объявление о личном кабинете. Показывается один раз на браузер,
// только гостям и только после того, как закрыт cookie-баннер.
// Акция недельная: после UNTIL поп-ап не появляется, даже если код не убрали.
const KEY = 'dvp_profile_announce_v1';
const UNTIL = Date.parse('2026-10-13T00:00:00+03:00');

export function wasProfileAnnounced() {
  try { return !!localStorage.getItem(KEY); } catch { return true; }
}

function markSeen() {
  try { localStorage.setItem(KEY, '1'); } catch {}
}

const BENEFITS = [
  { icon: '🎁', title: 'Каждая 8-я пицца бесплатно', note: 'счётчик считается сам' },
  { icon: '🏅', title: 'Скидка до 20% за заказы', note: 'чем больше заказов — тем выше ранг' },
  { icon: '📍', title: 'Адреса и история заказов', note: 'повторить заказ в два клика' },
];

export function ProfileAnnounce({ loggedIn, onLogin }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (loggedIn || wasProfileAnnounced() || Date.now() >= UNTIL) return;
    let timer = null;
    const arm = () => { timer = setTimeout(() => setShow(true), 2000); };
    // Сначала человек решает про cookie, и только потом появляемся мы.
    if (getCookieConsent()) arm();
    else {
      const t = setInterval(() => {
        if (getCookieConsent()) { clearInterval(t); arm(); }
      }, 500);
      return () => { clearInterval(t); if (timer) clearTimeout(timer); };
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [loggedIn]);

  const close = React.useCallback(() => { markSeen(); setShow(false); }, []);

  React.useEffect(() => {
    if (!show) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, close]);

  if (!show) return null;

  return (
    <div className="pa-overlay" role="dialog" aria-modal="true" aria-labelledby="pa-title" onClick={close}>
      <div className="pa-card" onClick={e => e.stopPropagation()}>
        <div className="pa-head">
          <button className="pa-close" onClick={close} aria-label="Закрыть">×</button>
          <div className="pa-emoji" aria-hidden="true">🍕</div>
          <div className="pa-title" id="pa-title">УРА</div>
          <p className="pa-lead">Мы добавили раздел профиль! Теперь оформить заказ можно ещё выгоднее и быстрее 🍕</p>
        </div>
        <div className="pa-body">
          {BENEFITS.map(b => (
            <div className="pa-row" key={b.title}>
              <span className="pa-ico" aria-hidden="true">{b.icon}</span>
              <div>
                <strong>{b.title}</strong>
                <small>{b.note}</small>
              </div>
            </div>
          ))}
          <button className="pa-cta" onClick={() => { markSeen(); setShow(false); onLogin(); }}>
            Войти через Telegram
          </button>
          <button className="pa-later" onClick={close}>Посмотрю позже</button>
          <p className="pa-note">Вход за 5 секунд — номер подтвердит Telegram, код вводить не нужно</p>
        </div>
      </div>
    </div>
  );
}

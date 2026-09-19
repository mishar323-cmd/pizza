/* eslint-disable */
import React from 'react';
import Ic from '../../shared/icons.jsx';
import { LEVELS } from './useProfile.js';
import { formatPhone } from '../auth/useAuth.js';

function PizzaPip({ filled, current, isGift }) {
  return (
    <div className="pip-cell" style={{position:'relative'}}>
      <div className={`pip ${filled ? 'on' : ''} ${current ? 'now' : ''}`}>
        <svg viewBox="0 0 40 40" width="100%" height="100%">
          <circle cx="20" cy="20" r="17" fill={filled ? '#FFB800' : '#E5E7EB'} stroke={filled ? '#D97A00' : '#D1D5DB'} strokeWidth="1.5"/>
          <circle cx="20" cy="20" r="13" fill={filled ? '#F4D9A6' : '#F3F4F6'}/>
          {filled && <>
            <circle cx="14" cy="16" r="2.5" fill="#DC2828"/>
            <circle cx="24" cy="14" r="2" fill="#DC2828"/>
            <circle cx="22" cy="24" r="2.2" fill="#DC2828"/>
            <circle cx="15" cy="25" r="1.8" fill="#DC2828"/>
            <path d="M16 19 q1 -2 3 -1" stroke="#0E7C5C" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </>}
        </svg>
      </div>
      {isGift && (
        <span style={{
          position:'absolute', inset:0,
          display:'grid', placeItems:'center',
          fontSize:'70%', pointerEvents:'none', lineHeight:1,
        }}>🎁</span>
      )}
    </div>
  );
}

function LoyaltyTracker({ inCycle }) {
  const left = 8 - inCycle;
  return (
    <div className="loyalty-card">
      <div className="loyalty-head">
        <div>
          <strong>Каждая 8-я пицца — бесплатно</strong>
          <p>{left === 1 ? '🎉 Следующая пицца — в подарок' : inCycle === 0 ? 'Закажите 7 пицц — 8-я будет в подарок' : `Ещё ${left - 1} ${plural(left - 1, 'пицца', 'пиццы', 'пицц')}, и следующая — в подарок`}</p>
        </div>
        <span className="loyalty-count">{inCycle}/8</span>
      </div>
      <div className="pip-row">
        {Array.from({length: 8}).map((_, i) => (
          <PizzaPip key={i} filled={i < inCycle} current={i === inCycle - 1} isGift={i === 7}/>
        ))}
      </div>
    </div>
  );
}

const STATUS = {
  new: 'Принят', cooking: 'Готовится', on_way: 'В пути', delivered: 'Доставлен', cancelled: 'Отменён',
};

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function ProfileModal({ open, onClose, auth }) {
  const [addrText, setAddrText] = React.useState('');
  const [addrLabel, setAddrLabel] = React.useState('');
  const [addrMsg, setAddrMsg] = React.useState(null);
  const [nameEdit, setNameEdit] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { if (open) { auth.refresh(); setAddrMsg(null); setNameEdit(null); } }, [open]);

  if (!open || !auth.me) return null;
  const { user, addresses, orders, loyalty } = auth.me;
  const totalSum = loyalty.totalSpent;
  const levelIdx = Math.max(0, LEVELS.findIndex(l => l.id === loyalty.level.id));
  const cur = LEVELS[levelIdx];
  const next = LEVELS[levelIdx + 1] || null;
  const progress = next ? Math.min(100, Math.round(((totalSum - cur.min) / (next.min - cur.min)) * 100)) : 100;

  const saveName = async () => {
    setBusy(true);
    try { await auth.updateName(nameEdit.trim()); setNameEdit(null); } catch {}
    setBusy(false);
  };

  const addAddress = async () => {
    const text = addrText.trim();
    if (text.length < 5 || busy) return;
    setBusy(true); setAddrMsg(null);
    try {
      await auth.addAddress(text, addrLabel.trim());
      setAddrText(''); setAddrLabel('');
      const q = await fetch('/api/delivery/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: text, subtotal: 0 }),
      }).then(r => r.ok ? r.json() : null).catch(() => null);
      if (q?.inZone) setAddrMsg({ ok: true, text: `Сохранено · ${q.zone.name}` });
      else if (q?.found === false) setAddrMsg({ ok: false, text: 'Сохранено, но мы не нашли такой адрес — проверьте населённый пункт, улицу и дом' });
      else if (q && q.inZone === false) setAddrMsg({ ok: false, text: 'Сохранено, но адрес вне зоны доставки — доступен самовывоз' });
      else setAddrMsg({ ok: true, text: 'Сохранено' });
    } catch (e) {
      setAddrMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose}/>
      <aside className="profile-modal open" role="dialog" aria-label="Профиль">
        <div className="profile-head">
          <h3>Профиль</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Ic name="close" size={18}/></button>
        </div>
        <div className="profile-body">
          <div className="profile-hero">
            <div className="avatar" style={{background: cur.color}}>{Array.from(user.name || '')[0] || '🍕'}</div>
            <div style={{flex: 1, minWidth: 0}}>
              {nameEdit === null ? (
                <div className="name-row">
                  <strong>{user.name || 'Как вас зовут?'}</strong>
                  <button className="link-btn" onClick={() => setNameEdit(user.name || '')}>{user.name ? 'изменить' : 'указать имя'}</button>
                </div>
              ) : (
                <form className="name-edit" onSubmit={e => { e.preventDefault(); saveName(); }}>
                  <input className="co-input" value={nameEdit} maxLength={60} autoFocus placeholder="Имя" onChange={e => setNameEdit(e.target.value)}/>
                  <button className="btn btn-primary btn-sm" disabled={busy}>Сохранить</button>
                </form>
              )}
              <small>{formatPhone(user.phone)}</small>
            </div>
          </div>

          <div className="level-card">
            <div className="lc-top">
              <span className="lc-badge" style={{background: cur.color + '22', color: cur.color}}>
                Уровень · {cur.name}
              </span>
              <strong className="lc-sum">{totalSum.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <small className="lc-hint">общая сумма заказов · {loyalty.ordersCount} {plural(loyalty.ordersCount, 'заказ', 'заказа', 'заказов')}</small>
            <div className="lc-bar"><span style={{width: `${progress}%`, background: cur.color}}/></div>
            {next ? (
              <small className="lc-next">До «{next.name}» — {(next.min - totalSum).toLocaleString('ru-RU')} ₽</small>
            ) : (
              <small className="lc-next">🏆 Максимальный уровень</small>
            )}
            <div className="lc-ladder">
              {LEVELS.map(l => (
                <div key={l.id} className={`rung ${totalSum >= l.min ? 'on' : ''}`}>
                  <span className="dot" style={{background: totalSum >= l.min ? l.color : '#E5E7EB'}}/>
                  <span>{l.name}</span>
                  <small>от {l.min.toLocaleString('ru-RU')} ₽</small>
                </div>
              ))}
            </div>
          </div>

          <LoyaltyTracker inCycle={loyalty.inCycle}/>

          <section className="profile-sec">
            <h4>Мои адреса</h4>
            <div className="addr-list">
              {addresses.map(a => (
                <div key={a.id} className={`addr-row ${a.isFavorite ? 'fav' : ''}`}>
                  <button className="fav-toggle" onClick={() => auth.updateAddress({ ...a, isFavorite: true })} aria-label="Сделать основным" title="Основной адрес">
                    <Ic name={a.isFavorite ? 'heart-fill' : 'heart'} size={14}/>
                  </button>
                  <div className="addr-info">
                    <strong>{a.label || a.text}</strong>
                    {a.label && <small>{a.text}</small>}
                  </div>
                  <button className="addr-del" onClick={() => { if (confirm('Удалить адрес?')) auth.removeAddress(a.id); }} aria-label="Удалить"><Ic name="close" size={14}/></button>
                </div>
              ))}
              {addresses.length === 0 && <div className="empty-orders">Адресов пока нет — добавьте, чтобы не вводить при заказе.</div>}
            </div>
            <form className="addr-add" onSubmit={e => { e.preventDefault(); addAddress(); }}>
              <input placeholder="Метка (Дом / Работа)" value={addrLabel} maxLength={40} onChange={e => setAddrLabel(e.target.value)}/>
              <input placeholder="Посёлок, улица, дом, кв." value={addrText} maxLength={300} onChange={e => { setAddrText(e.target.value); setAddrMsg(null); }}/>
              <button className="btn btn-ghost btn-sm" disabled={busy || addrText.trim().length < 5}>
                <Ic name="plus" size={14}/> Добавить
              </button>
            </form>
            {addrMsg && <div className={`addr-msg ${addrMsg.ok ? 'ok' : 'bad'}`}>{addrMsg.text}</div>}
          </section>

          <section className="profile-sec">
            <h4>История заказов</h4>
            {orders.length === 0 ? (
              <div className="empty-orders">Заказов пока нет. Соберите корзину — заказ появится здесь.</div>
            ) : (
              <div className="orders-list">
                {orders.map(o => (
                  <div key={o.id} className="order-row">
                    <div>
                      <strong>№{o.number} · {new Date(o.createdAt).toLocaleDateString('ru-RU', {day: '2-digit', month: 'short', year: 'numeric'})}</strong>
                      <small>{(o.items || []).map(i => `${i.name} ×${i.qty}`).join(' · ')}</small>
                      <small className={`order-status st-${o.status}`}>{STATUS[o.status] || o.status}{o.receiveMethod === 'pickup' ? ' · самовывоз' : ''}</small>
                    </div>
                    <div className="order-sum">{Math.round(o.total).toLocaleString('ru-RU')} ₽</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <button className="btn btn-ghost logout-btn" onClick={async () => { await auth.logout(); onClose(); }}>Выйти</button>
        </div>
      </aside>
    </>
  );
}

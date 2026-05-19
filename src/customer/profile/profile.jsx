/* eslint-disable */
import React from 'react';
import Ic from '../../shared/icons.jsx';
import { LEVELS } from './useProfile.js';

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

function LoyaltyTracker({ pizzaCount }) {
  const inCycle = pizzaCount % 8;
  const left = 8 - inCycle;
  const isFree = inCycle === 0 && pizzaCount > 0;
  return (
    <div className="loyalty-card">
      <div className="loyalty-head">
        <div>
          <strong>Каждая 8-я пицца — бесплатно</strong>
          <p>{isFree ? '🎉 Следующая пицца — за наш счёт' : left === 8 ? 'Закажите 8 пицц и одна будет в подарок' : `Ещё ${left} пицц${left === 1 ? 'у' : left < 5 ? 'ы' : ''} до подарка`}</p>
        </div>
        <span className="loyalty-count">{inCycle}/8</span>
      </div>
      <div className="pip-row">
        {Array.from({length: 8}).map((_, i) => (
          <PizzaPip key={i} filled={isFree || i < inCycle} current={!isFree && i === inCycle - 1} isGift={i === 7}/>
        ))}
      </div>
    </div>
  );
}

export function ProfileModal({ open, onClose, profileState }) {
  const { profile, totalSum, level, pizzaCount, setFavoriteAddress, addAddress, removeAddress, setProfile } = profileState;
  const [addrText, setAddrText] = React.useState('');
  const [addrLabel, setAddrLabel] = React.useState('');

  if (!open) return null;

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
            <div className="avatar" style={{background: level.current.color}}>{profile.name.charAt(0)}</div>
            <div>
              <strong>{profile.name}</strong>
              <small>{profile.phone}</small>
            </div>
          </div>

          <div className="level-card">
            <div className="lc-top">
              <span className="lc-badge" style={{background: level.current.color + '22', color: level.current.color}}>
                Уровень · {level.current.name}
              </span>
              <strong className="lc-sum">{totalSum.toLocaleString('ru-RU')} ₽</strong>
            </div>
            <small className="lc-hint">общая сумма заказов · {profile.orders.length} заказ{profile.orders.length === 1 ? '' : profile.orders.length < 5 ? 'а' : 'ов'}</small>
            <div className="lc-bar"><span style={{width: `${level.progress}%`, background: level.current.color}}/></div>
            {level.next ? (
              <small className="lc-next">До «{level.next.name}» — {(level.next.min - totalSum).toLocaleString('ru-RU')} ₽</small>
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

          <LoyaltyTracker pizzaCount={pizzaCount}/>

          <section className="profile-sec">
            <h4>Избранные адреса</h4>
            <div className="addr-list">
              {profile.addresses.map(a => (
                <div key={a.id} className={`addr-row ${a.favorite ? 'fav' : ''}`}>
                  <button className="fav-toggle" onClick={() => setFavoriteAddress(a.id)} aria-label="Сделать избранным">
                    <Ic name={a.favorite ? 'heart-fill' : 'heart'} size={14}/>
                  </button>
                  <div className="addr-info">
                    <strong>{a.label || a.text}</strong>
                    {a.label && <small>{a.text}</small>}
                  </div>
                  <button className="addr-del" onClick={() => removeAddress(a.id)} aria-label="Удалить"><Ic name="close" size={14}/></button>
                </div>
              ))}
            </div>
            <div className="addr-add">
              <input placeholder="Метка (Дом / Работа)" value={addrLabel} onChange={e => setAddrLabel(e.target.value)}/>
              <input placeholder="Улица, дом, квартира" value={addrText} onChange={e => setAddrText(e.target.value)}/>
              <button className="btn btn-ghost btn-sm" onClick={() => { if (addrText.trim()) { addAddress(addrText.trim(), addrLabel.trim()); setAddrText(''); setAddrLabel(''); } }}>
                <Ic name="plus" size={14}/> Добавить
              </button>
            </div>
          </section>

          <section className="profile-sec">
            <h4>Последние заказы</h4>
            {profile.orders.length === 0 ? (
              <div className="empty-orders">Заказов пока нет. Соберите корзину — она появится здесь.</div>
            ) : (
              <div className="orders-list">
                {profile.orders.slice(0, 5).map(o => (
                  <div key={o.id} className="order-row">
                    <div>
                      <strong>Заказ {new Date(o.date).toLocaleDateString('ru-RU', {day:'2-digit', month:'short'})}</strong>
                      <small>{o.items.map(i => `${i.name} ×${i.qty}`).join(' · ')}</small>
                    </div>
                    <div className="order-sum">{o.total.toLocaleString('ru-RU')} ₽</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

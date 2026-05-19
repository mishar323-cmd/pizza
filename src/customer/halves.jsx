/* eslint-disable */
// "Собери из половинок" — модалка с iOS-style скролл-пикерами
import React from 'react';
import { PIZZA_DATA, SIZES } from '../data/menu.js';
import Ic from '../shared/icons.jsx';

const IcH = Ic;

// Цена половинки: половина цены +10%, округлено вверх до десятков
export function halfPrice(fullPrice) {
  return Math.ceil((fullPrice / 2 * 1.1) / 10) * 10;
}

/* ───── iOS-style scroll picker (по образу выбора времени на айфоне) ───── */
const PICK_ITEM_H = 52;
const PICK_VISIBLE = 5;
const PICK_CONTAINER_H = PICK_ITEM_H * PICK_VISIBLE;
const PICK_PAD = (PICK_CONTAINER_H - PICK_ITEM_H) / 2;

function ScrollPicker({ items, valueId, onChange, side, size = 'md' }) {
  const trackRef = React.useRef(null);
  const tmoRef = React.useRef(null);
  const programmaticRef = React.useRef(false);

  // На монтировании прокрутить к текущему элементу
  React.useEffect(() => {
    const idx = items.findIndex(i => i.id === valueId);
    if (idx >= 0 && trackRef.current) {
      programmaticRef.current = true;
      trackRef.current.scrollTop = idx * PICK_ITEM_H;
      setTimeout(() => { programmaticRef.current = false; }, 60);
    }
  }, []);

  // Если внешний valueId изменился (например, при выборе клавишами), синхронизируем
  React.useEffect(() => {
    if (!trackRef.current) return;
    const idx = items.findIndex(i => i.id === valueId);
    const currentIdx = Math.round(trackRef.current.scrollTop / PICK_ITEM_H);
    if (idx >= 0 && idx !== currentIdx) {
      programmaticRef.current = true;
      trackRef.current.scrollTo({ top: idx * PICK_ITEM_H, behavior: 'smooth' });
      setTimeout(() => { programmaticRef.current = false; }, 350);
    }
  }, [valueId]);

  const handleScroll = () => {
    if (!trackRef.current) return;
    clearTimeout(tmoRef.current);
    tmoRef.current = setTimeout(() => {
      if (!trackRef.current || programmaticRef.current) return;
      const idx = Math.round(trackRef.current.scrollTop / PICK_ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const item = items[clamped];
      if (item && item.id !== valueId) onChange(item);
    }, 120);
  };

  const handleItemClick = (i) => {
    if (!trackRef.current) return;
    programmaticRef.current = true;
    trackRef.current.scrollTo({ top: i * PICK_ITEM_H, behavior: 'smooth' });
    onChange(items[i]);
    setTimeout(() => { programmaticRef.current = false; }, 350);
  };

  return (
    <div className="scroll-picker" style={{ height: PICK_CONTAINER_H }}>
      <div className="scroll-picker-highlight" style={{ top: PICK_PAD, height: PICK_ITEM_H }} aria-hidden="true"/>
      <div className="scroll-picker-track" ref={trackRef} onScroll={handleScroll}>
        <div style={{ height: PICK_PAD }}/>
        {items.map((it, i) => {
          const active = it.id === valueId;
          return (
            <div
              key={it.id}
              className={`scroll-picker-item ${active ? 'on' : ''}`}
              style={{ height: PICK_ITEM_H }}
              onClick={() => handleItemClick(i)}
            >
              <span className="sp-pic">
                {it.img ? <img src={it.img} alt="" onError={(e)=>{e.currentTarget.style.display='none'}}/> : null}
              </span>
              <span className="sp-info">
                <strong>{it.name}</strong>
                <small>{halfPrice(it.prices[size])} ₽ за половинку</small>
              </span>
            </div>
          );
        })}
        <div style={{ height: PICK_PAD }}/>
      </div>
      <div className="scroll-picker-mask top" aria-hidden="true"/>
      <div className="scroll-picker-mask bottom" aria-hidden="true"/>
    </div>
  );
}

/* ───── Превью пиццы, разрезанной вертикально ───── */
function HalvesDisc({ left, right, size = 'card' }) {
  return (
    <div className={`halves-disc ${size}`}>
      <div className="halves-half left">
        {left?.img && (
          <img
            src={left.img}
            alt={left?.name || ''}
            onError={(e)=>{e.currentTarget.style.display='none'}}
          />
        )}
      </div>
      <div className="halves-half right">
        {right?.img && (
          <img
            src={right.img}
            alt={right?.name || ''}
            onError={(e)=>{e.currentTarget.style.display='none'}}
          />
        )}
      </div>
      <div className="halves-line"/>
    </div>
  );
}

/* ───── Карточка в каталоге ───── */
export function HalvesCard({ onOpen }) {
  const list = PIZZA_DATA;
  const defaultLeft = list.find(p => p.id === 'pepperoni') || list[0];
  const defaultRight = list.find(p => p.id === 'cheese') || list[1];
  const fromPrice = halfPrice(defaultLeft.prices.sm) + halfPrice(defaultRight.prices.sm);

  return (
    <article
      className="pizza-card halves-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      <span className="pizza-flag new">новинка</span>
      <div className="pizza-image halves-preview" aria-hidden="true">
        <HalvesDisc left={defaultLeft} right={defaultRight} size="card"/>
      </div>
      <h3 className="pizza-name">Собери из половинок</h3>
      <p className="pizza-desc">Две разные начинки на одной пицце — выбери любую комбинацию</p>
      <div className="pizza-meta">
        <span>2 вкуса в 1</span>
        <span className="dot"/>
        <span>25 / 30 / 35 см</span>
      </div>
      <div className="pizza-foot">
        <div className="pizza-price"><small>от</small>{fromPrice} ₽</div>
        <button
          className="add-btn halves-cta"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          aria-label="Собрать пиццу из половинок"
        >
          <IcH name="sparkle" size={16}/>
        </button>
      </div>
    </article>
  );
}

/* ───── Модалка ───── */
export function HalvesModal({ open, onClose, onAdd }) {
  const list = PIZZA_DATA;
  const [size, setSize] = React.useState('md');
  const [leftId, setLeftId] = React.useState('pepperoni');
  const [rightId, setRightId] = React.useState('cheese');

  // Сброс при открытии, если значения вне списка
  React.useEffect(() => {
    if (!open) return;
    if (!list.find(p => p.id === leftId)) setLeftId(list[0]?.id);
    if (!list.find(p => p.id === rightId)) setRightId(list[1]?.id);
  }, [open]);

  if (!open) return null;

  const left = list.find(p => p.id === leftId);
  const right = list.find(p => p.id === rightId);
  const priceA = left ? left.prices[size] : 0;
  const priceB = right ? right.prices[size] : 0;
  const total = halfPrice(priceA) + halfPrice(priceB);
  const canAdd = !!(left && right);
  const sizeLabel = (SIZES.find(s => s.id === size) || {}).label || '30 см';

  const handleAdd = () => {
    if (!canAdd) return;
    const fakePizza = {
      id: `halves-${left.id}-${right.id}-${size}`,
      name: `Половинки: ${left.name} / ${right.name}`,
      desc: `${sizeLabel} · ${left.name} + ${right.name}`,
      img: left.img,
      ingredients: [],
      prices: { sm: total, md: total, lg: total },
    };
    onAdd(fakePizza, {
      sizeId: size,
      crustId: 'thin',
      addons: [],
      price: total,
      cartKey: fakePizza.id,
    });
    onClose();
  };

  return (
    <div className="pdmodal-overlay open halves-modal-overlay" onClick={onClose}>
      <div className="pdmodal halves-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pdmodal-close" onClick={onClose}><IcH name="close" size={18}/></button>

        <div className="pdmodal-pic halves-pic">
          <HalvesDisc left={left} right={right} size="big"/>
          <div className="halves-pic-labels">
            <div className="halves-pic-label">
              <span className="dot left"/>
              <div>
                <small>Левая</small>
                <strong>{left?.name}</strong>
              </div>
            </div>
            <div className="halves-pic-label">
              <span className="dot right"/>
              <div>
                <small>Правая</small>
                <strong>{right?.name}</strong>
              </div>
            </div>
          </div>
          <div className="halves-pic-caption">{sizeLabel} · тонкое тесто</div>
        </div>

        <div className="pdmodal-body halves-body">
          <h3>Собери из половинок</h3>
          <p className="desc">Прокрути колесо — найдёшь нужный вкус. Половинка стоит половину цены +10%, округлено до десятков.</p>

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--ink-soft)', marginTop: 14 }}>Размер</div>
          <div className="size-toggle">
            {SIZES.map(s => (
              <button key={s.id} className={size === s.id ? 'on' : ''} onClick={() => setSize(s.id)}>
                {s.label}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontWeight: 400 }}>{s.sub}</div>
              </button>
            ))}
          </div>

          <div className="halves-pickers">
            <div className="halves-picker-col">
              <div className="halves-col-head">
                <span className="halves-side-badge left">Левая половинка</span>
              </div>
              <ScrollPicker
                items={list}
                valueId={leftId}
                onChange={(p) => setLeftId(p.id)}
                side="left"
                size={size}
              />
            </div>
            <div className="halves-picker-col">
              <div className="halves-col-head">
                <span className="halves-side-badge right">Правая половинка</span>
              </div>
              <ScrollPicker
                items={list}
                valueId={rightId}
                onChange={(p) => setRightId(p.id)}
                side="right"
                size={size}
              />
            </div>
          </div>

          <div className="halves-breakdown">
            <div className="row">
              <span><span className="dot-tiny left"/> {left?.name} <small>{sizeLabel}</small></span>
              <span>{halfPrice(priceA)} ₽</span>
            </div>
            <div className="row">
              <span><span className="dot-tiny right"/> {right?.name} <small>{sizeLabel}</small></span>
              <span>{halfPrice(priceB)} ₽</span>
            </div>
          </div>

          <div className="pdmodal-foot">
            <div className="price-big">{total} ₽</div>
            <button className="btn btn-primary btn-lg" disabled={!canAdd} onClick={handleAdd}>
              {canAdd ? 'Добавить в корзину' : 'Выбери обе половинки'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

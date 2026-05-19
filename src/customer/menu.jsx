/* eslint-disable */
// Меню — каталог пиццы, выпадающая корзина, модалка деталей
import React from 'react';
import { PIZZA_DATA, ROMAN_DATA, SANDWICH_DATA, SNACK_DATA, DRINK_DATA, DESSERT_DATA, SIZES, CRUSTS, ADDONS } from '../data/menu.js';
import Ic from '../shared/icons.jsx';
import { HalvesCard } from './halves.jsx';

export function MenuSection({ cart, addToCart, removeFromCart, getQty, openDetail, openHalves }) {
  const [cat, setCat] = React.useState('pizza');
  const [filter, setFilter] = React.useState(null);

  const categories = [
    { id: 'pizza', label: 'Пицца', count: PIZZA_DATA.length },
    { id: 'roman', label: 'Римская', count: ROMAN_DATA.length },
    { id: 'sandwich', label: 'Сэндвичи', count: SANDWICH_DATA.length },
    { id: 'snacks', label: 'Закуски', count: SNACK_DATA.length },
    { id: 'drinks', label: 'Напитки', count: DRINK_DATA.length },
    { id: 'desserts', label: 'Десерты', count: DESSERT_DATA.length },
  ];

  const filters = [
    { id: 'veg', label: 'Вегетарианское', icon: 'leaf' },
    { id: 'hot', label: 'Острое', icon: 'flame' },
    { id: 'new', label: 'Новинки', icon: 'sparkle' },
    { id: 'meat', label: 'Мясные', icon: null },
  ];

  const items = React.useMemo(() => {
    if (cat === 'pizza') {
      let list = PIZZA_DATA;
      if (filter === 'veg') list = list.filter(p => p.veg);
      if (filter === 'hot') list = list.filter(p => p.hot);
      if (filter === 'new') list = list.filter(p => p.isNew);
      if (filter === 'meat') list = list.filter(p => !p.veg);
      return list;
    }
    if (cat === 'roman') return ROMAN_DATA;
    if (cat === 'sandwich') return SANDWICH_DATA;
    if (cat === 'snacks') return SNACK_DATA;
    if (cat === 'drinks') return DRINK_DATA;
    return DESSERT_DATA;
  }, [cat, filter]);

  return (
    <section id="menu" className="container menu-shell" data-screen-label="menu">
      <div className="sec-head" style={{marginBottom: 12}}>
        <div>
          <h2>Меню</h2>
          <p className="sub">Кликни на любую пиццу — выбери размер, тесто и допы. Корзина копится сбоку.</p>
        </div>
      </div>

      <div className="cat-tabs">
        {categories.map(c => (
          <button
            key={c.id}
            className={`cat-tab ${cat === c.id ? 'active' : ''}`}
            onClick={() => { setCat(c.id); setFilter(null); }}
          >
            {c.label}
            <span className="count">{c.count}</span>
          </button>
        ))}
      </div>

      {cat === 'pizza' && (
        <div className="filter-row">
          {filters.map(f => (
            <button
              key={f.id}
              className={`filter-chip ${filter === f.id ? 'on' : ''}`}
              onClick={() => setFilter(filter === f.id ? null : f.id)}
            >
              {f.icon && <Ic name={f.icon} size={14}/>}
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="menu-grid">
        {cat === 'pizza' && !filter && <HalvesCard onOpen={openHalves}/>}
        {cat === 'pizza' && items.map(p => (
          <PizzaCard
            key={p.id}
            p={p}
            qty={getQty(p.id)}
            onAdd={() => addToCart({ ...p, price: p.prices.md }, { sizeId: 'md', price: p.prices.md })}
            onMinus={() => removeFromCart(p.id)}
            onOpen={() => openDetail(p)}
          />
        ))}
        {cat !== 'pizza' && items.map(item => (
          <SimpleCard
            key={item.id}
            item={item}
            qty={getQty(item.id)}
            onAdd={() => addToCart(item, { simple: true })}
            onMinus={() => removeFromCart(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

function PizzaCard({ p, qty, onAdd, onMinus, onOpen }) {
  const [fav, setFav] = React.useState(false);
  const imgs = (p.imgs && p.imgs.length) ? p.imgs : [p.img];
  const [imgIdx, setImgIdx] = React.useState(0);
  const sizeLabels = ['25 см', '30 см', '35 см'];
  const next = (e) => { e.stopPropagation(); setImgIdx((imgIdx + 1) % imgs.length); };
  const prev = (e) => { e.stopPropagation(); setImgIdx((imgIdx - 1 + imgs.length) % imgs.length); };
  return (
    <article className="pizza-card" data-comment-anchor={`pizza-${p.id}`}>
      {p.tag && (
        <span className={`pizza-flag ${p.veg ? 'veg' : ''} ${p.hot ? 'hot' : ''} ${p.isNew ? 'new' : ''}`}>
          {p.tag}
        </span>
      )}
      <button className={`fav-btn ${fav ? 'on' : ''}`} onClick={() => setFav(!fav)} aria-label="В избранное">
        <Ic name={fav ? 'heart-fill' : 'heart'} size={16}/>
      </button>
      <button className="pizza-image" onClick={onOpen} aria-label={`Открыть ${p.name}`} style={{cursor:'pointer', background:'transparent', padding:0, border:'none', width:'100%', position:'relative'}}>
        {imgs.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={p.name}
            loading="lazy"
            style={{position:'absolute', inset:0, opacity: i === imgIdx ? 1 : 0, transition:'opacity .35s ease'}}
            onError={(e)=>{ e.currentTarget.style.display='none'; }}
          />
        ))}
        {imgs.length > 1 && (
          <>
            <button onClick={prev} className="img-nav prev" aria-label="Прошлое фото">‹</button>
            <button onClick={next} className="img-nav next" aria-label="Следующее фото">›</button>
            <div className="img-dots">
              {imgs.map((_, i) => (
                <span key={i} className={i === imgIdx ? 'on' : ''}/>
              ))}
            </div>
            <span className="img-size-tag">{sizeLabels[imgIdx] || ''}</span>
          </>
        )}
      </button>
      <h3 className="pizza-name" onClick={onOpen} style={{cursor:'pointer'}}>{p.name}</h3>
      <p className="pizza-desc">{p.desc}</p>
      <div className="pizza-meta">
        <span>{p.weight} г</span>
        <span className="dot"/>
        <span>{p.kcal} ккал</span>
        <span className="dot"/>
        <span>30 см</span>
      </div>
      <div className="pizza-foot">
        <div className="pizza-price">
          <small>от</small>{p.prices.sm} ₽
        </div>
        {qty > 0 ? (
          <div className="add-btn in-cart">
            <button className="qty-btn" onClick={onMinus}>−</button>
            <span className="qty">{qty}</span>
            <button className="qty-btn" onClick={onAdd}>+</button>
          </div>
        ) : (
          <button className="add-btn" onClick={onAdd} aria-label="Добавить в корзину">+</button>
        )}
      </div>
    </article>
  );
}

function SimpleCard({ item, qty, onAdd, onMinus }) {
  const isShake = item.id && item.id.startsWith('shake-');
  return (
    <article className="pizza-card">
      <div className="pizza-image">
        {item.img ? (
          <img src={item.img} alt={item.name} loading="lazy"
            style={isShake ? {
              objectFit: 'contain', objectPosition: 'center bottom'
            } : undefined}
            onError={(e)=>{e.currentTarget.style.display='none'}}/>
        ) : (
          <div style={{display:'grid', placeItems:'center', height:'100%', fontSize: 64, opacity:0.5}}>🍽</div>
        )}
      </div>
      <h3 className="pizza-name">{item.name}</h3>
      <p className="pizza-desc">{item.desc}</p>
      <div className="pizza-foot">
        <div className="pizza-price">{item.price} ₽</div>
        {qty > 0 ? (
          <div className="add-btn in-cart">
            <button className="qty-btn" onClick={onMinus}>−</button>
            <span className="qty">{qty}</span>
            <button className="qty-btn" onClick={onAdd}>+</button>
          </div>
        ) : (
          <button className="add-btn" onClick={onAdd}>+</button>
        )}
      </div>
    </article>
  );
}

/* ======================== Cart Drawer ======================== */
export function CartDrawer({ open, onClose, items, addToCart, removeFromCart, total, addUpsell, addresses, onCheckout }) {
  const free = 1000;
  const remaining = Math.max(0, free - total);
  const progress = Math.min(100, Math.round((total / free) * 100));
  const favAddr = (addresses || []).find(a => a.favorite) || (addresses || [])[0];
  const [pickedAddr, setPickedAddr] = React.useState(favAddr?.id);
  const [customAddr, setCustomAddr] = React.useState('');
  React.useEffect(() => { if (favAddr && !pickedAddr) setPickedAddr(favAddr.id); }, [favAddr]);

  return (
    <>
      <div className={`drawer-overlay ${open ? 'open' : ''}`} onClick={onClose}/>
      <aside className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-label="Корзина">
        <div className="drawer-head">
          <h3>Корзина · {items.length}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Ic name="close" size={18}/></button>
        </div>

        <div className="drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div className="big">🍕</div>
              <strong style={{display:'block', color:'var(--ink)', fontSize:18, marginBottom: 6}}>Корзина пуста</strong>
              <p style={{margin:0}}>Добавьте пиццу из меню — соберём горячий заказ за 35 минут.</p>
            </div>
          ) : (
            <>
              <div className="delivery-progress">
                {remaining > 0 ? (
                  <>До <strong>бесплатной доставки</strong> ещё <strong>{remaining} ₽</strong></>
                ) : (
                  <><Ic name="check" size={14}/> <strong>Доставка бесплатная</strong></>
                )}
                <div className="bar"><span style={{width: `${progress}%`}}/></div>
              </div>
              {items.map(it => (
                <div className="cart-item" key={it.cartKey}>
                  <div className="pic">
                    {it.img ? (
                      <img src={it.img} alt="" onError={(e)=>{e.currentTarget.style.display='none'}}/>
                    ) : (
                      <div style={{display:'grid', placeItems:'center', height:'100%', fontSize: 30}}>🍽</div>
                    )}
                  </div>
                  <div className="info">
                    <strong>{it.name}</strong>
                    <small>{it.simple ? it.desc : `${(SIZES.find(s => s.id === it.sizeId) || {}).label || '30 см'} · тонкое`}</small>
                  </div>
                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                    <div className="price">{it.price * it.qty} ₽</div>
                    <div className="ctrls">
                      <button onClick={() => removeFromCart(it.id, it.cartKey)}>−</button>
                      <span className="qty">{it.qty}</span>
                      <button onClick={() => addToCart(it, it)}>+</button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="upsell">
                <h4>Добавьте к заказу:</h4>
                <div className="upsell-row">
                  {DRINK_DATA.slice(0, 4).concat(DESSERT_DATA.slice(0, 2)).map(item => (
                    <button key={item.id} className="upsell-item" onClick={() => addUpsell(item)}>
                      <div className="pic" style={{overflow:'hidden'}}>
                        {item.img ? <img src={item.img} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} onError={(e)=>{e.currentTarget.style.display='none'}}/> : '🥤'}
                      </div>
                      <strong>{item.name}</strong>
                      <span className="p">+{item.price} ₽</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="drawer-foot">
            <div className="row"><span>Сумма</span><span>{total} ₽</span></div>
            <div className="row"><span>Доставка</span><span>{total >= free ? 'бесплатно' : '150 ₽'}</span></div>
            <div className="row total" style={{display:'flex', justifyContent:'space-between'}}>
              <span>Итого</span>
              <span>{total + (total >= free ? 0 : 150)} ₽</span>
            </div>
            <div className="addr-picker">
              <small style={{color:'var(--ink-mute)', fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em'}}>Доставить на</small>
              {(addresses || []).map(a => (
                <button key={a.id} className={`addr-pick ${pickedAddr === a.id ? 'on' : ''}`} onClick={() => setPickedAddr(a.id)}>
                  <span className="radio"/>
                  <span>
                    <strong>{a.label || a.text}</strong>
                    {a.label && <small>{a.text}</small>}
                  </span>
                </button>
              ))}
              <button className={`addr-pick ${pickedAddr === '__custom__' ? 'on' : ''}`} onClick={() => setPickedAddr('__custom__')}>
                <span className="radio"/>
                <span><strong>Другой адрес</strong></span>
              </button>
              {pickedAddr === '__custom__' && (
                <input
                  className="addr-custom-input"
                  placeholder="Улица, дом, квартира"
                  value={customAddr}
                  onChange={e => setCustomAddr(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <button className="btn btn-primary checkout" onClick={() => onCheckout && onCheckout(pickedAddr === '__custom__' ? customAddr || '__custom__' : pickedAddr)}>
              Оформить за 35 минут
              <Ic name="arrow-right" size={16}/>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ======================== Pizza Detail Modal ======================== */
export function PizzaDetail({ pizza, onClose, onAdd }) {
  const [size, setSize] = React.useState('md');
  const [crust, setCrust] = React.useState('thin');
  const [addons, setAddons] = React.useState([]);

  if (!pizza) return null;

  const addonsTotal = addons.reduce((s, a) => s + (ADDONS.find(x => x.id === a)?.p || 0), 0);
  const basePrice = (pizza.prices && pizza.prices[size]) || pizza.price || 0;
  const finalPrice = basePrice + addonsTotal;

  const toggleAddon = (id) => {
    setAddons(addons.includes(id) ? addons.filter(a => a !== id) : [...addons, id]);
  };

  return (
    <div className="pdmodal-overlay open" onClick={onClose}>
      <div className="pdmodal" onClick={e => e.stopPropagation()}>
        <button className="pdmodal-close" onClick={onClose}><Ic name="close" size={18}/></button>
        <div className="pdmodal-pic">
          <div className="disc">
            {(() => {
              const sizeIdx = ['sm','md','lg'].indexOf(size);
              const src = (pizza.imgs && pizza.imgs[sizeIdx]) || pizza.img;
              return <img src={src} alt={pizza.name} onError={(e)=>{e.currentTarget.style.display='none'}}/>;
            })()}
          </div>
        </div>
        <div className="pdmodal-body">
          <h3>{pizza.name}</h3>
          <p className="desc">{pizza.desc}</p>
          <div className="ingredients">
            <strong style={{color:'var(--ink)'}}>Ингредиенты: </strong>
            {pizza.ingredients.join(' · ')}
          </div>

          <div style={{fontSize: 13, fontWeight: 600, marginBottom: 8, color:'var(--ink-soft)'}}>Размер</div>
          <div className="size-toggle">
            {SIZES.map(s => {
              const sizePrice = (pizza.prices && pizza.prices[s.id]) || null;
              return (
                <button key={s.id} className={size === s.id ? 'on' : ''} onClick={() => setSize(s.id)}>
                  {s.label}
                  <div style={{fontSize: 10, opacity: 0.7, marginTop: 2, fontWeight: 400}}>{s.sub}</div>
                  {sizePrice && <div style={{fontSize: 12, fontWeight: 700, marginTop: 4}}>{sizePrice} ₽</div>}
                </button>
              );
            })}
          </div>

          <div style={{fontSize: 13, fontWeight: 600, marginBottom: 8, color:'var(--ink-soft)'}}>Добавить</div>
          <div className="add-row">
            {ADDONS.map(a => (
              <button
                key={a.id}
                className={`ad-item ${addons.includes(a.id) ? 'on' : ''}`}
                onClick={() => toggleAddon(a.id)}
              >
                {a.label}
                <span className="p">+{a.p} ₽</span>
              </button>
            ))}
          </div>

          <div className="pdmodal-foot">
            <div className="price-big">{finalPrice} ₽</div>
            <button className="btn btn-primary btn-lg" onClick={() => {
              onAdd(pizza, { sizeId: size, crustId: crust, addons, price: finalPrice });
              onClose();
            }}>
              Добавить в корзину
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================== Checkout Modal ======================== */
export function CheckoutModal({ open, onClose, onConfirm, items, total, profile, addresses }) {
  const free = 1000;

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [pickedAddr, setPickedAddr] = React.useState(null);
  const [customAddr, setCustomAddr] = React.useState('');
  const [receiveMethod, setReceiveMethod] = React.useState('delivery'); // 'delivery' | 'pickup'
  const [payMethod, setPayMethod] = React.useState('online'); // 'online' | 'cash'
  const [timeMode, setTimeMode] = React.useState('asap'); // 'asap' | 'exact'
  const [pickedTime, setPickedTime] = React.useState('');

  // min time = now + 1 hour, rounded to next 15 min, within 10:00–22:30 MSK
  const getMinTime = () => {
    const now = new Date();
    const mskOffset = 3 * 60; // UTC+3
    const mskNow = new Date(now.getTime() + (mskOffset - now.getTimezoneOffset()) * 60000);
    mskNow.setHours(mskNow.getHours() + 1);
    const mins = mskNow.getMinutes();
    const rounded = Math.ceil(mins / 15) * 15;
    mskNow.setMinutes(rounded, 0, 0);
    const h = String(mskNow.getHours()).padStart(2, '0');
    const m = String(mskNow.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleTimeModeChange = (mode) => {
    setTimeMode(mode);
    if (mode === 'exact' && !pickedTime) setPickedTime(getMinTime());
  };

  React.useEffect(() => {
    if (open && profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
      const fav = (profile.addresses || []).find(a => a.favorite) || (profile.addresses || [])[0];
      if (fav) setPickedAddr(fav.id);
      setTimeMode('asap');
      setPickedTime('');
    }
  }, [open]);

  // При смене на доставку сбрасываем "при получении"
  React.useEffect(() => {
    if (receiveMethod === 'delivery') setPayMethod('online');
  }, [receiveMethod]);

  const [paying, setPaying] = React.useState(false);
  const [payError, setPayError] = React.useState('');

  if (!open) return null;

  const isPickup = receiveMethod === 'pickup';
  const delivery = isPickup ? 0 : (total >= free ? 0 : 150);
  const grandTotal = total + delivery;

  const resolvedAddr = isPickup
    ? 'Романовская 5, подъезд 10 (самовывоз)'
    : pickedAddr === '__custom__'
      ? customAddr
      : (addresses || []).find(a => a.id === pickedAddr)?.text || customAddr;

  const canSubmit = name.trim() && phone.trim() && (isPickup || resolvedAddr.trim());

  const handleSubmit = async () => {
    if (!canSubmit || paying) return;
    const orderData = { name: name.trim(), phone: phone.trim(), address: resolvedAddr, comment: comment.trim(), receiveMethod, payMethod, deliveryTime: timeMode === 'exact' ? pickedTime : 'asap' };

    if (payMethod === 'online') {
      setPaying(true);
      setPayError('');
      try {
        const desc = `Заказ Дело в пицце: ${items.map(i => `${i.name}×${i.qty}`).join(', ')}`;
        const resp = await fetch('/api/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: grandTotal,
            description: desc.slice(0, 128),
            returnUrl: window.location.origin + `/?order=success&method=${receiveMethod}&time=${encodeURIComponent(timeMode === 'exact' ? pickedTime : 'asap')}`,
            phone: phone.trim(),
            items: items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          }),
        });
        const data = await resp.json();
        if (data.confirmation?.confirmation_url) {
          window.location.href = data.confirmation.confirmation_url;
        } else {
          setPayError(data.description || 'Ошибка оплаты, попробуйте снова');
          setPaying(false);
        }
      } catch (e) {
        setPayError('Нет соединения с сервером оплаты');
        setPaying(false);
      }
    } else {
      onConfirm(orderData);
    }
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose}/>
      <aside className="checkout-drawer open" role="dialog" aria-label="Оформление заказа">
        <div className="drawer-head">
          <h3>Оформление заказа</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Ic name="close" size={18}/></button>
        </div>
        <div className="drawer-body">

          {/* Order summary */}
          <div className="co-section">
            <div className="co-label">Состав заказа</div>
            {items.map(it => (
              <div className="co-row" key={it.cartKey}>
                <span className="co-name">{it.name} ×{it.qty}</span>
                <span className="co-price">{it.price * it.qty} ₽</span>
              </div>
            ))}
            <div className="co-row co-total">
              <span>Доставка</span>
              <span>{delivery === 0 ? 'бесплатно' : `${delivery} ₽`}</span>
            </div>
          </div>

          {/* Receive method */}
          <div className="co-section">
            <div className="co-label">Способ получения</div>
            <div className="co-toggle">
              <button className={receiveMethod === 'delivery' ? 'on' : ''} onClick={() => setReceiveMethod('delivery')}>🚴 Доставка</button>
              <button className={receiveMethod === 'pickup' ? 'on' : ''} onClick={() => setReceiveMethod('pickup')}>🏃 Самовывоз</button>
            </div>
            {isPickup && <p className="co-hint">Романовская 5, подъезд 10. Готово через ~20 мин.</p>}
          </div>

          {/* Delivery time */}
          <div className="co-section">
            <div className="co-label">{isPickup ? 'Время готовности' : 'Время доставки'}</div>
            <div className="co-toggle">
              <button className={timeMode === 'asap' ? 'on' : ''} onClick={() => handleTimeModeChange('asap')}>
                ⚡ Ближайшее время
              </button>
              <button className={timeMode === 'exact' ? 'on' : ''} onClick={() => handleTimeModeChange('exact')}>
                🕐 Ко времени
              </button>
            </div>
            {timeMode === 'exact' && (
              <input
                className="co-input"
                type="time"
                value={pickedTime}
                min={getMinTime()}
                max="23:00"
                onChange={e => setPickedTime(e.target.value)}
              />
            )}
            {timeMode === 'asap' && (
              <p className="co-hint">{isPickup ? 'Готово ~через 20 мин после заказа.' : 'Доставим через 35–60 мин после заказа.'}</p>
            )}
          </div>

          {/* Contact */}
          <div className="co-section">
            <div className="co-label">Контакты</div>
            <input className="co-input" placeholder="Имя" value={name} onChange={e => setName(e.target.value)}/>
            <input className="co-input" placeholder="Телефон" type="tel" value={phone} onChange={e => setPhone(e.target.value)}/>
          </div>

          {/* Address — only for delivery */}
          {!isPickup && (
            <div className="co-section">
              <div className="co-label">Адрес доставки</div>
              {(addresses || []).map(a => (
                <button key={a.id} className={`addr-pick ${pickedAddr === a.id ? 'on' : ''}`} onClick={() => setPickedAddr(a.id)}>
                  <span className="radio"/>
                  <span>
                    <strong>{a.label || a.text}</strong>
                    {a.label && <small>{a.text}</small>}
                  </span>
                </button>
              ))}
              <button className={`addr-pick ${pickedAddr === '__custom__' ? 'on' : ''}`} onClick={() => setPickedAddr('__custom__')}>
                <span className="radio"/>
                <span><strong>Другой адрес</strong></span>
              </button>
              {pickedAddr === '__custom__' && (
                <input className="co-input" placeholder="Улица, дом, квартира" value={customAddr} onChange={e => setCustomAddr(e.target.value)} autoFocus/>
              )}
            </div>
          )}

          {/* Payment */}
          <div className="co-section">
            <div className="co-label">Способ оплаты</div>
            <div className="co-toggle">
              <button className={payMethod === 'online' ? 'on' : ''} onClick={() => setPayMethod('online')}>💳 Онлайн</button>
              <button
                className={payMethod === 'cash' ? 'on' : ''}
                disabled={!isPickup}
                style={!isPickup ? {opacity: 0.4, cursor: 'not-allowed'} : undefined}
                onClick={() => isPickup && setPayMethod('cash')}
              >
                💵 При получении
                {!isPickup && <span className="co-pay-note"> · только самовывоз</span>}
              </button>
            </div>
          </div>

          {/* Comment */}
          <div className="co-section">
            <div className="co-label">{isPickup ? 'Комментарий' : 'Комментарий курьеру'}</div>
            <textarea className="co-input co-textarea" placeholder={isPickup ? 'Пожелания к заказу…' : 'Код домофона, этаж, пожелания…'} value={comment} onChange={e => setComment(e.target.value)} rows={3}/>
          </div>

        </div>
        <div className="drawer-foot">
          <div className="row total" style={{display:'flex', justifyContent:'space-between', marginBottom: 12}}>
            <span>Итого</span>
            <span style={{fontFamily:'Unbounded', fontWeight:700}}>{grandTotal} ₽</span>
          </div>
          {payError && <div style={{color:'var(--primary)', fontSize:13, marginBottom:8, textAlign:'center'}}>{payError}</div>}
          <button
            className="btn btn-primary checkout"
            disabled={!canSubmit || paying}
            style={(!canSubmit || paying) ? {opacity: 0.6, cursor:'not-allowed'} : undefined}
            onClick={handleSubmit}
          >
            {paying ? 'Переход к оплате…' : payMethod === 'online' ? `Оплатить ${grandTotal} ₽` : 'Оформить за 35 минут'}
            {!paying && <Ic name="arrow-right" size={16}/>}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ======================== Toast ======================== */
export function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div className="toast" key={t.id}>
          <Ic name="check" size={16}/>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

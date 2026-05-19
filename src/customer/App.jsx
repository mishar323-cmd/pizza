/* eslint-disable */
import React from 'react';
import { SIZES } from '../data/menu.js';
import { useTweaks, TweaksPanel, TweakSection, TweakSelect, TweakColor, TweakToggle } from './tweaks-panel.jsx';
import { useProfile } from './profile/useProfile.js';
import { ProfileModal } from './profile/profile.jsx';
import { DeliveryMap } from './delivery-map.jsx';
import { NightOverlay } from './night-overlay.jsx';
import { TopBar, Header, Hero, ScrollingBanner } from './header-hero.jsx';

import { MenuSection, CartDrawer, PizzaDetail, ToastStack, CheckoutModal } from './menu.jsx';
import { HalvesModal } from './halves.jsx';
import { PromoSection, TrustSection, ReviewsSection, FaqSection, Footer, MobileBar } from './sections.jsx';


const TWEAK_DEFAULTS = {
  "theme": "default",
  "showPromo": true,
  "showStats": true,
  "menuDensity": "comfortable",
  "primaryColor": "#DC2828",
  "forceNight": false
};

function OrderSuccessPage({ method, time, onClose }) {
  const isPickup = method === 'pickup';
  const timeLabel = time === 'asap'
    ? (isPickup ? '~20 минут' : '35–60 минут')
    : `к ${time}`;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px', textAlign: 'center',
    }}>
      <div style={{fontSize: 72, marginBottom: 16}}>🎉</div>
      <h1 style={{fontFamily: 'Unbounded', fontSize: 'clamp(22px, 5vw, 36px)', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.02em'}}>
        Спасибо за заказ!
      </h1>
      <p style={{fontSize: 16, color: 'var(--ink-soft)', maxWidth: 420, margin: '0 0 8px', lineHeight: 1.5}}>
        {isPickup
          ? <>Заказ будет готов примерно <strong>через {timeLabel}</strong>. Ждём вас на Романовской 5, подъезд 10.</>
          : <>Курьер будет у вас примерно <strong>через {timeLabel}</strong>. Пицца едет горячая!</>
        }
      </p>
      <p style={{fontSize: 14, color: 'var(--ink-mute)', margin: '0 0 32px'}}>
        Номер заказа и детали придут в СМС.
      </p>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320}}>
        <a href="https://t.me/delovpizza" target="_blank" rel="noopener noreferrer"
          style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            background:'#229ED9', color:'#fff', borderRadius:'var(--r-pill)',
            padding:'14px 24px', fontWeight:600, fontSize:15, textDecoration:'none'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.007 9.456c-.148.658-.537.818-1.088.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.332-.373-.12L7.16 14.338l-2.95-.924c-.641-.2-.654-.641.136-.949l11.527-4.445c.533-.194 1.001.13.69.227z"/></svg>
          Написать в Telegram
        </a>
        <a href="tel:+79154889419"
          style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            background:'var(--bg-elev)', color:'var(--ink)', borderRadius:'var(--r-pill)',
            padding:'14px 24px', fontWeight:600, fontSize:15, textDecoration:'none',
            border:'1px solid var(--line)'}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.95 9.81 19.79 19.79 0 01.88 1.18 2 2 0 012.86 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z"/></svg>
          +7 915 488-94-19
        </a>
        <button onClick={onClose}
          style={{background:'none', border:'none', color:'var(--ink-mute)', fontSize:14,
            cursor:'pointer', padding:'8px', marginTop:4}}>
          Вернуться в меню
        </button>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = React.useState(false);
  const [cart, setCart] = React.useState([]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  const [halvesOpen, setHalvesOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState([]);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const profileState = useProfile();

  // Check for ?order=success redirect from YooKassa
  const urlParams = new URLSearchParams(window.location.search);
  const orderSuccess = urlParams.get('order') === 'success';
  const orderMethod = urlParams.get('method') || 'delivery';
  const orderTime = urlParams.get('time') || 'asap';

  if (orderSuccess) {
    return <OrderSuccessPage method={orderMethod} time={orderTime} onClose={() => {
      window.history.replaceState({}, '', '/');
    }}/>;
  }

  // Apply theme
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme === 'default' ? '' : t.theme);
    if (t.theme === 'default' && t.primaryColor && t.primaryColor !== '#DC2828') {
      document.documentElement.style.setProperty('--primary', t.primaryColor);
    } else {
      document.documentElement.style.removeProperty('--primary');
    }
  }, [t.theme, t.primaryColor]);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  React.useEffect(() => {
    document.body.classList.toggle('no-scroll', drawerOpen || !!detail || halvesOpen);
  }, [drawerOpen, detail, halvesOpen]);

  const showToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, { id, msg }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 2000);
  };

  const cartKey = (item, opts = {}) => {
    if (opts.simple) return item.id;
    return `${item.id}|${opts.sizeId || 'md'}|${opts.crustId || 'thin'}|${(opts.addons || []).sort().join(',')}`;
  };

  const addToCart = (item, opts = {}) => {
    const key = opts.cartKey || cartKey(item, opts);
    setCart(prev => {
      const existing = prev.find(p => p.cartKey === key);
      if (existing) return prev.map(p => p.cartKey === key ? { ...p, qty: p.qty + 1 } : p);
      const sizeObj = SIZES.find(s => s.id === (opts.sizeId || 'md'));
      const basePrice = opts.simple ? item.price : (opts.price || Math.round(item.price * (sizeObj?.mul || 1)));
      return [...prev, {
        ...item,
        cartKey: key,
        sizeId: opts.sizeId,
        crustId: opts.crustId,
        addons: opts.addons,
        price: basePrice,
        qty: 1,
        simple: !!opts.simple,
      }];
    });
    showToast(`${item.name} в корзине`);
  };

  const removeFromCart = (id, key) => {
    setCart(prev => {
      const k = key || id;
      const found = prev.find(p => p.cartKey === k || (!key && p.id === id));
      if (!found) return prev;
      if (found.qty > 1) return prev.map(p => p === found ? { ...p, qty: p.qty - 1 } : p);
      return prev.filter(p => p !== found);
    });
  };

  const getQty = (id) => cart.filter(p => p.id === id).reduce((s, p) => s + p.qty, 0);
  const total = cart.reduce((s, p) => s + p.price * p.qty, 0);
  const cartCount = cart.reduce((s, p) => s + p.qty, 0);

  const scrollToMenu = () => {
    document.querySelector('#menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <TopBar/>
      <Header
        cartCount={cartCount}
        cartTotal={total}
        onCartOpen={() => setDrawerOpen(true)}
        onProfileOpen={() => setProfileOpen(true)}
        profileBadge={profileState.freeAvailable}
      />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profileState={profileState}
      />
      <Hero onScrollToMenu={scrollToMenu}/>
      <ScrollingBanner/>
      {t.showPromo !== false && <PromoSection onScrollToMenu={scrollToMenu}/>}
      <MenuSection
        cart={cart}
        addToCart={addToCart}
        removeFromCart={removeFromCart}
        getQty={getQty}
        openDetail={setDetail}
        openHalves={() => setHalvesOpen(true)}
      />
      <TrustSection/>
      <ReviewsSection/>
      <DeliveryMap/>
      <FaqSection/>
      <Footer/>
      <MobileBar count={cartCount} total={total} onOpen={() => setDrawerOpen(true)}/>
      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={cart}
        addToCart={(it, opts) => addToCart(it, opts)}
        removeFromCart={removeFromCart}
        total={total}
        addUpsell={(it) => addToCart(it, { simple: true })}
        addresses={profileState.profile.addresses}
        onCheckout={() => {
          setDrawerOpen(false);
          setTimeout(() => setCheckoutOpen(true), 200);
        }}
      />
      <PizzaDetail
        pizza={detail}
        onClose={() => setDetail(null)}
        onAdd={addToCart}
      />
      <HalvesModal
        open={halvesOpen}
        onClose={() => setHalvesOpen(false)}
        onAdd={addToCart}
      />
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart}
        total={total}
        profile={profileState.profile}
        addresses={profileState.profile.addresses}
        onConfirm={(data) => {
          const delivery = data.receiveMethod === 'pickup' ? 0 : (total >= 1000 ? 0 : 150);
          const grandTotal = total + delivery;
          profileState.placeOrder(cart, grandTotal, data.address);
          fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
              total: grandTotal,
              delivery,
            }),
          }).catch(() => {});
          setCart([]);
          setCheckoutOpen(false);
          showToast('Заказ оформлен!');
          setTimeout(() => setProfileOpen(true), 400);
        }}
      />
      <ToastStack toasts={toasts}/>
      <NightOverlay force={t.forceNight}/>
    </>
  );
}

export default App;

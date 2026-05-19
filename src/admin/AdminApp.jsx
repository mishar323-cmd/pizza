/* eslint-disable */
// Root админ-приложения
import React from 'react';
import { AdminStore } from './store/admin-store.js';
import { LoginScreen } from './login.jsx';
import { OrdersBoard, OrdersHistory, Couriers, StopList } from './orders.jsx';
import { MenuEdit } from './menu-edit.jsx';
import ZonesAdvanced from './zones.jsx';
import { SettingsPage } from './settings.jsx';
import { CookTime, Promos } from './cooking-promo.jsx';

function AdminLayout({ session, onLogout, store, setStore }) {
  const [page, setPage] = React.useState('orders');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const today = AdminStore.TODAY_KEY();
  const activeToday = (store.orders || []).filter(o => o.createdAt.slice(0, 10) === today && o.status !== 'delivered' && o.status !== 'cancelled').length;

  const pages = [
    { id: 'orders',   label: 'Заказы',          ic: '📋', badge: activeToday > 0 ? activeToday : null },
    { id: 'history',  label: 'История заказов', ic: '📜' },
    { id: 'cook',     label: 'Время готовки',   ic: '⏱' },
    { id: 'promos',   label: 'Акции',           ic: '🎉', badge: store.promos.length },
    { id: 'menu',     label: 'Меню',            ic: '🍕' },
    { id: 'stop',     label: 'Стоп-лист',       ic: '🚫', badge: store.stopList.length || null },
    { id: 'zones',    label: 'Зоны доставки',   ic: '📍' },
    { id: 'couriers', label: 'Курьеры',         ic: '🛵', badge: (store.couriers || []).length || null },
  ];

  const renderPage = () => {
    switch (page) {
      case 'orders':  return <OrdersBoard   store={store} setStore={setStore}/>;
      case 'history': return <OrdersHistory store={store}/>;
      case 'cook':    return <CookTime      store={store} setStore={setStore}/>;
      case 'promos':  return <Promos        store={store} setStore={setStore}/>;
      case 'menu':    return <MenuEdit      store={store} setStore={setStore}/>;
      case 'stop':    return <StopList      store={store} setStore={setStore}/>;
      case 'zones':   return <ZonesAdvanced store={store} setStore={setStore}/>;
      case 'couriers':return <Couriers      store={store} setStore={setStore}/>;
      default: return null;
    }
  };

  return (
    <div className="admin-shell">
      <div className="mobile-topbar">
        <button onClick={() => setSidebarOpen(true)} aria-label="Меню">☰</button>
        <strong style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 15 }}>Админ — {pages.find(p => p.id === page)?.label}</strong>
      </div>

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} onClick={(e) => { if (e.target.classList.contains('nav-item')) setSidebarOpen(false); }}>
        <div className="sidebar-brand">
          <span className="mark"/>
          <div>
            <strong>Дело в пицце</strong>
            <small>Админка</small>
          </div>
        </div>

        <div className="nav-divider">Операции</div>
        {pages.slice(0, 3).map(p => (
          <button key={p.id} className={`nav-item ${page === p.id ? 'on' : ''}`} onClick={() => setPage(p.id)}>
            <span className="ic">{p.ic}</span>
            <span>{p.label}</span>
            {p.badge != null && <span className="badge">{p.badge}</span>}
          </button>
        ))}

        <div className="nav-divider">Контент</div>
        {pages.slice(3).map(p => (
          <button key={p.id} className={`nav-item ${page === p.id ? 'on' : ''}`} onClick={() => setPage(p.id)}>
            <span className="ic">{p.ic}</span>
            <span>{p.label}</span>
            {p.badge != null && <span className="badge">{p.badge}</span>}
          </button>
        ))}

        <div className="sidebar-foot">
          <div className="avatar">{session.name?.[0] || 'A'}</div>
          <div className="info">
            <strong>{session.name}</strong>
            <small>{session.role}</small>
          </div>
          <button onClick={onLogout} title="Выйти">⎋</button>
        </div>
      </aside>

      <main className="admin-main">
        {renderPage()}
      </main>
    </div>
  );
}

function AdminApp() {
  const [session, setSession] = React.useState(() => AdminStore.loadSession());
  const [store, setStore] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    document.body.classList.add('admin');
    return () => document.body.classList.remove('admin');
  }, []);

  React.useEffect(() => {
    if (!session) { setStore(null); return; }
    setLoading(true);
    AdminStore.init().then(s => { setStore(s); setLoading(false); });
  }, [session]);

  // Periodic order refresh
  React.useEffect(() => {
    if (!session || !store) return;
    const t = setInterval(async () => {
      const orders = await AdminStore.refreshOrders();
      setStore(prev => prev ? { ...prev, orders } : prev);
    }, 15000);
    return () => clearInterval(t);
  }, [session, !!store]);

  if (!session) {
    return <LoginScreen onLogin={setSession}/>;
  }

  if (loading || !store) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', fontFamily: 'Unbounded, sans-serif' }}>
        Загрузка…
      </div>
    );
  }

  const logout = () => {
    AdminStore.clearSession();
    setSession(null);
  };

  return <AdminLayout session={session} onLogout={logout} store={store} setStore={setStore}/>;
}

export default AdminApp;

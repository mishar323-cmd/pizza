/* eslint-disable */
// Заказы — текущая смена (board) + история + курьеры + стоп-лист
import React from 'react';
import { AdminStore } from './store/admin-store.js';

function timeSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  return `${h} ч назад`;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABELS = {
  new: 'Новый',
  cooking: 'Готовится',
  on_way: 'В пути',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};
const STATUS_FLOW = ['new', 'cooking', 'on_way', 'delivered'];

function OrderCard({ order, onAdvance, onCancel, onOpen }) {
  const next = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
  const nextLabel = {
    cooking: '✓ Принять заказ',
    on_way: '→ Передать курьеру',
    delivered: '✓ Завершить',
  }[next];

  return (
    <div className={`order-card ${order.status}`} onClick={() => onOpen(order)}>
      <div className="head">
        <span className="num">#{order.number}</span>
        <span className="time">{fmtTime(order.createdAt)} · {timeSince(order.createdAt)}</span>
      </div>
      <div className="who">
        <strong>{order.customer.name}</strong>
        <small>{order.customer.phone}</small>
        <small>{order.address} · <span className={`zone-pill ${order.zone.toLowerCase()}`}>Зона {order.zone}</span></small>
      </div>
      <div className="items">
        {order.items.map((it, i) => <div key={i}>{it.name} × {it.qty}</div>)}
      </div>
      <div className="foot">
        <span className="total">{(order.total + order.delivery).toLocaleString('ru-RU')} ₽</span>
        <span className="chip">{order.payment}</span>
      </div>
      {next && order.status !== 'cancelled' && order.status !== 'delivered' && (
        <div className="action-row" onClick={(e) => e.stopPropagation()}>
          <button className="mini primary" onClick={() => onAdvance(order.id)}>{nextLabel}</button>
          <button className="mini danger" onClick={() => onCancel(order.id)}>Отменить</button>
        </div>
      )}
    </div>
  );
}

function OrderModal({ order, onClose, onAdvance, onCancel }) {
  if (!order) return null;
  return (
    <div className="amodal-overlay" onClick={onClose}>
      <div className="amodal" onClick={(e) => e.stopPropagation()}>
        <div className="row-spread" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Заказ #{order.number}</h3>
          <span className={`status-pill ${order.status}`}>{STATUS_LABELS[order.status]}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', display: 'grid', gap: 6 }}>
          <div><strong>{order.customer.name}</strong> · {order.customer.phone}</div>
          <div>{order.address} · <span className={`zone-pill ${order.zone.toLowerCase()}`}>Зона {order.zone}</span></div>
          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(order.createdAt)} · ETA {order.etaMinutes} мин · {order.assignedTo || '—'}</div>
        </div>
        <table className="dtable" style={{ margin: '14px 0' }}>
          <thead>
            <tr><th>Позиция</th><th style={{ textAlign: 'right' }}>Кол-во</th><th style={{ textAlign: 'right' }}>Цена</th></tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i}>
                <td>{it.name}</td>
                <td style={{ textAlign: 'right' }}>{it.qty}</td>
                <td style={{ textAlign: 'right' }}>{(it.qty * it.price).toLocaleString('ru-RU')} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row-spread">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Сумма</div>
            <div style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 20 }}>{order.total.toLocaleString('ru-RU')} ₽</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: 12 }}>+ Доставка</div>
            <div style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 20 }}>{order.delivery} ₽</div>
          </div>
        </div>
        <div className="amodal-actions">
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <>
              <button className="abtn abtn-danger" onClick={() => { onCancel(order.id); onClose(); }}>Отменить</button>
              <button className="abtn abtn-primary" onClick={() => { onAdvance(order.id); onClose(); }}>Дальше по статусу</button>
            </>
          )}
          <button className="abtn abtn-ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

export function OrdersBoard({ store, setStore }) {
  const [selected, setSelected] = React.useState(null);

  const today = AdminStore.TODAY_KEY();
  const orders = (store.orders || []).filter(o => o.createdAt.slice(0, 10) === today);

  const cols = [
    { id: 'new', label: 'Новые', filter: o => o.status === 'new' },
    { id: 'cooking', label: 'Готовится', filter: o => o.status === 'cooking' },
    { id: 'on_way', label: 'В пути', filter: o => o.status === 'on_way' },
    { id: 'done', label: 'Закрыты сегодня', filter: o => o.status === 'delivered' || o.status === 'cancelled' },
  ];

  const advance = (id) => {
    const target = store.orders.find(o => o.id === id);
    if (!target || !target.dbId) return;
    const idx = STATUS_FLOW.indexOf(target.status);
    const newStatus = STATUS_FLOW[idx + 1] || target.status;
    setStore({ ...store, orders: store.orders.map(o => o.id === id ? { ...o, status: newStatus } : o) });
    AdminStore.updateOrder(target.dbId, { status: newStatus, assignedTo: target.assignedTo || '' }).catch(e => console.warn('updateOrder:', e));
  };
  const cancel = (id) => {
    const target = store.orders.find(o => o.id === id);
    if (!target || !target.dbId) return;
    setStore({ ...store, orders: store.orders.map(o => o.id === id ? { ...o, status: 'cancelled' } : o) });
    AdminStore.updateOrder(target.dbId, { status: 'cancelled', assignedTo: target.assignedTo || '' }).catch(e => console.warn('updateOrder:', e));
  };

  const todayTotal = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total + o.delivery, 0);
  const activeCount = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length;

  return (
    <div>
      <h1 className="admin-h1">Заказы — сегодня</h1>
      <p className="admin-sub">Активные заказы текущей смены. История за прошлые дни — в отдельной вкладке.</p>

      <div className="stat-row">
        <div className="stat-card">
          <small>Активных сейчас</small>
          <div className="value">{activeCount}<span className="unit">в работе</span></div>
        </div>
        <div className="stat-card">
          <small>Закрыто за день</small>
          <div className="value">{orders.filter(o => o.status === 'delivered').length}</div>
        </div>
        <div className="stat-card">
          <small>Выручка за день</small>
          <div className="value">{todayTotal.toLocaleString('ru-RU')}<span className="unit">₽</span></div>
        </div>
        <div className="stat-card">
          <small>Средний чек</small>
          <div className="value">{orders.length > 0 ? Math.round(todayTotal / Math.max(1, orders.filter(o => o.status === 'delivered').length)).toLocaleString('ru-RU') : 0}<span className="unit">₽</span></div>
        </div>
      </div>

      <div className="orders-board">
        {cols.map(c => {
          const list = orders.filter(c.filter);
          return (
            <div className="order-col" key={c.id}>
              <h3>{c.label} <span className="count">{list.length}</span></h3>
              <div className="order-col-list">
                {list.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 12, textAlign: 'center', background: 'var(--bg-elev,#fff)', borderRadius: 10, border: '1px dashed var(--line)' }}>Пусто</div>}
                {list.map(o => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onAdvance={advance}
                    onCancel={cancel}
                    onOpen={setSelected}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <OrderModal order={selected} onClose={() => setSelected(null)} onAdvance={advance} onCancel={cancel}/>
    </div>
  );
}

export function OrdersHistory({ store }) {
  const today = AdminStore.TODAY_KEY();
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  const orders = (store.orders || [])
    .filter(o => o.createdAt.slice(0, 10) !== today)
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .filter(o => !search || `${o.number}`.includes(search) || o.customer.phone.includes(search) || o.customer.name.toLowerCase().includes(search.toLowerCase()) || o.address.toLowerCase().includes(search.toLowerCase()));

  const totalDelivered = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total + o.delivery, 0);

  return (
    <div>
      <h1 className="admin-h1">История заказов</h1>
      <p className="admin-sub">Все заказы кроме текущего дня. Найдено: {orders.length}, выручка {totalDelivered.toLocaleString('ru-RU')} ₽.</p>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Поиск по номеру, имени, телефону, адресу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Все статусы</option>
          <option value="delivered">Доставленные</option>
          <option value="cancelled">Отменённые</option>
        </select>
      </div>

      <div className="table-card">
        <table className="dtable">
          <thead>
            <tr>
              <th>№</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Адрес</th>
              <th>Зона</th>
              <th style={{ textAlign: 'right' }}>Сумма</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td><strong>#{o.number}</strong></td>
                <td className="muted">{fmtDate(o.createdAt)}</td>
                <td>
                  <strong>{o.customer.name}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{o.customer.phone}</div>
                </td>
                <td className="muted">{o.address}</td>
                <td><span className={`zone-pill ${o.zone.toLowerCase()}`}>Зона {o.zone}</span></td>
                <td style={{ textAlign: 'right', fontFamily: 'Unbounded, sans-serif' }}>{(o.total + o.delivery).toLocaleString('ru-RU')} ₽</td>
                <td><span className={`status-pill ${o.status}`}>{STATUS_LABELS[o.status]}</span></td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40 }} className="muted">Ничего не найдено</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Couriers({ store, setStore }) {
  const list = store.couriers || [];
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState(null);

  const startAdd = () => { setDraft({ id: 'c' + Date.now(), name: '', phone: '', transport: '', note: '' }); setEditing('new'); };
  const startEdit = (c) => { setDraft({ ...c }); setEditing(c.id); };
  const close = () => { setEditing(null); setDraft(null); };
  const save = () => {
    let next;
    if (editing === 'new') next = { ...store, couriers: [...list, draft] };
    else next = { ...store, couriers: list.map(c => c.id === editing ? draft : c) };
    setStore(next); AdminStore.save(next); close();
  };
  const remove = (id) => {
    if (!confirm('Удалить курьера?')) return;
    const next = { ...store, couriers: list.filter(c => c.id !== id) };
    setStore(next); AdminStore.save(next);
  };

  return (
    <div>
      <h1 className="admin-h1">Курьеры</h1>
      <p className="admin-sub">База курьеров с контактами и транспортом. Используется при назначении заказа.</p>

      <div className="toolbar">
        <span className="grow"/>
        <button className="abtn abtn-primary" onClick={startAdd}>+ Добавить курьера</button>
      </div>

      <div className="table-card">
        <table className="dtable">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Транспорт</th>
              <th>Доп. информация</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }} className="muted">Курьеров пока нет — добавьте первого</td></tr>
            )}
            {list.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td><a href={`tel:${c.phone}`} style={{ color: 'var(--ink)' }}>{c.phone}</a></td>
                <td>{c.transport || <span className="muted">—</span>}</td>
                <td className="muted" style={{ fontSize: 12 }}>{c.note || '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="abtn abtn-ghost" onClick={() => startEdit(c)}>Изм.</button>
                  <button className="abtn abtn-danger" onClick={() => remove(c.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && draft && (
        <div className="amodal-overlay" onClick={close}>
          <div className="amodal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing === 'new' ? 'Новый курьер' : 'Редактировать курьера'}</h3>
            <div className="field">
              <label>Имя</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Иван Петров" autoFocus/>
            </div>
            <div className="field">
              <label>Номер телефона</label>
              <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+7 916 100-22-11"/>
            </div>
            <div className="field">
              <label>Транспорт</label>
              <input value={draft.transport} onChange={(e) => setDraft({ ...draft, transport: e.target.value })} placeholder="Авто · Renault Logan / Скутер / Велосипед"/>
            </div>
            <div className="field">
              <label>Доп. информация</label>
              <textarea rows="3" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Зоны, смена, особенности..."/>
            </div>
            <div className="amodal-actions">
              <button className="abtn abtn-ghost" onClick={close}>Отмена</button>
              <button className="abtn abtn-primary" onClick={save} disabled={!draft.name || !draft.phone}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StopList({ store, setStore }) {
  const menu = store.menu || [];
  const CAT_LABEL = { pizza: 'Пицца', roman: 'Римская', sandwich: 'Сэндвичи', snacks: 'Закуски', drinks: 'Напитки', desserts: 'Десерты' };
  const stopCategories = store.stopCategories || [];

  const GROUP_STOPS = [
    { id: 'pizza-25', label: 'Пицца 25 см',     hint: 'Скрыть размер 25 см во всех пиццах' },
    { id: 'pizza-30', label: 'Пицца 30 см',     hint: 'Скрыть размер 30 см во всех пиццах' },
    { id: 'pizza-35', label: 'Пицца 35 см',     hint: 'Скрыть размер 35 см во всех пиццах' },
    { id: 'roman',    label: 'Римская пицца',   hint: 'Скрыть всю римскую категорию' },
    { id: 'sandwich', label: 'Сэндвичи',        hint: 'Скрыть все сэндвичи' },
    { id: 'rolls',    label: 'Роллы',           hint: 'Скрыть закрытые роллы / кальцоне' },
    { id: 'snacks',   label: 'Закуски',         hint: 'Скрыть всю категорию закусок' },
  ];

  const toggleGroup = (id) => {
    const has = stopCategories.includes(id);
    const next = { ...store, stopCategories: has ? stopCategories.filter(x => x !== id) : [...stopCategories, id] };
    setStore(next);
    AdminStore.save(next);
  };

  const inStop = menu.filter(p => store.stopList.includes(p.id));
  const available = menu.filter(p => !store.stopList.includes(p.id));
  const [cat, setCat] = React.useState('all');
  const cats = [{ id: 'all', label: 'Все' }, ...Object.keys(CAT_LABEL).map(id => ({ id, label: CAT_LABEL[id] }))];
  const filterByCat = (list) => cat === 'all' ? list : list.filter(p => (p.cat || 'pizza') === cat);

  const remove = (id) => {
    const next = { ...store, stopList: store.stopList.filter(x => x !== id) };
    setStore(next);
    AdminStore.save(next);
  };
  const add = (id) => {
    if (store.stopList.includes(id)) return;
    const next = { ...store, stopList: [...store.stopList, id] };
    setStore(next);
    AdminStore.save(next);
  };

  return (
    <div>
      <h1 className="admin-h1">Стоп-лист</h1>
      <p className="admin-sub">Позиции и группы в стопе не показываются клиентам. {inStop.length} позиций + {stopCategories.length} групп.</p>

      <h2 className="admin-h2">Группы (размеры и категории)</h2>
      <p className="admin-sub" style={{ marginTop: -8 }}>Поставить в стоп целую категорию или конкретный размер пиццы.</p>
      <div className="group-stops">
        {GROUP_STOPS.map(g => {
          const on = stopCategories.includes(g.id);
          return (
            <button key={g.id} className={`group-stop ${on ? 'on' : ''}`} onClick={() => toggleGroup(g.id)}>
              <div className="group-stop-head">
                <strong>{g.label}</strong>
                <span className={`switch ${on ? 'on' : ''}`}/>
              </div>
              <small>{g.hint}</small>
              {on && <span className="group-stop-flag">В стопе</span>}
            </button>
          );
        })}
      </div>

      <h2 className="admin-h2" style={{ marginTop: 32 }}>Отдельные позиции в стопе</h2>
      {inStop.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-elev,#fff)', borderRadius: 14, border: '1px dashed var(--line)', color: 'var(--ink-mute)' }}>
          Стоп-лист пуст — все позиции доступны
        </div>
      ) : (
        <div className="cards-grid">
          {inStop.map(p => (
            <div key={p.id} className="edit-card in-stop">
              {p.img && <div className="pic"><img src={p.img} alt="" onError={(e)=>{e.currentTarget.style.display='none'}}/></div>}
              <span className="chip" style={{ alignSelf: 'flex-start' }}>{CAT_LABEL[p.cat || 'pizza']}</span>
              <h4>{p.name}</h4>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>{p.desc}</p>
              <button className="abtn abtn-primary" style={{ marginTop: 'auto' }} onClick={() => remove(p.id)}>Снять со стопа</button>
            </div>
          ))}
        </div>
      )}

      <h2 className="admin-h2" style={{ marginTop: 32 }}>Доступные позиции</h2>
      <div className="tabs-row">
        {cats.map(c => {
          const count = c.id === 'all' ? available.length : available.filter(p => (p.cat || 'pizza') === c.id).length;
          return (
            <button key={c.id} className={`tab-btn ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
              {c.label} <span className="count">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="cards-grid">
        {filterByCat(available).map(p => (
          <div key={p.id} className="edit-card">
            {p.img && <div className="pic"><img src={p.img} alt="" onError={(e)=>{e.currentTarget.style.display='none'}}/></div>}
            <span className="chip" style={{ alignSelf: 'flex-start' }}>{CAT_LABEL[p.cat || 'pizza']}</span>
            <h4>{p.name}</h4>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>{p.desc}</p>
            <button className="abtn abtn-ghost" style={{ marginTop: 'auto' }} onClick={() => add(p.id)}>Поставить в стоп</button>
          </div>
        ))}
      </div>
    </div>
  );
}

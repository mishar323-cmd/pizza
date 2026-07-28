/* eslint-disable */
// Меню — редактирование позиций; Стоп-лист
import React from 'react';
import { AdminStore } from './store/admin-store.js';
import { PIZZA_DATA, ROMAN_DATA, SANDWICH_DATA, SNACK_DATA, DRINK_DATA, DESSERT_DATA } from '../data/menu.js';

const allFromData = [
  ...(PIZZA_DATA || []).map(p => ({ ...p, cat: 'pizza' })),
  ...(ROMAN_DATA || []).map(p => ({ ...p, cat: 'roman' })),
  ...(SANDWICH_DATA || []).map(p => ({ ...p, cat: 'sandwich' })),
  ...(SNACK_DATA || []).map(p => ({ ...p, cat: 'snacks' })),
  ...(DRINK_DATA || []).map(p => ({ ...p, cat: 'drinks' })),
  ...(DESSERT_DATA || []).map(p => ({ ...p, cat: 'desserts' })),
];

export function MenuEdit({ store, setStore }) {
  const menu = store.menu || allFromData;
  const [search, setSearch] = React.useState('');
  const [cat, setCat] = React.useState('all');
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);

  const cats = [
    { id: 'all', label: 'Все' },
    { id: 'pizza', label: 'Пицца' },
    { id: 'roman', label: 'Римская' },
    { id: 'sandwich', label: 'Сэндвичи' },
    { id: 'snacks', label: 'Закуски' },
    { id: 'drinks', label: 'Напитки' },
    { id: 'desserts', label: 'Десерты' },
    ...(store.menuCategories || []),
  ];

  const addCategory = () => {
    const label = window.prompt('Название новой категории (например, «Соусы»):');
    if (!label || !label.trim()) return;
    const id = 'cat-' + Date.now().toString(36);
    const next = { ...store, menuCategories: [...(store.menuCategories || []), { id, label: label.trim() }] };
    setStore(next);
    AdminStore.save(next);
    setCat(id);
  };

  const removeCategory = (id) => {
    if (!window.confirm('Удалить категорию? Позиции в ней останутся, но без категории.')) return;
    const next = { ...store, menuCategories: (store.menuCategories || []).filter(c => c.id !== id) };
    setStore(next);
    AdminStore.save(next);
    if (cat === id) setCat('all');
  };

  const filtered = menu.filter(p => {
    if (cat !== 'all' && (p.cat || 'pizza') !== cat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const update = (id, patch) => {
    const next = { ...store, menu: menu.map(p => p.id === id ? { ...p, ...patch } : p) };
    setStore(next);
    AdminStore.save(next);
  };

  const remove = (id) => {
    if (!confirm('Удалить позицию из меню?')) return;
    const next = { ...store, menu: menu.filter(p => p.id !== id), stopList: store.stopList.filter(x => x !== id) };
    setStore(next);
    AdminStore.save(next);
  };

  const startAdd = () => {
    const c = cat === 'all' ? 'pizza' : cat;
    setDraft({
      id: 'new-' + Date.now(),
      cat: c,
      name: '',
      desc: '',
      ingredients: [],
      ...(c === 'pizza' ? { prices: { sm: 0, md: 0, lg: 0 } } : {}),
      price: 0,
      weight: 420,
      kcal: 250,
      img: '',
    });
    setEditing('new');
  };

  const startEdit = (p) => { setDraft({ ...p, ingredientsText: (p.ingredients || []).join(', '), hasSizes: !!(p.sizes && p.sizes.length) }); setEditing(p.id); };
  const closeEdit = () => { setEditing(null); setDraft(null); };
  const saveEdit = () => {
    const clean = { ...draft, ingredients: (draft.ingredientsText || '').split(',').map(s => s.trim()).filter(Boolean) };
    delete clean.ingredientsText;
    if (clean.cat === 'pizza') {
      delete clean.sizes;
    } else {
      delete clean.prices; // не-пицца не использует размеры 25/30/35
      if (clean.hasSizes) {
        clean.sizes = (clean.sizes || [])
          .map(s => ({ label: (s.label || '').trim(), price: +s.price || 0 }))
          .filter(s => s.label || s.price);
        if (clean.sizes.length) clean.price = Math.min(...clean.sizes.map(s => s.price));
      } else {
        delete clean.sizes;
      }
    }
    delete clean.hasSizes;
    if (editing === 'new') {
      const next = { ...store, menu: [...menu, clean] };
      setStore(next); AdminStore.save(next);
    } else {
      update(editing, clean);
    }
    closeEdit();
  };

  const toggleStop = (id) => {
    const inStop = store.stopList.includes(id);
    const next = { ...store, stopList: inStop ? store.stopList.filter(x => x !== id) : [...store.stopList, id] };
    setStore(next);
    AdminStore.save(next);
  };

  const isPizza = (p) => (p.cat || 'pizza') === 'pizza' || (p.cat || 'pizza') === 'roman' || p.prices;

  return (
    <div>
      <h1 className="admin-h1">Меню</h1>
      <p className="admin-sub">{menu.length} позиций во всех категориях. Кликни «Изменить» чтобы отредактировать, «В стоп» — временно скрыть.</p>

      <div className="tabs-row">
        {cats.map(c => {
          const count = c.id === 'all' ? menu.length : menu.filter(p => (p.cat || 'pizza') === c.id).length;
          return (
            <button key={c.id} className={`tab-btn ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
              {c.label} <span className="count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Найти позицию..." value={search} onChange={(e) => setSearch(e.target.value)}/>
        <span className="grow"/>
        {(store.menuCategories || []).some(c => c.id === cat) && (
          <button className="abtn abtn-danger" onClick={() => removeCategory(cat)}>Удалить категорию</button>
        )}
        <button className="abtn abtn-ghost" onClick={addCategory}>+ Категория</button>
        <button className="abtn abtn-primary" onClick={startAdd}>+ Добавить позицию</button>
      </div>

      <div className="cards-grid">
        {filtered.map(p => {
          const inStop = store.stopList.includes(p.id);
          return (
            <div key={p.id} className={`edit-card ${inStop ? 'in-stop' : ''}`}>
              {p.img && <div className="pic"><img src={p.img} alt="" onError={(e)=>{e.currentTarget.style.display='none'}}/></div>}
              <span className="chip" style={{ alignSelf: 'flex-start' }}>{(cats.find(c => c.id === (p.cat || 'pizza')) || {}).label}</span>
              <h4>{p.name}</h4>
              <p className="muted" style={{ fontSize: 12, margin: 0 }}>{p.desc}</p>
              {p.prices && (p.prices.sm || p.prices.md || p.prices.lg) ? (
                <div className="prices">
                  <span><b>{p.prices?.sm || 0}</b> ₽ <span className="muted">25см</span></span>
                  <span><b>{p.prices?.md || 0}</b> ₽ <span className="muted">30см</span></span>
                  <span><b>{p.prices?.lg || 0}</b> ₽ <span className="muted">35см</span></span>
                </div>
              ) : (p.sizes && p.sizes.length) ? (
                <div className="prices"><span>от <b>{Math.min(...p.sizes.map(s => Number(s.price) || 0))}</b> ₽ <span className="muted">{p.sizes.length} разм.</span></span></div>
              ) : (
                <div className="prices"><span><b>{p.price || 0}</b> ₽</span></div>
              )}
              <div className="row-spread" style={{ marginTop: 'auto' }}>
                <button className="abtn abtn-ghost" onClick={() => startEdit(p)}>Изменить</button>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className={`abtn ${inStop ? 'abtn-primary' : 'abtn-ghost'}`} onClick={() => toggleStop(p.id)}>
                    {inStop ? 'В стопе' : 'В стоп'}
                  </button>
                  <button className="abtn abtn-danger" onClick={() => remove(p.id)} title="Удалить">×</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && draft && (
        <div className="amodal-overlay" onClick={closeEdit}>
          <div className="amodal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing === 'new' ? 'Новая позиция' : 'Редактировать позицию'}</h3>
            <div className="field">
              <label>Категория</label>
              <select value={draft.cat || 'pizza'} onChange={(e) => setDraft({ ...draft, cat: e.target.value })}>
                {cats.slice(1).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Название</label>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/>
            </div>
            <div className="field">
              <label>Описание</label>
              <textarea rows="2" value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })}/>
            </div>
            {draft.cat === 'pizza' ? (
              <>
                <div className="field">
                  <label>Ингредиенты (через запятую)</label>
                  <input value={draft.ingredientsText || ''} onChange={(e) => setDraft({ ...draft, ingredientsText: e.target.value })}/>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  <div className="field">
                    <label>Цена 25 см</label>
                    <input type="number" value={(draft.prices && draft.prices.sm) || 0} onChange={(e) => setDraft({ ...draft, prices: { ...(draft.prices || {}), sm: +e.target.value } })}/>
                  </div>
                  <div className="field">
                    <label>Цена 30 см</label>
                    <input type="number" value={(draft.prices && draft.prices.md) || 0} onChange={(e) => setDraft({ ...draft, prices: { ...(draft.prices || {}), md: +e.target.value } })}/>
                  </div>
                  <div className="field">
                    <label>Цена 35 см</label>
                    <input type="number" value={(draft.prices && draft.prices.lg) || 0} onChange={(e) => setDraft({ ...draft, prices: { ...(draft.prices || {}), lg: +e.target.value } })}/>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Вес, г</label>
                    <input type="number" value={draft.weight || 0} onChange={(e) => setDraft({ ...draft, weight: +e.target.value })}/>
                  </div>
                  <div className="field">
                    <label>Калории</label>
                    <input type="number" value={draft.kcal || 0} onChange={(e) => setDraft({ ...draft, kcal: +e.target.value })}/>
                  </div>
                </div>
              </>
            ) : (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, margin: '4px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!draft.hasSizes} onChange={(e) => {
                    const on = e.target.checked;
                    setDraft({ ...draft, hasSizes: on, sizes: on ? (draft.sizes && draft.sizes.length ? draft.sizes : [{ label: '', price: draft.price || 0 }]) : undefined });
                  }}/>
                  Несколько размеров (напр. «6 шт / 12 шт»)
                </label>
                {draft.hasSizes ? (
                  <div className="field">
                    <label>Размеры и цены</label>
                    {(draft.sizes || []).map((s, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 40px', gap: 8, marginBottom: 8 }}>
                        <input placeholder="Название (6 шт)" value={s.label || ''} onChange={(e) => { const sizes = [...draft.sizes]; sizes[i] = { ...sizes[i], label: e.target.value }; setDraft({ ...draft, sizes }); }}/>
                        <input type="number" placeholder="₽" value={s.price || 0} onChange={(e) => { const sizes = [...draft.sizes]; sizes[i] = { ...sizes[i], price: +e.target.value }; setDraft({ ...draft, sizes }); }}/>
                        <button type="button" className="abtn abtn-danger" title="Удалить размер" onClick={() => setDraft({ ...draft, sizes: draft.sizes.filter((_, j) => j !== i) })}>×</button>
                      </div>
                    ))}
                    <button type="button" className="abtn abtn-ghost" onClick={() => setDraft({ ...draft, sizes: [...(draft.sizes || []), { label: '', price: 0 }] })}>+ Размер</button>
                  </div>
                ) : (
                  <div className="field">
                    <label>Цена, ₽</label>
                    <input type="number" value={draft.price || 0} onChange={(e) => setDraft({ ...draft, price: +e.target.value })}/>
                  </div>
                )}
              </>
            )}
            <div className="field">
              <label>Картинка</label>
              {draft.img && (
                <img src={draft.img} alt="" style={{ maxHeight: 90, maxWidth: '100%', borderRadius: 8, display: 'block', marginBottom: 8, objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }}/>
              )}
              <input type="file" accept="image/*" disabled={uploading} onChange={async (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                setUploading(true);
                try {
                  const { url } = await AdminStore.uploadImage(f);
                  setDraft(d => ({ ...d, img: url }));
                } catch (err) {
                  alert(err.message || 'Не удалось загрузить файл');
                } finally {
                  setUploading(false);
                  e.target.value = '';
                }
              }}/>
              {uploading && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Загрузка…</div>}
              <input value={draft.img || ''} onChange={(e) => setDraft({ ...draft, img: e.target.value })} placeholder="или вставь ссылку https://..." style={{ marginTop: 8 }}/>
            </div>
            <div className="amodal-actions">
              <button className="abtn abtn-ghost" onClick={closeEdit}>Отмена</button>
              <button className="abtn abtn-primary" onClick={saveEdit} disabled={!draft.name}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

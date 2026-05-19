/* eslint-disable */
// Время готовки + Акции
import React from 'react';
import { AdminStore } from './store/admin-store.js';

export function CookTime({ store, setStore }) {
  const [val, setVal] = React.useState(store.cookTimeMinutes);
  React.useEffect(() => setVal(store.cookTimeMinutes), [store.cookTimeMinutes]);

  const save = (n) => {
    const v = Math.max(10, Math.min(120, Math.round(n) || 35));
    setVal(v);
    const next = { ...store, cookTimeMinutes: v };
    setStore(next);
    AdminStore.save(next);
  };

  return (
    <div>
      <h1 className="admin-h1">Время готовки</h1>
      <p className="admin-sub">Это значение показывается в hero на главной странице и в карточке статуса кухни.</p>

      <div className="cook-time-card">
        <div>
          <div className="cook-time-big">{val}<span className="unit">мин</span></div>
          <div className="cook-stepper">
            <button onClick={() => save(val - 5)} aria-label="Минус 5">−</button>
            <input type="number" value={val} onChange={(e) => save(+e.target.value)} min="10" max="120"/>
            <button onClick={() => save(val + 5)} aria-label="Плюс 5">+</button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>Шаг 5 минут. Минимум 10, максимум 120. Сохраняется автоматически.</p>
        </div>

        <div className="cook-preview">
          <small>Как видит клиент на сайте</small>
          <div className="live">
            <span className="pulse"/>
            Кухня готовит прямо сейчас · везём за {val} мин
          </div>
          <small style={{ marginTop: 12 }}>Также в FAQ</small>
          <div style={{ background: 'var(--bg-elev,#fff)', padding: '12px 16px', borderRadius: 10, fontSize: 13, color: 'var(--ink-soft)' }}>
            Сроки зависят от вашего адреса — от {Math.max(10, val - 5)} до {Math.min(120, val + 25)} минут, и горячая пицца у вас.
          </div>
        </div>
      </div>
    </div>
  );
}

export function Promos({ store, setStore }) {
  const [editing, setEditing] = React.useState(null);
  const [draft, setDraft] = React.useState(null);

  const update = (id, patch) => {
    const next = { ...store, promos: store.promos.map(p => p.id === id ? { ...p, ...patch } : p) };
    setStore(next);
    AdminStore.save(next);
  };

  const remove = (id) => {
    if (!confirm('Удалить акцию?')) return;
    const next = { ...store, promos: store.promos.filter(p => p.id !== id) };
    setStore(next);
    AdminStore.save(next);
  };

  const startAdd = () => {
    setDraft({ id: 'p' + Date.now(), enabled: true, kind: 'accent', tag: '', title: '', body: '', cta: 'Подробнее' });
    setEditing('new');
  };
  const startEdit = (p) => { setDraft({ ...p }); setEditing(p.id); };
  const closeEdit = () => { setEditing(null); setDraft(null); };
  const saveEdit = () => {
    if (editing === 'new') {
      const next = { ...store, promos: [...store.promos, draft] };
      setStore(next); AdminStore.save(next);
    } else {
      update(editing, draft);
    }
    closeEdit();
  };

  return (
    <div>
      <h1 className="admin-h1">Акции</h1>
      <p className="admin-sub">До 3 промо-блоков. Отображаются в секции «Акции» на сайте. {store.promos.length}/3</p>

      <div className="promos-grid">
        {store.promos.map(p => (
          <div key={p.id} className={`promo-edit ${p.enabled ? '' : 'disabled'}`}>
            <h5>
              <span>{ {big: 'Главная', accent: 'Акцентная', dark: 'Тёмная'}[p.kind] || p.kind }</span>
              <span className={`switch ${p.enabled ? 'on' : ''}`} onClick={() => update(p.id, { enabled: !p.enabled })} role="switch" aria-checked={p.enabled}/>
            </h5>
            <div className="preview">
              <span className="tag">{p.tag}</span>
              <strong>{p.title}</strong>
              <p>{p.body}</p>
            </div>
            <div className="row-spread" style={{ marginTop: 'auto' }}>
              <button className="abtn abtn-ghost" onClick={() => startEdit(p)}>Изменить</button>
              <button className="abtn abtn-danger" onClick={() => remove(p.id)}>Удалить</button>
            </div>
          </div>
        ))}
        {store.promos.length < 3 && (
          <button className="add-promo-btn" onClick={startAdd}>
            + Добавить акцию
          </button>
        )}
      </div>

      {editing && draft && (
        <div className="amodal-overlay" onClick={closeEdit}>
          <div className="amodal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing === 'new' ? 'Новая акция' : 'Редактировать акцию'}</h3>
            <div className="field">
              <label>Тип карточки</label>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                <option value="big">Главная (большая, градиент)</option>
                <option value="accent">Акцентная (жёлтая)</option>
                <option value="dark">Тёмная</option>
              </select>
            </div>
            <div className="field">
              <label>Метка (короткая)</label>
              <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} placeholder="−15%, главная акция…"/>
            </div>
            <div className="field">
              <label>Заголовок</label>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="2 пиццы 30 см = 1 290 ₽"/>
            </div>
            <div className="field">
              <label>Описание</label>
              <textarea rows="3" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Условия акции…"/>
            </div>
            <div className="field">
              <label>Текст кнопки</label>
              <input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })}/>
            </div>
            <div className="amodal-actions">
              <button className="abtn abtn-ghost" onClick={closeEdit}>Отмена</button>
              <button className="abtn abtn-primary" onClick={saveEdit} disabled={!draft.title || !draft.tag}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

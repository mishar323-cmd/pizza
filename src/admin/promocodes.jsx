/* eslint-disable */
// Промокоды — управление для всех админов. CRUD над promo_codes:
// создание, редактирование (скидка ₽/%, срок действия, мин. сумма), удаление.
import React from 'react';
import { AdminStore } from './store/admin-store.js';

const box = { background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: 20, marginBottom: 18 };
const inp = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
const label = { display: 'block', fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: '#555' };

const EMPTY = { id: null, code: '', description: '', discountType: 'fixed', discountValue: 0, minOrder: 0, expiresAt: '', active: true };

const isoToDate = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
const dateToIso = (s) => { if (!s) return null; const d = new Date(s + 'T23:59:59'); return isNaN(d) ? null : d.toISOString(); };
const fmtDiscount = (p) => p.discountType === 'percent' ? `${p.discountValue}%` : `${p.discountValue} ₽`;
const fmtExpiry = (iso) => { if (!iso) return 'бессрочно'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('ru-RU'); };
const isExpired = (iso) => iso && new Date(iso) < new Date();

export function PromoCodesPage() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(null); // null = closed; object = create/edit

  const load = async () => {
    setLoading(true); setErr('');
    try { setItems((await AdminStore.listPromos()) || []); }
    catch (e) { setErr(e.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  };
  React.useEffect(() => { load(); }, []);

  const openNew = () => { setOk(''); setErr(''); setForm({ ...EMPTY }); };
  const openEdit = (p) => { setOk(''); setErr(''); setForm({ ...p, expiresAt: isoToDate(p.expiresAt) }); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(''); setBusy(true);
    const payload = {
      code: form.code, description: form.description || '',
      discountType: form.discountType, discountValue: Number(form.discountValue),
      minOrder: Number(form.minOrder) || 0, expiresAt: dateToIso(form.expiresAt),
      active: !!form.active, perPhoneLimit: 0, maxUses: null, startsAt: null, source: 'admin',
    };
    try {
      if (form.id) { await AdminStore.updatePromo(form.id, payload); setOk('Промокод обновлён.'); }
      else { await AdminStore.createPromo(payload); setOk('Промокод создан.'); }
      setForm(null);
      await load();
    } catch (e) { setErr(e.message || 'Не удалось сохранить'); }
    finally { setBusy(false); }
  };

  const del = async (p) => {
    if (!window.confirm(`Удалить промокод «${p.code}»?`)) return;
    setErr(''); setOk('');
    try { await AdminStore.deletePromo(p.id); await load(); }
    catch (e) { setErr(e.message || 'Не удалось удалить'); }
  };

  const toggleActive = async (p) => {
    try {
      await AdminStore.updatePromo(p.id, { ...p, expiresAt: p.expiresAt || null, active: !p.active, source: p.source || 'admin' });
      await load();
    } catch (e) { setErr(e.message || 'Не удалось изменить'); }
  };

  return (
    <div style={{ maxWidth: 820, padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 24, margin: 0 }}>Промокоды</h1>
        <button onClick={openNew} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#DC2828', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>+ Промокод</button>
      </div>
      <p style={{ color: '#888', margin: '0 0 20px', fontSize: 14 }}>Скидка в рублях или процентах, срок действия, минимальная сумма заказа.</p>

      {err && <div style={{ ...box, borderColor: '#f3b4b4', background: '#fdf1f1', color: '#b42318' }}>{err}</div>}
      {ok && <div style={{ ...box, borderColor: '#b7e0c0', background: '#f0faf3', color: '#1a7f37' }}>{ok}</div>}

      <div style={box}>
        {loading ? <div style={{ color: '#888' }}>Загрузка…</div> : items.length === 0 ? (
          <div style={{ color: '#888' }}>Пока нет промокодов. Нажмите «+ Промокод».</div>
        ) : items.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid #f2f2f2', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontFamily: 'Unbounded, sans-serif', letterSpacing: 0.5 }}>{p.code}</strong>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#fde8e8', color: '#b42318' }}>−{fmtDiscount(p)}</span>
                {!p.active && <span style={{ fontSize: 12, color: '#999', padding: '3px 9px', borderRadius: 20, background: '#f0f0f0' }}>выключен</span>}
                {isExpired(p.expiresAt) && <span style={{ fontSize: 12, color: '#b42318', padding: '3px 9px', borderRadius: 20, background: '#fdf1f1' }}>истёк</span>}
              </div>
              <div style={{ color: '#999', fontSize: 12.5, marginTop: 3 }}>
                {p.description ? p.description + ' · ' : ''}от {p.minOrder || 0} ₽ · до {fmtExpiry(p.expiresAt)} · использован {p.usedCount || 0}×
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#666', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!p.active} onChange={() => toggleActive(p)} /> активен
            </label>
            <button onClick={() => openEdit(p)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Изменить</button>
            <button onClick={() => del(p)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #f0c8c8', background: '#fff', color: '#b42318', cursor: 'pointer', fontSize: 13 }}>Удалить</button>
          </div>
        ))}
      </div>

      {form && (
        <div onClick={() => !busy && setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'grid', placeItems: 'center', padding: 16 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ ...box, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', marginBottom: 0 }}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'Unbounded, sans-serif', fontSize: 18 }}>{form.id ? 'Редактировать промокод' : 'Новый промокод'}</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={label}>Код</label>
                <input style={{ ...inp, textTransform: 'uppercase', opacity: form.id ? 0.6 : 1 }} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="LETO2026" disabled={!!form.id} required />
                {form.id && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Код нельзя изменить у существующего промокода.</div>}
              </div>
              <div>
                <label style={label}>Описание (необязательно)</label>
                <input style={inp} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Летняя акция" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Тип скидки</label>
                  <select style={inp} value={form.discountType} onChange={(e) => set('discountType', e.target.value)}>
                    <option value="fixed">Рубли (₽)</option>
                    <option value="percent">Проценты (%)</option>
                  </select>
                </div>
                <div>
                  <label style={label}>Размер скидки</label>
                  <input style={inp} type="number" min="1" step="1" value={form.discountValue} onChange={(e) => set('discountValue', e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Мин. сумма заказа, ₽</label>
                  <input style={inp} type="number" min="0" step="1" value={form.minOrder} onChange={(e) => set('minOrder', e.target.value)} />
                </div>
                <div>
                  <label style={label}>Действует до</label>
                  <input style={inp} type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#444', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.active} onChange={(e) => set('active', e.target.checked)} /> Активен
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setForm(null)} disabled={busy} style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Отмена</button>
                <button type="submit" disabled={busy} style={{ padding: '11px 20px', borderRadius: 10, border: 'none', background: '#DC2828', color: '#fff', fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

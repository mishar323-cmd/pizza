/* eslint-disable */
// Журнал действий админов + колокольчик уведомлений. Только для владельца
// (role=super). Бэкенд тоже проверяет роль на GET /api/admin/audit.
import React from 'react';
import { AdminStore } from './store/admin-store.js';

const LAST_SEEN_KEY = 'dvp_audit_lastseen_v1';
const getLastSeen = () => { try { return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0; } catch { return 0; } };
const setLastSeen = (id) => { try { localStorage.setItem(LAST_SEEN_KEY, String(id)); } catch {} };

const STATUS = { new: 'Новый', cooking: 'Готовится', on_way: 'В пути', delivered: 'Доставлен', cancelled: 'Отменён' };

export function describeAction(e) {
  const d = e.details || {};
  switch (e.action) {
    case 'login': return 'вошёл в админку';
    case 'order.status': return `статус ${e.target} → ${STATUS[d.status] || d.status || '—'}`;
    case 'admin.create': return `создал ${e.target}${d.role === 'super' ? ' (владелец)' : ''}`;
    case 'admin.delete': return `удалил ${e.target}`;
    default:
      if (e.action.startsWith('settings.')) return `изменил: ${e.target}`;
      return `${e.action} ${e.target}`.trim();
  }
}

export function fmtTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  const sameDay = d.toDateString() === now.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `сегодня ${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mo} ${hh}:${mm}`;
}

const openInNewTab = () => window.open(location.pathname + '#audit', '_blank', 'noopener');

function Avatar({ name, action }) {
  const danger = action === 'admin.delete';
  const bg = danger ? '#fde8e8' : action === 'admin.create' ? '#e8f3ff' : '#f0f0f0';
  const fg = danger ? '#b42318' : action === 'admin.create' ? '#1e5eb8' : '#666';
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: bg, color: fg, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 14 }}>
      {(name || '?')[0]?.toUpperCase()}
    </div>
  );
}

// ── Notifications bell (lives in the admin shell) ─────────────────────────
export function NotificationsBell({ onOpenJournal }) {
  const [items, setItems] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const [lastSeen, setSeen] = React.useState(getLastSeen());

  const load = React.useCallback(async () => {
    try { setItems((await AdminStore.listAudit(30)) || []); } catch {}
  }, []);
  React.useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((e) => e.id > lastSeen).length;
  const markSeen = () => { const max = items.length ? items[0].id : lastSeen; setLastSeen(max); setSeen(max); };
  const toggle = () => { setOpen((o) => { if (!o) markSeen(); return !o; }); };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={toggle} title="Уведомления" style={{
        position: 'relative', width: 40, height: 40, borderRadius: 10, border: '1px solid #e6e6e6',
        background: '#fff', cursor: 'pointer', fontSize: 18,
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 10, background: '#DC2828', color: '#fff', fontSize: 11, fontWeight: 700,
            display: 'grid', placeItems: 'center', boxSizing: 'border-box',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', right: 0, top: 48, width: 340, maxWidth: '90vw', zIndex: 41,
            background: '#fff', border: '1px solid #eee', borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)', overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f2f2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 14 }}>Действия админов</strong>
              <button onClick={openInNewTab} title="Открыть в новой вкладке" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: 16 }}>↗</button>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {items.length === 0 && <div style={{ padding: 20, color: '#999', fontSize: 14 }}>Пока пусто.</div>}
              {items.slice(0, 20).map((e) => (
                <div key={e.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f6f6f6', background: e.id > lastSeen ? '#fffaf0' : '#fff' }}>
                  <Avatar name={e.adminName || e.adminLogin} action={e.action} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5 }}><strong>{e.adminName || e.adminLogin}</strong> {describeAction(e)}</div>
                    <div style={{ color: '#aaa', fontSize: 12 }}>{fmtTime(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setOpen(false); onOpenJournal && onOpenJournal(); }} style={{
              width: '100%', padding: '12px', border: 'none', borderTop: '1px solid #f2f2f2',
              background: '#fafafa', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#DC2828',
            }}>Открыть весь журнал</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Full journal page ─────────────────────────────────────────────────────
export function AuditPage() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');

  const load = React.useCallback(async () => {
    try { setItems((await AdminStore.listAudit(200)) || []); setErr(''); }
    catch (e) { setErr(e.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);
  React.useEffect(() => { if (items.length) { setLastSeen(items[0].id); } }, [items.length]);

  return (
    <div style={{ maxWidth: 820, padding: '8px 4px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 24, margin: 0 }}>Журнал действий</h1>
        <button onClick={openInNewTab} style={{
          padding: '9px 14px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fff',
          cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
        }}>Открыть в новой вкладке ↗</button>
      </div>
      <p style={{ color: '#888', margin: '0 0 20px', fontSize: 14 }}>Все действия админов. Обновляется автоматически.</p>

      {err && <div style={{ padding: 16, borderRadius: 12, background: '#fdf1f1', color: '#b42318', marginBottom: 16 }}>{err}</div>}

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20, color: '#888' }}>Загрузка…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 20, color: '#888' }}>Пока нет записей.</div>
        ) : (
          items.map((e) => (
            <div key={e.id} style={{ display: 'flex', gap: 12, padding: '13px 16px', borderBottom: '1px solid #f4f4f4', alignItems: 'center' }}>
              <Avatar name={e.adminName || e.adminLogin} action={e.action} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}><strong>{e.adminName || e.adminLogin}</strong> {describeAction(e)}</div>
                <div style={{ color: '#aaa', fontSize: 12 }}>@{e.adminLogin}{e.ip ? ' · ' + e.ip : ''}</div>
              </div>
              <div style={{ color: '#999', fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtTime(e.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

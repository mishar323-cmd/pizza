/* eslint-disable */
// Управление админами — доступно только владельцу (role=super). Бэкенд тоже
// проверяет роль, UI лишь прячет экран у обычных админов.
import React from 'react';
import { AdminStore } from './store/admin-store.js';

function genPassword(len = 12) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  try {
    const arr = new Uint32Array(len);
    window.crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
  } catch {
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

const box = {
  background: '#fff', border: '1px solid #eee', borderRadius: 14,
  padding: 20, marginBottom: 18,
};
const inp = {
  width: '100%', padding: '11px 13px', borderRadius: 10,
  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box',
};
const label = { display: 'block', fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: '#555' };

export function AdminsPage({ session }) {
  const [admins, setAdmins] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', login: '', password: '', role: 'admin' });

  const load = async () => {
    setLoading(true); setErr('');
    try { setAdmins((await AdminStore.listAdmins()) || []); }
    catch (e) { setErr(e.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  };
  React.useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk(''); setBusy(true);
    try {
      const a = await AdminStore.createAdmin(form);
      setOk(`Создан «${a.name}» · логин: ${a.login} · пароль: ${form.password} — сохрани и передай, пароль больше не показывается.`);
      setForm({ name: '', login: '', password: '', role: 'admin' });
      await load();
    } catch (e) { setErr(e.message || 'Не удалось создать'); }
    finally { setBusy(false); }
  };

  const del = async (a) => {
    if (!window.confirm(`Удалить админа «${a.name}» (${a.login})?`)) return;
    setErr(''); setOk('');
    try { await AdminStore.deleteAdmin(a.id); await load(); }
    catch (e) { setErr(e.message || 'Не удалось удалить'); }
  };

  const roleLabel = (r) => (r === 'super' ? 'Владелец' : 'Админ');

  return (
    <div style={{ maxWidth: 720, padding: '8px 4px 40px' }}>
      <h1 style={{ fontFamily: 'Unbounded, sans-serif', fontSize: 24, margin: '0 0 6px' }}>Админы</h1>
      <p style={{ color: '#888', margin: '0 0 20px', fontSize: 14 }}>
        Управление доступом в админку. Владелец может добавлять и удалять админов.
      </p>

      {err && <div style={{ ...box, borderColor: '#f3b4b4', background: '#fdf1f1', color: '#b42318' }}>{err}</div>}
      {ok && <div style={{ ...box, borderColor: '#b7e0c0', background: '#f0faf3', color: '#1a7f37' }}>{ok}</div>}

      <div style={box}>
        {loading ? (
          <div style={{ color: '#888' }}>Загрузка…</div>
        ) : (
          <div>
            {admins.map((a) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid #f2f2f2',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: a.role === 'super' ? '#DC2828' : '#e9e9e9',
                  color: a.role === 'super' ? '#fff' : '#555',
                  display: 'grid', placeItems: 'center', fontWeight: 700,
                }}>{(a.name || a.login)[0]?.toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{a.name}</strong>
                  <div style={{ color: '#999', fontSize: 13 }}>@{a.login}</div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                  background: a.role === 'super' ? '#fde8e8' : '#f0f0f0',
                  color: a.role === 'super' ? '#b42318' : '#666',
                }}>{roleLabel(a.role)}</span>
                {a.id === session.adminId ? (
                  <span style={{ color: '#bbb', fontSize: 13, width: 84, textAlign: 'right' }}>это вы</span>
                ) : (
                  <button onClick={() => del(a)} style={{
                    width: 84, padding: '7px 0', borderRadius: 8, border: '1px solid #f0c8c8',
                    background: '#fff', color: '#b42318', cursor: 'pointer', fontSize: 13,
                  }}>Удалить</button>
                )}
              </div>
            ))}
            {admins.length === 0 && <div style={{ color: '#888' }}>Пока нет админов.</div>}
          </div>
        )}
      </div>

      <form onSubmit={submit} style={box}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'Unbounded, sans-serif', fontSize: 17 }}>Добавить админа</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={label}>Имя</label>
            <input style={inp} value={form.name} onChange={set('name')} placeholder="Семён" required />
          </div>
          <div>
            <label style={label}>Логин</label>
            <input style={inp} value={form.login} onChange={set('login')} placeholder="semyon" autoCapitalize="none" required />
          </div>
          <div>
            <label style={label}>Пароль (мин. 8 символов)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={inp} value={form.password} onChange={set('password')} placeholder="пароль" minLength={8} required />
              <button type="button" onClick={() => setForm((f) => ({ ...f, password: genPassword() }))} style={{
                whiteSpace: 'nowrap', padding: '0 14px', borderRadius: 10,
                border: '1px solid #ddd', background: '#fafafa', cursor: 'pointer', fontSize: 13,
              }}>Сгенерировать</button>
            </div>
          </div>
          <div>
            <label style={label}>Роль</label>
            <select style={inp} value={form.role} onChange={set('role')}>
              <option value="admin">Админ</option>
              <option value="super">Владелец (может управлять админами)</option>
            </select>
          </div>
          <button type="submit" disabled={busy} style={{
            padding: '12px 20px', borderRadius: 10, border: 'none',
            background: '#DC2828', color: '#fff', fontWeight: 600, fontSize: 15,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, justifySelf: 'start',
          }}>{busy ? 'Создаём…' : 'Создать админа'}</button>
        </div>
      </form>
    </div>
  );
}

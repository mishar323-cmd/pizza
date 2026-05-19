/* eslint-disable */
import React from 'react';
import { AdminStore } from './store/admin-store.js';

export function LoginScreen({ onLogin }) {
  const [login, setLogin] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await AdminStore.login(login.trim(), password);
      onLogin(session);
    } catch (err) {
      setError(err.message === 'invalid credentials' ? 'Неверный логин или пароль' : (err.message || 'Ошибка входа'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo"/>
        <h1>Дело в пицце</h1>
        <p>Админ-панель</p>
        {error && <div className="login-error">{error}</div>}
        <div className="field">
          <label>Логин</label>
          <input
            type="text"
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="admin"
            autoFocus
            disabled={busy}
          />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="•••••••"
            disabled={busy}
          />
        </div>
        <button type="submit" className="abtn abtn-primary login-btn" disabled={busy}>
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

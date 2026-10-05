/* eslint-disable */
import React from 'react';
import Ic from '../../shared/icons.jsx';
import { formatPhone } from './useAuth.js';

function useCountdown() {
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

export function LoginModal({ open, onClose, auth, localAddresses, onLoggedIn }) {
  const [step, setStep] = React.useState('phone');
  const [phone, setPhone] = React.useState('');
  const [agree, setAgree] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [channel, setChannel] = React.useState('sms');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resendLeft, setResendLeft] = useCountdown();
  const codeRef = React.useRef(null);
  const [tg, setTg] = React.useState(null);       // {link, nonce} — вход через бота
  const [tgState, setTgState] = React.useState('idle'); // idle | opened | error
  const [tgAvailable, setTgAvailable] = React.useState(true);
  const [phoneAvailable, setPhoneAvailable] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStep('phone'); setCode(''); setError(''); setBusy(false); setTgState('idle'); setTg(null);
    let alive = true;
    auth.authMethods()
      .then(m => { if (alive) setPhoneAvailable(!!m.phone); })
      .catch(() => {});
    auth.tgStart()
      .then(r => { if (alive) { setTg(r); setTgAvailable(true); } })
      .catch(() => { if (alive) setTgAvailable(false); });
    return () => { alive = false; };
  }, [open]);

  // Пока клиент подтверждает номер в боте, сайт ждёт готовности входа.
  React.useEffect(() => {
    if (!open || !tg?.nonce || tgState !== 'opened') return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const r = await auth.tgStatus(tg.nonce);
        if (!alive) return;
        if (r.status === 'ready') {
          clearInterval(timer);
          await auth.finishWithToken(r.token, localAddresses);
          onLoggedIn?.({ isNew: false });
          onClose();
        } else if (r.status === 'expired' || r.status === 'used') {
          clearInterval(timer);
          setTgState('error');
          setError('Ссылка для входа устарела. Нажмите «Войти через Telegram» ещё раз.');
        }
      } catch {}
    }, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [open, tg, tgState]);

  React.useEffect(() => {
    if (step === 'code') setTimeout(() => codeRef.current?.focus(), 50);
  }, [step]);

  if (!open) return null;

  const digits = phone.replace(/\D/g, '');
  const phoneOk = /^[78]?9\d{9}$/.test(digits);

  const send = async () => {
    if (!phoneOk || !agree || busy) return;
    setBusy(true); setError('');
    try {
      const r = await auth.requestCode(phone);
      setChannel(r.channel);
      setResendLeft(r.resendAfter || 60);
      setCode('');
      setStep('code');
    } catch (e) {
      setError(e.message);
      if (e.data?.resendAfter) { setResendLeft(e.data.resendAfter); setStep('code'); }
    } finally {
      setBusy(false);
    }
  };

  const check = async (value) => {
    if (value.length !== 4 || busy) return;
    setBusy(true); setError('');
    try {
      const r = await auth.verify(phone, value, localAddresses);
      onLoggedIn?.(r);
      onClose();
    } catch (e) {
      setError(e.message + (e.data?.attemptsLeft ? ` · осталось попыток: ${e.data.attemptsLeft}` : ''));
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onCode = (v) => {
    const c = v.replace(/\D/g, '').slice(0, 4);
    setCode(c);
    if (c.length === 4) check(c);
  };

  return (
    <>
      <div className="drawer-overlay open" onClick={onClose}/>
      <aside className="profile-modal open" role="dialog" aria-label="Вход">
        <div className="profile-head">
          <h3>Вход</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть"><Ic name="close" size={18}/></button>
        </div>
        <div className="profile-body">
          {step === 'phone' ? (
            <form className="login-form" onSubmit={e => { e.preventDefault(); send(); }}>
              <p className="login-lead">Войдите, чтобы сохранять адреса и историю заказов, а каждая 8-я пицца была бесплатной.</p>

              {tgAvailable && (
                <>
                  <label className="login-consent">
                    <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)}/>
                    <span>Даю <a href="/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a></span>
                  </label>
                  <a
                    className={`btn btn-primary login-submit login-tg ${(!agree || !tg) ? 'disabled' : ''}`}
                    href={tg?.link || '#'}
                    target="_blank"
                    rel="noopener"
                    onClick={e => { if (!agree || !tg) { e.preventDefault(); return; } setTgState('opened'); setError(''); }}
                  >
                    Войти через Telegram
                  </a>
                  {tgState === 'opened' && <p className="login-note">Откройте бота и нажмите «Поделиться номером». Эта страница сама продолжит вход.</p>}
                  {!agree && <p className="login-note">Сначала отметьте согласие.</p>}
                  <p className="login-note">Номер подтверждает Telegram — вводить его и ждать код не нужно.</p>
                  {phoneAvailable && <div className="login-or"><span>или по номеру телефона</span></div>}
                </>
              )}
              {phoneAvailable && <>
              <label className="login-label" htmlFor="login-phone">Номер телефона</label>
              <input id="login-phone" className="co-input login-phone" type="tel" inputMode="tel" autoComplete="tel"
                placeholder="+7 9XX XXX-XX-XX" value={phone} autoFocus
                onChange={e => { setPhone(e.target.value); setError(''); }}/>
              {error && <div className="login-error">{error}</div>}
              <button type="submit" className="btn btn-primary login-submit" disabled={!phoneOk || !agree || busy}>
                {busy ? 'Отправляем…' : 'Получить код'}
              </button>
              </>}
              <p className="login-note">Вход не обязателен — заказать можно и без него.</p>
            </form>
          ) : (
            <div className="login-form">
              <p className="login-lead">
                {channel === 'call'
                  ? <>Сейчас на <b>{formatPhone(phone)}</b> поступит звонок. Отвечать не нужно — введите <b>последние 4 цифры</b> номера, с которого звонят.</>
                  : channel === 'telegram'
                    ? <>Код отправлен в <b>Telegram</b> на номер <b>{formatPhone(phone)}</b> — проверьте чат с Telegram.</>
                    : <>Отправили SMS с кодом на <b>{formatPhone(phone)}</b>.</>}
              </p>
              <label className="login-label" htmlFor="login-code">{channel === 'call' ? 'Последние 4 цифры номера' : channel === 'telegram' ? 'Код из Telegram' : 'Код из SMS'}</label>
              <input id="login-code" ref={codeRef} className="co-input login-code" inputMode="numeric" autoComplete="one-time-code"
                maxLength={4} placeholder="• • • •" value={code} onChange={e => onCode(e.target.value)} disabled={busy}/>
              {error && <div className="login-error">{error}</div>}
              <div className="login-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('phone'); setError(''); }}>Изменить номер</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={resendLeft > 0 || busy} onClick={send}>
                  {resendLeft > 0 ? `Отправить снова через ${resendLeft} с` : 'Отправить код снова'}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

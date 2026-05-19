/* eslint-disable */
// Night overlay — пиццерия спит с 23:00 до 10:00 МСК
import React from 'react';

export function NightOverlay({ force = false }) {
  const [dismissed, setDismissed] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const [mskTime, setMskTime] = React.useState('');

  React.useEffect(() => {
    const check = () => {
      const now = new Date();
      // МСК = UTC+3 (без перехода на летнее время)
      const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
      const mskMin = (utcMin + 3 * 60) % (24 * 60);
      const mskHour = Math.floor(mskMin / 60);
      const mskM = mskMin % 60;
      setMskTime(`${String(mskHour).padStart(2, '0')}:${String(mskM).padStart(2, '0')}`);
      // Активно с 23:00 до 10:00 МСК
      setActive(mskHour >= 23 || mskHour < 10);
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const visible = (active || force) && !dismissed;

  React.useEffect(() => {
    document.body.classList.toggle('site-night-blur', visible);
    return () => document.body.classList.remove('site-night-blur');
  }, [visible]);

  if (!visible) return null;

  const handlePreorder = () => {
    setDismissed(true);
    setTimeout(() => {
      document.querySelector('#menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  return (
    <div className="night-overlay" role="dialog" aria-label="Пиццерия отдыхает">
      <div className="night-modal" onClick={(e) => e.stopPropagation()}>
        <div className="night-stars" aria-hidden="true">
          <span/><span/><span/><span/><span/><span/>
        </div>
        <div className="night-moon" aria-hidden="true">
          <svg width="84" height="84" viewBox="0 0 84 84" fill="none">
            <defs>
              <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff7d6" stopOpacity="0.55"/>
                <stop offset="100%" stopColor="#fff7d6" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="42" cy="42" r="42" fill="url(#moonGlow)"/>
            <path d="M52 18a26 26 0 1 0 14 32 22 22 0 0 1-14-32z" fill="#fff3c2" stroke="#f0d97a" strokeWidth="1.2"/>
            <circle cx="36" cy="44" r="2.6" fill="#e6c45e" opacity="0.55"/>
            <circle cx="44" cy="36" r="1.4" fill="#e6c45e" opacity="0.45"/>
            <circle cx="48" cy="52" r="2" fill="#e6c45e" opacity="0.5"/>
          </svg>
        </div>
        <h3>Повара пошли спать</h3>
        <p>...чтобы завтра пицца была ещё вкуснее. Вы можете оформить предзаказ на завтра, а мы обработаем его сразу в начале смены.</p>
        <button className="btn btn-primary btn-lg night-cta" onClick={handlePreorder}>
          Оформить предзаказ
        </button>
        <div className="night-meta">
          <span>Работаем с 10:00 до 23:00 МСК</span>
          <span className="dot"/>
          <span>Сейчас в Москве {mskTime}</span>
        </div>
      </div>
    </div>
  );
}

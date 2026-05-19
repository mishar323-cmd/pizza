/* eslint-disable */
// Trust / reviews / FAQ / footer / promo / app composition
import React from 'react';
import { REVIEWS, FAQ } from '../data/menu.js';
import Ic from '../shared/icons.jsx';

const Ic3 = Ic;

export function PromoSection({ onScrollToMenu }) {
  return (
    <section id="promo" className="container" data-screen-label="promo">
      <div className="sec-head">
        <div>
          <h2>Акции, на которые<br/><span className="accent">смотрят даже сытые.</span></h2>
        </div>
        <p className="sub">Каждую неделю выкатываем новую — следите за Telegram-каналом, чтобы успеть.</p>
      </div>
      <div className="promo-grid">
        <div className="promo-card big">
          <div>
            <span className="promo-tag">главная акция</span>
            <h3>2 пиццы 30 см<br/>= 1 290 ₽</h3>
            <p>Любые две классические пиццы среднего размера. До конца недели.</p>
          </div>
          <button className="promo-cta" onClick={onScrollToMenu}>Собрать комбо</button>
          <div className="visual-disc"/>
          <div className="visual-disc inner"/>
        </div>
        <div className="promo-card accent">
          <span className="promo-tag">−15%</span>
          <h3>На&nbsp;первый заказ</h3>
          <p>Промокод <strong>ПЕРВЫЙ</strong> при оформлении.</p>
          <button className="promo-cta">Скопировать</button>
          <div className="visual-disc"/>
        </div>
        <div className="promo-card dark">
          <span className="promo-tag" style={{background: 'rgba(255,184,0,0.2)', color:'var(--accent)'}}>каждый 5-й</span>
          <h3>Бесплатно</h3>
          <p>Маргарита 25 см в подарок к каждому пятому заказу.</p>
          <button className="promo-cta">Подробнее</button>
          <div className="visual-disc"/>
        </div>
      </div>
    </section>
  );
}

export function TrustSection() {
  return (
    <section id="about" className="container" data-screen-label="trust">
      <div className="sec-head">
        <div>
          <h2>Не маркетинг,<br/><span className="accent">а кухонная честность.</span></h2>
        </div>
        <p className="sub">Мы маленькая локальная пиццерия в Красногорске. Делаем как для своих — потому что вы и есть наши соседи.</p>
      </div>
      <div className="trust-grid">
        <div className="trust-card">
          <div className="ic"><Ic3 name="leaf" size={24}/></div>
          <h4>Вкусное, хрустящее тесто</h4>
          <p>Замешиваем в 6 утра. Проходит 24 часа холодной ферментации — отсюда вкус и лёгкое тесто, которое не лежит камнем.</p>
        </div>
        <div className="trust-card">
          <div className="ic"><Ic3 name="shield" size={24}/></div>
          <h4>Сыр и мясо — нормальные</h4>
          <p>Моцарелла Galbani, пепперони от итальянского поставщика, мясо охлаждённое (не размороженное). Без растительного «сыра».</p>
        </div>
        <div className="trust-card">
          <div className="ic"><Ic3 name="truck" size={24}/></div>
          <h4>Везём в термосумке</h4>
          <p>Курьер забирает пиццу через 90 секунд после печи. До вашей двери — 35 минут в среднем по Глухово. Если опаздываем, заказ за наш счёт.</p>
        </div>
      </div>
    </section>
  );
}

export function ReviewsSection() {
  return (
    <section id="reviews" className="container" data-screen-label="reviews">
      <div className="sec-head">
        <div>
          <h2>53 отзыва.<br/><span className="accent">5.0 из 5.</span></h2>
        </div>
        <p className="sub">Реальные отзывы клиентов с Яндекс.Карт.</p>
      </div>
      <div className="reviews-row">
        {REVIEWS.map((r, i) => (
          <div className="review-card" key={i}>
            <div className="review-stars">
              {Array(r.stars).fill(0).map((_, s) => <Ic3 key={s} name="star" size={14}/>)}
            </div>
            <blockquote>«{r.text}»</blockquote>
            <div className="review-meta">
              <div className="av">{r.name[0]}</div>
              <div>
                <strong>{r.name}</strong>
                <small>{r.where}</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FaqSection() {
  const [closed, setClosed] = React.useState(() => new Set());
  const toggle = (i) => {
    setClosed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  return (
    <section id="faq" className="container" data-screen-label="faq">
      <div className="sec-head">
        <div>
          <h2>Частые вопросы</h2>
        </div>
        <p className="sub">Не нашли ответ? Напишите в Telegram @delovpizza — отвечает живой человек, обычно за 2 минуты.</p>
      </div>
      <div className="faq-row">
        {FAQ.map((f, i) => (
          <div key={i} className={`faq-item ${!closed.has(i) ? 'open' : ''}`}>
            <button className="faq-q" onClick={() => toggle(i)}>
              <span>{f.q}</span>
              <span className="ic">+</span>
            </button>
            <div className="faq-a">{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer" data-screen-label="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="#" className="logo">
              <span className="logo-mark">Д</span>
              <div>Дело в пицце<small style={{color:'rgba(255,255,255,0.5)'}}>Красногорск</small></div>
            </a>
            <p>Локальная пиццерия в Глухово. Делаем тесто на закваске, везём горячо и быстро. С 2025 года.</p>
            <div className="footer-socials">
              <a href="https://t.me/delovpizza" target="_blank" aria-label="Telegram"><Ic3 name="tg" size={18}/></a>
              <a href="https://wa.me/79154889419" target="_blank" aria-label="WhatsApp"><Ic3 name="wa" size={18}/></a>
              <a href="tel:+79154889419" aria-label="Телефон"><Ic3 name="phone" size={18}/></a>
            </div>
          </div>
          <div>
            <h5>Меню</h5>
            <ul>
              <li><a href="#menu">Пицца</a></li>
              <li><a href="#menu">Напитки</a></li>
              <li><a href="#menu">Десерты</a></li>
              <li><a href="#promo">Акции</a></li>
            </ul>
          </div>
          <div>
            <h5>Контакты</h5>
            <ul>
              <li><a href="tel:+79154889419">+7 915 488-94-19</a></li>
              <li><a href="#">Романовская 5, под. 10</a></li>
              <li><a href="#">Ежедневно 10:00 — 23:00</a></li>
              <li><a href="mailto:mmismo@yandex.ru">mmismo@yandex.ru</a></li>
            </ul>
          </div>
          <div>
            <h5>Документы</h5>
            <ul>
              <li><a href="/police">Политика конфиденциальности</a></li>
              <li><a href="/rekviziti">Реквизиты</a></li>
              <li><a href="#">Оферта</a></li>
              <li><a href="#">Доставка и оплата</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2018–2026 Дело в пицце. ИП Рубан М.О., ИНН 772648698801</span>
          <span>Сделано с любовью к тесту 🍕</span>
        </div>
      </div>
    </footer>
  );
}

/* ======================== Toast ======================== */
export function ToastStack({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div className="toast" key={t.id}>
          <Ic3 name="check" size={16}/>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

export function MobileBar({ count, total, onOpen }) {
  if (count === 0) return null;
  return (
    <button className={`mobile-bar ${count > 0 ? 'show' : ''}`} onClick={onOpen}>
      <span style={{display:'inline-flex', alignItems:'center'}}>
        <span className="badge">{count}</span>
        Корзина
      </span>
      <span>{total} ₽ →</span>
    </button>
  );
}

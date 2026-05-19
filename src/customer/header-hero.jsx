/* eslint-disable */
import React from 'react';
import Ic from '../shared/icons.jsx';
// Header / topbar / hero / promo

const { useState, useEffect, useRef, useMemo } = React;

export function TopBar() {
  return (
    <div className="topbar">
      <div className="container inner">
        <div className="ribbon">
          <span><Ic name="pin" size={14}/> Красногорск, Романовская 5</span>
          <span style={{opacity: 0.4}}>|</span>
          <span><Ic name="clock" size={14}/> Доставка 60 мин</span>
          <span style={{opacity: 0.4}}>|</span>
          <span style={{display:'inline-flex', gap:6, alignItems:'center'}}><span className="dot"/> Кухня открыта · до 23:00</span>
        </div>
        <div style={{display:'flex', gap: 18, alignItems:'center'}}>
          <a href="tel:+79154889419" style={{display:'inline-flex', gap:6, alignItems:'center', fontWeight:600}}>
            <Ic name="phone" size={14}/> +7 915 488-94-19
          </a>
          <a href="https://t.me/delovpizza" target="_blank" style={{display:'inline-flex', gap:6, alignItems:'center'}}>
            <Ic name="tg" size={14}/> Telegram
          </a>
        </div>
      </div>
    </div>
  );
}

export function Header({ cartCount, cartTotal, onCartOpen, onProfileOpen, profileBadge }) {
  return (
    <header className="header">
      <div className="container inner">
        <a href="#" className="logo" data-comment-anchor="logo">
          <span className="logo-mark">Д</span>
          <div>
            Дело в пицце
            <small>Красногорск</small>
          </div>
        </a>
        <nav className="nav">
          <a href="#menu" className="active">Меню</a>
          <a href="#promo">Акции</a>
          <a href="#about">О нас</a>
          <a href="#reviews">Отзывы</a>
          <a href="#faq">Помощь</a>
        </nav>
        <div className="header-actions">
          <button className="icon-btn ghost-mobile" title="Поиск"><Ic name="search" size={18}/></button>
          <button className="icon-btn ghost-mobile profile-btn" title="Профиль" onClick={onProfileOpen} style={{position:'relative'}}>
            <Ic name="user" size={18}/>
            {profileBadge && <span className="profile-dot" aria-hidden="true"/>}
          </button>
          <button className="cart-btn" onClick={onCartOpen}>
            <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
              <Ic name="cart" size={18}/>
              {cartCount > 0 && <span className="badge">{cartCount}</span>}
            </span>
            <span>{cartTotal > 0 ? `${cartTotal} ₽` : 'Корзина'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Hero({ onScrollToMenu }) {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div className="hero-text">
            <span className="hero-eyebrow">
              <span className="pulse"/>
              Кухня готовит прямо сейчас · везём за 35 мин
            </span>
            <h1>
              Пицца,<br/>
              в которой<br/>
              <em>дело.</em>
            </h1>
            <p className="lead">
              Тонкое хрустящее тесто, итальянская моцарелла, свежие овощи.
              Бесплатная доставка по Глухово и окрестностям.
            </p>
            <div className="hero-ctas">
              <button className="btn btn-primary btn-lg" onClick={onScrollToMenu}>
                Смотреть меню
                <Ic name="arrow-right" size={16}/>
              </button>
              <a className="btn btn-ghost btn-lg" href="tel:+79154889419">
                <Ic name="phone" size={16}/>
                Позвонить
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <div className="hero-stat-num">35<span className="unit">мин</span></div>
                <div className="hero-stat-label">средняя доставка по Глухово</div>
              </div>
              <div>
                <div className="hero-stat-num">4.9<span className="unit">/5</span></div>
                <div className="hero-stat-label">500+ отзывов на маркетплейсах</div>
              </div>
              <div>
                <div className="hero-stat-num">12<span className="unit">видов</span></div>
                <div className="hero-stat-label">пицц на любой вкус</div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-blob"/>
            <div className="hero-ring"/>
            <div className="hero-logo-stage">
              <img className="hero-logo-img" src="/logo.png" alt="Дело в пицце"/>
              <div className="cheese-drips" aria-hidden="true">
                <svg viewBox="0 0 600 400" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="cheeseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFE08A"/>
                      <stop offset="40%" stopColor="#FFB800"/>
                      <stop offset="100%" stopColor="#D97A00"/>
                    </linearGradient>
                  </defs>
                  <g className="drip-anim">
                    <path className="drip-strand" d="M120 0 q-6 60 -2 130 q-1 30 6 60 q3 30 -8 60 q-2 20 8 40 a8 8 0 0 0 16 0 q10 -20 8 -40 q-11 -30 -8 -60 q7 -30 6 -60 q4 -70 -2 -130 z"/>
                  </g>
                  <g className="drip-anim">
                    <path className="drip-strand" d="M260 0 q-4 50 0 110 q5 25 -4 55 q-2 18 6 36 a6 6 0 0 0 12 0 q8 -18 6 -36 q-9 -30 -4 -55 q4 -60 0 -110 z"/>
                  </g>
                  <g className="drip-anim">
                    <path className="drip-strand" d="M390 0 q-8 70 -2 150 q-1 35 8 70 q4 24 -10 48 a8 8 0 0 0 16 8 q14 -32 10 -56 q-9 -35 -8 -70 q6 -80 -2 -150 z"/>
                  </g>
                  <g className="drip-anim">
                    <path className="drip-strand" d="M490 0 q-3 40 1 90 q3 22 -3 44 q-2 14 4 28 a5 5 0 0 0 10 0 q6 -14 4 -28 q-6 -22 -3 -44 q4 -50 1 -90 z"/>
                  </g>
                </svg>
              </div>
              <span className="cheese-droplet d1"/>
              <span className="cheese-droplet d2"/>
              <span className="cheese-droplet d3"/>
              <span className="cheese-droplet d4"/>
              <div className="drip-puddle"/>
            </div>
            <div className="hero-bubble bubble-1">
              <div className="bubble-ic" style={{background:'var(--primary-soft)', color:'var(--primary)'}}>
                <Ic name="flame" size={20}/>
              </div>
              <div>
                <strong>Всегда горячая пицца</strong>
                <small>к вашему столу</small>
              </div>
            </div>
            <div className="hero-bubble bubble-2">
              <div className="bubble-ic" style={{background:'#E8F5EE', color:'var(--basil)'}}>
                <Ic name="leaf" size={20}/>
              </div>
              <div>
                <strong>Вкусное, хрустящее тесто</strong>
                <small>замешиваем каждое утро</small>
              </div>
            </div>
            <div className="hero-bubble bubble-3">
              <div className="bubble-ic" style={{background:'#FFF3D6', color:'#A66A00'}}>
                <Ic name="gift" size={20}/>
              </div>
              <div>
                <strong>Подарок к 1му заказу</strong>
                <small>при заказе от 1500₽</small>
              </div>
            </div>
          </div>
        </div>

        <div className="usp-strip">
          <div className="usp-cell">
            <div className="ic"><Ic name="truck" size={20}/></div>
            <div>
              <strong>Собственная служба доставки</strong>
              <small>гарантия скорости</small>
            </div>
          </div>
          <div className="usp-cell">
            <div className="ic"><Ic name="shield" size={20}/></div>
            <div>
              <strong>Контроль качества</strong>
              <small>Каждая пицца проверяется и пломбируется перед выдачей</small>
            </div>
          </div>
          <div className="usp-cell">
            <div className="ic"><Ic name="percent" size={20}/></div>
            <div>
              <strong>Самовывоз − 10%</strong>
              <small>забирайте на Романовской 5</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ScrollingBanner() {
  const items = ['Вкусное, хрустящее тесто', '12 видов пицц', 'Собственная служба доставки', 'Свободная моцарелла из Италии', 'Кухня в центре Глухово', 'С любовью к деталям'];
  return (
    <div className="scrolling-banner" aria-hidden="true">
      <div className="track">
        {[0, 1].map(i => (
          <span key={i}>
            {items.map((t, idx) => (
              <React.Fragment key={idx}>
                {t}
                <span className="dot"/>
              </React.Fragment>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}


/* eslint-disable */
// Карта зон доставки на Яндекс.Картах
import React from 'react';

const YMAPS_APIKEY = '377a4a65-0532-44a8-9ff7-d6877c155757';

export function DeliveryMap() {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  // Глухово, ул. Романовская 5
  const ORIGIN = [55.767003, 37.236615];

  React.useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;

    const ensureScript = () => new Promise((resolve, reject) => {
      if (window.ymaps) return resolve(window.ymaps);
      const s = document.createElement('script');
      s.src = `https://api-maps.yandex.ru/2.1/?apikey=${YMAPS_APIKEY}&lang=ru_RU`;
      s.async = true;
      s.onload = () => resolve(window.ymaps);
      s.onerror = reject;
      document.head.appendChild(s);
    });

    ensureScript().then(ymaps => ymaps.ready(() => {
      if (cancelled || !ref.current || mapRef.current) return;
      const map = new ymaps.Map(ref.current, {
        center: ORIGIN,
        zoom: 13,
        controls: ['zoomControl'],
      }, { suppressMapOpenBlock: true });
      mapRef.current = map;

      // Зона В — 10 км (серая, платная)
      const zoneC = new ymaps.Circle([ORIGIN, 10000], {
        hintContent: 'Зона В · 10 км',
        balloonContent: '<b>Зона В · 10 км</b><br/>Доставка за счёт получателя',
      }, {
        fillColor: 'rgba(80, 80, 80, 0.06)',
        strokeColor: '#666',
        strokeWidth: 2,
        strokeStyle: 'dot',
      });

      // Зона Б — пользовательский полигон (Глухово и окрестности)
      const zoneB = new ymaps.Polygon([[
        [55.7955, 37.2050],
        [55.7950, 37.2300],
        [55.7935, 37.2545],
        [55.7900, 37.2750],
        [55.7720, 37.2800],
        [55.7400, 37.2820],
        [55.7280, 37.2700],
        [55.7250, 37.2400],
        [55.7270, 37.2100],
        [55.7330, 37.1900],
        [55.7555, 37.1700],
        [55.7755, 37.1655],
        [55.7900, 37.1755],
        [55.7955, 37.2050],
      ]], {
        hintContent: 'Зона Б · Глухово и окрестности',
        balloonContent: '<b>Зона Б</b><br/>Доставка 300 ₽, бесплатно от 3 000 ₽',
      }, {
        fillColor: 'rgba(27, 77, 191, 0.10)',
        strokeColor: '#1B4DBF',
        strokeWidth: 2,
        strokeStyle: 'shortdash',
      });

      // Зона А — обведённый пользователем овал вокруг ЖК «Новая Рига» / Романовской
      const zoneA = new ymaps.Polygon([[
        [55.7690, 37.2340],
        [55.7715, 37.2380],
        [55.7722, 37.2430],
        [55.7718, 37.2475],
        [55.7705, 37.2495],
        [55.7685, 37.2500],
        [55.7665, 37.2495],
        [55.7650, 37.2480],
        [55.7642, 37.2450],
        [55.7640, 37.2420],
        [55.7644, 37.2385],
        [55.7652, 37.2355],
        [55.7665, 37.2335],
        [55.7680, 37.2330],
        [55.7690, 37.2340],
      ]], {
        hintContent: 'Зона А · ЖК «Новая Рига» · бесплатно',
        balloonContent: '<b>Зона А · ЖК «Новая Рига»</b><br/>Бесплатная доставка от 500 ₽',
      }, {
        fillColor: 'rgba(220, 40, 40, 0.18)',
        strokeColor: '#DC2828',
        strokeWidth: 2,
      });

      const placemark = new ymaps.Placemark(ORIGIN, {
        hintContent: 'Дело в пицце',
        balloonContent: '<b>Дело в пицце</b><br/>Глухово, ул. Романовская 5',
      }, {
        preset: 'islands#redIcon',
        iconColor: '#DC2828',
      });

      map.geoObjects.add(zoneC);
      map.geoObjects.add(zoneB);
      map.geoObjects.add(zoneA);
      map.geoObjects.add(placemark);
      map.setBounds(zoneC.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 16 });
      map.behaviors.disable('scrollZoom');
    })).catch(() => {});

    return () => {
      cancelled = true;
      if (mapRef.current) { try { mapRef.current.destroy(); } catch {} mapRef.current = null; }
    };
  }, []);

  return (
    <section id="delivery" className="container" data-screen-label="delivery-zones">
      <div className="sec-head">
        <div>
          <h2>Зоны доставки<br/><span className="accent">по Глухово и окрестностям</span></h2>
        </div>
        <p className="sub">Бесплатная доставка по ЖК «Новая Рига». По Глухово и окрестностям — 300 ₽, либо бесплатно от 3 000 ₽.</p>
      </div>

      <div className="delivery-wrap">
        <div className="delivery-map" ref={ref} aria-label="Карта зон доставки"/>
        <aside className="delivery-legend">
          <div className="zone-card zone-a">
            <div className="zone-tag">Зона А</div>
            <strong>ЖК «Новая Рига»</strong>
            <p>Наш домашний радиус — везём за 30–35 минут. Доставка бесплатно от 500 ₽.</p>
            <ul>
              <li><span className="dot" style={{background:'#DC2828'}}/> Бесплатная доставка от 500 ₽</li>
              <li><span className="dot" style={{background:'#DC2828'}}/> Среднее время 30 минут</li>
            </ul>
          </div>
          <div className="zone-card zone-b">
            <div className="zone-tag" style={{background:'rgba(27,77,191,0.12)', color:'#1B4DBF'}}>Зона Б</div>
            <strong>Глухово и окрестности</strong>
            <p>Михалково, Воронки, Архангельское, Барвиха, Жуковка, Раздоры, Александровка, Петрово-Дальнее, Бузланово, Инженерный-1, Поздняково. До двери — около 60 минут.</p>
            <ul>
              <li><span className="dot" style={{background:'#1B4DBF'}}/> Доставка 300 ₽</li>
              <li><span className="dot" style={{background:'#1B4DBF'}}/> Бесплатно от 3 000 ₽</li>
            </ul>
          </div>
          <div className="zone-card zone-c">
            <div className="zone-tag" style={{background:'rgba(80,80,80,0.10)', color:'#555'}}>Зона В</div>
            <strong>10 км от пиццерии</strong>
            <p>Доставка за счёт получателя — стоимость рассчитает оператор после оформления заказа. При заказе от 5 000 ₽ доставка 600 ₽. Время около 60 минут, зависит от вашей локации. Пицца приедет горячая.</p>
            <ul>
              <li><span className="dot" style={{background:'#666'}}/> Платная доставка · 600 ₽ от 5 000 ₽</li>
              <li><span className="dot" style={{background:'#666'}}/> Пицца приедет горячая</li>
            </ul>
          </div>
          <div className="zone-help">
            Не уверены, попадаете ли в зону? Напишите адрес в <a href="https://t.me/delovpizza" target="_blank" rel="noopener noreferrer">чат</a> — проверим за минуту.
          </div>
        </aside>
      </div>
    </section>
  );
}

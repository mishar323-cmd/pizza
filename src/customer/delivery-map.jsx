/* eslint-disable */
// Карта зон доставки на Яндекс.Картах — зоны берутся из админки (/api/delivery/zones)
import React from 'react';

const YMAPS_APIKEY = '377a4a65-0532-44a8-9ff7-d6877c155757';

function hexToRgba(hex, a) {
  const m = (hex || '#666666').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return `rgba(102,102,102,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

const rub = (n) => `${Number(n).toLocaleString('ru-RU')} ₽`;

export function zonePriceLine(z) {
  if (!z.deliveryPrice) return z.freeFrom > 0 ? `Бесплатная доставка от ${rub(z.freeFrom)}` : 'Доставка бесплатно';
  return `Доставка ${rub(z.deliveryPrice)}${z.freeFrom > 0 ? `, бесплатно от ${rub(z.freeFrom)}` : ''}`;
}

export function DeliveryMap() {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const [data, setData] = React.useState(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/delivery/zones')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  React.useEffect(() => {
    if (!ref.current || !data) return;
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
      const origin = data.origin;
      const map = new ymaps.Map(ref.current, { center: origin, zoom: 12, controls: ['zoomControl'] }, { suppressMapOpenBlock: true });
      mapRef.current = map;

      // Largest zones first so smaller ones stay clickable on top.
      const isPoly = (z) => z.polygon && z.polygon.length >= 3;
      const size = (z) => {
        if (!isPoly(z)) { const d = (z.radiusKm || 10) / 111 * 2; return d * d; }
        const la = z.polygon.map(p => p[0]), lo = z.polygon.map(p => p[1]);
        return (Math.max(...la) - Math.min(...la)) * (Math.max(...lo) - Math.min(...lo));
      };
      [...data.zones].sort((a, b) => size(b) - size(a)).forEach(z => {
        const props = { hintContent: z.name, balloonContent: `<b>${z.name}</b><br/>${zonePriceLine(z)}` };
        const opts = { fillColor: hexToRgba(z.color, 0.12), strokeColor: z.color || '#666', strokeWidth: 2 };
        map.geoObjects.add(isPoly(z)
          ? new ymaps.Polygon([z.polygon], props, opts)
          : new ymaps.Circle([origin, (z.radiusKm || 10) * 1000], props, { ...opts, strokeStyle: 'dot' }));
      });

      map.geoObjects.add(new ymaps.Placemark(origin, {
        hintContent: 'Дело в пицце',
        balloonContent: '<b>Дело в пицце</b><br/>Глухово, ул. Романовская 5',
      }, { preset: 'islands#redIcon', iconColor: '#DC2828' }));

      const bounds = map.geoObjects.getBounds();
      if (bounds) map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 16 });
      map.behaviors.disable('scrollZoom');
    })).catch(() => {});

    return () => {
      cancelled = true;
      if (mapRef.current) { try { mapRef.current.destroy(); } catch {} mapRef.current = null; }
    };
  }, [data]);

  const zones = data?.zones || [];

  return (
    <section id="delivery" className="container" data-screen-label="delivery-zones">
      <div className="sec-head">
        <div>
          <h2>Зоны доставки<br/><span className="accent">по Глухово и окрестностям</span></h2>
        </div>
        <p className="sub">Стоимость доставки считается автоматически по адресу при оформлении заказа.</p>
      </div>

      <div className="delivery-wrap">
        {failed
          ? <div className="delivery-map" style={{ display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>Карта временно недоступна — проверим адрес по телефону <a href="tel:+79154889419">+7 915 488-94-19</a></div>
          : <div className="delivery-map" ref={ref} aria-label="Карта зон доставки"/>}
        <aside className="delivery-legend">
          {zones.map(z => (
            <div className="zone-card" key={z.id}>
              <div className="zone-tag" style={{ background: hexToRgba(z.color, 0.12), color: z.color }}>{z.name.split('·')[0].trim()}</div>
              <strong>{z.name.includes('·') ? z.name.split('·').slice(1).join('·').trim() : z.name}</strong>
              {z.description && <p>{z.description}</p>}
              <ul>
                <li><span className="dot" style={{ background: z.color }}/> {zonePriceLine(z)}</li>
                {z.eta > 0 && <li><span className="dot" style={{ background: z.color }}/> Около {z.eta} минут</li>}
              </ul>
            </div>
          ))}
          <div className="zone-help">
            Не уверены, попадаете ли в зону? Напишите адрес в <a href="https://t.me/delovpizza" target="_blank" rel="noopener noreferrer">чат</a> — проверим за минуту.
          </div>
        </aside>
      </div>
    </section>
  );
}

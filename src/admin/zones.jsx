/* eslint-disable */
// Редактор полигона зоны на Яндекс.Картах (использует встроенный editor)
import React from 'react';
import { AdminStore } from './store/admin-store.js';

const YMAPS_APIKEY = '377a4a65-0532-44a8-9ff7-d6877c155757';
const ZONE_ORIGIN = [55.767003, 37.236615];

function loadYmaps() {
  return new Promise((resolve, reject) => {
    if (window.ymaps && window.ymaps.Map) return resolve(window.ymaps);
    let s = document.querySelector('script[data-ymaps]');
    if (!s) {
      s = document.createElement('script');
      s.src = `https://api-maps.yandex.ru/2.1/?apikey=${YMAPS_APIKEY}&lang=ru_RU`;
      s.async = true;
      s.dataset.ymaps = '1';
      document.head.appendChild(s);
    }
    s.addEventListener('load', () => resolve(window.ymaps));
    s.addEventListener('error', reject);
    if (window.ymaps) resolve(window.ymaps);
  });
}

function ZoneMapEditor({ zone, otherZones, onSave, onClose }) {
  const mapRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const polygonRef = React.useRef(null);
  const [drawing, setDrawing] = React.useState(false);
  const [pointCount, setPointCount] = React.useState((zone.polygon || []).length);

  React.useEffect(() => {
    let cancelled = false;
    let map;
    loadYmaps().then(ym => ym.ready(() => {
      if (cancelled || !containerRef.current) return;
      map = new ym.Map(containerRef.current, {
        center: ZONE_ORIGIN,
        zoom: 13,
        controls: ['zoomControl', 'fullscreenControl', 'typeSelector'],
      }, { suppressMapOpenBlock: true });
      mapRef.current = map;

      // Точка пиццерии
      const placemark = new ym.Placemark(ZONE_ORIGIN, {
        hintContent: 'Дело в пицце',
      }, {
        preset: 'islands#redIcon',
        iconColor: '#DC2828',
      });
      map.geoObjects.add(placemark);

      // Полупрозрачные полигоны других зон (для ориентира)
      (otherZones || []).forEach(z => {
        if (!z.polygon || z.polygon.length < 3) return;
        const p = new ym.Polygon([z.polygon], {
          hintContent: z.name,
        }, {
          fillColor: z.color + '22',
          strokeColor: z.color,
          strokeWidth: 1,
          strokeStyle: 'dot',
          opacity: 0.5,
        });
        map.geoObjects.add(p);
      });

      // Полигон текущей зоны
      const initial = (zone.polygon && zone.polygon.length >= 3) ? [...zone.polygon] : [];
      const polygon = new ym.Polygon(initial.length ? [initial] : [[]], {
        hintContent: zone.name,
      }, {
        fillColor: hexToRgba(zone.color, 0.25),
        strokeColor: zone.color,
        strokeWidth: 3,
        editorMaxPoints: 200,
        editorMenuManager: function (items) {
          return items;
        },
      });
      polygonRef.current = polygon;
      map.geoObjects.add(polygon);

      // Если есть полигон — включаем редактирование сразу
      if (initial.length >= 3) {
        polygon.editor.startEditing();
        // Кадрируем
        try {
          map.setBounds(polygon.geometry.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
        } catch {}
      } else {
        // Иначе сразу запускаем рисование новых точек
        polygon.editor.startEditing();
        polygon.editor.startDrawing();
        setDrawing(true);
      }

      // Слушаем изменение количества точек
      const updateCount = () => {
        const coords = polygon.geometry.getCoordinates();
        const ring = (coords && coords[0]) || [];
        setPointCount(ring.length);
      };
      polygon.events.add('geometrychange', updateCount);
      updateCount();
    })).catch(() => {});

    return () => {
      cancelled = true;
      if (polygonRef.current) {
        try { polygonRef.current.editor.stopDrawing(); } catch {}
        try { polygonRef.current.editor.stopEditing(); } catch {}
      }
      if (mapRef.current) {
        try { mapRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const toggleDrawing = () => {
    if (!polygonRef.current) return;
    if (drawing) {
      polygonRef.current.editor.stopDrawing();
      setDrawing(false);
    } else {
      polygonRef.current.editor.startDrawing();
      setDrawing(true);
    }
  };

  const clearPolygon = () => {
    if (!polygonRef.current) return;
    if (!confirm('Очистить полигон и начать рисовать с нуля?')) return;
    polygonRef.current.geometry.setCoordinates([[]]);
    polygonRef.current.editor.startDrawing();
    setDrawing(true);
    setPointCount(0);
  };

  const handleSave = () => {
    if (!polygonRef.current) return;
    const coords = polygonRef.current.geometry.getCoordinates();
    const ring = (coords && coords[0]) || [];
    if (ring.length < 3) {
      alert('Зона должна содержать минимум 3 точки');
      return;
    }
    onSave(ring);
  };

  return (
    <div className="amodal-overlay" onClick={onClose}>
      <div className="zone-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="zone-editor-head">
          <div>
            <h3>Редактирование зоны</h3>
            <small>{zone.name}</small>
          </div>
          <button className="abtn abtn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="zone-editor-help">
          <strong>Как работать:</strong> {drawing ? 'кликайте по карте, чтобы поставить точки. Двойной клик завершает рисование.' : 'тяните точки полигона мышью. Клик по середине ребра — добавить точку. Правый клик по точке — удалить.'} Текущая зона: <b>{pointCount}</b> точ{pointCount === 1 ? 'ка' : pointCount < 5 ? 'ки' : 'ек'}.
        </div>

        <div className="zone-editor-toolbar">
          <button className={`abtn ${drawing ? 'abtn-primary' : 'abtn-ghost'}`} onClick={toggleDrawing}>
            {drawing ? '✓ Завершить рисование' : '✎ Добавить точки'}
          </button>
          <button className="abtn abtn-ghost" onClick={clearPolygon}>Очистить</button>
          <span style={{ flex: 1 }}/>
          <button className="abtn abtn-ghost" onClick={onClose}>Отмена</button>
          <button className="abtn abtn-primary" onClick={handleSave} disabled={pointCount < 3}>Сохранить зону</button>
        </div>

        <div className="zone-editor-map" ref={containerRef}/>
      </div>
    </div>
  );
}

function hexToRgba(hex, a) {
  const m = (hex || '#666666').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return `rgba(102,102,102,${a})`;
  const [, r, g, b] = m;
  return `rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)},${a})`;
}

export default function ZonesAdvanced({ store, setStore }) {
  const [editingZone, setEditingZone] = React.useState(null);

  const update = (id, patch) => {
    const next = { ...store, zones: store.zones.map(z => z.id === id ? { ...z, ...patch } : z) };
    setStore(next);
    AdminStore.save(next);
  };

  const saveZonePolygon = (ring) => {
    if (!editingZone) return;
    update(editingZone.id, { polygon: ring });
    setEditingZone(null);
  };

  return (
    <div>
      <h1 className="admin-h1">Зоны доставки</h1>
      <p className="admin-sub">Тарифы и геометрия каждой зоны. Кликни «Редактировать на карте», чтобы расставить точки границы.</p>

      <div className="zones-list">
        {store.zones.map(z => {
          const points = (z.polygon || []).length;
          return (
            <div key={z.id} className="zone-edit zone-edit-rich">
              <div className="stripe" style={{ background: z.color }}/>
              <div className="name">
                <strong>{z.name}</strong>
                <small>ID: {z.id} · {points >= 3 ? `${points} точек на карте` : (z.polygon === null ? 'круг 10 км' : 'не задано')}</small>
              </div>
              <div className="field-mini">
                <label>Доставка, ₽</label>
                <input type="number" value={z.deliveryPrice} onChange={(e) => update(z.id, { deliveryPrice: +e.target.value })}/>
              </div>
              <div className="field-mini">
                <label>Бесплатно от, ₽</label>
                <input type="number" value={z.freeFrom} onChange={(e) => update(z.id, { freeFrom: +e.target.value })}/>
              </div>
              <div className="field-mini">
                <label>Время, мин</label>
                <input type="number" value={z.eta} onChange={(e) => update(z.id, { eta: +e.target.value })}/>
              </div>
              <button className="abtn abtn-primary" onClick={() => setEditingZone(z)}>📍 На карте</button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, padding: 14, background: 'var(--bg-soft)', borderRadius: 12, fontSize: 13, color: 'var(--ink-soft)' }}>
        <strong>Подсказка:</strong> в режиме рисования кликайте по карте, чтобы поставить точки. Двойной клик — завершить. Существующие точки можно перетаскивать; клик по середине ребра — вставить новую; правый клик по точке — удалить.
      </div>

      {editingZone && (
        <ZoneMapEditor
          zone={editingZone}
          otherZones={store.zones.filter(z => z.id !== editingZone.id)}
          onSave={saveZonePolygon}
          onClose={() => setEditingZone(null)}
        />
      )}
    </div>
  );
}

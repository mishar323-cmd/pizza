/* eslint-disable */
import React from 'react';
// Icons component (simple stroke icons)

const Ic = ({ name, size = 20 }) => {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'pin': return <svg {...common}><path d="M12 21s-7-7.5-7-12a7 7 0 1 1 14 0c0 4.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case 'phone': return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>;
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'cart': return <svg {...common}><path d="M3 4h2l2.5 12.5a2 2 0 0 0 2 1.5h8a2 2 0 0 0 2-1.6L21.5 8H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/></svg>;
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'search': return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'menu': return <svg {...common}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'close': return <svg {...common}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'minus': return <svg {...common}><path d="M5 12h14"/></svg>;
    case 'heart': return <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>;
    case 'heart-fill': return <svg {...common} fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>;
    case 'star': return <svg {...common} fill="currentColor"><path d="M12 2.5l3 6.4 6.9.7-5.2 4.7 1.5 6.7L12 17.7l-6.2 3.3 1.5-6.7L2.1 9.6l6.9-.7L12 2.5Z"/></svg>;
    case 'flame': return <svg {...common}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17l1-3 1 3a2.5 2.5 0 1 0 2-4.5C13 8.5 16 5 12 2c0 6-5 6-5 11 0 1.5.7 2.7 1.5 1.5Z"/></svg>;
    case 'truck': return <svg {...common}><path d="M1 7h13v10H1zM14 10h4l3 3v4h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z"/><path d="m9 12 2 2 4-4"/></svg>;
    case 'leaf': return <svg {...common}><path d="M11 20A7 7 0 0 1 4 13V5a8 8 0 0 1 16 0c0 9-9 15-9 15Z"/><path d="M2 21c0-3 4-7 9-9"/></svg>;
    case 'sparkle': return <svg {...common}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M5.6 18.4l4.2-4.2M14.2 9.8l4.2-4.2"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'check': return <svg {...common}><path d="m20 6-11 11L4 12"/></svg>;
    case 'tg': return <svg {...common}><path d="m22 3-9.5 18-3-9-9-3 21.5-6Z"/></svg>;
    case 'wa': return <svg {...common}><path d="M3 21l1.5-5A8 8 0 1 1 8 19.5L3 21Z"/><path d="M8 11c.5 2 2 3.5 4 4l1.5-1.2 2.2 1A2 2 0 0 1 13 17a8 8 0 0 1-7-7 2 2 0 0 1 2.2-2.7l1 2.2L8 11Z"/></svg>;
    case 'percent': return <svg {...common}><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M19 5 5 19"/></svg>;
    case 'gift': return <svg {...common}><path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2 0-4-2-3-4s4-1 3 4ZM12 8c2 0 4-2 3-4s-4-1-3 4Z"/></svg>;
    default: return null;
  }
};

export default Ic;

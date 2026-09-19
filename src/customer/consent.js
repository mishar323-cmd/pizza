// Cookie consent. Yandex.Metrika is analytics, so it loads only after the
// visitor explicitly accepts it (152-ФЗ). v2: earlier "1" only meant "saw
// the notice", so everyone is asked again.
const KEY = 'dvp_cookie_consent_v2';
const METRIKA_ID = 112285572;

export function getCookieConsent() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'all' || v === 'necessary' ? v : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value) {
  const prev = getCookieConsent();
  try { localStorage.setItem(KEY, value); } catch {}
  if (value === 'all') {
    loadMetrika();
  } else if (prev === 'all') {
    // Withdrawn: drop analytics cookies; a reload unloads the counter.
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => n.startsWith('_ym'))
      .forEach(n => { document.cookie = `${n}=; Max-Age=0; path=/`; document.cookie = `${n}=; Max-Age=0; path=/; domain=.${location.hostname}`; });
    location.reload();
  }
}

let loaded = false;
export function loadMetrika() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
  document.head.appendChild(s);
  window.ym(METRIKA_ID, 'init', {
    ssr: true, webvisor: true, clickmap: true, ecommerce: 'dataLayer',
    referrer: document.referrer, url: location.href, accurateTrackBounce: true, trackLinks: true,
  });
}

export function openCookieSettings() {
  window.dispatchEvent(new Event('dvp-cookie-settings'));
}

// Also covers pages that render without the banner (e.g. payment success).
if (getCookieConsent() === 'all') loadMetrika();

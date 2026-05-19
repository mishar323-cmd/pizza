/* eslint-disable */
// Админ-панель — мок-данные и хранение

export const ADMIN_USERS = [
  { login: 'admin',  password: 'admin',  name: 'Михаил Р.', role: 'Владелец', avatar: 'М' },
  { login: 'kitchen', password: '1234',  name: 'Анна П.',   role: 'Шеф-повар', avatar: 'А' },
  { login: 'manager', password: 'qwerty', name: 'Дмитрий К.', role: 'Менеджер', avatar: 'Д' },
];

export const STORE_KEY = 'dvp_admin_v3';

const DEFAULT_STATE = {
  cookingTime: 35,
  promos: [
    { id: 'p1', tag: 'главная акция', tagColor: 'primary', title: '2 пиццы 30 см\n= 1 290 ₽', text: 'Любые две классические пиццы среднего размера. До конца недели.', cta: 'Собрать комбо', active: true },
    { id: 'p2', tag: '−15%',           tagColor: 'accent',  title: 'На первый заказ',  text: 'Промокод ПЕРВЫЙ при оформлении.', cta: 'Скопировать', active: true },
    { id: 'p3', tag: 'каждый 5-й',     tagColor: 'dark',    title: 'Бесплатно',         text: 'Маргарита 25 см в подарок к каждому пятому заказу.', cta: 'Подробнее', active: true },
  ],
  menu: [
    { id: 'cheese',    name: 'Сырная',          cat: 'pizza', prices: { sm: 580, md: 680, lg: 780 }, stop: false },
    { id: 'margherita',name: 'Маргаритта',      cat: 'pizza', prices: { sm: 680, md: 880, lg: 1080 }, stop: false },
    { id: 'pepperoni', name: 'Пепперони',       cat: 'pizza', prices: { sm: 680, md: 880, lg: 1080 }, stop: false },
    { id: 'ham-mush',  name: 'Ветчина и грибы', cat: 'pizza', prices: { sm: 680, md: 880, lg: 1080 }, stop: false },
    { id: 'meat',      name: 'Мясная',          cat: 'pizza', prices: { sm: 680, md: 880, lg: 1080 }, stop: false },
    { id: 'hawaii',    name: 'Гавайская',       cat: 'pizza', prices: { sm: 780, md: 880, lg: 1080 }, stop: false },
    { id: 'bbq',       name: 'Барбекю',         cat: 'pizza', prices: { sm: 780, md: 980, lg: 1180 }, stop: false },
    { id: 'sea',       name: 'Морская',         cat: 'pizza', prices: { sm: 780, md: 1080, lg: 1180 }, stop: false },
    { id: 'pesto',     name: 'Песто с курицей', cat: 'pizza', prices: { sm: 769, md: 1039, lg: 1209 }, stop: false },
    { id: 'carbonara', name: 'Карбонара',       cat: 'pizza', prices: { sm: 779, md: 1129, lg: 1239 }, stop: false },
    { id: 'spicy',     name: 'Острейшая',       cat: 'pizza', prices: { sm: 799, md: 1080, lg: 1180 }, stop: true },
    { id: 'veggie',    name: 'Овощи и грибы',   cat: 'pizza', prices: { sm: 680, md: 880, lg: 1080 }, stop: false },
    { id: 'cola',      name: 'Coca-Cola 0,5',   cat: 'drink', price: 155, stop: false },
    { id: 'lemon',     name: 'Добрый лимон 0,5',cat: 'drink', price: 155, stop: false },
    { id: 'shake-strawberry', name: 'Милкшейк клубника', cat: 'drink', price: 224, stop: true },
    { id: 'tiramisu',  name: 'Тирамису',        cat: 'dessert', price: 320, stop: false },
    { id: 'cheesecake',name: 'Чизкейк',         cat: 'dessert', price: 290, stop: false },
  ],
  zones: [
    { id: 'a', label: 'Зона А', area: 'ЖК «Новая Рига»',      color: '#DC2828', price: 0,   freeFrom: 500,  eta: '30 мин',  desc: 'Бесплатная доставка от 500 ₽' },
    { id: 'b', label: 'Зона Б', area: 'Глухово и окрестности', color: '#1B4DBF', price: 300, freeFrom: 3000, eta: '60 мин',  desc: 'Михалково, Воронки, Архангельское, Барвиха, Жуковка и др.' },
    { id: 'c', label: 'Зона В', area: '10 км от пиццерии',     color: '#666666', price: 600, freeFrom: null, eta: '60 мин',  desc: 'Платная доставка, рассчитывает оператор. При заказе от 5 000 ₽ — 600 ₽.' },
  ],
};

// Сгенерим моковые заказы
function genOrders() {
  const today = new Date();
  const isoDay = (d) => d.toISOString().slice(0,10);
  const statuses = ['new', 'cooking', 'delivering', 'done'];
  const items = [
    ['Пепперони 30 см ×1', 'Coca-Cola 0,5 ×2'],
    ['Сырная 35 см ×1', 'Картошка Бургер ×1'],
    ['Половинки: Пепперони / Карбонара 30 см ×1', 'Чай Rich ×1'],
    ['Мясная 30 см ×1', 'Маргаритта 25 см ×1', 'BonAqua ×2'],
    ['Острейшая 30 см ×1'],
    ['Барбекю 35 см ×1', 'Креветки 9 шт ×1', 'Тирамису ×1'],
    ['Гавайская 30 см ×1'],
    ['Морская 35 см ×1', 'Песто 30 см ×1'],
    ['Ветчина и грибы 30 см ×1', 'Coca-Cola ×1'],
    ['Овощи и грибы 25 см ×1'],
  ];
  const names = ['Анна К.', 'Дмитрий М.', 'Светлана Р.', 'Илья В.', 'Мария С.', 'Антон Г.', 'Ольга Б.', 'Павел Н.'];
  const addrs = ['Новая Рига, к.5', 'Романовская 12', 'Архангельская 8', 'Михалково, ул. Лесная 4', 'Барвиха, Луговая 18', 'Раздоры, Главная 22'];
  const phones = ['+7 (915) 488-94-19', '+7 (903) 123-45-67', '+7 (916) 234-56-78', '+7 (925) 345-67-89'];
  const zoneIds = ['a','b','c'];
  const list = [];
  let id = 1024;
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - dayOffset);
    const count = dayOffset === 0 ? 14 : (3 + Math.floor(Math.random()*6));
    for (let i = 0; i < count; i++) {
      const itemsList = items[Math.floor(Math.random()*items.length)];
      const total = 600 + Math.floor(Math.random()*2200);
      const isToday = dayOffset === 0;
      const status = isToday
        ? (i < 3 ? 'new' : i < 6 ? 'cooking' : i < 9 ? 'delivering' : 'done')
        : 'done';
      const dt = new Date(d);
      dt.setHours(10 + Math.floor(Math.random()*12));
      dt.setMinutes(Math.floor(Math.random()*60));
      list.push({
        id: '#' + (id++),
        date: dt.toISOString(),
        status,
        name: names[Math.floor(Math.random()*names.length)],
        phone: phones[Math.floor(Math.random()*phones.length)],
        address: addrs[Math.floor(Math.random()*addrs.length)],
        zone: zoneIds[Math.floor(Math.random()*zoneIds.length)],
        items: itemsList,
        total,
        method: ['Карта онлайн','Наличными курьеру','По QR курьеру','СБП'][Math.floor(Math.random()*4)],
      });
    }
  }
  return list;
}

export const DEFAULT_ADMIN_STATE = DEFAULT_STATE;

export const loadAdminState = function() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_STATE;
};
export const saveAdminState = function(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
};

export const ORDERS_SEED = genOrders();
export const statusLabel = (s) => ({ new: 'Новый', cooking: 'Готовится', delivering: 'В пути', done: 'Доставлен', cancelled: 'Отменён' }[s] || s);
export const statusColor = (s) => ({ new: '#DC2828', cooking: '#F59E0B', delivering: '#1B4DBF', done: '#0E7C5C', cancelled: '#666' }[s] || '#666');
export const fmtMoney = (v) => v.toLocaleString('ru-RU') + ' ₽';
export const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
export const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();

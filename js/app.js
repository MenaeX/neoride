/* NEORIDE — каталог, фильтры, сценарии подбора, сравнение. Без зависимостей. */
'use strict';

const CATS = [
  ['all', 'Все модели'], ['самокат', 'Электросамокаты'], ['велосипед', 'Электровелосипеды'],
  ['скутер', 'Электроскутеры'], ['питбайк', 'Электропитбайки'], ['трицикл', 'Трициклы'],
  ['квадроцикл', 'Квадроциклы'], ['мотоцикл', 'Мотоциклы'],
];
// Внедорожник: полный привод или высокая мощность.
function isOffroad(c) {
  const s = c.specs || {};
  return /полн|внедор/i.test(String(s.drive || '')) || (s.power || 0) >= 1500;
}
// Сценарии — НЕЗАВИСИМЫЕ предикаты (модель может попадать в несколько: быстрый внедорожник
// есть и в «Бездорожье», и в «Максимум скорости»). Бейдж карточки (utpOf) — один, фильтры — пересекаются.
const SCENARIOS = [
  ['🏙', 'Город', c => c.cat === 'самокат' && !isOffroad(c) && (c.specs.speed || 0) < 60],
  ['🛣', 'Дальние поездки', c => (c.specs.range || 0) >= 55],
  ['⛰', 'Бездорожье', c => isOffroad(c)],
  ['📦', 'Курьерам', c => c.cat === 'велосипед' || c.cat === 'трицикл' || ((c.specs.load || 0) >= 120 && (c.specs.range || 0) >= 45)],
  ['🪶', 'Лёгкие', c => (c.specs.weight || 99) <= 20],
  ['🏁', 'Максимум скорости', c => (c.specs.speed || 0) >= 55],
];
// УТП-бейдж: один главный «для чего лучше» — из характеристик (приоритет сверху вниз)
function utpOf(c) {
  const s = c.specs || {}, d = String(s.drive || '').toLowerCase();
  // грузовые электровелосипеды/трициклы (багажник) — это и есть курьерские
  if (c.cat === 'велосипед' || c.cat === 'трицикл') return ['📦', 'Для курьера', 'cur'];
  if (d.includes('полн') || (s.power || 0) >= 1500) return ['🏔', 'Для бездорожья', 'off'];
  if ((s.speed || 0) >= 60) return ['🚀', 'Максимум скорости', 'spd'];
  if (c.cat === 'самокат' && (s.range || 0) >= 70) return ['🔋', 'Дальнобой', 'rng'];
  if ((s.power || 999) <= 350 && (s.speed || 99) <= 25) return ['🧒', 'Для подростка', 'kid'];
  return ['🏙', 'Для города', 'city'];  // «сиденье» в данных недостоверно — как УТП не используем
}
const PRICE_BANDS = [['all', 'любая'], ['0-30', 'до 30 т.'], ['30-60', '30–60 т.'], ['60-999', '60 т. +']];
const SPEED_BANDS = [['all', 'любая'], ['0-25', 'до 25'], ['25-45', '25–45'], ['45-999', '45+']];
const isKids = c => (c.specs.power || 999) <= 300 && (c.specs.speed || 99) <= 25;
const isSenior = c => c.cat === 'трицикл' || c.specs.seat === true || (c.cat === 'скутер' && (c.specs.speed || 99) <= 40);
const AGE_BANDS = [['all', 'всем'], ['kids', 'детям/подросткам'], ['adult', 'взрослым'], ['senior', 'пенсионерам']];
const AGE_PRED = { kids: isKids, adult: c => !isKids(c), senior: isSenior };
const SPEC_LABELS = {
  power: ['Мощность', 'Вт', 1], volt: ['Напряжение', 'В', 0], battery_ah: ['Батарея', 'А·ч', 1],
  speed: ['Макс. скорость', 'км/ч', 1], range: ['Запас хода', 'км', 1], load: ['Макс. нагрузка', 'кг', 1],
  weight: ['Вес', 'кг', -1], wheel: ['Колёса', '"', 0], charge: ['Зарядка', 'ч', -1],
  brakes: ['Тормоза', '', 0], drive: ['Привод', '', 0],
  box: ['Размер коробки', '', 0], gross: ['Вес с упаковкой', 'кг', 0],
};
const fmt = n => n == null ? '—' : Number(n).toLocaleString('ru-RU');
const rub = n => n == null ? '—' : fmt(n) + ' ₽';

// Брендовая страница (kugoo.html / aovo каталог): window.BRAND_LOCK фиксирует бренд,
// прячет чипы брендов и ограничивает серии — общий движок, отдельные витрины.
const BRAND_LOCK = (typeof window !== 'undefined' && window.BRAND_LOCK) || null;
// Страница категории (katalog/<cat>.html): window.CAT_LOCK фиксирует категорию.
const CAT_LOCK = (typeof window !== 'undefined' && window.CAT_LOCK) || null;
// LOCK = режим листинга (бренд/категория). Без него — главная-витрина (ТОП/Новинки/окошки).
const LOCK = BRAND_LOCK || CAT_LOCK;
const inLock = c => !BRAND_LOCK || (c.brand || 'Kugoo') === BRAND_LOCK;
let state = { cat: CAT_LOCK || 'all', series: 'all', brand: BRAND_LOCK || 'all', stock: true, opt: false, hit: false, new: false, price: 'all', speed: 'all', age: 'all', scen: null, sort: 'pop' };

// Серия модели (семейство): A / S / M / G / F / V / LX / HX / EC / Wish … (не-Kugoo → бренд)
function seriesOf(c) {
  if (c.brand && c.brand !== 'Kugoo') return c.brand;
  const n = c.name.replace(/^(Kirin|Квадроцикл)\s+/i, '').trim();
  const m = n.match(/^([A-Za-z]+|[А-Яа-я]+)/);
  return m ? m[1].toUpperCase() : '—';
}
let compare = new Set(JSON.parse(localStorage.getItem('cmp') || '[]'));
const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));

/* ---------- фильтры ---------- */
function chipRow(el, bands, key) {
  el.innerHTML = bands.map(([v, label]) =>
    `<button class="fchip${state[key] === v ? ' active' : ''}" data-v="${v}">${label}</button>`).join('');
  el.querySelectorAll('.fchip').forEach(b => b.onclick = () => {
    state[key] = b.dataset.v;
    el.querySelectorAll('.fchip').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    render();
  });
}
const tabsEl = document.getElementById('catTabs');
CATS.forEach(([key, label]) => {
  if (CAT_LOCK) return;  // на странице категории вкладки категорий не нужны
  const b = document.createElement('button');
  b.className = 'cat-tab' + (key === state.cat ? ' active' : '');
  b.textContent = label;
  b.onclick = () => {
    state.cat = key; showAll = false;
    document.querySelectorAll('.cat-tab').forEach(x => x.classList.remove('active')); b.classList.add('active');
    render();
    const g = document.getElementById('found'); if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  tabsEl.appendChild(b);
});
// чипы брендов (мультибренд) — показываем ряд только если в наличии 2+ бренда
const brandEl = document.getElementById('brandTabs');
if (brandEl && !BRAND_LOCK) {
  const bc = {};
  CATALOG.filter(c => c.price && c.img).forEach(c => { const b = c.brand || 'Kugoo'; bc[b] = (bc[b] || 0) + 1; });
  const brands = Object.keys(bc).sort((a, b) => bc[b] - bc[a] || a.localeCompare(b));
  if (brands.length > 1) {
    brandEl.hidden = false;
    [['all', 'Все бренды']].concat(brands.map(b => [b, b])).forEach(([key, label]) => {
      const btn = document.createElement('button');
      btn.className = 'series-tab' + (key === state.brand ? ' active' : '');
      btn.textContent = label;
      if (key !== 'all') btn.title = `Бренд ${label} · моделей: ${bc[key]}`;
      btn.onclick = () => { state.brand = key; brandEl.querySelectorAll('.series-tab').forEach(x => x.classList.remove('active')); btn.classList.add('active'); showAll = false; render(); };
      brandEl.appendChild(btn);
    });
  }
}
// чипы серий — все семейства, по убыванию числа моделей
const seriesEl = document.getElementById('seriesTabs');
if (seriesEl) {
  const cnt = {};
  CATALOG.filter(c => c.price && c.img && inLock(c)).forEach(c => { const s = seriesOf(c); cnt[s] = (cnt[s] || 0) + 1; });
  const list = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.localeCompare(b));
  [['all', 'Все серии']].concat(list.map(s => [s, s])).forEach(([key, label]) => {
    const b = document.createElement('button');
    b.className = 'series-tab' + (key === state.series ? ' active' : '');
    b.textContent = label;
    if (key !== 'all') b.title = `Серия ${label} · моделей: ${cnt[key]}`;
    b.onclick = () => { state.series = key; seriesEl.querySelectorAll('.series-tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); showAll = false; render(); };
    seriesEl.appendChild(b);
  });
}
chipRow(document.getElementById('ageChips'), AGE_BANDS, 'age');
chipRow(document.getElementById('priceChips'), PRICE_BANDS, 'price');
chipRow(document.getElementById('speedChips'), SPEED_BANDS, 'speed');
document.getElementById('onlyStock').onchange = e => { state.stock = e.target.checked; render(); };
document.getElementById('onlyHit').onchange = e => { state.hit = e.target.checked; render(); };
{ const n = document.getElementById('onlyNew'); if (n) n.onchange = e => { state.new = e.target.checked; render(); }; }
document.getElementById('sortSel').onchange = e => { state.sort = e.target.value; render(); };

// Плитки «по задаче» — главный, понятный новичку вход в каталог (вместо букв-серий)
const ucRow = document.getElementById('useCaseTiles');
if (ucRow) {
  const tiles = [['✨', 'Все модели', null]].concat(SCENARIOS.map((s, i) => [s[0], s[1], i]));
  ucRow.innerHTML = tiles.map(([icon, label, i]) =>
    `<button class="usecase-tile${i === null ? ' active' : ''}" data-uc="${i === null ? '' : i}"><span class="uc-ic">${icon}</span>${label}</button>`).join('');
  ucRow.querySelectorAll('[data-uc]').forEach(b => {
    b.onclick = () => {
      state.scen = b.dataset.uc === '' ? null : Number(b.dataset.uc);
      ucRow.querySelectorAll('.usecase-tile').forEach(x => x.classList.toggle('active', x === b));
      showAll = false;
      render();
      const g = document.getElementById('found');
      if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });
}

function inBand(v, band) {
  if (band === 'all') return true;
  if (v == null) return false;
  const [lo, hi] = band.split('-').map(Number);
  return v >= lo * 1 && v <= hi * 1;
}

function filtered() {
  let list = CATALOG.filter(c => c.price && c.img);
  if (state.cat !== 'all') list = list.filter(c => c.cat === state.cat);
  if (state.brand !== 'all') list = list.filter(c => (c.brand || 'Kugoo') === state.brand);
  if (state.series !== 'all') list = list.filter(c => seriesOf(c) === state.series);
  if (state.stock) list = list.filter(c => c.stock === 'in');
  if (state.hit) list = list.filter(c => c.hit);
  if (state.new) list = list.filter(c => c.new);
  if (state.age !== 'all') list = list.filter(AGE_PRED[state.age]);
  list = list.filter(c => inBand(c.price / 1000, state.price));
  list = list.filter(c => state.speed === 'all' || inBand(c.specs.speed, state.speed));
  if (state.scen != null) list = list.filter(SCENARIOS[state.scen][2]);
  const s = state.sort;
  if (s === 'pop') list.sort((a, b) => ((b.new ? 1 : 0) - (a.new ? 1 : 0)) || (b.pop - a.pop) || (b.stock === 'in') - (a.stock === 'in'));
  if (s === 'price-asc') list.sort((a, b) => a.price - b.price);
  if (s === 'price-desc') list.sort((a, b) => b.price - a.price);
  if (s === 'speed') list.sort((a, b) => (b.specs.speed || 0) - (a.specs.speed || 0));
  if (s === 'range') list.sort((a, b) => (b.specs.range || 0) - (a.specs.range || 0));
  return list;
}

const BADGE = {
  in: '<span class="badge in">В наличии</span>',
  opt: '<span class="badge opt">Только опт · от 10 шт</span>',
  wait: '<span class="badge wait">Ожидается</span>',
  no: '<span class="badge no">Под заказ</span>',
};

function driveTxt(d) {
  if (!d) return null;
  d = String(d).toLowerCase();
  if (d.includes('полн')) return 'полный привод';
  if (d.includes('перед')) return 'передний привод';
  if (d.includes('задн')) return 'задний привод';
  if (d.includes('центр')) return 'центральный мотор';
  return null;
}

function cardHTML(c) {
  const s = c.specs || {};
  const chips = [
    s.speed ? `⚡ ${s.speed} км/ч` : null,
    s.range ? `🛣 ${s.range} км` : null,
    s.power ? `🔋 ${fmt(s.power)} Вт` : null,
    s.weight ? `⚖ ${s.weight} кг` : null,
    s.wheel ? `◯ ${s.wheel}″` : null,
    driveTxt(s.drive) ? `⚙ ${driveTxt(s.drive)}` : null,
  ].filter(Boolean).map(t => `<span class="spec-chip">${t}</span>`).join('');
  const gal = (c.gallery && c.gallery.length) ? c.gallery : (c.img ? [c.img] : []);
  const slides = gal.length
    ? gal.map((g, i) => `<img loading="lazy" src="${g}" alt="${c.brand || 'Kugoo'} ${c.name}" class="cg-slide${i ? '' : ' on'}">`).join('')
    : '<span class="noimg">фото скоро</span>';
  const galNav = gal.length > 1
    ? `<button class="cg-arr cg-prev" data-cg="prev" aria-label="Предыдущее фото">‹</button><button class="cg-arr cg-next" data-cg="next" aria-label="Следующее фото">›</button><span class="cg-count">1/${gal.length}</span>`
    : '';
  const on = compare.has(c.id) ? ' on' : '';
  const optNote = c.stock === 'opt' ? '<div class="opt-note">Оптовая позиция (от 10 шт) — наличие уточняйте; без гарантии производителя</div>' : '';
  const warr = c.warranty ? '<div class="warr">✓ Гарантия 12 мес · документы</div>' : '';
  const hasSale = c.old && c.old > c.price;
  const badges = (hasSale ? `<span class="badge sale">−${fmt(c.old - c.price)} ₽</span>` : '') + (c.new ? '<span class="badge new">🆕 Новинка</span>' : '') + (c.hit ? '<span class="badge hit">🔥 ХИТ</span>' : '') + BADGE[c.stock];
  const u = utpOf(c);
  return `<article class="card" data-id="${c.id}">
    <div class="card-img" data-gal="${gal.length}" data-open="${c.id}" role="button" tabindex="0" title="Подробнее"><div class="badges">${badges}</div><div class="cg-track">${slides}</div>${galNav}</div>
    <div class="card-body">
      <div class="utp utp-${u[2]}">${u[0]} ${u[1]}</div>
      <div class="card-name" data-open="${c.id}">${c.brand || 'Kugoo'} ${c.name}</div>
      <div class="card-specs">${chips}</div>
      ${warr}${optNote}
      <div class="card-foot">
        <div class="price">${rub(c.price)}${hasSale ? `<s class="price-old">${rub(c.old)}</s>` : ''}<small>розница</small></div>
        <button class="cmp-toggle${on}" data-cmp="${c.id}" title="Добавить к сравнению">⚖ Сравнить</button>
      </div>
      ${c.stock === 'in'
        ? `<div class="card-actions">
             <button class="btn btn-accent card-cart" data-addcart="${c.id}">🛒 В корзину</button>
             <button class="btn card-1click" data-order="${c.id}">⚡ Купить в один клик</button>
           </div>`
        : `<button class="btn card-notify" data-notify="${c.id}">🔔 Сообщить о наличии</button>`}
    </div>
  </article>`;
}

const VISIBLE = 12;
let showAll = false;

function render() {
  let list = filtered();
  // если под фильтр ничего нет в наличии — не показываем пустоту, выводим «под заказ»
  let note = '';
  if (!list.length && state.stock) {
    state.stock = false;
    const alt = filtered();
    state.stock = true;
    if (alt.length) { list = alt; note = ' · нет в наличии, показаны под заказ'; }
  }
  const shown = showAll ? list : list.slice(0, VISIBLE);
  document.getElementById('found').textContent = `Найдено моделей: ${list.length}${note}`;
  document.getElementById('grid').innerHTML = shown.map(cardHTML).join('') ||
    '<p style="color:var(--mut)">Под выбранные фильтры моделей нет — попробуйте смягчить условия.</p>';
  wireCards(document.getElementById('grid'));

  const wrap = document.getElementById('showAllWrap');
  const btn = document.getElementById('showAllBtn');
  if (wrap && btn) {
    wrap.hidden = list.length <= VISIBLE;
    btn.innerHTML = showAll
      ? 'Свернуть каталог ↑'
      : `Показать все модели <b>(ещё ${list.length - VISIBLE})</b> ↓`;
  }
}

function toggleShowAll() {
  showAll = !showAll;
  render();
  if (!showAll) document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
}

/* ---------- обвязка карточек (клик/сравнение/уведомить/карусель фото) ---------- */
function wireCards(root) {
  if (!root) return;
  root.querySelectorAll('[data-cmp]').forEach(b => b.onclick = () => toggleCompare(b.dataset.cmp));
  root.querySelectorAll('[data-notify]').forEach(b => b.onclick = () => openNotify(b.dataset.notify));
  root.querySelectorAll('[data-open]').forEach(el => {
    el.onclick = () => openModel(el.dataset.open);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModel(el.dataset.open); } };
  });
  root.querySelectorAll('.card-img[data-gal]').forEach(box => {
    if (Number(box.dataset.gal) <= 1) return;
    const slides = [].slice.call(box.querySelectorAll('.cg-slide'));
    const cnt = box.querySelector('.cg-count');
    let i = 0;
    const show = n => { i = (n + slides.length) % slides.length; slides.forEach((s, k) => s.classList.toggle('on', k === i)); if (cnt) cnt.textContent = (i + 1) + '/' + slides.length; };
    const prev = box.querySelector('.cg-prev'), next = box.querySelector('.cg-next');
    if (prev) prev.addEventListener('click', e => { e.stopPropagation(); show(i - 1); });
    if (next) next.addEventListener('click', e => { e.stopPropagation(); show(i + 1); });
    let x0 = null;
    box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(dx < 0 ? i + 1 : i - 1); x0 = null; }, { passive: true });
  });
}

/* ---------- главная-витрина: ТОП-продаж, Новинки, окошки категорий ---------- */
const CAT_SLUG = { 'самокат': 'samokaty', 'велосипед': 'velosipedy', 'скутер': 'skutery', 'питбайк': 'pitbayki', 'трицикл': 'tricikly', 'квадроцикл': 'kvadrocikly', 'мотоцикл': 'motocikly' };
const CAT_ORDER = ['самокат', 'велосипед', 'скутер', 'питбайк', 'трицикл', 'квадроцикл', 'мотоцикл'];
function plModels(n) { return pluralRu(n, 'модель', 'модели', 'моделей'); }
function fillCarousel(trackId, list) {
  const el = document.getElementById(trackId);
  if (!el) return false;
  if (!list.length) return false;
  el.innerHTML = list.map(cardHTML).join('');
  wireCards(el);
  // стрелки прокрутки
  const car = el.closest('.vcar');
  if (car) {
    const prev = car.querySelector('.vcar-prev'), next = car.querySelector('.vcar-next');
    const step = () => Math.max(260, el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width + 16 : 300);
    if (prev) prev.onclick = () => el.scrollBy({ left: -step() * 2, behavior: 'smooth' });
    if (next) next.onclick = () => el.scrollBy({ left: step() * 2, behavior: 'smooth' });
  }
  return true;
}
function renderCatTiles() {
  const el = document.getElementById('catTiles');
  if (!el) return;
  const pool = CATALOG.filter(c => c.price && c.img);
  el.innerHTML = CAT_ORDER.map(cat => {
    const list = pool.filter(c => c.cat === cat);
    if (!list.length || !CAT_SLUG[cat]) return '';
    const rep = list.find(c => c.stock === 'in') || list[0];
    const label = (CATS.find(x => x[0] === cat) || [, cat])[1];
    return `<a class="cat-tile" href="katalog-${CAT_SLUG[cat]}.html">
      <div class="ct-img"><img loading="lazy" src="${rep.img}" alt="${label}"></div>
      <div class="ct-info"><div class="ct-name">${label}</div><div class="ct-count">${list.length} ${plModels(list.length)}</div></div>
    </a>`;
  }).join('');
}
function buildVitrina() {
  const pool = CATALOG.filter(c => c.price && c.img);
  // ТОП-продаж: хиты, добиваем по популярности до 8
  let top = pool.filter(c => c.hit);
  if (top.length < 6) {
    const extra = pool.filter(c => !c.hit).sort((a, b) => (b.pop || 0) - (a.pop || 0));
    top = top.concat(extra).slice(0, 10);
  }
  top.sort((a, b) => (b.pop || 0) - (a.pop || 0));
  fillCarousel('topSalesTrack', top.slice(0, 12));
  // Новинки
  const fresh = pool.filter(c => c.new);
  const okNew = fillCarousel('newModelsTrack', fresh);
  const newSec = document.getElementById('newModelsSec');
  if (newSec && !okNew) newSec.hidden = true;
  renderCatTiles();
}

/* ---------- сравнение ---------- */
function toggleCompare(id) {
  if (compare.has(id)) compare.delete(id);
  else if (compare.size >= 4) { alert('Максимум 4 модели в сравнении'); return; }
  else compare.add(id);
  localStorage.setItem('cmp', JSON.stringify([...compare]));
  syncCompareUI();
}
function syncCompareUI() {
  document.querySelectorAll('[data-cmp]').forEach(b => b.classList.toggle('on', compare.has(b.dataset.cmp)));
  const bar = document.getElementById('compareBar');
  const top = document.getElementById('topCompareBtn');
  bar.hidden = compare.size === 0;
  if (top) { top.hidden = compare.size === 0; document.getElementById('topCompareCnt').textContent = compare.size; }
  document.getElementById('compareChips').innerHTML = [...compare].map(id =>
    `<span class="cchip">${byId[id].name}<button data-rm="${id}">✕</button></span>`).join('');
  document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => toggleCompare(b.dataset.rm));
}
function compareRow(label, vals, { unit = '', better = 0, fmtFn = null } = {}) {
  // различие считаем без учёта регистра; в diff-строке лучшее значение лаймовое, остальные циановые
  const norm = vals.map(v => v == null ? '' : String(v).trim().toLowerCase());
  const isDiff = new Set(norm).size > 1;
  let best = null;
  const nums = vals.filter(v => typeof v === 'number');
  if (better !== 0 && nums.length) best = better > 0 ? Math.max(...nums) : Math.min(...nums);
  const tds = vals.map(v => {
    const txt = v == null || v === '' ? '—'
      : fmtFn ? fmtFn(v)
      : typeof v === 'number' ? fmt(v) + (unit ? ' ' + unit : '') : v;
    let cls = '';
    if (isDiff) cls = (best != null && v === best) ? 'cmp-best' : 'cmp-val-diff';
    return `<td class="${cls}">${txt}</td>`;
  }).join('');
  return { html: `<tr class="${isDiff ? 'cmp-diff' : ''}"><th>${label}</th>${tds}</tr>`, isDiff };
}

function compareTable(diffOnly) {
  const items = [...compare].map(id => byId[id]);
  if (!items.length) return '<p>Добавьте модели в сравнение.</p>';
  const cols = items.map(c => `<td><img src="${c.img}" alt="${c.name}" onerror="this.remove()"><div>${c.brand || 'Kugoo'} ${c.name}</div></td>`).join('');
  const stockTxt = { in: '✅ в наличии', opt: '🟣 только опт (от 10 шт)', wait: '⏳ ожидается', no: 'под заказ' };
  const rowsArr = [];
  rowsArr.push(compareRow('Цена', items.map(c => c.price), { better: -1, fmtFn: v => `<span class="cmp-price">${rub(v)}</span>` }));
  rowsArr.push(compareRow('Наличие', items.map(c => stockTxt[c.stock])));
  rowsArr.push(compareRow('Гарантия', items.map(c => c.warranty ? '12 мес + документы' : null)));
  for (const key of Object.keys(SPEC_LABELS)) {
    const [label, unit, better] = SPEC_LABELS[key];
    const vals = items.map(c => c.specs?.[key]);
    if (vals.every(v => v == null)) continue;
    rowsArr.push(compareRow(label, vals, { unit, better }));
  }
  const rows = rowsArr.filter(r => !diffOnly || r.isDiff).map(r => r.html).join('');
  return `<table class="cmp-table"><thead><tr><th></th>${cols}</tr></thead><tbody>${rows ||
    '<tr><td colspan="9" style="color:var(--mut)">Выбранные модели по заполненным характеристикам не различаются.</td></tr>'}</tbody></table>`;
}
const modal = document.getElementById('compareModal');
document.getElementById('openCompare').onclick = () => { drawCompare(); modal.hidden = false; };
const topBtn = document.getElementById('topCompareBtn');
if (topBtn) topBtn.onclick = () => { drawCompare(); modal.hidden = false; };
document.getElementById('closeCompare').onclick = () => modal.hidden = true;
function clearCompare() { compare.clear(); localStorage.setItem('cmp', '[]'); syncCompareUI(); }
document.getElementById('clearCompare').onclick = clearCompare;
document.getElementById('clearCompareModal').onclick = () => { clearCompare(); modal.hidden = true; };
document.getElementById('diffOnly').onchange = drawCompare;
modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
function drawCompare() {
  document.getElementById('compareTableWrap').innerHTML = compareTable(document.getElementById('diffOnly').checked);
}

/* ---------- модал заявки ---------- */
const leadModal = document.getElementById('leadModal');
// Бэкенд заявок — воркер neoride-bot (workers.dev доступен в РФ; форма работает и с GitHub Pages).
const LEAD_API = 'https://neoride-bot.amenshikov007.workers.dev/api/lead';
let orderCtx = {};
function pluralRu(n, a, b, c) {
  n = Math.abs(n) % 100; const d = n % 10;
  if (n > 10 && n < 20) return c;
  if (d > 1 && d < 5) return b;
  if (d === 1) return a;
  return c;
}
const TG_BOT = 'https://t.me/neoride_shop_bot';
// Настройка «обвязки» лид-модалки под режим (заявка / уведомление о наличии).
function setLeadChrome(o) {
  o = o || {};
  const title = document.getElementById('leadTitle');
  const intro = document.getElementById('leadIntro');
  const tg = document.getElementById('leadTg');
  const btn = document.getElementById('leadSubmit');
  const st = document.getElementById('leadStatus');
  if (title) title.textContent = o.title || 'Оставить заявку';
  if (intro) intro.textContent = o.intro || 'Оставьте контакт — ответим в течение 15 минут в рабочее время (09:00–21:00 МСК).';
  if (tg) { tg.textContent = o.tgText || 'Написать в Telegram'; tg.href = o.tgHref || TG_BOT; }
  if (btn) { btn.disabled = false; btn.textContent = o.submit || 'Отправить заявку'; }
  if (st) st.hidden = true;
}
function openLead(d) {
  d = d || {};
  orderCtx = {
    cart: false,
    modelId: d.order || '',
    model: d.name || '',
    stock: d.stock || '',
    warranty: d.warr === '1',
    src: d.src ? d.src.split(',').filter(Boolean) : [],
  };
  const line = document.getElementById('leadModelLine');
  document.getElementById('leadModel').value = orderCtx.model;
  if (orderCtx.model) { line.innerHTML = '🛒 ' + orderCtx.model; line.hidden = false; }
  else line.hidden = true;
  setLeadChrome();
  document.getElementById('leadForm').hidden = false;
  leadModal.hidden = false;
}
// Оформление корзины: тот же лид-модал, но со списком позиций. Заявка → менеджер
// подтверждает наличие/цену → присылает ссылку на оплату.
function openLeadCart() {
  const items = (window.neorideCart && window.neorideCart.get()) || [];
  if (!items.length) return;
  orderCtx = { cart: true, items };
  const n = items.reduce((s, i) => s + i.qty, 0);
  const tot = items.reduce((s, i) => s + i.price * i.qty, 0);
  const line = document.getElementById('leadModelLine');
  line.innerHTML = '🛒 Заказ: ' + n + ' ' + pluralRu(n, 'позиция', 'позиции', 'позиций') + ' · ориентир ' + rub(tot) +
    '<span class="lead-items">' + items.map(i => '• ' + i.name + ' ×' + i.qty).join('<br>') + '</span>';
  line.hidden = false;
  document.getElementById('leadModel').value = items.map(i => i.name + ' ×' + i.qty).join('; ');
  setLeadChrome();
  document.getElementById('leadForm').hidden = false;
  leadModal.hidden = false;
}
window.neorideOpenLeadCart = openLeadCart;
// «Сообщить о наличии» для моделей вне склада: подписка в Telegram-боте (бот сам напишет,
// как только модель перейдёт в наличие) либо контакт для ручного уведомления менеджером.
function openNotify(id) {
  const c = byId[id];
  orderCtx = { notify: true, modelId: id, model: c ? (c.brand || 'Kugoo') + ' ' + c.name : '' };
  const line = document.getElementById('leadModelLine');
  line.innerHTML = '🔔 Сообщить, когда появится: ' + orderCtx.model;
  line.hidden = false;
  document.getElementById('leadModel').value = orderCtx.model;
  setLeadChrome({
    title: 'Сообщить о наличии',
    intro: 'Подпишитесь — как только модель появится в наличии, бот сообщит первым. Или оставьте контакт, и менеджер уведомит вручную.',
    tgText: '🔔 Подписаться в Telegram',
    tgHref: TG_BOT + '?start=notify_' + id,
    submit: 'Уведомить меня',
  });
  document.getElementById('leadForm').hidden = false;
  leadModal.hidden = false;
}
window.neorideOpenNotify = openNotify;
// «купить в один клик» с карточки → лид-форма с этой моделью
document.addEventListener('click', e => {
  const b = e.target.closest('[data-order]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const c = byId[b.dataset.order];
  if (c) openLead({ order: c.id, name: (c.brand || 'Kugoo') + ' ' + c.name, stock: c.stock, warr: c.warranty ? '1' : '0', src: (c.src || []).join(',') });
});
if (leadModal) {
  document.getElementById('closeLead').onclick = () => leadModal.hidden = true;
  leadModal.onclick = e => { if (e.target === leadModal) leadModal.hidden = true; };
  const form = document.getElementById('leadForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('leadSubmit');
    const st = document.getElementById('leadStatus');
    const contact = document.getElementById('leadContact').value.trim();
    if (!contact) return;
    const consentEl = document.getElementById('leadConsent');
    if (consentEl && !consentEl.checked) {
      st.textContent = 'Отметьте согласие на обработку персональных данных, чтобы отправить заявку.';
      st.className = 'lead-status err'; st.hidden = false;
      return;
    }
    btn.disabled = true; btn.textContent = 'Отправляем…';
    const base = {
      name: document.getElementById('leadName').value,
      contact,
      consent: true,
      page: location.pathname,
      website: form.website.value,
    };
    const payload = orderCtx.notify
      ? { ...base, notify: true, model: orderCtx.model, modelId: orderCtx.modelId }
      : orderCtx.cart && orderCtx.items && orderCtx.items.length
      ? {
          ...base,
          items: orderCtx.items.map(i => ({
            id: i.id, name: i.name, qty: i.qty, price: i.price,
            stock: i.stock, warranty: i.warranty, src: i.src,
          })),
        }
      : {
          ...base,
          model: orderCtx.model || document.getElementById('leadModel').value,
          modelId: orderCtx.modelId,
          stock: orderCtx.stock,
          warranty: orderCtx.warranty,
          src: orderCtx.src,
        };
    try {
      const r = await fetch(LEAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        if (window.ymGoal) window.ymGoal(orderCtx.notify ? 'restock_sub' : orderCtx.cart ? 'cart_order' : 'lead');
        if (orderCtx.cart && window.neorideCart) window.neorideCart.clear();
        form.hidden = true;
        st.textContent = orderCtx.notify
          ? '✅ Готово! Сообщим, как только модель появится в наличии. Для мгновенного уведомления подпишитесь в Telegram кнопкой ниже.'
          : '✅ Заявка отправлена! Менеджер подтвердит наличие и итоговую цену и пришлёт ссылку на оплату — в течение 15 минут в рабочее время (09:00–21:00 МСК).';
        st.className = 'lead-status ok'; st.hidden = false;
      } else throw new Error();
    } catch (_) {
      btn.disabled = false; btn.textContent = 'Отправить заявку';
      st.textContent = '⚠ Не удалось отправить. Напишите нам в Telegram кнопкой ниже.';
      st.className = 'lead-status err'; st.hidden = false;
    }
  });
}

/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('vis')), { threshold: .12 });
document.querySelectorAll('[data-rev]').forEach(el => io.observe(el));

/* ---------- карточка модели (детали) ---------- */
function cleanDesc(s) {
  if (!s) return '';
  // подстраховка к пайплайну: режем продающий хвост и любые упоминания поставщика
  s = s.split(/Купить/i)[0];
  s = s
    .replace(/kugoo[\s-]?russia/gi, '')
    .replace(/официальн\w*\s+(магазин\w*|дилер\w*)/gi, '')
    .replace(/у нас на сайте/gi, '')
    .replace(/Честная гарантия[^.!?]*/gi, '')
    .replace(/Доставка по[^.!?]*/gi, '')
    .replace(/[☎️📞⭐️✔️✅♨️🔥»«]/g, '')
    .replace(/\+?\d[\d\s\-()]{8,}\d/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // обрезать незаконченное последнее предложение
  if (s && !/[.!?…]$/.test(s)) {
    const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf('!'), s.lastIndexOf('?'), s.lastIndexOf('…'));
    if (i > 30) s = s.slice(0, i + 1);
  }
  s = s.replace(/^[\s,.—-]+/, '').trim();
  return s.length < 40 ? '' : s;
}
const modelModal = document.getElementById('modelModal');
function openModel(id) {
  const c = byId[id];
  if (!c || !modelModal) return;
  document.getElementById('mmTitle').textContent = (c.brand || 'Kugoo') + ' ' + c.name;
  const s = c.specs || {};
  const rows = Object.keys(SPEC_LABELS).filter(k => {
    if (s[k] == null || s[k] === '') return false;
    if (k === 'drive' && !driveTxt(s[k])) return false;   // мусорный привод (40.92kg и т.п.) не показываем
    return true;
  }).map(k => {
    const [label, unit] = SPEC_LABELS[k];
    const v = k === 'drive' ? driveTxt(s[k]) : s[k];
    return `<tr><td>${label}</td><td>${v}${unit ? ' ' + unit : ''}</td></tr>`;
  }).join('');
  const gal = (c.gallery && c.gallery.length) ? c.gallery : (c.img ? [c.img] : []);
  const alt = (c.brand || 'Kugoo') + ' ' + c.name;
  const galHTML = gal.length ? `<div class="mm-img">${c.new ? '<span class="badge new">🆕 Новинка</span>' : ''}${c.hit ? '<span class="badge hit">🔥 ХИТ</span>' : ''}` +
    `<img id="mmGalImg" src="${gal[0]}" alt="${alt}">` +
    (gal.length > 1 ? `<button class="mm-nav mm-prev" id="mmPrev" aria-label="Назад">‹</button>` +
      `<button class="mm-nav mm-next" id="mmNext" aria-label="Вперёд">›</button>` +
      `<div class="mm-counter" id="mmCounter">1 / ${gal.length}</div>` : '') + `</div>` : '';
  const warr = c.warranty ? '<div class="warr">✓ Гарантия 12 мес · документы</div>' : '';
  // Гарантию и «товарный чек / гарантийный талон» показываем ТОЛЬКО для гарантийных моделей (склад).
  // Для остальных — без гарантии производителя и без гарантийного талона (учтено в цене).
  const kitRows = c.warranty
    ? '<tr><td>Гарантия</td><td>12 мес (АКБ и контроллер — 3 мес)</td></tr>' +
      '<tr><td>Комплектация</td><td>Товарный чек, гарантийный талон, зарядное устройство</td></tr>'
    : '<tr><td>Гарантия</td><td>Без гарантии производителя (учтено в цене)</td></tr>' +
      '<tr><td>Комплектация</td><td>Зарядное устройство</td></tr>';
  const desc = cleanDesc(c.desc);
  document.getElementById('mmBody').innerHTML =
    galHTML +
    `<div class="mm-price">${rub(c.price)}<small>розница</small></div>` + warr +
    `<table class="mm-specs">${rows}${kitRows}</table>` +
    (desc ? `<p class="mm-desc">${desc}</p>` : '') +
    `<div class="mm-actions">
       <button class="btn btn-accent" data-addcart="${c.id}">🛒 В корзину</button>
       <button class="btn" id="mmOrder">Купить в один клик</button>
       <a class="btn lead-tg" href="https://t.me/neoride_shop_bot" target="_blank" rel="noopener">Написать в Telegram</a>
     </div>`;
  if (gal.length > 1) {
    let gi = 0;
    const gimg = document.getElementById('mmGalImg');
    const show = () => { gimg.src = gal[gi]; document.getElementById('mmCounter').textContent = (gi + 1) + ' / ' + gal.length; };
    document.getElementById('mmPrev').onclick = () => { gi = (gi - 1 + gal.length) % gal.length; show(); };
    document.getElementById('mmNext').onclick = () => { gi = (gi + 1) % gal.length; show(); };
    let sx = 0;
    gimg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    gimg.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { gi = (gi + (dx < 0 ? 1 : -1) + gal.length) % gal.length; show(); }
    }, { passive: true });
  }
  document.getElementById('mmOrder').onclick = () => {
    modelModal.hidden = true;
    openLead({ order: c.id, name: (c.brand || 'Kugoo') + ' ' + c.name, stock: c.stock, warr: c.warranty ? '1' : '0', src: (c.src || []).join(',') });
  };
  modelModal.hidden = false;
}
if (modelModal) {
  document.getElementById('mmClose').onclick = () => modelModal.hidden = true;
  modelModal.onclick = e => { if (e.target === modelModal) modelModal.hidden = true; };
}
// для чат-консультанта: открыть карточку модели по ссылке из ответа
window.neorideOpenModel = openModel;

const showAllBtn = document.getElementById('showAllBtn');
if (showAllBtn) showAllBtn.onclick = toggleShowAll;

// бренд-навигация по ссылке: #brand-kugoo / #brand-aovo (из шапки и других страниц)
function applyBrandFromHash(rerender) {
  const m = (location.hash || '').match(/^#brand-(.+)$/);
  if (!m) return;
  const want = decodeURIComponent(m[1]).toLowerCase();
  const match = CATALOG.map(c => c.brand || 'Kugoo').find(b => b.toLowerCase() === want);
  if (!match) return;
  state.brand = match; showAll = false;
  const be = document.getElementById('brandTabs');
  if (be) be.querySelectorAll('.series-tab').forEach(x => x.classList.toggle('active', x.textContent === match));
  if (rerender) render();
  const el = document.getElementById('catalog');
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 60);
}
applyBrandFromHash(false);
window.addEventListener('hashchange', () => applyBrandFromHash(true));

// Режим страницы: с замком (бренд/категория) — листинг с фильтрами; без замка — главная-витрина.
if (LOCK) {
  // листинг бренда/категории: прячем витрину и сторителлинг главной, оставляем каталог
  ['vitrina', 'flagship', 'scen', 'cinema'].forEach(id => { const e = document.getElementById(id); if (e) e.hidden = true; });
  if (CAT_LOCK) {
    const label = (CATS.find(x => x[0] === CAT_LOCK) || [, CAT_LOCK])[1];
    const h = document.getElementById('catTitle'); if (h) h.innerHTML = label + ' <span class="g">Kugoo и AOVO</span>';
  }
  render();
} else {
  // главная-витрина; при сбое — фолбэк на обычный каталог, чтобы магазин не остался пустым
  try {
    const cat = document.getElementById('catalog'); if (cat) cat.hidden = true;
    // #scen на главной оставляем — это секция квиза «Подберём за 15 секунд»
    buildVitrina();
  } catch (e) {
    const v = document.getElementById('vitrina'); if (v) v.hidden = true;
    const cat = document.getElementById('catalog'); if (cat) cat.hidden = false;
    const scen = document.getElementById('scen'); if (scen) scen.hidden = false;
    render();
  }
}
syncCompareUI();

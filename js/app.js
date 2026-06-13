/* NEORIDE — каталог, фильтры, сценарии подбора, сравнение. Без зависимостей. */
'use strict';

const CATS = [
  ['all', 'Все'], ['самокат', 'Самокаты'], ['скутер', 'Скутеры'], ['трицикл', 'Трициклы'],
  ['велосипед', 'Велосипеды'], ['питбайк', 'Питбайки'], ['бензо', 'Бензо'],
];
const SCENARIOS = [
  ['🏙', 'Город', c => c.cat === 'самокат' && (c.specs.speed || 99) <= 35 && (c.specs.weight || 0) <= 20],
  ['🛣', 'Дальние поездки', c => (c.specs.range || 0) >= 55],
  ['⛰', 'Бездорожье', c => (c.specs.power || 0) >= 1000],
  ['📦', 'Курьерам', c => (c.cat === 'велосипед' || c.cat === 'трицикл') && (c.specs.range || 0) >= 40],
  ['🪶', 'Лёгкие', c => (c.specs.weight || 99) <= 16],
  ['🏁', 'Максимум скорости', c => (c.specs.speed || 0) >= 60],
];
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
};
const fmt = n => n == null ? '—' : Number(n).toLocaleString('ru-RU');
const rub = n => n == null ? '—' : fmt(n) + ' ₽';

let state = { cat: 'all', series: 'all', stock: false, opt: false, hit: false, price: 'all', speed: 'all', age: 'all', scen: null, sort: 'pop' };

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
  const b = document.createElement('button');
  b.className = 'cat-tab' + (key === state.cat ? ' active' : '');
  b.textContent = label;
  b.onclick = () => { state.cat = key; document.querySelectorAll('.cat-tab').forEach(x => x.classList.remove('active')); b.classList.add('active'); render(); };
  tabsEl.appendChild(b);
});
// чипы серий — все семейства, по убыванию числа моделей
const seriesEl = document.getElementById('seriesTabs');
if (seriesEl) {
  const cnt = {};
  CATALOG.filter(c => c.price && c.img).forEach(c => { const s = seriesOf(c); cnt[s] = (cnt[s] || 0) + 1; });
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
document.getElementById('onlyOpt').onchange = e => { state.opt = e.target.checked; render(); };
document.getElementById('onlyHit').onchange = e => { state.hit = e.target.checked; render(); };
document.getElementById('sortSel').onchange = e => { state.sort = e.target.value; render(); };

const scenRow = document.getElementById('scenRow');
SCENARIOS.forEach(([icon, label, pred], i) => {
  const b = document.createElement('button');
  b.className = 'scen-chip';
  b.innerHTML = `${icon} ${label}`;
  b.onclick = () => {
    state.scen = state.scen === i ? null : i;
    scenRow.querySelectorAll('.scen-chip').forEach((x, j) => x.classList.toggle('active', state.scen === j));
    render();
    document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
  };
  scenRow.appendChild(b);
});

function inBand(v, band) {
  if (band === 'all') return true;
  if (v == null) return false;
  const [lo, hi] = band.split('-').map(Number);
  return v >= lo * 1 && v <= hi * 1;
}

function filtered() {
  let list = CATALOG.filter(c => c.price && c.img);
  if (state.cat !== 'all') list = list.filter(c => c.cat === state.cat);
  if (state.series !== 'all') list = list.filter(c => seriesOf(c) === state.series);
  if (state.stock) list = list.filter(c => c.stock === 'in');
  if (state.opt) list = list.filter(c => c.stock === 'opt');
  if (state.hit) list = list.filter(c => c.hit);
  if (state.age !== 'all') list = list.filter(AGE_PRED[state.age]);
  list = list.filter(c => inBand(c.price / 1000, state.price));
  list = list.filter(c => state.speed === 'all' || inBand(c.specs.speed, state.speed));
  if (state.scen != null) list = list.filter(SCENARIOS[state.scen][2]);
  const s = state.sort;
  if (s === 'pop') list.sort((a, b) => (b.pop - a.pop) || (b.stock === 'in') - (a.stock === 'in'));
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
  const img = c.img ? `<img loading="lazy" src="${c.img}" alt="${c.brand || 'Kugoo'} ${c.name}">` : '<span class="noimg">фото скоро</span>';
  const on = compare.has(c.id) ? ' on' : '';
  const optNote = c.stock === 'opt' ? '<div class="opt-note">Оптовая позиция (от 10 шт) — наличие уточняйте; без гарантии производителя</div>' : '';
  const warr = c.warranty ? '<div class="warr">✓ Гарантия 12 мес · документы</div>' : '';
  const badges = (c.hit ? '<span class="badge hit">🔥 ХИТ</span>' : '') + BADGE[c.stock];
  return `<article class="card" data-id="${c.id}">
    <div class="card-img" data-open="${c.id}" role="button" tabindex="0" title="Подробнее"><div class="badges">${badges}</div>${img}</div>
    <div class="card-body">
      <div class="card-name" data-open="${c.id}">${c.brand || 'Kugoo'} ${c.name}</div>
      <div class="card-specs">${chips}</div>
      ${warr}${optNote}
      <div class="card-foot">
        <div class="price">${rub(c.price)}<small>розница</small></div>
        <button class="cmp-toggle${on}" data-cmp="${c.id}" title="Добавить к сравнению">⚖ Сравнить</button>
      </div>
      <button class="btn btn-accent card-order" data-order="${c.id}" data-name="${c.brand || 'Kugoo'} ${c.name}" data-stock="${c.stock}" data-warr="${c.warranty ? 1 : 0}" data-src="${(c.src || []).join(',')}">Заказать</button>
    </div>
  </article>`;
}

const VISIBLE = 12;
let showAll = false;

function render() {
  const list = filtered();
  const shown = showAll ? list : list.slice(0, VISIBLE);
  document.getElementById('found').textContent = `Найдено моделей: ${list.length}`;
  document.getElementById('grid').innerHTML = shown.map(cardHTML).join('') ||
    '<p style="color:var(--mut)">Под выбранные фильтры моделей нет — попробуйте смягчить условия.</p>';
  document.querySelectorAll('[data-cmp]').forEach(b => b.onclick = () => toggleCompare(b.dataset.cmp));
  document.querySelectorAll('[data-order]').forEach(b => b.onclick = () => openLead(b.dataset));
  document.querySelectorAll('[data-open]').forEach(el => {
    el.onclick = () => openModel(el.dataset.open);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModel(el.dataset.open); } };
  });

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
function openLead(d) {
  d = d || {};
  orderCtx = {
    modelId: d.order || '',
    model: d.name || '',
    stock: d.stock || '',
    warranty: d.warr === '1',
    src: d.src ? d.src.split(',').filter(Boolean) : [],
  };
  const line = document.getElementById('leadModelLine');
  document.getElementById('leadModel').value = orderCtx.model;
  if (orderCtx.model) { line.textContent = '🛒 ' + orderCtx.model; line.hidden = false; }
  else line.hidden = true;
  const st = document.getElementById('leadStatus');
  if (st) { st.hidden = true; }
  document.getElementById('leadForm').hidden = false;
  leadModal.hidden = false;
}
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
    const payload = {
      name: document.getElementById('leadName').value,
      contact,
      consent: true,
      model: orderCtx.model || document.getElementById('leadModel').value,
      modelId: orderCtx.modelId,
      stock: orderCtx.stock,
      warranty: orderCtx.warranty,
      src: orderCtx.src,
      page: location.pathname,
      website: form.website.value,
    };
    try {
      const r = await fetch(LEAD_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        form.hidden = true;
        st.textContent = '✅ Заявка отправлена! Свяжемся в течение 15 минут в рабочее время.';
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
  const galHTML = gal.length ? `<div class="mm-img">${c.hit ? '<span class="badge hit">🔥 ХИТ</span>' : ''}` +
    `<img id="mmGalImg" src="${gal[0]}" alt="${alt}">` +
    (gal.length > 1 ? `<button class="mm-nav mm-prev" id="mmPrev" aria-label="Назад">‹</button>` +
      `<button class="mm-nav mm-next" id="mmNext" aria-label="Вперёд">›</button>` +
      `<div class="mm-counter" id="mmCounter">1 / ${gal.length}</div>` : '') + `</div>` : '';
  const warr = c.warranty ? '<div class="warr">✓ Гарантия 12 мес · документы</div>' : '';
  const desc = cleanDesc(c.desc);
  document.getElementById('mmBody').innerHTML =
    galHTML +
    `<div class="mm-price">${rub(c.price)}<small>розница</small></div>` + warr +
    (rows ? `<table class="mm-specs">${rows}</table>` : '') +
    (desc ? `<p class="mm-desc">${desc}</p>` : '') +
    `<div class="mm-actions">
       <button class="btn btn-accent" id="mmOrder">Заказать</button>
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

const showAllBtn = document.getElementById('showAllBtn');
if (showAllBtn) showAllBtn.onclick = toggleShowAll;

render();
syncCompareUI();

/* NEORIDE опт-страница: калькулятор прибыли. */
'use strict';

const fmt = n => n == null ? '—' : Number(n).toLocaleString('ru-RU');
const rub = n => n == null ? '—' : fmt(n) + ' ₽';
const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const LEAD_API = 'https://neoride-bot.amenshikov007.workers.dev/api/lead';

const STOCK_MARK = { in: '✅', opt: '🟣 уточнить наличие', wait: '⏳' };
const FMT_LABEL = { in: 'от 3 шт', opt: 'от 10 шт' };
const optList = CATALOG.filter(c => c.opt && c.price && (c.stock === 'in' || c.stock === 'opt'))
  .sort((a, b) => a.price - b.price);

// --- Выпадающий список (без розницы; подписан форматом + наличие) ---
const calcModel = document.getElementById('calcModel');
const CALC_GROUPS = [['самокат', 'Самокаты'], ['велосипед', 'Велосипеды'], ['скутер', 'Скутеры'],
  ['трицикл', 'Трициклы'], ['питбайк', 'Питбайки'], ['бензо', 'Бензо']];
calcModel.innerHTML = CALC_GROUPS.map(([key, label]) => {
  const items = optList.filter(c => c.cat === key);
  if (!items.length) return '';
  return `<optgroup label="${label}">` + items.map(c =>
    `<option value="${c.id}">Kugoo ${c.name} — ${FMT_LABEL[c.stock] || ''} ${STOCK_MARK[c.stock] || ''}</option>`).join('') + '</optgroup>';
}).join('');

// --- Калькулятор: несколько моделей + количество вручную ---
const calcRows = document.getElementById('calcRows');
let cart = [];
const defQty = c => (c.stock === 'in' ? 3 : 10);
const totalProfit = () => cart.reduce((s, it) => { const c = byId[it.id]; return c ? s + (c.price - c.opt) * it.qty : s; }, 0);

function calcRender() {
  calcRows.innerHTML = cart.map(it => {
    const c = byId[it.id]; if (!c) return '';
    return `<div class="calc-item" data-id="${it.id}">
      <span class="ci-name">Kugoo ${c.name}<small>${FMT_LABEL[c.stock] || ''}</small></span>
      <input class="ci-qty" type="number" inputmode="numeric" min="1" max="1000" value="${it.qty}" data-id="${it.id}" aria-label="Количество, шт">
      <span class="ci-profit">+${fmt((c.price - c.opt) * it.qty)} ₽</span>
      <button class="ci-del" type="button" data-id="${it.id}" aria-label="Убрать">✕</button>
    </div>`;
  }).join('') || '<p class="calc-empty">Добавьте модели, чтобы посчитать прибыль.</p>';
  document.getElementById('calcTotal').textContent = cart.length ? rub(totalProfit()) : '—';
  calcRows.querySelectorAll('.ci-qty').forEach(inp => inp.oninput = () => {
    const v = Math.max(1, Math.min(1000, parseInt(inp.value, 10) || 1));
    const it = cart.find(x => x.id === inp.dataset.id);
    if (it) it.qty = v;
    const c = byId[inp.dataset.id];
    inp.closest('.calc-item').querySelector('.ci-profit').textContent = '+' + fmt((c.price - c.opt) * v) + ' ₽';
    document.getElementById('calcTotal').textContent = rub(totalProfit());
  });
  calcRows.querySelectorAll('.ci-del').forEach(b => b.onclick = () => { cart = cart.filter(x => x.id !== b.dataset.id); calcRender(); });
}

document.getElementById('calcAdd').onclick = () => {
  const id = calcModel.value;
  if (!id || cart.some(x => x.id === id)) return;
  cart.push({ id, qty: defQty(byId[id]) });
  calcRender();
};

const calcDef = optList.find(c => /M4 Pro/i.test(c.name)) || optList[0];
if (calcDef) { cart.push({ id: calcDef.id, qty: defQty(calcDef) }); calcModel.value = calcDef.id; }
calcRender();

const leadModal = document.getElementById('leadModal');
document.getElementById('optRequest').onclick = e => {
  e.preventDefault();
  const txt = cart.map(it => { const c = byId[it.id]; return c ? `Kugoo ${c.name} x${it.qty}` : ''; }).filter(Boolean).join(', ');
  document.getElementById('leadModel').value = txt || 'Оптовая заявка';
  leadModal.hidden = false;
};
document.getElementById('closeLead').onclick = () => leadModal.hidden = true;
leadModal.onclick = e => { if (e.target === leadModal) leadModal.hidden = true; };

const leadForm = document.getElementById('leadForm');
leadForm.addEventListener('submit', async e => {
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
    model: document.getElementById('leadModel').value,
    page: 'opt',
    website: leadForm.website.value,
  };
  try {
    const r = await fetch(LEAD_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      leadForm.hidden = true;
      st.textContent = '✅ Заявка отправлена! Подтвердим наличие и пришлём счёт в рабочее время.';
      st.className = 'lead-status ok'; st.hidden = false;
    } else throw new Error();
  } catch (_) {
    btn.disabled = false; btn.textContent = 'Запросить счёт';
    st.textContent = '⚠ Не удалось отправить. Напишите нам в Telegram кнопкой ниже.';
    st.className = 'lead-status err'; st.hidden = false;
  }
});

// --- Хелперы карточки/модалки (порт из app.js) ---
const SPEC_LABELS = {
  power: ['Мощность', 'Вт'], volt: ['Напряжение', 'В'], battery_ah: ['Батарея', 'А·ч'],
  speed: ['Макс. скорость', 'км/ч'], range: ['Запас хода', 'км'], load: ['Макс. нагрузка', 'кг'],
  weight: ['Вес', 'кг'], wheel: ['Колёса', '"'], charge: ['Зарядка', 'ч'],
  brakes: ['Тормоза', ''], drive: ['Привод', ''],
  box: ['Размер коробки', ''], gross: ['Вес с упаковкой', 'кг'],
};
function driveTxt(d) {
  if (!d) return null; d = String(d).toLowerCase();
  if (d.includes('полн')) return 'полный привод';
  if (d.includes('перед')) return 'передний привод';
  if (d.includes('задн')) return 'задний привод';
  if (d.includes('центр')) return 'центральный мотор';
  return null;
}
function cleanDesc(s) {
  if (!s) return '';
  s = s.split(/Купить/i)[0]
    .replace(/kugoo[\s-]?russia/gi, '').replace(/официальн\w*\s+(магазин\w*|дилер\w*)/gi, '')
    .replace(/Честная гарантия[^.!?]*/gi, '').replace(/[☎️📞⭐️✔️✅♨️🔥»«]/g, '')
    .replace(/\+?\d[\d\s\-()]{8,}\d/g, '').replace(/\s{2,}/g, ' ').trim();
  return s.length < 40 ? '' : s;
}

// --- Оптовый каталог карточками ---
const OPT_CATS = [['all', 'Все'], ['самокат', 'Самокаты'], ['велосипед', 'Велосипеды'],
  ['скутер', 'Скутеры'], ['трицикл', 'Трициклы'], ['питбайк', 'Питбайки'],
  ['квадроцикл', 'Квадроциклы'], ['бензо', 'Бензо']];
const OPT_FMT = [['all', 'Все форматы'], ['in', 'Гарантия · от 3 шт'], ['opt', 'Мин. цена · от 10 шт']];
const optGrid = document.getElementById('optGrid');
const optTabs = document.getElementById('optTabs');
const optFormat = document.getElementById('optFormat');
let optCat = 'all', optFmt = 'all', showAllOpt = false;
const OPT_VISIBLE = 8;

function optCardHTML(c) {
  const s = c.specs || {};
  const chips = [
    s.speed ? `⚡ ${s.speed} км/ч` : null,
    s.range ? `🛣 ${s.range} км` : null,
    s.power ? `🔋 ${fmt(s.power)} Вт` : null,
    s.weight ? `⚖ ${s.weight} кг` : null,
  ].filter(Boolean).map(t => `<span class="spec-chip">${t}</span>`).join('');
  const img = c.img ? `<img loading="lazy" src="${c.img}" alt="Kugoo ${c.name}">` : '<span class="noimg">фото скоро</span>';
  const badges = (c.hit ? '<span class="badge hit">🔥 ХИТ</span>' : '') +
    (c.stock === 'in'
      ? '<span class="badge in">от 3 шт · гарантия</span>'
      : '<span class="badge opt">от 10 шт · мин. цена</span>');
  return `<article class="card">
    <div class="card-img" data-open="${c.id}" role="button" tabindex="0" title="Подробнее"><div class="badges">${badges}</div>${img}</div>
    <div class="card-body">
      <div class="card-name" data-open="${c.id}">Kugoo ${c.name}</div>
      <div class="card-specs">${chips}</div>
      <div class="card-foot">
        <div class="price">${rub(c.opt)}<small>опт за шт</small></div>
        <div class="opt-retail">розница ${rub(c.price)}</div>
      </div>
      <button class="btn btn-accent" data-opt="${c.id}" data-name="Kugoo ${c.name}">Запросить счёт</button>
    </div>
  </article>`;
}

// --- Модалка модели с галереей ---
const modelModal = document.getElementById('modelModal');
function openOptModel(id) {
  const c = byId[id];
  if (!c || !modelModal) return;
  document.getElementById('mmTitle').textContent = 'Kugoo ' + c.name;
  const s = c.specs || {};
  const rows = Object.keys(SPEC_LABELS).filter(k => {
    if (s[k] == null || s[k] === '') return false;
    if (k === 'drive' && !driveTxt(s[k])) return false;
    return true;
  }).map(k => {
    const [label, unit] = SPEC_LABELS[k];
    const v = k === 'drive' ? driveTxt(s[k]) : s[k];
    return `<tr><td>${label}</td><td>${v}${unit ? ' ' + unit : ''}</td></tr>`;
  }).join('');
  const gal = (c.gallery && c.gallery.length) ? c.gallery : (c.img ? [c.img] : []);
  const alt = 'Kugoo ' + c.name;
  const galHTML = gal.length ? `<div class="mm-img">${c.hit ? '<span class="badge hit">🔥 ХИТ</span>' : ''}` +
    `<img id="mmGalImg" src="${gal[0]}" alt="${alt}">` +
    (gal.length > 1 ? `<button class="mm-nav mm-prev" id="mmPrev" aria-label="Назад">‹</button>` +
      `<button class="mm-nav mm-next" id="mmNext" aria-label="Вперёд">›</button>` +
      `<div class="mm-counter" id="mmCounter">1 / ${gal.length}</div>` : '') + `</div>` : '';
  const fmtRow = c.stock === 'in'
    ? '<tr><td>Опт-формат</td><td>от 3 шт · гарантия 12 мес + документы</td></tr>'
    : '<tr><td>Опт-формат</td><td>от 10 шт одной модели · минимальная цена · без гарантии</td></tr>';
  const desc = cleanDesc(c.desc);
  document.getElementById('mmBody').innerHTML =
    galHTML +
    `<div class="mm-price">${rub(c.opt)}<small>опт за шт · розница ${rub(c.price)}</small></div>` +
    `<table class="mm-specs">${rows}${fmtRow}</table>` +
    (desc ? `<p class="mm-desc">${desc}</p>` : '') +
    `<div class="mm-actions">
       <button class="btn btn-accent" id="mmOrder">Запросить счёт</button>
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
    document.getElementById('leadModel').value = 'Kugoo ' + c.name;
    leadModal.hidden = false;
  };
  modelModal.hidden = false;
}
if (modelModal) {
  document.getElementById('mmClose').onclick = () => modelModal.hidden = true;
  modelModal.onclick = e => { if (e.target === modelModal) modelModal.hidden = true; };
}

function renderOpt() {
  if (!optGrid) return;
  const list = optList.filter(c => (optCat === 'all' || c.cat === optCat) && (optFmt === 'all' || c.stock === optFmt));
  const shown = showAllOpt ? list : list.slice(0, OPT_VISIBLE);
  optGrid.innerHTML = shown.map(optCardHTML).join('') || '<p class="sec-sub">В этой категории пока нет позиций.</p>';
  optGrid.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => {
    document.getElementById('leadModel').value = b.dataset.name;
    leadModal.hidden = false;
  });
  optGrid.querySelectorAll('[data-open]').forEach(el => {
    el.onclick = () => openOptModel(el.dataset.open);
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOptModel(el.dataset.open); } };
  });
  const wrap = document.getElementById('optShowAllWrap'), btn = document.getElementById('optShowAll');
  if (wrap && btn) {
    if (list.length > OPT_VISIBLE) {
      wrap.hidden = false;
      btn.textContent = showAllOpt ? 'Свернуть ↑' : `Показать все (ещё ${list.length - OPT_VISIBLE}) ↓`;
    } else { wrap.hidden = true; }
  }
}
{
  const sb = document.getElementById('optShowAll');
  if (sb) sb.onclick = () => { showAllOpt = !showAllOpt; renderOpt(); };
}

if (optFormat) {
  optFormat.innerHTML = OPT_FMT.map(([k, l]) => `<button class="cat-tab${k === 'all' ? ' active' : ''}" data-optfmt="${k}">${l}</button>`).join('');
  optFormat.querySelectorAll('[data-optfmt]').forEach(b => b.onclick = () => {
    optFmt = b.dataset.optfmt; showAllOpt = false;
    optFormat.querySelectorAll('.cat-tab').forEach(x => x.classList.toggle('active', x.dataset.optfmt === optFmt));
    renderOpt();
  });
}
if (optTabs) {
  optTabs.innerHTML = OPT_CATS.filter(([k]) => k === 'all' || optList.some(c => c.cat === k))
    .map(([k, l]) => `<button class="cat-tab${k === 'all' ? ' active' : ''}" data-optcat="${k}">${l}</button>`).join('');
  optTabs.querySelectorAll('[data-optcat]').forEach(b => b.onclick = () => {
    optCat = b.dataset.optcat; showAllOpt = false;
    optTabs.querySelectorAll('.cat-tab').forEach(x => x.classList.toggle('active', x.dataset.optcat === optCat));
    renderOpt();
  });
}
renderOpt();

const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('vis')), { threshold: .12 });
document.querySelectorAll('[data-rev]').forEach(el => io.observe(el));

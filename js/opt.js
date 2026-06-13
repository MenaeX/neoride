/* NEORIDE опт-страница: калькулятор прибыли. */
'use strict';

const fmt = n => n == null ? '—' : Number(n).toLocaleString('ru-RU');
const rub = n => n == null ? '—' : fmt(n) + ' ₽';
const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const LEAD_API = 'https://neoride-bot.amenshikov007.workers.dev/api/lead';

const calcModel = document.getElementById('calcModel');
const STOCK_MARK = { in: '✅', opt: '🟣 уточнить наличие', wait: '⏳' };
const optList = CATALOG.filter(c => c.opt && c.price && (c.stock === 'in' || c.stock === 'opt'))
  .sort((a, b) => a.price - b.price);

const groups = [['самокат', 'Самокаты'], ['скутер', 'Скутеры'], ['трицикл', 'Трициклы'],
  ['велосипед', 'Велосипеды'], ['питбайк', 'Питбайки'], ['бензо', 'Бензо']];
calcModel.innerHTML = groups.map(([key, label]) => {
  const items = optList.filter(c => c.cat === key);
  if (!items.length) return '';
  return `<optgroup label="${label}">` + items.map(c =>
    `<option value="${c.id}">Kugoo ${c.name} — розница ${fmt(c.price)} ₽ ${STOCK_MARK[c.stock] || ''}</option>`).join('') + '</optgroup>';
}).join('');

const def = optList.find(c => /M4 Pro/i.test(c.name)) || optList[0];
if (def) calcModel.value = def.id;

function calc() {
  const c = byId[calcModel.value];
  if (!c) return;
  const qty = Math.max(10, Math.min(100, +document.getElementById('calcQty').value || 10));
  document.getElementById('calcQty').value = qty;
  const unit = c.price - c.opt;
  document.getElementById('calcOpt').textContent = rub(c.opt);
  document.getElementById('calcRetail').textContent = rub(c.price);
  document.getElementById('calcUnit').textContent = rub(unit);
  document.getElementById('calcTotal').textContent = rub(unit * qty);
}
calcModel.onchange = calc;
document.getElementById('calcQty').oninput = calc;
calc();

const leadModal = document.getElementById('leadModal');
document.getElementById('optRequest').onclick = e => { e.preventDefault(); leadModal.hidden = false; };
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

// --- Оптовый каталог карточками ---
const OPT_CATS = [['all', 'Все'], ['самокат', 'Самокаты'], ['велосипед', 'Велосипеды'],
  ['скутер', 'Скутеры'], ['трицикл', 'Трициклы'], ['питбайк', 'Питбайки'],
  ['квадроцикл', 'Квадроциклы'], ['бензо', 'Бензо']];
const optGrid = document.getElementById('optGrid');
const optTabs = document.getElementById('optTabs');
let optCat = 'all';

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
    (c.stock === 'in' ? '<span class="badge">склад · гарантия</span>' : '');
  return `<article class="card">
    <div class="card-img"><div class="badges">${badges}</div>${img}</div>
    <div class="card-body">
      <div class="card-name">Kugoo ${c.name}</div>
      <div class="card-specs">${chips}</div>
      <div class="card-foot">
        <div class="price">${rub(c.opt)}<small>опт за шт</small></div>
        <div class="opt-retail">розница ${rub(c.price)}</div>
      </div>
      <button class="btn btn-accent" data-opt="${c.id}" data-name="Kugoo ${c.name}">Запросить счёт</button>
    </div>
  </article>`;
}

function renderOpt() {
  if (!optGrid) return;
  const list = optList.filter(c => optCat === 'all' || c.cat === optCat);
  optGrid.innerHTML = list.map(optCardHTML).join('') || '<p class="sec-sub">В этой категории пока нет позиций.</p>';
  optGrid.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => {
    document.getElementById('leadModel').value = b.dataset.name;
    leadModal.hidden = false;
  });
}

if (optTabs) {
  optTabs.innerHTML = OPT_CATS.filter(([k]) => k === 'all' || optList.some(c => c.cat === k))
    .map(([k, l]) => `<button class="cat-tab${k === 'all' ? ' active' : ''}" data-optcat="${k}">${l}</button>`).join('');
  optTabs.querySelectorAll('[data-optcat]').forEach(b => b.onclick = () => {
    optCat = b.dataset.optcat;
    optTabs.querySelectorAll('.cat-tab').forEach(x => x.classList.toggle('active', x.dataset.optcat === optCat));
    renderOpt();
  });
}
renderOpt();

const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('vis')), { threshold: .12 });
document.querySelectorAll('[data-rev]').forEach(el => io.observe(el));

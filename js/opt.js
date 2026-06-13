/* NEORIDE опт-страница: калькулятор прибыли. */
'use strict';

const fmt = n => n == null ? '—' : Number(n).toLocaleString('ru-RU');
const rub = n => n == null ? '—' : fmt(n) + ' ₽';
const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));

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
  if (window.NEORIDE_TG_ONLY) {
    leadForm.hidden = true;
    st.textContent = '✅ Открываем Telegram — напишите нам там, подтвердим наличие и пришлём счёт.';
    st.className = 'lead-status ok'; st.hidden = false;
    window.open('https://t.me/neoride_shop_bot', '_blank', 'noopener');
    return;
  }
  btn.disabled = true; btn.textContent = 'Отправляем…';
  const payload = {
    name: document.getElementById('leadName').value,
    contact,
    model: document.getElementById('leadModel').value,
    page: 'opt',
    website: leadForm.website.value,
  };
  try {
    const r = await fetch('/api/lead', {
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

const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('vis')), { threshold: .12 });
document.querySelectorAll('[data-rev]').forEach(el => io.observe(el));

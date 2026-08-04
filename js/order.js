/* NEORIDE — оформление заявки для страниц без app.js (напр. витрина AOVO).
   Использует те же модалки (#leadModal/#cartModal) и тот же воркер, что и каталог Kugoo.
   Корзину рисует cart.js; здесь — чекаут (neorideOpenLeadCart) + «купить в один клик» (data-order). */
'use strict';
(function () {
  var LEAD_API = 'https://neoride-bot.amenshikov007.workers.dev/api/lead';
  var TG_BOT = 'https://t.me/neoride_shop_bot';
  var leadModal = document.getElementById('leadModal');
  if (!leadModal) return;
  var orderCtx = {};

  function rub(n) { return (n == null ? '—' : Number(n).toLocaleString('ru-RU')) + ' ₽'; }
  function pluralRu(n, a, b, c) {
    n = Math.abs(n) % 100; var d = n % 10;
    if (n > 10 && n < 20) return c;
    if (d > 1 && d < 5) return b;
    if (d === 1) return a;
    return c;
  }
  function chrome() {
    var t = document.getElementById('leadTitle'); if (t) t.textContent = 'Оставить заявку';
    var intro = document.getElementById('leadIntro'); if (intro) intro.textContent = 'Оставьте контакт — ответим в течение 15 минут в рабочее время (09:00–21:00 МСК).';
    var tg = document.getElementById('leadTg'); if (tg) { tg.textContent = 'Написать в Telegram'; tg.href = TG_BOT; }
    var btn = document.getElementById('leadSubmit'); if (btn) { btn.disabled = false; btn.textContent = 'Отправить заявку'; }
    var st = document.getElementById('leadStatus'); if (st) st.hidden = true;
  }

  function openLead(d) {
    d = d || {};
    orderCtx = { cart: false, modelId: d.order || '', model: d.name || '', stock: d.stock || '', warranty: d.warr === '1', src: [] };
    var line = document.getElementById('leadModelLine');
    document.getElementById('leadModel').value = orderCtx.model;
    if (orderCtx.model) { line.innerHTML = '🛒 ' + orderCtx.model; line.hidden = false; } else line.hidden = true;
    chrome();
    document.getElementById('leadForm').hidden = false;
    leadModal.hidden = false;
  }

  function openLeadCart() {
    var items = (window.neorideCart && window.neorideCart.get()) || [];
    if (!items.length) return;
    orderCtx = { cart: true, items: items };
    var n = items.reduce(function (s, i) { return s + i.qty; }, 0);
    var tot = items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var line = document.getElementById('leadModelLine');
    line.innerHTML = '🛒 Заказ: ' + n + ' ' + pluralRu(n, 'позиция', 'позиции', 'позиций') + ' · ориентир ' + rub(tot) +
      '<span class="lead-items">' + items.map(function (i) { return '• ' + i.name + ' ×' + i.qty; }).join('<br>') + '</span>';
    line.hidden = false;
    document.getElementById('leadModel').value = items.map(function (i) { return i.name + ' ×' + i.qty; }).join('; ');
    chrome();
    document.getElementById('leadForm').hidden = false;
    leadModal.hidden = false;
  }
  window.neorideOpenLeadCart = openLeadCart;

  // «купить в один клик» на карточках/в модалке витрины
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-order]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var ex = (window.CART_EXTRA || []).filter(function (c) { return c.id === b.getAttribute('data-order'); })[0];
    openLead(ex ? { order: ex.id, name: (ex.brand || '') + ' ' + ex.name, stock: ex.stock, warr: ex.warranty ? '1' : '0' } : { order: b.getAttribute('data-order') });
  });

  document.getElementById('closeLead').onclick = function () { leadModal.hidden = true; };
  leadModal.onclick = function (e) { if (e.target === leadModal) leadModal.hidden = true; };
  var form = document.getElementById('leadForm');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('leadSubmit');
    var st = document.getElementById('leadStatus');
    var contact = document.getElementById('leadContact').value.trim();
    if (!contact) return;
    var consent = document.getElementById('leadConsent');
    if (consent && !consent.checked) {
      st.textContent = 'Отметьте согласие на обработку персональных данных, чтобы отправить заявку.';
      st.className = 'lead-status err'; st.hidden = false; return;
    }
    btn.disabled = true; btn.textContent = 'Отправляем…';
    var base = { name: document.getElementById('leadName').value, contact: contact, consent: true, page: location.pathname, website: form.website.value };
    var payload = orderCtx.cart && orderCtx.items && orderCtx.items.length
      ? Object.assign({}, base, { items: orderCtx.items.map(function (i) { return { id: i.id, name: i.name, qty: i.qty, price: i.price, stock: i.stock, warranty: i.warranty, src: i.src }; }) })
      : Object.assign({}, base, { model: orderCtx.model || document.getElementById('leadModel').value, modelId: orderCtx.modelId, stock: orderCtx.stock, warranty: orderCtx.warranty, src: [] });
    try {
      var r = await fetch(LEAD_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      var j = await r.json().catch(function () { return {}; });
      if (r.ok && j.ok) {
        if (window.ymGoal) try { window.ymGoal(orderCtx.cart ? 'cart_order' : 'lead'); } catch (_) {}
        if (orderCtx.cart && window.neorideCart) window.neorideCart.clear();
        form.hidden = true;
        st.textContent = '✅ Заявка отправлена! Менеджер подтвердит наличие и итоговую цену и пришлёт ссылку на оплату — в течение 15 минут в рабочее время (09:00–21:00 МСК).';
        st.className = 'lead-status ok'; st.hidden = false;
      } else throw new Error();
    } catch (_) {
      btn.disabled = false; btn.textContent = 'Отправить заявку';
      st.textContent = '⚠ Не удалось отправить. Напишите нам в Telegram кнопкой ниже.';
      st.className = 'lead-status err'; st.hidden = false;
    }
  });
})();

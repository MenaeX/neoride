/* NEORIDE — корзина. Хранит [{id, qty}] в localStorage, данные модели резолвит из CATALOG.
   Модель оплаты: корзина → заявка → менеджер подтверждает наличие/цену → ссылка на оплату.
   Поэтому корзина ведёт к заявке (openLeadCart в app.js), а не к мгновенному списанию. */
'use strict';
(function () {
  var KEY = 'neoride_cart_v1';
  var MAX_QTY = 20;

  var MAP = {};
  if (typeof CATALOG !== 'undefined') CATALOG.forEach(function (c) { MAP[c.id] = c; });

  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a
        .filter(function (x) { return x && x.id && MAP[x.id]; })
        .map(function (x) { return { id: x.id, qty: Math.min(MAX_QTY, Math.max(1, parseInt(x.qty, 10) || 1)) }; });
    } catch (e) { return []; }
  }
  var items = load();
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }

  var fmt = function (n) { return n == null ? '—' : Number(n).toLocaleString('ru-RU'); };
  var rub = function (n) { return fmt(n) + ' ₽'; };
  var nameOf = function (c) { return (c.brand || 'Kugoo') + ' ' + c.name; };

  function find(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null; }
  function count() { return items.reduce(function (n, it) { return n + it.qty; }, 0); }
  function total() { return items.reduce(function (s, it) { var c = MAP[it.id]; return s + (c && c.price ? c.price * it.qty : 0); }, 0); }

  // полные строки для оформления заявки (передаём воркеру)
  function resolved() {
    return items.filter(function (it) { return MAP[it.id]; }).map(function (it) {
      var c = MAP[it.id];
      return {
        id: it.id, qty: it.qty, name: nameOf(c), price: c.price || 0,
        stock: c.stock || '', warranty: !!c.warranty, src: Array.isArray(c.src) ? c.src : [],
      };
    });
  }

  /* ---- тост (своя реализация, класс .max-toast уже стилизован) ---- */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'max-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  /* ---- мутации ---- */
  function add(id, qty) {
    if (!MAP[id]) return;
    qty = qty || 1;
    var it = find(id);
    if (it) it.qty = Math.min(MAX_QTY, it.qty + qty);
    else items.push({ id: id, qty: Math.min(MAX_QTY, qty) });
    persist(); syncBadge(); renderBody();
    toast('Добавлено в корзину: ' + nameOf(MAP[id]));
  }
  function setQty(id, qty) {
    var it = find(id); if (!it) return;
    it.qty = Math.min(MAX_QTY, Math.max(1, qty));
    persist(); syncBadge(); renderBody();
  }
  function remove(id) {
    items = items.filter(function (it) { return it.id !== id; });
    persist(); syncBadge(); renderBody();
  }
  function clear() { items = []; persist(); syncBadge(); renderBody(); }

  /* ---- бейдж счётчика в шапке ---- */
  function syncBadge() {
    var b = document.getElementById('cartCnt');
    if (!b) return;
    var n = count();
    b.textContent = n;
    b.hidden = n === 0;
    var btn = document.getElementById('navCart');
    if (btn && n > 0) { btn.classList.remove('pulse'); void btn.offsetWidth; btn.classList.add('pulse'); }
  }

  /* ---- модалка корзины ---- */
  var modal, body;
  function renderBody() {
    if (!body) return;
    var list = resolved();
    if (!list.length) {
      body.innerHTML = '<p class="cart-empty">Корзина пуста.<br><span>Добавьте модели из каталога — соберём заказ и подтвердим наличие.</span></p>' +
        '<a class="btn btn-accent cart-go" href="#catalog" id="cartToCatalog">Перейти в каталог</a>';
      var go = document.getElementById('cartToCatalog');
      if (go) go.onclick = function () { close(); };
      return;
    }
    var lines = list.map(function (r) {
      var img = r.img ? '<img src="' + (MAP[r.id].img) + '" alt="' + r.name + '">' : '<span class="cart-noimg">фото</span>';
      var warr = r.warranty ? '<span class="cart-warr">гарантия 12 мес</span>' : '';
      return '<div class="cart-line">' +
        '<div class="cart-thumb">' + img + '</div>' +
        '<div class="cart-info"><div class="cart-name">' + r.name + '</div>' +
        '<div class="cart-sub">' + rub(r.price) + ' / шт ' + warr + '</div></div>' +
        '<div class="cart-qty"><button type="button" data-dec="' + r.id + '" aria-label="Меньше">−</button>' +
        '<span>' + r.qty + '</span>' +
        '<button type="button" data-inc="' + r.id + '" aria-label="Больше">+</button></div>' +
        '<div class="cart-sum">' + rub(r.price * r.qty) + '</div>' +
        '<button type="button" class="cart-rm" data-cartrm="' + r.id + '" aria-label="Убрать">✕</button>' +
        '</div>';
    }).join('');
    body.innerHTML =
      '<div class="cart-lines">' + lines + '</div>' +
      '<div class="cart-foot">' +
        '<div class="cart-total"><span>Ориентир по товару</span><b>' + rub(total()) + '</b></div>' +
        '<p class="cart-note">Это предварительная сумма по каталогу. Финальную цену, наличие и доставку подтвердит менеджер до оплаты — после этого пришлём ссылку на оплату.</p>' +
        '<button type="button" class="btn btn-accent cart-checkout" id="cartCheckout">Оформить заявку</button>' +
        '<button type="button" class="btn cart-clear" id="cartClear">← Продолжить покупки</button>' +
      '</div>';
    document.getElementById('cartCheckout').onclick = function () {
      close();
      if (typeof window.neorideOpenLeadCart === 'function') window.neorideOpenLeadCart();
    };
    document.getElementById('cartClear').onclick = close;  // «продолжить покупки» = закрыть корзину (товары остаются; убрать позицию — крестик ✕)
  }

  function open() { renderBody(); if (modal) modal.hidden = false; }
  function close() { if (modal) modal.hidden = true; }

  /* ---- инициализация ---- */
  function init() {
    modal = document.getElementById('cartModal');
    body = document.getElementById('cartBody');
    var closeBtn = document.getElementById('cartClose');
    if (closeBtn) closeBtn.onclick = close;
    if (modal) modal.onclick = function (e) { if (e.target === modal) close(); };
    var navCart = document.getElementById('navCart');
    if (navCart) navCart.onclick = open;

    // делегирование: кнопки «в корзину» в карточках/модалках + управление qty внутри корзины
    document.addEventListener('click', function (e) {
      var addBtn = e.target.closest('[data-addcart]');
      if (addBtn) { add(addBtn.getAttribute('data-addcart'), 1); return; }
      var dec = e.target.closest('[data-dec]');
      if (dec) { var it = find(dec.getAttribute('data-dec')); if (it) setQty(it.id, it.qty - 1); return; }
      var inc = e.target.closest('[data-inc]');
      if (inc) { var it2 = find(inc.getAttribute('data-inc')); if (it2) setQty(it2.id, it2.qty + 1); return; }
      var rm = e.target.closest('[data-cartrm]');
      if (rm) { remove(rm.getAttribute('data-cartrm')); return; }
    });
    syncBadge();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // публичный API (читает app.js при оформлении)
  window.neorideCart = { add: add, remove: remove, setQty: setQty, clear: clear, get: resolved, count: count, total: total, open: open };
})();

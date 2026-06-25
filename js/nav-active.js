/* NEORIDE — единая шапка: подсветка активного пункта меню по текущему адресу
   + счётчик корзины на «лёгких» страницах (где не подключён cart.js: модели, блог, юр-страницы). */
(function () {
  function norm(p) { return (p || '/').replace(/index\.html$/, '').replace(/\/+$/, '') || '/'; }
  var here = norm(location.pathname);

  // 1) подсветка по совпадению адреса
  document.querySelectorAll('.nav a[href]').forEach(function (a) {
    var h = a.getAttribute('href') || '';
    if (h.charAt(0) === '#' || h.indexOf('tel:') === 0 || h.indexOf('mailto:') === 0) return;
    var ap;
    try { ap = norm(new URL(a.href, location.href).pathname); } catch (e) { return; }
    if (ap === '/') return; // логотип/главная пунктом не считаем
    if (here === ap || here.indexOf(ap + '/') === 0 || (ap === '/blog' && here.indexOf('/blog') === 0)) {
      a.classList.add('active');
    }
  });

  // 2) принудительная подсветка по data-nav на <body> (страницы моделей: бренд Kugoo/AOVO)
  var forced = document.body && document.body.getAttribute('data-nav');
  if (forced) {
    var f = document.querySelector('.nav a[data-nav="' + forced + '"]');
    if (f) f.classList.add('active');
  }

  // 3) счётчик корзины на страницах без cart.js (берём из того же localStorage)
  if (!window.neorideCart) {
    try {
      var items = JSON.parse(localStorage.getItem('neoride_cart_v1') || '[]');
      var n = items.reduce(function (s, i) { return s + (i.qty || 1); }, 0);
      var b = document.getElementById('cartCnt');
      if (b && n > 0) { b.textContent = n; b.hidden = false; }
    } catch (e) {}
  }
})();

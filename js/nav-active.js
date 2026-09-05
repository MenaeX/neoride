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

  // 4) мобильное бургер-меню (единое на всех страницах; на десктопе скрыто CSS-ом).
  //    Ссылки на все разделы сайта — прямые адреса, чтобы работали с любой страницы.
  (function () {
    var nav = document.querySelector('.topbar .nav');
    if (!nav || document.getElementById('burgerBtn')) return;
    var LINKS = [
      ['Каталог', '/#catalog'],
      ['Электросамокаты', '/katalog-samokaty.html'],
      ['Электровелосипеды', '/katalog-velosipedy.html'],
      ['Электроскутеры', '/katalog-skutery.html'],
      ['Электропитбайки', '/katalog-pitbayki.html'],
      ['Трициклы', '/katalog-tricikly.html'],
      ['Kugoo', '/kugoo.html'],
      ['AOVO', '/aovo.html'],
      ['Доставка', '/delivery.html'],
      ['Оптовикам', '/opt.html'],
      ['Почему мы', '/#why'],
      ['Отзывы', '/#reviewsSec'],
      ['Вопросы', '/#faq'],
      ['Блог', '/blog/'],
      ['Контакты', '/contacts.html'],
    ];
    var btn = document.createElement('button');
    btn.id = 'burgerBtn'; btn.className = 'burger'; btn.type = 'button';
    btn.setAttribute('aria-label', 'Меню'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    nav.appendChild(btn);

    var menu = document.createElement('div');
    menu.id = 'burgerMenu'; menu.className = 'burger-menu'; menu.hidden = true;
    menu.innerHTML =
      '<div class="bm-head"><span class="bm-logo">NEO<b>RIDE</b></span>' +
      '<button class="bm-close" type="button" aria-label="Закрыть">✕</button></div>' +
      '<nav class="bm-links">' +
      LINKS.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + '</a>'; }).join('') +
      '</nav>' +
      '<div class="bm-foot">' +
      '<a class="bm-call" href="tel:+79104248858">📞 +7 910 424-88-58</a>' +
      '<a class="bm-tg" href="https://t.me/neoride_shop_bot" target="_blank" rel="noopener">Написать в Telegram</a>' +
      '</div>';
    document.body.appendChild(menu);

    function open() { menu.hidden = false; document.body.style.overflow = 'hidden'; btn.setAttribute('aria-expanded', 'true'); btn.classList.add('on'); }
    function close() { menu.hidden = true; document.body.style.overflow = ''; btn.setAttribute('aria-expanded', 'false'); btn.classList.remove('on'); }
    btn.addEventListener('click', function () { menu.hidden ? open() : close(); });
    menu.querySelector('.bm-close').addEventListener('click', close);
    menu.addEventListener('click', function (e) { if (e.target === menu) close(); });
    menu.querySelectorAll('.bm-links a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) close(); });
  })();

  // 5) Согласие на аналитику. 🚨 05.09.2026: раньше плашка лишь УВЕДОМЛЯЛА («продолжая
  // пользоваться сайтом, вы соглашаетесь»), а Метрика с вебвизором грузилась сразу при
  // открытии страницы — это загрузка трекеров до согласия (152-ФЗ ст. 9), штраф от 30 тыс.
  // Теперь счётчики стартуют ТОЛЬКО по кнопке «Принять»; отказ уважается и запоминается.
  (function () {
    var vybor = null;
    try { vybor = localStorage.getItem('neoride_cookie_ok'); } catch (e) {}
    if (vybor === '1' || vybor === '0') return;   // выбор уже сделан — плашку не показываем
    if (document.getElementById('cookieBar')) return;

    var bar = document.createElement('div');
    bar.id = 'cookieBar'; bar.className = 'cookie-bar';
    bar.innerHTML =
      '<span>Мы хотим включить Яндекс.Метрику, чтобы понимать, как вы пользуетесь сайтом, ' +
      'и не показывать лишнюю рекламу. Она ставит cookies и передаёт обезличенные данные о ' +
      'посещении. Подробности — в <a href="/privacy.html" target="_blank" rel="noopener">Политике</a> и ' +
      '<a href="/consent.html" target="_blank" rel="noopener">Согласии</a>. Без неё сайт работает полностью.</span>' +
      '<button type="button" class="cookie-ok">Принять</button>' +
      '<button type="button" class="cookie-no">Только необходимые</button>';
    document.body.appendChild(bar);

    var zapomnit = function (znachenie) {
      try { localStorage.setItem('neoride_cookie_ok', znachenie); } catch (e) {}
      bar.remove();
    };
    bar.querySelector('.cookie-ok').addEventListener('click', function () {
      zapomnit('1');
      if (typeof window.neorideZagruzitMetriku === 'function') window.neorideZagruzitMetriku();
    });
    bar.querySelector('.cookie-no').addEventListener('click', function () { zapomnit('0'); });
  })();

  // 5б) Видео по клику. 🚨 05.09.2026: раньше плеер youtube-nocookie стоял в разметке
  // и грузился при открытии страницы — это передача IP посетителя на серверы Google в США
  // без его согласия (152-ФЗ ст. 12). Теперь до клика показывается наша картинка.
  (function () {
    var vstavit = function (box) {
      var id = box.getAttribute('data-yt');
      if (!id || box.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0&modestbranding=1&autoplay=1';
      f.title = box.getAttribute('aria-label') || 'Видео';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      box.innerHTML = '';
      box.appendChild(f);
    };
    document.querySelectorAll('.video-lazy').forEach(function (box) {
      box.addEventListener('click', function () { vstavit(box); });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vstavit(box); }
      });
    });
  })();

  // 6) SEO-текст: раскрытие/сворачивание по кнопке (текст всегда в DOM — поисковик его видит).
  document.querySelectorAll('.seo-text .st-toggle').forEach(function (btn) {
    var sec = btn.closest('.seo-text');
    if (!sec) return;
    var label = btn.querySelector('.st-lbl');
    btn.addEventListener('click', function () {
      var open = sec.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Свернуть' : 'Читать далее';
    });
  });
})();

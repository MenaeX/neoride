/* Яндекс.Метрика NEORIDE — ДВА счётчика на всех страницах:
     109839341 — наш основной (аккаунт neoride.ru): вебвизор, карта кликов, наши цели.
     110482350 — счётчик агентства (их аккаунт) для оптимизации Яндекс.Директа.
   Оба поддерживаются штатно (Метрика допускает несколько счётчиков на странице).
   Цели (phone_click / tg_click / max_click) отправляются во ВСЕ счётчики,
   чтобы у агентства были готовые конверсии для оптимизации рекламы.

   ВАЖНО: <meta> подтверждения владения (yandex-verification, google-site-verification)
   стоят прямо в <head> каждой страницы — их читают краулеры Вебмастера/Search Console
   из сырого HTML, JS-инъекция для верификации не годится. Здесь их НЕТ намеренно. */
(function () {
  var COUNTERS = [109839341, 110482350]; // все активные счётчики Метрики
  var PRIMARY = COUNTERS[0];

  // Безопасная отправка запроса на бэкенд (заявка/чат/лид): сперва свой домен
  // api.neoride.ru (кастом-домен CF, живёт в РФ), при сетевой ошибке — прямой workers.dev.
  window.neoridePost = function (path, payload) {
    var bases = ['https://api.neoride.ru', 'https://neoride-bot.amenshikov007.workers.dev'];
    var opts = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
    return fetch(bases[0] + path, opts).catch(function () { return fetch(bases[1] + path, opts); });
  };

  // Цель отправляется во ВСЕ счётчики (агентству нужны те же конверсии для Директа).
  window.ymGoal = function (name, params) {
    try { if (window.ym) COUNTERS.forEach(function (c) { window.ym(c, 'reachGoal', name, params || {}); }); }
    catch (e) {}
  };

  if (!COUNTERS.length) return;

  // 🚨 05.09.2026: счётчики грузятся ТОЛЬКО после согласия посетителя (152-ФЗ ст. 9).
  // Раньше tag.js уезжал сразу при открытии страницы, а плашка лишь уведомляла об этом
  // постфактум — проверка vlip.site справедливо назвала это загрузкой трекеров до
  // согласия. Загрузку выполняет neorideZagruzitMetriku(), её зовёт плашка согласия
  // (nav-active.js) — сразу, если человек соглашался раньше, или по кнопке «Принять».
  var zagruzheno = false;

  // 🚨 31.08.2026: загрузчик tag.js обслуживает ТОЛЬКО тот счётчик, чей id стоит в его
  // адресе. Прежняя схема «один тег с id нашего счётчика + init обоих» регистрировала
  // счётчик агентства, но он не отправлял НИ ОДНОГО хита — проверено в браузере
  // (перехват запросов к mc.yandex.ru). Поэтому тег грузим на КАЖДЫЙ счётчик отдельно.
  window.neorideZagruzitMetriku = function () {
    if (zagruzheno) return;
    zagruzheno = true;
  (function (m, e, t, i) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    COUNTERS.forEach(function (c) {
      var src = 'https://mc.yandex.ru/metrika/tag.js?id=' + c;
      for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === src) { return; } }
      var k = e.createElement(t), a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = src; a.parentNode.insertBefore(k, a);
    });
  })(window, document, 'script', 'ym');

  // Наш счётчик — с вебвизором и электронной торговлей.
  // 🚨 ssr здесь НЕ ставить: с этим флагом счётчик перестаёт слать просмотр автоматически,
  // когда на странице он не единственный (проверено 31.08.2026). Сайт статический,
  // серверного рендеринга нет — флаг не нужен.
  window.ym(PRIMARY, 'init', {
    webvisor: true,
    clickmap: true,
    ecommerce: 'dataLayer',
    accurateTrackBounce: true,
    trackLinks: true,
  });
  // Счётчики партнёров (агентство) — БЕЗ ssr: с этим флагом второй счётчик на странице
  // молчит, хиты не уходят (проверено 31.08.2026). Вебвизор и ecommerce партнёру не нужны.
  COUNTERS.slice(1).forEach(function (c) {
    window.ym(c, 'init', { clickmap: true, accurateTrackBounce: true, trackLinks: true });
  });
  };

  // Согласие уже давалось раньше — грузим сразу, плашку показывать не нужно.
  try {
    if (localStorage.getItem('neoride_cookie_ok') === '1') window.neorideZagruzitMetriku();
  } catch (e) {}

  // Делегированные цели: клик по телефону (звонок), Telegram и MAX (мессенджер-конверсии)
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('a[href^="tel:"]')) { window.ymGoal('phone_click'); return; }
    if (e.target.closest('a[href*="t.me/neoride_shop_bot"]')) { window.ymGoal('tg_click'); return; }
    if (e.target.closest('[data-max]')) { window.ymGoal('max_click'); }
  });
})();

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

  // Стандартный инициализатор Яндекс.Метрики (tag.js грузим один раз, гвардом от повтора)
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) { return; } }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + PRIMARY, 'ym');

  // Инициализируем каждый счётчик отдельным вызовом.
  COUNTERS.forEach(function (c) {
    window.ym(c, 'init', {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: 'dataLayer',
      accurateTrackBounce: true,
      trackLinks: true,
    });
  });

  // Делегированные цели: клик по телефону (звонок), Telegram и MAX (мессенджер-конверсии)
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('a[href^="tel:"]')) { window.ymGoal('phone_click'); return; }
    if (e.target.closest('a[href*="t.me/neoride_shop_bot"]')) { window.ymGoal('tg_click'); return; }
    if (e.target.closest('[data-max]')) { window.ymGoal('max_click'); }
  });
})();

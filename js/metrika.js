/* Яндекс.Метрика NEORIDE — счётчик посещаемости + цели для оптимизации рекламы.
   Активируется, когда задан COUNTER (номер счётчика из metrika.yandex.ru).
   Пока COUNTER === null — скрипт инертен: ничего не грузит, ym-вызовы безопасны. */
(function () {
  var COUNTER = 109839341; // номер счётчика Яндекс.Метрики (neoride.ru)

  // Безопасная отправка цели из любого места кода (заявка/чат/клик в мессенджер).
  // Работает как заглушка, пока счётчик не настроен.
  window.ymGoal = function (name, params) {
    try { if (COUNTER && window.ym) window.ym(COUNTER, 'reachGoal', name, params || {}); }
    catch (e) {}
  };

  if (!COUNTER) return; // счётчик ещё не подключён — выходим, не грузим внешний скрипт

  // Стандартный инициализатор Яндекс.Метрики (tag.js)
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) { return; } }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=' + COUNTER, 'ym');

  window.ym(COUNTER, 'init', {
    webvisor: true,
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true,
  });

  // Делегированные цели: клик в Telegram и MAX (мессенджер-конверсии)
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('a[href*="t.me/"]')) { window.ymGoal('tg_click'); return; }
    if (e.target.closest('[data-max]')) { window.ymGoal('max_click'); }
  });
})();

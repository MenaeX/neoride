/* Кнопки связи на сайте. ИИ-консультант убран 08.09.2026 по решению Андрея:
   баланс Anthropic ушёл в ноль, а поток вопросов небольшой — людям проще писать
   напрямую в Telegram @neoride_shop_bot, где сообщения падают владельцу в личку.
   Прежний виджет переписки (окно, история, обращения к /api/chat) удалён отсюда целиком;
   сам обработчик /api/chat в воркере оставлен на случай возврата ИИ. */

/* Свернуть плавающие кнопки связи (Канал/MAX/Telegram) в одну кнопку «Связь» —
   на мобиле они перекрывали контент. По тапу разворачиваются вверх, клик вне — закрытие. */
(function () {
  function init() {
    var fabs = [].slice.call(document.querySelectorAll('.channel-fab, .max-fab, .tg-fab'));
    if (fabs.length < 2) return;
    var wrap = document.createElement('div');
    wrap.className = 'fab-stack';
    document.body.appendChild(wrap);
    fabs.forEach(function (f) { wrap.appendChild(f); });
    var t = document.createElement('button');
    t.className = 'fab-toggle'; t.type = 'button';
    t.setAttribute('aria-label', 'Связаться');
    t.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1-.1 1.1-.6 2.6-1.6 3.9 1.9-.3 3.6-1 4.9-1.9 1.1.3 2.3.5 3.6.5 5.5 0 10-3.8 10-8.6S17.5 3 12 3z"/></svg><span>Связь</span>';
    document.body.appendChild(t);
    var open = false;
    function set(o) {
      open = o;
      wrap.classList.toggle('open', o);
      t.classList.toggle('active', o);
      t.querySelector('span').textContent = o ? 'Закрыть' : 'Связь';
    }
    t.addEventListener('click', function (e) { e.stopPropagation(); set(!open); });
    document.addEventListener('click', function (e) { if (open && !wrap.contains(e.target)) set(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  else setTimeout(init, 0);
})();

/* Окно «Спасибо за заявку» — единое подтверждение для ВСЕХ форм сайта.
   Зачем: клиент должен видеть, что данные ушли, а Метрика — считать это целью.
   Цель для агентства: событие `zayavka_otpravlena` + виртуальный просмотр
   страницы /zayavka-otpravlena (на неё удобно вешать цель «посещение страницы»). */
(function () {
  var TEKST_PO_UMOLCHANIYU =
    'Менеджер свяжется с вами и подтвердит наличие, итоговую цену, доставку и оплату — ' +
    'в течение 15 минут в рабочее время (09:00–21:00 МСК).';

  function sozdat() {
    var m = document.createElement('div');
    m.className = 'modal';
    m.id = 'thanksModal';
    m.hidden = true;
    m.innerHTML =
      '<div class="modal-box modal-box-sm">' +
        '<div class="modal-head"><h3>Спасибо за заявку!</h3>' +
          '<button class="modal-close" type="button" data-thanks-close aria-label="Закрыть">✕</button></div>' +
        '<div class="modal-body">' +
          '<p class="thanks-ok">✅ Заявка отправлена</p>' +
          '<p class="thanks-text"></p>' +
          '<div class="thanks-alt">' +
            '<a class="btn btn-accent" href="https://t.me/neoride_shop_bot" target="_blank" rel="noopener">Написать в Telegram</a>' +
            '<button type="button" class="btn" data-thanks-close>Закрыть</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-thanks-close]')) m.hidden = true;
    });
    return m;
  }

  window.neorideThanks = function (tekst) {
    var m = document.getElementById('thanksModal') || sozdat();
    m.querySelector('.thanks-text').textContent = tekst || TEKST_PO_UMOLCHANIYU;
    m.hidden = false;
    try {
      if (window.ymGoal) window.ymGoal('zayavka_otpravlena');
      if (window.ymHit) window.ymHit('/zayavka-otpravlena');
    } catch (e) {}
  };

  // Esc закрывает окно
  document.addEventListener('keydown', function (e) {
    var m = document.getElementById('thanksModal');
    if (e.key === 'Escape' && m && !m.hidden) m.hidden = true;
  });
})();

/* FX: кинематографичные анимации NEORIDE (параллакс, reveal, каскад, tilt) */
(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    document.querySelectorAll('.rw-trig').forEach(function (el) { el.classList.add('go'); });
    return;
  }

  /* LED-прогресс скролла */
  var led = document.getElementById('scrollLed');

  /* видеофон hero: грузим только на десктопе */
  var hv = document.querySelector('.hero-video');
  if (hv && innerWidth > 760) {
    hv.src = hv.dataset.src;
    hv.addEventListener('canplay', function () {
      hv.classList.add('live');
      hv.play().catch(function () {});
    }, { once: true });
    hv.load();
  }

  /* параллакс [data-prlx] — только десктоп (на мобиле iOS Safari чернит при перерисовке) */
  var prlx = innerWidth > 760 ? [].slice.call(document.querySelectorAll('[data-prlx]')) : [];
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var vh = innerHeight;
      var doc = document.documentElement;
      if (led) {
        var p = scrollY / (doc.scrollHeight - vh || 1);
        led.style.width = (p * 100).toFixed(2) + '%';
      }
      prlx.forEach(function (el) {
        var r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        var mid = r.top + r.height / 2 - vh / 2;
        var k = parseFloat(el.dataset.prlx) || 0.3;
        el.style.transform = 'translateY(' + (mid * k).toFixed(1) + 'px)';
      });
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* word-reveal: .rw-trig получает .go при появлении */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('go'); io.unobserve(e.target); }
    });
  }, { threshold: 0.25 });
  document.querySelectorAll('.rw-trig').forEach(function (el) { io.observe(el); });

  /* каскад карточек каталога (grid перерисовывается фильтрами) */
  var grid = document.getElementById('grid');
  if (grid) {
    var cardIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('fx-in'); cardIO.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    var arm = function () {
      var col = 0;
      [].forEach.call(grid.children, function (card, i) {
        if (!card.classList.contains('card') || card.classList.contains('fx')) return;
        card.classList.add('fx');
        card.style.setProperty('--d', (Math.min(i % 8, 5) * 0.07).toFixed(2) + 's');
        cardIO.observe(card);
      });
    };
    new MutationObserver(arm).observe(grid, { childList: true });
    arm();
  }

  /* лёгкий tilt hero-кадра за курсором (только точный указатель) */
  var tilt = document.querySelector('[data-tilt]');
  if (tilt && matchMedia('(pointer: fine)').matches) {
    var hero = tilt.closest('.hero') || tilt.parentElement;
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
    function loop() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      tilt.style.setProperty('--tiltX', cx.toFixed(2) + 'px');
      tilt.style.setProperty('--tiltY', cy.toFixed(2) + 'px');
      var img = tilt.querySelector('img');
      if (img) img.style.translate = cx.toFixed(2) + 'px ' + cy.toFixed(2) + 'px';
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(loop);
      else raf = null;
    }
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * -18;
      ty = ((e.clientY - r.top) / r.height - 0.5) * -10;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    hero.addEventListener('pointerleave', function () {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  }
})();

/* Кнопка MAX: у MAX нет ссылки-на-чат по номеру, поэтому по клику копируем номер
   и подсказываем найти нас в приложении. Делегирование — работает и для модалки. */
(function () {
  var MAX_PHONE = '+7 910 402-88-58';
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'max-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2800);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-max]');
    if (!el) return;
    e.preventDefault();
    var num = MAX_PHONE.replace(/[^\d+]/g, '');
    var ok = 'Номер ' + MAX_PHONE + ' скопирован — откройте MAX и найдите нас по номеру';
    var no = 'Напишите нам в MAX по номеру ' + MAX_PHONE;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(num).then(function () { toast(ok); }, function () { toast(no); });
    } else { toast(no); }
  });
})();

/* Неоновая подсветка под курсором (только desktop / точный указатель) */
(function () {
  if (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) return;
  var g = document.createElement('div');
  g.className = 'cursor-glow';
  document.body.appendChild(g);
  var x = 0, y = 0, tx = 0, ty = 0, raf = null;
  function loop() {
    x += (tx - x) * 0.18; y += (ty - y) * 0.18;
    g.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) { raf = requestAnimationFrame(loop); }
    else { raf = null; }
  }
  window.addEventListener('mousemove', function (e) {
    tx = e.clientX; ty = e.clientY; g.style.opacity = '1';
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  window.addEventListener('mouseout', function (e) { if (!e.relatedTarget) g.style.opacity = '0'; });
})();

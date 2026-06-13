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

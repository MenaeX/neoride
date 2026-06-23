/* Квиз-подбор NEORIDE: «Подберём за 15 секунд» → 5 вопросов → самокаты в наличии.
   Самодостаточный модуль: триггер-кнопка в секции #scen + всплывающая модалка. */
(function () {
  'use strict';
  if (typeof CATALOG === 'undefined' || !Array.isArray(CATALOG)) return;

  var STEPS = [
    { key: 'where', q: 'Где будете кататься?', opts: [
      ['city', '🏙 По городу'], ['far', '🛣 Дальние поездки'], ['offroad', '🏔 Бездорожье'], ['courier', '📦 Работа курьером'] ] },
    { key: 'who', q: 'Кому самокат?', opts: [
      ['adult', '🧑 Взрослому'], ['teen', '🧒 Подростку'], ['gift', '🎁 В подарок / не определился'] ] },
    { key: 'weight', q: 'Вес ездока?', opts: [
      ['l', 'До 80 кг'], ['m', '80–110 кг'], ['h', 'Больше 110 кг'] ] },
    { key: 'budget', q: 'Бюджет?', opts: [
      ['b1', 'До 50 000 ₽'], ['b2', '50–90 000 ₽'], ['b3', '90 000 ₽ и выше'], ['any', 'Не важно'] ] },
    { key: 'prio', q: 'Что важнее всего?', opts: [
      ['speed', '⚡ Скорость'], ['range', '🔋 Запас хода'], ['compact', '🎒 Компактность'], ['power', '💪 Проходимость'] ] },
  ];
  var ans = {}, step = 0, root;

  function rub(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }

  function pool() { return CATALOG.filter(function (c) { return c.cat === 'самокат' && c.stock === 'in' && c.price; }); }

  function isOff(s) { return /полн|внедор/i.test(s.drive || '') || (s.power || 0) >= 1000; }

  function score(c) {
    var s = c.specs || {}, sc = 0, p = c.price;
    // бюджет (мягко — чтоб всегда были варианты)
    if (ans.budget === 'b1') sc += p <= 50000 ? 4 : (p <= 70000 ? 1 : -3);
    else if (ans.budget === 'b2') sc += (p > 40000 && p <= 92000) ? 4 : -1;
    else if (ans.budget === 'b3') sc += p >= 88000 ? 4 : -1;
    // вес ездока ↔ макс. нагрузка
    var load = s.load || 100;
    if (ans.weight === 'h') sc += load >= 130 ? 3 : (load >= 120 ? 1 : -3);
    else if (ans.weight === 'm') sc += load >= 120 ? 2 : 0;
    // сценарий
    if (ans.where === 'far') sc += (s.range || 0) / 25;
    else if (ans.where === 'offroad') sc += (s.power || 0) / 350 + (isOff(s) ? 3 : 0);
    else if (ans.where === 'courier') sc += (s.range || 0) / 35 + load / 70;
    else if (ans.where === 'city') sc += s.weight ? (28 - Math.min(s.weight, 28)) / 7 : 0;
    // кому
    if (ans.who === 'teen') sc += -(s.power || 600) / 700 - (s.weight || 15) / 30;
    // приоритет
    if (ans.prio === 'speed') sc += (s.speed || 0) / 14;
    else if (ans.prio === 'range') sc += (s.range || 0) / 25;
    else if (ans.prio === 'compact') sc += s.weight ? (30 - Math.min(s.weight, 30)) / 5 : 0;
    else if (ans.prio === 'power') sc += (s.power || 0) / 350 + (isOff(s) ? 2 : 0);
    return sc;
  }

  function matches() {
    return pool().map(function (c) { return { c: c, s: score(c) }; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 4).map(function (x) { return x.c; });
  }

  function style() {
    if (document.getElementById('quizStyle')) return;
    var st = document.createElement('style'); st.id = 'quizStyle';
    st.textContent =
      '.quiz-ov{position:fixed;inset:0;z-index:120;background:rgba(4,6,12,.78);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:16px}' +
      '.quiz-ov.open{display:flex}' +
      '.quiz-box{width:100%;max-width:520px;background:#0c0f18;border:1px solid rgba(46,230,255,.25);border-radius:22px;padding:26px 24px;box-shadow:0 30px 80px rgba(0,0,0,.6);max-height:92vh;overflow:auto}' +
      '.quiz-box h3{font:800 22px Unbounded,sans-serif;color:#fff;margin:0 0 4px}' +
      '.quiz-box .quiz-sub{font:14px Inter,sans-serif;color:#9a9bb0;margin:0 0 18px}' +
      '.quiz-bar{height:4px;border-radius:4px;background:rgba(255,255,255,.1);margin:0 0 20px;overflow:hidden}' +
      '.quiz-bar i{display:block;height:100%;background:var(--grad,linear-gradient(90deg,#b8ff2e,#2ee6ff));transition:.3s}' +
      '.quiz-q{font:700 18px Inter,sans-serif;color:#fff;margin:0 0 16px}' +
      '.quiz-opts{display:grid;gap:10px}' +
      '.quiz-opts button{text-align:left;padding:14px 16px;border:1px solid rgba(255,255,255,.14);border-radius:13px;background:rgba(255,255,255,.03);color:#eef3fa;font:600 15px Inter,sans-serif;cursor:pointer;transition:.18s}' +
      '.quiz-opts button:hover{border-color:var(--cyan,#2ee6ff);background:rgba(46,230,255,.1)}' +
      '.quiz-back{margin-top:16px;background:none;border:0;color:#8a8aa0;font:14px Inter,sans-serif;cursor:pointer}' +
      '.quiz-x{position:absolute;top:14px;right:16px}' +
      '.quiz-res{display:grid;gap:12px;margin-top:4px}' +
      '.quiz-card{display:flex;gap:12px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.03);text-decoration:none;transition:.18s}' +
      '.quiz-card:hover{border-color:var(--cyan,#2ee6ff)}' +
      '.quiz-card img{width:78px;height:64px;object-fit:contain;background:#11131c;border-radius:9px;flex:none}' +
      '.quiz-card b{display:block;font:700 15px Inter,sans-serif;color:#fff}' +
      '.quiz-card span{font:13px Inter,sans-serif;color:#9a9bb0}' +
      '.quiz-card .qp{font:800 15px Unbounded,sans-serif;color:var(--lime,#b8ff2e);margin-top:2px}' +
      '.quiz-cta{display:block;width:100%;text-align:center;margin-top:16px;padding:13px;border-radius:12px;background:var(--grad,linear-gradient(96deg,#b8ff2e,#2ee6ff));color:#06130a;font:700 15px Inter,sans-serif;text-decoration:none;border:0;cursor:pointer}' +
      /* триггер-кнопка в секции подбора */
      '.quiz-launch{display:flex;width:100%;align-items:center;justify-content:center;gap:10px;margin-top:8px;padding:18px 26px;border-radius:14px;background:var(--grad,linear-gradient(96deg,#b8ff2e,#2ee6ff));color:#06130a;font:800 17px Inter,sans-serif;border:0;cursor:pointer;box-shadow:0 10px 30px rgba(120,243,150,.25)}' +
      '.quiz-launch:hover{transform:translateY(-2px)}';
    document.head.appendChild(st);
  }

  function render() {
    var pct = Math.round((step) / STEPS.length * 100);
    if (step < STEPS.length) {
      var s = STEPS[step];
      root.querySelector('.quiz-body').innerHTML =
        '<div class="quiz-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="quiz-q">' + (step + 1) + '. ' + s.q + '</div>' +
        '<div class="quiz-opts">' + s.opts.map(function (o) {
          return '<button data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        (step > 0 ? '<button class="quiz-back">← Назад</button>' : '');
      root.querySelectorAll('.quiz-opts button').forEach(function (b) {
        b.onclick = function () { ans[s.key] = b.dataset.v; step++; render(); };
      });
      var bk = root.querySelector('.quiz-back'); if (bk) bk.onclick = function () { step--; render(); };
    } else {
      var res = matches();
      var cards = res.length ? res.map(function (c) {
        var s = c.specs || {};
        var line = [s.speed ? s.speed + ' км/ч' : '', s.range ? 'до ' + s.range + ' км' : '', s.power ? s.power + ' Вт' : ''].filter(Boolean).join(' · ');
        return '<a class="quiz-card" href="model/' + c.id + '.html" data-id="' + c.id + '">' +
          '<img src="' + (c.img || 'img/hero-poster.jpg') + '" alt="' + c.name + '">' +
          '<div><b>' + (c.brand || 'Kugoo') + ' ' + c.name + '</b><span>' + line + '</span><div class="qp">' + rub(c.price) + '</div></div></a>';
      }).join('') : '<p class="quiz-sub">Точного совпадения в наличии нет — напишите нам, подберём вручную.</p>';
      root.querySelector('.quiz-body').innerHTML =
        '<div class="quiz-bar"><i style="width:100%"></i></div>' +
        '<div class="quiz-q">Готово! Вот что подходит и есть в наличии:</div>' +
        '<div class="quiz-res">' + cards + '</div>' +
        '<a class="quiz-cta" href="#catalog">Смотреть весь каталог →</a>' +
        '<button class="quiz-back">↺ Пройти заново</button>';
      root.querySelectorAll('.quiz-card').forEach(function (a) {
        a.onclick = function (e) {
          if (typeof window.neorideOpenModel === 'function') { e.preventDefault(); close(); window.neorideOpenModel(a.dataset.id); }
        };
      });
      root.querySelector('.quiz-cta').onclick = function () { close(); };
      root.querySelector('.quiz-back').onclick = function () { ans = {}; step = 0; render(); };
      if (window.ymGoal) try { window.ymGoal('quiz_done'); } catch (e) {}
    }
  }

  function open() { ans = {}; step = 0; render(); root.classList.add('open'); document.body.style.overflow = 'hidden'; if (window.ymGoal) try { window.ymGoal('quiz_open'); } catch (e) {} }
  function close() { root.classList.remove('open'); document.body.style.overflow = ''; }

  function build() {
    style();
    root = document.createElement('div');
    root.className = 'quiz-ov';
    root.innerHTML =
      '<div class="quiz-box" style="position:relative">' +
        '<button class="btn quiz-x" type="button" aria-label="Закрыть" style="padding:6px 12px">✕</button>' +
        '<h3>Подберём за 15 секунд</h3>' +
        '<p class="quiz-sub">5 вопросов — покажем самокаты в наличии под вашу задачу.</p>' +
        '<div class="quiz-body"></div>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelector('.quiz-x').onclick = close;
    root.onclick = function (e) { if (e.target === root) close(); };

    // триггер в секции подбора: прячем чипы, ставим кнопку запуска
    var scen = document.getElementById('scen');
    var scenRow = document.getElementById('scenRow');
    if (scen) {
      var sub = scen.querySelector('.sec-sub'); if (sub) sub.textContent = 'Ответьте на 5 вопросов — подберём подходящие модели в наличии за 15 секунд.';
      if (scenRow) scenRow.style.display = 'none';
      var launch = document.createElement('button');
      launch.type = 'button'; launch.className = 'quiz-launch';
      launch.innerHTML = '🎯 Подобрать за 15 секунд';
      launch.onclick = open;
      (scenRow ? scenRow.parentNode : scen.querySelector('.container') || scen).insertBefore(launch, scenRow || null);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

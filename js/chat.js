/* AI-чат-консультант NEORIDE — общается с /api/chat (Claude). Самовнедряемый виджет. */
(function () {
  'use strict';

  // Бэкенд чата — Cloudflare Worker (workers.dev доступен в РФ без VPN, в отличие от CF-страниц).
  var API = 'https://neoride-bot.amenshikov007.workers.dev/api/chat';
  var GREETING = 'Привет! Я Олег, консультант NEORIDE 🛴\nПомогу выбрать электротранспорт под вашу задачу. Что ищете — самокат для города, подальше поездить или для подростка?';
  var QUICK = [
    'Посоветуй до 40 000 ₽',
    'Что для дальних поездок?',
    'Самый мощный самокат',
  ];

  // история для API (без приветствия — оно чисто визуальное); сохраняется между страницами
  var STORE = 'neoride_chat_v1';
  // стабильный короткий id гостя — чтобы владелец различал диалоги разных посетителей
  var sid;
  try {
    sid = localStorage.getItem('neoride_chat_sid');
    if (!sid) { sid = Math.random().toString(36).slice(2, 6); localStorage.setItem('neoride_chat_sid', sid); }
  } catch (e) { sid = '----'; }
  var history = [];
  try { history = JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e) { history = []; }
  function save() {
    try {
      history = history.slice(-20);
      localStorage.setItem(STORE, JSON.stringify(history));
    } catch (e) {}
  }
  var busy = false;
  var els = {};

  function build() {
    var fab = document.createElement('button');
    fab.className = 'chat-fab';
    fab.setAttribute('aria-label', 'Открыть чат с консультантом');
    fab.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.8 2 11.5c0 2.4 1.2 4.6 3.1 6.1-.1 1.1-.6 2.6-1.6 3.9 1.9-.3 3.6-1 4.9-1.9 1.1.3 2.3.5 3.6.5 5.5 0 10-3.8 10-8.6S17.5 3 12 3z"/></svg><span>Спросить ИИ</span>';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.className = 'chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Чат с консультантом NEORIDE');
    panel.innerHTML =
      '<div class="chat-head">' +
        '<div class="chat-ava">N</div>' +
        '<div><b>Олег · NEORIDE</b><span>● онлайн-консультант</span></div>' +
        '<button class="chat-x" aria-label="Закрыть">✕</button>' +
      '</div>' +
      '<div class="chat-log" id="chatLog"></div>' +
      '<div class="chat-quick" id="chatQuick"></div>' +
      '<div class="chat-input-row">' +
        '<textarea id="chatInput" rows="1" placeholder="Напишите вопрос…" autocomplete="off"></textarea>' +
        '<button class="chat-send" id="chatSend" aria-label="Отправить">' +
          '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 20.5l18-8.5L3 3.5 3 10l12 2-12 2z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="chat-note">Начиная чат, вы принимаете <a href="/privacy.html" target="_blank" rel="noopener">Политику</a> и <a href="/consent.html" target="_blank" rel="noopener">Согласие</a> на обработку ПДн · наличие и заказ подтверждает менеджер</div>';
    document.body.appendChild(panel);

    els.fab = fab;
    els.panel = panel;
    els.log = panel.querySelector('#chatLog');
    els.quick = panel.querySelector('#chatQuick');
    els.input = panel.querySelector('#chatInput');
    els.send = panel.querySelector('#chatSend');

    fab.onclick = function () { if (window.ymGoal) window.ymGoal('chat_open'); open(); };
    panel.querySelector('.chat-x').onclick = close;
    els.send.onclick = function () { submit(); };
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    els.input.addEventListener('input', function () {
      els.input.style.height = 'auto';
      els.input.style.height = Math.min(els.input.scrollHeight, 90) + 'px';
    });

    // восстановить переписку и открытое состояние после навигации/обновления
    renderLog();
    resumePending();
    try { if (localStorage.getItem(STORE + '_open') === '1') open(); } catch (e) {}
  }

  function renderLog() {
    if (els.log.children.length) return;
    addMsg('bot', GREETING);
    history.forEach(function (m) { addMsg(m.role === 'user' ? 'me' : 'bot', m.content); });
    if (!history.length) renderQuick();
  }

  function open() {
    els.panel.classList.add('open');
    els.fab.style.display = 'none';
    renderLog();
    try { localStorage.setItem(STORE + '_open', '1'); } catch (e) {}
    setTimeout(function () { els.input.focus(); }, 150);
  }
  function close() {
    els.panel.classList.remove('open');
    try { localStorage.setItem(STORE + '_open', '0'); } catch (e) {}
    els.fab.style.display = '';
  }

  function renderQuick() {
    els.quick.innerHTML = '';
    QUICK.forEach(function (q) {
      var b = document.createElement('button');
      b.textContent = q;
      b.onclick = function () { send(q); };
      els.quick.appendChild(b);
    });
  }

  // найти модель каталога по названию из маркера [[...]]
  function findModel(name) {
    if (typeof CATALOG === 'undefined' || !CATALOG) return null;
    var q = name.replace(/^kugoo\s+/i, '').split('/')[0].trim().toLowerCase();
    if (!q) return null;
    var list = CATALOG;
    return list.find(function (c) { return c.name.toLowerCase() === q; })
      || list.find(function (c) { return ('kugoo ' + c.name).toLowerCase() === name.toLowerCase(); })
      || list.find(function (c) { return c.name.toLowerCase().indexOf(q) === 0; })
      || list.find(function (c) { return q.indexOf(c.name.toLowerCase()) === 0 && c.name.length > 2; })
      || null;
  }

  function rub(n) { return n == null ? '' : Number(n).toLocaleString('ru-RU') + ' ₽'; }

  // bot-сообщение: маркеры [[Модель]] -> кликабельные ссылки на карточку
  function renderRich(el, text) {
    text.split(/(\[\[[^\]]+\]\])/g).forEach(function (p) {
      var mm = p.match(/^\[\[([^\]]+)\]\]$/);
      if (mm) {
        var model = findModel(mm[1]);
        if (model) {
          var a = document.createElement('a');
          a.className = 'chat-model';
          // всегда настоящая ссылка на страницу модели — кликабельна даже без модалки
          a.href = 'model/' + model.id + '.html';
          a.textContent = (model.brand || 'Kugoo') + ' ' + model.name + (model.price ? ' · ' + rub(model.price) : '');
          a.onclick = function (e) {
            if (typeof window.neorideOpenModel === 'function') {
              e.preventDefault();
              // на мобиле закрываем панель чата, иначе модалка откроется под ней
              if (window.matchMedia && window.matchMedia('(max-width:760px)').matches) { try { close(); } catch (x) {} }
              window.neorideOpenModel(model.id);
            }
          };
          el.appendChild(a);
        } else {
          el.appendChild(document.createTextNode(mm[1]));
        }
      } else if (p) {
        el.appendChild(document.createTextNode(p));
      }
    });
  }

  function addMsg(role, text) {
    var d = document.createElement('div');
    d.className = 'chat-msg ' + (role === 'me' ? 'me' : 'bot');
    if (role === 'bot' && /\[\[[^\]]+\]\]/.test(text)) { renderRich(d, text); }
    else { d.textContent = text; }
    els.log.appendChild(d);
    els.log.scrollTop = els.log.scrollHeight;
    return d;
  }

  function typing(on) {
    var t = els.log.querySelector('.chat-typing');
    if (on && !t) {
      t = document.createElement('div');
      t.className = 'chat-typing';
      t.innerHTML = '<i></i><i></i><i></i>';
      els.log.appendChild(t);
      els.log.scrollTop = els.log.scrollHeight;
    } else if (!on && t) {
      t.remove();
    }
  }

  function submit() {
    var v = els.input.value.trim();
    if (v) send(v);
  }

  // запрос ответа по текущей истории (используется и при отправке, и при авто-дозапросе)
  function requestReply() {
    busy = true;
    els.send.disabled = true;
    typing(true);
    return fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history, page: location.pathname, sid: sid }),
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (d) {
        typing(false);
        if (d && d.ok && d.reply) {
          history.push({ role: 'assistant', content: d.reply });
          save();
          addMsg('bot', d.reply);
        } else {
          addMsg('bot', 'Связь с консультантом прервалась 🙏 Напишите нам — ответим: MAX +7 910 402-88-58 или Telegram @neoride_shop_bot');
        }
      })
      .catch(function () {
        typing(false);
        addMsg('bot', 'Связь с консультантом сейчас недоступна. Напишите нам: MAX +7 910 402-88-58 или Telegram @neoride_shop_bot');
      })
      .finally(function () {
        busy = false;
        els.send.disabled = false;
      });
  }

  function send(text) {
    if (busy) return;
    els.quick.innerHTML = '';
    els.input.value = '';
    els.input.style.height = 'auto';
    addMsg('me', text);
    history.push({ role: 'user', content: text });
    save();
    requestReply().then(function () { els.input.focus(); });
  }

  // если страницу перелистнули, пока консультант думал — последний вопрос остался без ответа: дозапросим
  function resumePending() {
    if (busy) return;
    if (!history.length || history[history.length - 1].role !== 'user') return;
    requestReply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

/* Свернуть плавающие кнопки связи (Канал/MAX/ИИ/Telegram) в одну кнопку «Связь» —
   на мобиле они перекрывали контент. По тапу разворачиваются вверх, клик вне — закрытие. */
(function () {
  function init() {
    var fabs = [].slice.call(document.querySelectorAll('.channel-fab, .max-fab, .tg-fab, .chat-fab'));
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

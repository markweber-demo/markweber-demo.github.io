/* Shell — каркас страницы: тёмная шапка, меню роли, подвал, панель прототипа,
   кнопка «Замечание». Владелец — таск 02.

   Страница кладёт своё содержимое в <div id="page" data-screen="Имя экрана">
   и зовёт Shell.mount({ active, role }). Кнопки работают через data-act:
   экран регистрирует обработчик Shell.on('имя', fn). Кнопка без обработчика
   не молчит — открывает окно «появится в рабочей версии», а прибор видит её
   в body[data-dead-acts]. data-soon="Что" — то же окно сознательно.

   Данные — только через DATA и ACT, состояние — только через Store. */
(function (w) {
  'use strict';

  var NAV = {
    zakazchik: [
      { id: 'apparaty', title: 'Мои аппараты', href: 'apparaty.html' },
      { id: 'zayavka', title: 'Новая заявка', href: 'zayavka-novaya.html' }
    ],
    zavod: [
      { id: 'svodka', title: 'Сводка', href: 'svodka.html' },
      { id: 'voronka', title: 'Воронка', href: 'crm.html' },
      { id: 'zakazchiki', title: 'Заказчики', href: 'zakazchiki.html' },
      { id: 'servis', title: 'Сервис', href: 'crm.html#servis' }
    ]
  };
  var HOME = { zakazchik: 'apparaty.html', zavod: 'crm.html' };
  /* Своя главная человека (поле home в данных персоны, 11a) — у директора сводка;
     без поля — главная роли. Логотип, вход и возврат со страницы чужой роли идут сюда. */
  function glavnaya(role) {
    var m = safe(function () { return w.DATA.me(); }, null);
    return (m && m.side === role && m.home) || HOME[role] || 'index.html';
  }

  /* Что будет в рабочей версии — из спецификации, «после обследования» (R35, R50). */
  var POZZHE = [
    'Интеграция с 1С:ТОИР и ERP завода',
    'Уведомления на почту и в мессенджер',
    'Мобильная версия',
    'Разметка замечаний на чертеже',
    'Мониторинг оборудования в работе',
    'Несколько площадок одного заказчика',
    'Обмен паспортами между системами',
    'Опросные листы на все типы аппаратов'
  ];

  /* Справочник — один источник: имя завода из DATA.spravochnik(). */
  function spravochnik() { return safe(function () { return w.DATA.spravochnik(); }, null) || {}; }
  function zavodName() { var z = spravochnik().zavod; return z ? z.short || z.name : ''; }

  var ACTS = {};
  var dead = {};
  var cfg = { active: null, role: null, base: '' };
  var wired = false;

  function esc(s) { return w.Render ? w.Render.esc(s) : String(s == null ? '' : s); }
  function el(html) { var t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstElementChild; }
  function safe(fn, dflt) { try { var v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } }
  function url(href) { return (cfg.base || '') + href; }
  function hereFile() { return String(w.location.pathname).split('/').pop() || 'index.html'; }
  /* Разбор адреса один — Render.param. */
  function param(name) { return w.Render.param(name) || null; }

  var ICON = {
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>',
    panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>'
  };

  /* --- люди входа ----------------------------------------------------------
     Три демо-персоны: инженер установки и специалист по снабжению у главного
     заказчика (у кого больше всего контактов — ТАНЕКО), специалист отдела
     маркетинга и продаж у завода. Берём из DATA по должности. */
  function find(list, re, not) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== not && re.test(list[i].position || '')) { return list[i]; }
    }
    return null;
  }
  function lyudi() {
    var zz = safe(function () { return w.DATA.zakazchiki(); }, []) || [];
    var glavnyy = null;
    zz.forEach(function (z) {
      if (!glavnyy || (z.contacts || []).length > (glavnyy.contacts || []).length) { glavnyy = z; }
    });
    var zk = glavnyy ? glavnyy.contacts || [] : safe(function () { return w.DATA.lyudi({ side: 'zakazchik' }); }, []) || [];
    var zv = safe(function () { return w.DATA.lyudi({ side: 'zavod' }); }, []) || [];
    var snab = find(zk, /снабж|материально-техн/i);
    var inzh = find(zk, /гидроочист/i, snab) || find(zk, /инженер|механик/i, snab);
    return [
      { key: 'inzhener', role: 'zakazchik', title: 'Заказчик · инженер установки', p: inzh },
      { key: 'snab', role: 'zakazchik', title: 'Заказчик · снабжение', p: snab },
      { key: 'zavod', role: 'zavod', title: 'Завод · маркетинг и продажи', p: find(zv, /маркетинг|продаж/i) || zv[0] || null }
    ];
  }

  function me() { return safe(function () { return w.DATA.me(); }, null); }
  function company(m) {
    if (!m) { return ''; }
    if (m.side === 'zavod') { return zavodName(); }
    var z = m.zakazchikId ? safe(function () { return w.DATA.zakazchik(m.zakazchikId); }, null) : null;
    return z ? z.name : '';
  }
  function screenName() {
    var p = document.getElementById('page');
    return (p && p.getAttribute('data-screen')) || document.title || hereFile();
  }

  /* --- шапка, меню, подвал ------------------------------------------------
     Шапка светлая, как на сайте из концепции: синий юбилейный логотип слева,
     меню роли тонким текстом, справа кто вошёл и «Выйти». */
  function header() {
    var m = me();
    var who = m
      ? '<div class="who"><div class="who__text"><div class="who__name">' + esc(m.name) + '</div>' +
          '<div class="who__meta">' + esc([m.position, company(m)].filter(Boolean).join(' · ')) + '</div></div>' +
          '<button class="who__out" type="button" data-act="logout">Выйти</button></div>'
      : '';
    return el(
      '<header class="shell-header"><div class="container shell-header__in">' +
        '<a class="brand" href="' + esc(url(glavnaya(cfg.role))) + '">' +
          '<img class="brand__logo" src="' + esc(url('assets/img/logo-bmz-70-siniy.svg')) + '" ' +
            'alt="Бугульминский механический завод, 70 лет" width="138" height="40">' +
          '<span class="brand__name">' + (cfg.role === 'zavod' ? 'Работа с заказчиками' : 'Сервис заказчика') + '</span>' +
        '</a>' + nav() + who +
      '</div></header>');
  }

  function activeId() {
    if (cfg.role === 'zavod' && hereFile() === 'crm.html') {
      return w.location.hash === '#servis' ? 'servis' : 'voronka';
    }
    return cfg.active;
  }
  function nav() {
    var items = NAV[cfg.role] || [];
    if (!items.length) { return ''; }
    var a = activeId();
    return '<nav class="shell-nav" aria-label="Разделы">' +
      items.map(function (n) {
        return '<a class="shell-nav__item' + (n.id === a ? ' is-active' : '') + '" data-nav="' + n.id + '" href="' +
          esc(url(n.href)) + '"' + (n.id === a ? ' aria-current="page"' : '') + '>' + esc(n.title) + '</a>';
      }).join('') + '</nav>';
  }
  function refreshNav() {
    var a = activeId();
    document.querySelectorAll('.shell-nav__item').forEach(function (x) {
      var on = x.getAttribute('data-nav') === a;
      x.classList.toggle('is-active', on);
      if (on) { x.setAttribute('aria-current', 'page'); } else { x.removeAttribute('aria-current'); }
    });
  }
  function footer() {
    return el('<footer class="shell-footer"><div class="container shell-footer__in">Прототип. Данные демонстрационные</div></footer>');
  }

  /* --- кнопки в углу ------------------------------------------------------- */
  function notesCount() { return (safe(function () { return w.Store.notes(); }, []) || []).length; }
  function dock() {
    var n = notesCount();
    return el('<div class="proto-dock">' +
      '<button class="proto-btn proto-btn--light" type="button" data-act="note" title="Замечание к экрану" aria-label="Оставить замечание">' +
        ICON.note + (n ? '<span class="proto-btn__count">' + n + '</span>' : '') + '</button>' +
      '<button class="proto-btn" type="button" data-act="panel" aria-expanded="false" aria-controls="proto-panel" ' +
        'title="Панель прототипа. В рабочей версии её не будет" aria-label="Панель прототипа">' + ICON.panel + '</button>' +
      '</div>');
  }
  function refreshDock() {
    var old = document.querySelector('.proto-dock');
    if (old) {
      var open = !!document.getElementById('proto-panel');
      var fresh = dock();
      old.parentNode.replaceChild(fresh, old);
      if (open) { fresh.querySelector('[data-act="panel"]').setAttribute('aria-expanded', 'true'); }
    }
    var p = document.getElementById('proto-panel');
    if (p) { p.parentNode.replaceChild(panel(), p); }
  }

  /* --- ходы вне системы -----------------------------------------------------
     Действуют через ACT, активны по признакам DATA (apparat.mozhno.*), от
     сценариев не зависят. Своих правил у панели нет: правило живёт в dannye.js. */
  function vseApparaty() { return safe(function () { return w.DATA.apparaty({}); }, []) || []; }
  function mozhno(a) { return a.mozhno || {}; }
  var MOVES = {
    reviziya: {
      title: 'Конструктор выложил ревизию',
      why: 'Нет аппарата, где конструктору назначено задание и ход за ним',
      kandidaty: function () { return vseApparaty().filter(function (a) { return !!mozhno(a).reviziyu; }); },
      run: function (a) { w.ACT.vypustitReviziyu(a.id, mozhno(a).reviziyu); }
    },
    tkp: {
      title: 'ТКП принято, договор подписан',
      why: 'Нет аппарата, где ТКП направлено и ждёт ответа заказчика',
      kandidaty: function () { return vseApparaty().filter(function (a) { return !!mozhno(a).dogovor; }); },
      run: function (a) { w.ACT.tkpPrinyatoDogovor(a.id); }
    }
  };
  function apparatLabel(a) {
    var z = safe(function () { return w.DATA.zakazchik(a.zakazchikId); }, null);
    return [a.nazvanie, a.oboznachenie, a.techPoz ? 'поз. ' + a.techPoz : '', z ? z.name : ''].filter(Boolean).join(' · ');
  }
  function doMove(key, id) {
    var a = null;
    MOVES[key].kandidaty().forEach(function (x) { if (x.id === id) { a = x; } });
    if (a) { MOVES[key].run(a); }
    Shell.reload();
  }
  function startMove(key) {
    var m = MOVES[key], list = m.kandidaty();
    if (!list.length) { w.Render.modal({ title: m.title, text: m.why + '.' }); return; }
    if (list.length === 1) { doMove(key, list[0].id); return; }
    w.Render.modal({
      title: m.title,
      text: 'К какому аппарату?',
      body: '<div class="stack--tight">' + list.map(function (a) {
        return '<button class="btn btn--secondary btn--block" type="button" data-act="move-do" data-move="' + key +
          '" data-id="' + esc(a.id) + '">' + esc(apparatLabel(a)) + '</button>';
      }).join('') + '</div>',
      foot: '<button class="btn btn--secondary" type="button" data-close>Отмена</button>'
    });
  }

  /* --- панель прототипа ---------------------------------------------------- */
  function panelWho() {
    var role = safe(function () { return w.Store.role(); }, null);
    var person = safe(function () { return w.Store.person(); }, null);
    return '<div class="proto-panel__group"><p class="label">Роль и человек</p><div class="proto-who">' +
      lyudi().map(function (x) {
        var on = role === x.role && x.p && person === x.p.id;
        return '<button class="proto-who__opt' + (on ? ' is-active' : '') + '" type="button" data-act="switch" data-key="' + x.key + '"' +
          (on ? ' aria-pressed="true"' : ' aria-pressed="false"') + (x.p ? '' : ' disabled') + '>' +
          '<span class="proto-who__role">' + esc(x.title) + '</span>' +
          '<span class="proto-who__name">' + esc(x.p ? x.p.name + ', ' + x.p.position : 'нет в демо-данных') + '</span></button>';
      }).join('') + '</div></div>';
  }
  function panelTur() {
    if (!w.Tur || !w.Tur.current) { return ''; }
    var cur = safe(function () { return w.Tur.current(); }, null);
    var list = safe(function () { return w.Tur.list ? w.Tur.list() : null; }, null) || [
      { id: 'A', title: 'А. Новый аппарат: от опросного листа до согласованного чертежа' },
      { id: 'B', title: 'Б. Где мой аппарат' },
      { id: 'V', title: 'В. Аппарат в эксплуатации' }
    ];
    var step = cur
      ? '<div class="proto-step"><p class="label">Шаг ' + esc(cur.step) + ' из ' + esc(cur.total) + '</p>' +
          '<p class="small">' + esc(cur.text) + '</p>' +
          '<button class="btn btn--primary btn--sm" type="button" data-act="tur-go" data-id="' + esc(cur.scenario) + '">Перейти</button></div>'
      : '';
    return '<div class="proto-panel__group" data-block="tur"><p class="label">Сценарии</p>' + step +
      '<div class="proto-scen">' + list.map(function (s) {
        var on = cur && cur.scenario === s.id;
        return '<button class="proto-who__opt' + (on ? ' is-active' : '') + '" type="button" data-act="tur-go" data-id="' + esc(s.id) + '">' +
          '<span class="proto-who__role">' + esc(s.title) + '</span></button>';
      }).join('') + '</div></div>';
  }
  function panelMoves() {
    return '<div class="proto-panel__group"><p class="label">Ходы вне системы</p><div class="proto-moves">' +
      Object.keys(MOVES).map(function (k) {
        var m = MOVES[k], n = m.kandidaty().length;
        return '<button class="btn btn--secondary btn--sm btn--block" type="button" data-act="move" data-move="' + k + '"' +
          (n ? '' : ' disabled title="' + esc(m.why) + '"') + '>' + esc(m.title) + '</button>' +
          (n ? '' : '<p class="proto-moves__why">' + esc(m.why) + '</p>');
      }).join('') + '</div></div>';
  }
  function panel() {
    var n = notesCount();
    return el('<div class="proto-panel" id="proto-panel" role="dialog" aria-label="Панель прототипа">' +
      '<div class="proto-panel__head"><p class="proto-panel__title">Панель прототипа</p>' +
        '<p class="proto-panel__sub">В рабочей версии её не будет</p></div>' +
      panelWho() + panelTur() + panelMoves() +
      '<div class="proto-panel__group"><details class="proto-later"><summary>Что будет в рабочей версии</summary>' +
        '<ul>' + POZZHE.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<p class="small muted">Состав и порядок уточняются после обследования.</p></details></div>' +
      '<div class="proto-panel__group proto-panel__actions">' +
        '<button class="btn btn--secondary btn--sm btn--block" type="button" data-act="notes-copy">Скопировать замечания' +
          (n ? ' (' + n + ')' : '') + '</button>' +
        '<button class="btn btn--danger btn--sm btn--block" type="button" data-act="reset">Сбросить демо</button>' +
      '</div></div>');
  }
  function togglePanel(force) {
    var open = document.getElementById('proto-panel');
    var btn = document.querySelector('[data-act="panel"]');
    var want = force === undefined ? !open : force;
    if (!want && open) { open.parentNode.removeChild(open); }
    if (want && !open) { document.body.appendChild(panel()); }
    if (btn) { btn.setAttribute('aria-expanded', want ? 'true' : 'false'); }
  }

  /* --- смена роли: ближайшая по смыслу страница (R53i) --------------------- */
  function blizhayshaya(role) {
    var f = hereFile();
    var id = param('id');
    if ((f === 'apparat.html' || f === 'pasport.html') && id) {
      return safe(function () { return w.DATA.apparat(id); }, null) ? f + '?id=' + encodeURIComponent(id) : glavnaya(role);
    }
    if (f === 'proverka.html') { return f + w.location.search; }
    var own = (NAV[role] || []).some(function (n) { return n.href.split('#')[0] === f; });
    if (own && role === cfg.role) { return f + w.location.search + w.location.hash; }
    return glavnaya(role);
  }
  function switchTo(key) {
    var x = null;
    lyudi().forEach(function (y) { if (y.key === key) { x = y; } });
    if (!x || !x.p) { return; }
    w.Store.setRole(x.role);
    w.Store.setPerson(x.p.id);
    Shell.navigate(url(blizhayshaya(x.role)));
  }

  /* --- замечания ----------------------------------------------------------- */
  var noteModal = null;
  function noteDialog() {
    noteModal = w.Render.modal({
      title: 'Замечание к экрану «' + screenName() + '»',
      text: 'Пометка сохранится в этом браузере вместе с названием экрана и ролью. Чтобы забрать все пометки, нажмите «Скопировать замечания» в панели прототипа.',
      body: '<label class="field"><span class="field__label label">Текст замечания</span>' +
        '<textarea class="textarea" id="note-text" rows="4"></textarea></label>',
      foot: '<button class="btn btn--primary" type="button" data-act="note-save">Сохранить</button>' +
        '<button class="btn btn--secondary" type="button" data-close>Отмена</button>',
      onClose: function () { noteModal = null; }
    });
  }
  function saveNote() {
    if (!noteModal) { return; }
    var f = noteModal.querySelector('#note-text');
    var text = f ? f.value.trim() : '';
    if (!text) { if (f) { f.classList.add('input--error'); f.focus(); } return; }
    /* Store хранит ровно { screen, text, role, at }: столько и пишем. */
    w.Store.addNote({ screen: screenName(), text: text, role: w.Store.role() });
    noteModal.close();
    refreshDock();
  }
  function notesText() {
    var list = safe(function () { return w.Store.notes(); }, []) || [];
    return list.map(function (n, i) {
      var who = n.role === 'zavod' ? 'завод' : n.role === 'zakazchik' ? 'заказчик' : '';
      var d = n.at && w.Render ? w.Render.data(n.at, { format: 'docTime' }) : '';
      return (i + 1) + '. «' + (n.screen || '') + '»' + (who ? ', ' + who : '') + (d ? ', ' + d : '') + '\n' + (n.text || '');
    }).join('\n\n');
  }
  /* По file:// асинхронный буфер обмена может не ответить — копируем синхронно
     и в любом случае показываем результат. */
  function copyNotes() {
    var text = notesText();
    if (!text) {
      w.Render.modal({ title: 'Замечаний пока нет', text: 'Кнопка «Замечание» есть на каждом экране, в правом нижнем углу. Пометка попадёт в этот список.' });
      return;
    }
    var ok = false;
    try {
      var box = document.createElement('textarea');
      box.value = text; box.setAttribute('readonly', 'readonly');
      box.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(box); box.select();
      ok = document.execCommand('copy');
      document.body.removeChild(box);
    } catch (e) { ok = false; }
    w.Render.modal(ok
      ? { title: 'Замечания скопированы', text: 'Список скопирован простым текстом, его можно вставить в письмо.' }
      : { title: 'Замечания', text: 'Скопировать автоматически не получилось. Выделите текст ниже и скопируйте его.',
          body: '<textarea class="textarea" rows="10" readonly>' + esc(text) + '</textarea>' });
  }

  /* --- действия каркаса ---------------------------------------------------- */
  function registerShellActs() {
    ACTS.panel = function () { togglePanel(); };
    ACTS.note = function () { noteDialog(); };
    ACTS['note-save'] = function () { saveNote(); };
    ACTS['notes-copy'] = function () { copyNotes(); };
    ACTS.switch = function (t) { switchTo(t.getAttribute('data-key')); };
    ACTS.move = function (t) { startMove(t.getAttribute('data-move')); };
    ACTS['move-do'] = function (t) { doMove(t.getAttribute('data-move'), t.getAttribute('data-id')); };
    ACTS['tur-go'] = function (t) { w.Tur.go(t.getAttribute('data-id')); };
    ACTS.logout = function () { Shell.navigate(url('index.html')); };
    ACTS.reset = function () {
      w.Render.modal({
        title: 'Сбросить демо?',
        text: 'Все действия в прототипе отменятся, данные вернутся к исходным. Войти нужно будет заново.',
        foot: '<button class="btn btn--primary" type="button" data-act="reset-do">Сбросить</button>' +
          '<button class="btn btn--secondary" type="button" data-close>Отмена</button>'
      });
    };
    ACTS['reset-do'] = function () { w.Store.reset(); Shell.navigate(url('index.html')); };
    publishActs();
  }
  function publishActs() {
    if (document.body) { document.body.setAttribute('data-live-acts', Object.keys(ACTS).join(' ')); }
  }

  function wire() {
    if (wired) { return; }
    wired = true;
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-act], [data-soon]') : null;
      if (!t || t.disabled) { return; }
      if (t.hasAttribute('data-soon')) { e.preventDefault(); w.Render.soon(t.getAttribute('data-soon') || undefined); return; }
      var act = t.getAttribute('data-act');
      e.preventDefault();
      if (ACTS[act]) { ACTS[act](t, e); return; }
      /* Незарегистрированное действие: смотрящий видит окно, прибор — находку. */
      dead[act] = true;
      document.body.setAttribute('data-dead-acts', Object.keys(dead).join(' '));
      w.Render.soon();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('proto-panel') && !document.querySelector('.modal-backdrop')) { togglePanel(false); }
    });
    w.addEventListener('hashchange', refreshNav);
  }

  var Shell = {
    /** active — id пункта меню ('apparaty', 'zayavka', 'svodka', 'voronka', 'zakazchiki', 'servis');
        role — чья страница: 'zakazchik' | 'zavod'; без role — страница обеих ролей;
        bare: true — без шапки и меню (вход, проверка); base — префикс адресов (для стендов).
        Не вошёл — уводит на вход; чужая роль — на главную своей. Возвращает false, если увёл. */
    mount: function (o) {
      o = o || {};
      cfg = { active: o.active || null, role: null, base: o.base || '' };
      var role = safe(function () { return w.Store.role(); }, null);
      if (!o.bare) {
        if (!role) { Shell.navigate(url('index.html')); return false; }
        if (o.role && o.role !== role) { Shell.navigate(url(glavnaya(role))); return false; }
      }
      cfg.role = role;
      registerShellActs();
      var page = document.getElementById('page');
      if (!o.bare && page) {
        var main = el('<main class="shell-main" id="main"><div class="container"></div></main>');
        page.parentNode.insertBefore(main, page);
        main.firstChild.appendChild(page);
        document.body.insertBefore(header(), document.body.firstChild);
        document.body.classList.add('shell');
        main.parentNode.insertBefore(footer(), main.nextSibling);
      }
      document.body.appendChild(dock());
      wire();
      return true;
    },
    /** Экран регистрирует действие: Shell.on('otvet', fn) для data-act="otvet"; fn(кнопка, событие). */
    on: function (act, fn) { ACTS[act] = fn; publishActs(); return Shell; },
    /** Зарегистрированные действия страницы. */
    acts: function () { return Object.keys(ACTS); },
    /** Переход. Стенды подменяют, чтобы проверить адрес без ухода со страницы. */
    navigate: function (href) { w.location.href = href; },
    /** Перечитать экран после хода: страница рисуется заново из DATA. */
    reload: function () { w.location.reload(); },
    /** Перерисовать счётчик замечаний и открытую панель без перезагрузки. */
    refresh: function () { refreshDock(); },
    /** Открыть или закрыть панель прототипа: true, false или без аргумента — переключить. */
    panel: function (open) { togglePanel(open); },
    /** Главная страница роли. */
    home: function (role) { return HOME[role] || 'index.html'; },
    /** Своя главная вошедшего человека: поле home персоны, иначе главная роли (11a). */
    glavnaya: function (role) { return glavnaya(role || cfg.role); },
    /** Пункты меню роли. */
    nav: function (role) { return (NAV[role || cfg.role] || []).slice(); },
    /** Демо-персоны входа: [{ key: 'inzhener'|'snab'|'zavod', role, title, p: {id, name, position} | null }]. */
    lyudi: lyudi,
    /** Роль, с которой смонтирована страница. */
    role: function () { return cfg.role; },
    /** Текст замечаний, как его кладёт «Скопировать замечания». */
    notesText: notesText
  };

  w.Shell = Shell;
})(window);

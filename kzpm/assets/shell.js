/* Shell — каркас страницы кабинета: шапка как у сайта kzpm.com, меню роли,
   подвал, кнопка и панель ведущего. Владелец — таск 02, перенесено из каркаса
   БМЗ (без окна замечаний и ходов вне системы).

   Страница кладёт содержимое в <div id="page" data-screen="Имя экрана">
   и зовёт Shell.mount({ active, role }). Кнопки работают через data-act:
   экран регистрирует обработчик Shell.on('имя', fn). Кнопка без обработчика
   не молчит — открывает окно «Появится в рабочей версии», а прибор видит её
   в body[data-dead-acts]. data-soon="Что" — то же окно сознательно.

   Один кабинет на все роли (R18): шапка, стиль и название одни, меняется
   меню. Меню берётся по DATA.me().rol. Содержимое панели ведущего даёт
   tur.js (Tur.panel), блок «Сменить роль» и «Сбросить демо» каркас дописывает сам.

   Данные — только через DATA, состояние — только через Store. */
(function (w) {
  'use strict';

  var NAZVANIE = 'Личный кабинет заказчика';

  /* Меню роли — спецификация, «Каркас на всех экранах». id пункта = имя файла
     экрана: его передаёт страница в Shell.mount({ active }). Руководитель
     видит «Сводку», а из неё ходит в списки сотрудника на просмотр. */
  var ZAKAZCHIK = [
    { id: 'kabinet', title: 'Главная', href: 'kabinet.html' },
    { id: 'produkty', title: 'Продукты и образцы', href: 'produkty.html' },
    { id: 'zakazy', title: 'Заказы', href: 'zakazy.html' },
    { id: 'otgruzki', title: 'Отгрузки', href: 'otgruzki.html' },
    { id: 'dokumenty', title: 'Документы', href: 'dokumenty.html' },
    { id: 'pretenzii', title: 'Претензии', href: 'pretenzii.html' }
  ];
  var SOTRUDNIK = [
    { id: 'ochered', title: 'Очередь', href: 'ochered.html' },
    { id: 'produkty', title: 'Запросы и образцы', href: 'produkty.html' },
    { id: 'zakazy', title: 'Заказы', href: 'zakazy.html' },
    { id: 'otgruzki', title: 'Отгрузки', href: 'otgruzki.html' },
    { id: 'pretenzii', title: 'Претензии', href: 'pretenzii.html' }
  ];
  var NAV = {
    zakazchik: ZAKAZCHIK,
    menedzher: SOTRUDNIK,
    servis: SOTRUDNIK,
    direktor: [{ id: 'svodka', title: 'Сводка', href: 'svodka.html' }]
  };
  /* Главная стороны, если человек не выбран: персона по умолчанию в dannye.js —
     закупщик и менеджер. У человека своя главная — поле home в данных. */
  var HOME = { zakazchik: 'kabinet.html', zavod: 'ochered.html' };

  var ACTS = {};
  var dead = {};
  var cfg = { active: null, role: null, base: '' };
  var wired = false;

  function esc(s) { return w.Render ? w.Render.esc(s) : String(s == null ? '' : s); }
  function el(html) { var t = document.createElement('div'); t.innerHTML = html.trim(); return t.firstElementChild; }
  function safe(fn, dflt) { try { var v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } }
  function url(href) { return (cfg.base || '') + href; }
  function me() { return safe(function () { return w.DATA.me(); }, null); }
  function hereFile() { return String(w.location.pathname).split('/').pop() || 'index.html'; }

  /* Своя главная вошедшего: home персоны, иначе главная стороны.
     Логотип, вход и уход со страницы чужой роли ведут сюда. */
  function glavnaya(role) {
    var m = me();
    var r = role || (m ? m.side : null);
    return (m && m.side === r && m.home) || HOME[r] || 'index.html';
  }
  function navOf(rol) {
    if (!rol) { var m = me(); rol = m ? m.rol : null; }
    return (NAV[rol] || []).map(function (n) { return { id: n.id, title: n.title, href: n.href }; });
  }

  var ICON = {
    panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>'
  };

  /* --- шапка, меню, подвал ------------------------------------------------
     Верхняя полоса как у сайта: белая, 72 px, логотип сайта 36 px, граница
     #dedde3. Рядом с логотипом название кабинета; у сотрудников КЗПМ под ним
     пометка, что это вход сотрудника, — название при этом то же. Справа кто
     вошёл и «Выйти». Ниже — меню роли. */
  function header() {
    var m = me();
    var staff = m && m.side === 'zavod';
    var meta = !m ? '' : staff ? m.predpriyatie : [m.position, m.predpriyatie].filter(Boolean).join(' · ');
    var who = m
      ? '<div class="who"><div class="who__text"><div class="who__name">' + esc(m.name) + '</div>' +
          '<div class="who__meta">' + esc(meta) + '</div></div>' +
          '<button class="btn btn--secondary btn--sm who__out" type="button" data-act="logout">Выйти</button></div>'
      : '';
    return el(
      '<header class="shell-header">' +
        '<div class="shell-header__top"><div class="container shell-header__in">' +
          '<a class="brand" href="' + esc(url(glavnaya(cfg.role))) + '">' +
            '<img class="brand__logo" src="' + esc(url('assets/img/logo.svg')) + '" alt="Камский завод полимерных материалов" width="138" height="36">' +
            '<span class="brand__text"><span class="brand__name">' + NAZVANIE + '</span>' +
              (staff ? '<span class="brand__staff">Вход для сотрудников КЗПМ</span>' : '') + '</span>' +
          '</a>' + who +
        '</div></div>' + nav() +
      '</header>');
  }

  function nav() {
    var items = navOf();
    if (!items.length) { return ''; }
    var a = cfg.active;
    return '<nav class="shell-nav" aria-label="Разделы"><div class="container shell-nav__in">' +
      items.map(function (n) {
        return '<a class="shell-nav__item' + (n.id === a ? ' is-active' : '') + '" data-nav="' + esc(n.id) + '" href="' +
          esc(url(n.href)) + '"' + (n.id === a ? ' aria-current="page"' : '') + '>' + esc(n.title) + '</a>';
      }).join('') + '</div></nav>';
  }

  /* Подвал фиолетовый, как у сайта, белый логотип на однородной заливке
     (брендбук, стр. 7 и 10). Строка одна. */
  function footer() {
    return el('<footer class="shell-footer"><div class="container shell-footer__in">' +
      '<img class="shell-footer__logo" src="' + esc(url('assets/img/logo-white.svg')) + '" alt="" aria-hidden="true" width="108" height="28">' +
      '<span>Прототип. Данные демонстрационные</span></div></footer>');
  }

  /* --- панель ведущего ----------------------------------------------------- */
  function dock() {
    return el('<div class="proto-dock">' +
      '<button class="proto-btn" type="button" data-act="panel" aria-expanded="false" aria-controls="proto-panel" ' +
        'title="Панель ведущего. В рабочей версии её не будет">' + ICON.panel + '<span>Панель ведущего</span></button>' +
      '</div>');
  }
  /* --- смена роли из панели --------------------------------------------------
     На входе три двери (решение Аделя 13.10), все люди демо — здесь: предприятия
     с закупщиком и технологом, затем менеджер по продажам, служба сервиса,
     генеральный директор. Блок стоит под сценариями и свёрнут: сценарии первые.
     Щелчок меняет роль и человека без выхода и открывает ближайшую по смыслу
     страницу (blizhayshaya). */
  var PORYADOK_KZPM = ['menedzher', 'servis', 'direktor'];
  function lyudiRoli() {
    var vse = safe(function () { return w.DATA.lyudi(); }, []) || [];
    var kzpm = PORYADOK_KZPM.map(function (k) { return vse.filter(function (p) { return p.key === k && p.side === 'zavod'; })[0]; });
    return vse.filter(function (p) { return p.side === 'zakazchik'; }).concat(kzpm.filter(Boolean));
  }
  function panelRol() {
    var spisok = lyudiRoli(), m = me(), tek = m ? m.id : null, gruppy = [], kto = null;
    if (!spisok.length) { return ''; }
    spisok.forEach(function (p) {
      var g = gruppy[gruppy.length - 1];
      if (!g || g.title !== p.predpriyatie) { g = { title: p.predpriyatie, lyudi: [] }; gruppy.push(g); }
      g.lyudi.push(p);
      if (p.id === tek) { kto = p; }
    });
    function knopka(p) {
      var on = p.id === tek, sub = p.side === 'zakazchik' ? p.position : '';
      if (on) { sub = sub ? sub + ' · сейчас' : 'Сейчас'; }
      return '<button class="proto-opt' + (on ? ' is-active' : '') + '" type="button" data-act="smenit-rol" data-id="' + esc(p.id) + '"' +
        (on ? ' aria-current="true"' : '') + '><span class="proto-opt__title">' + esc(p.name) + '</span>' +
        (sub ? '<span class="proto-opt__sub">' + esc(sub) + '</span>' : '') + '</button>';
    }
    return '<div class="proto-panel__group" data-block="rol"><details class="proto-rol">' +
      '<summary><span class="label">Сменить роль</span>' +
        (kto ? '<span class="proto-rol__seychas">Сейчас: ' + esc(kto.side === 'zakazchik' && kto.position ?
          kto.name + ', ' + kto.position.charAt(0).toLowerCase() + kto.position.slice(1) : kto.name) + '</span>' : '') +
      '</summary>' +
      gruppy.map(function (g) {
        return '<p class="label proto-sub">' + esc(g.title) + '</p><div class="proto-scen">' + g.lyudi.map(knopka).join('') + '</div>';
      }).join('') + '</details></div>';
  }
  /* Ближайшая по смыслу страница для того, кто только что стал текущим (byl — кем был):
       * карточка заказа, продукта или претензии остаётся, если новый человек её видит;
       * форма запроса остаётся у заказчика; страница товара остаётся собой;
       * раздел остаётся, если он есть в меню новой роли, а его параметры —
         только у той же стороны и того же предприятия;
       * иначе — главная нового человека.
     role, person и panel из адреса снимаются: иначе страница вернула бы прежнего. */
  var KARTOCHKA = { 'zakaz.html': 'zakaz', 'produkt.html': 'produkt', 'pretenziya.html': 'pretenziya' };
  function blizhayshaya(byl) {
    var m = me(), f = hereFile();
    if (!m) { return 'index.html'; }
    var q = String(w.location.search || '').replace(/^\?/, '').split('&').filter(function (kv) {
      return kv && !/^(role|person|panel)=/.test(kv);
    }).join('&');
    var tam = f + (q ? '?' + q : '') + String(w.location.hash || '');
    if (f === 'sayt-ffs.html') { return tam; }
    if (KARTOCHKA[f]) {
      var id = safe(function () { return w.Render.param('id'); }, '');
      return id && safe(function () { return w.DATA[KARTOCHKA[f]](id); }, null) ? tam : glavnaya(m.side);
    }
    if (f === 'zapros-novyy.html') { return m.side === 'zakazchik' ? tam : glavnaya(m.side); }
    if (!navOf(m.rol).some(function (n) { return n.href === f; })) { return glavnaya(m.side); }
    var teZhe = !!byl && byl.side === m.side && (m.side === 'zavod' || byl.zakazchikId === m.zakazchikId);
    return teZhe ? tam : f;
  }
  function smenitRol(id) {
    var p = null;
    lyudiRoli().forEach(function (x) { if (x.id === id) { p = x; } });
    if (!p) { return; }
    var byl = me();
    w.Store.setRole(p.side);
    w.Store.setPerson(p.id);
    Shell.navigate(url(blizhayshaya(byl)));
  }

  function panel() {
    var tur = safe(function () { return w.Tur && w.Tur.panel ? w.Tur.panel() : ''; }, '') || '';
    return el('<div class="proto-panel" id="proto-panel" role="dialog" aria-label="Панель ведущего">' +
      '<div class="proto-panel__head"><p class="proto-panel__title">Панель ведущего</p>' +
        '<p class="proto-panel__sub">В рабочей версии её не будет</p></div>' +
      tur + safe(panelRol, '') +
      '<div class="proto-panel__group proto-panel__actions">' +
        '<button class="btn btn--danger btn--sm btn--block" type="button" data-act="reset">Сбросить демо</button>' +
      '</div></div>');
  }
  /* Текущий шаг сценария (aria-current="step" у шага или у итога) стоит ниже списка сценариев
     и может не поместиться в невысокое окно. Панель прокручивается к нему, только если он
     виден не целиком: шаг встаёт под шапку панели. */
  function pokazatTekushchiy() {
    var p = document.getElementById('proto-panel'), c = p ? p.querySelector('[aria-current="step"]') : null;
    if (!c) { return; }
    var head = p.querySelector('.proto-panel__head'), hh = head ? head.getBoundingClientRect().height : 0;
    var pr = p.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (cr.top >= pr.top + hh && cr.bottom <= pr.bottom) { return; }
    p.scrollTop = Math.max(0, p.scrollTop + (cr.top - pr.top) - hh - 12);
  }
  function togglePanel(force) {
    var open = document.getElementById('proto-panel');
    var btn = document.querySelector('.proto-dock [data-act="panel"]');
    var want = force === undefined ? !open : !!force;
    if (!want && open) { open.parentNode.removeChild(open); }
    if (want && !open) {
      document.body.appendChild(panel());
      pokazatTekushchiy();
      /* размеры считаются по загруженному шрифту, иначе шаг окажется «ниже края» зря */
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(pokazatTekushchiy); }
    }
    if (btn) { btn.setAttribute('aria-expanded', want ? 'true' : 'false'); }
  }
  /* После хода панель рисуется заново: прокрутка остаётся прежней, а новый текущий шаг
     виден целиком без ручной прокрутки. */
  function refreshPanel() {
    var p = document.getElementById('proto-panel');
    if (!p) { return; }
    var top = p.scrollTop, nov = panel();
    p.parentNode.replaceChild(nov, p);
    nov.scrollTop = top;
    pokazatTekushchiy();
  }

  /* --- действия каркаса ---------------------------------------------------- */
  function registerShellActs() {
    ACTS.panel = function () { togglePanel(); };
    ACTS['smenit-rol'] = function (t) { smenitRol(t.getAttribute('data-id')); };
    ACTS.logout = function () { Shell.navigate(url('index.html')); };
    ACTS.reset = function () {
      w.Render.modal({
        title: 'Сбросить демо?',
        text: 'Все действия в прототипе будут отменены, и демо-данные станут исходными. После сброса нужно войти заново.',
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
  }

  var Shell = {
    /** active — id пункта меню, он же имя файла экрана ('kabinet', 'produkty', 'zakazy', 'otgruzki',
        'dokumenty', 'pretenzii', 'ochered', 'svodka'); role — чья страница: 'zakazchik' | 'zavod';
        без role — страница обеих сторон; bare: true — без шапки, меню и подвала (вход);
        base — префикс адресов (для стендов). Страница чужой стороны уводит на свою главную.
        Возвращает false, если увёл: страница обязана выйти. */
    mount: function (o) {
      o = o || {};
      cfg = { active: o.active || null, role: null, base: o.base || '' };
      var role = safe(function () { return w.Store.role(); }, null);
      if (!o.bare) {
        /* Не вошёл — на вход, а после входа обратно на эту страницу с её параметрами. */
        if (!role) { Shell.navigate(url('index.html?next=' + encodeURIComponent(hereFile() + w.location.search + w.location.hash))); return false; }
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
      /* Место под кнопку панели страница может дать сама (вход): тогда кнопка стоит
         в потоке и не наезжает на содержимое. Иначе — в правом нижнем углу. */
      var slot = document.getElementById('proto-dock-slot'), d = dock();
      if (slot) { d.classList.add('proto-dock--inline'); slot.appendChild(d); } else { document.body.appendChild(d); }
      wire();
      return true;
    },
    /** Экран регистрирует действие: Shell.on('poluchil', fn) для data-act="poluchil"; fn(кнопка, событие). */
    on: function (act, fn) { ACTS[act] = fn; publishActs(); return Shell; },
    /** Зарегистрированные действия страницы. */
    acts: function () { return Object.keys(ACTS); },
    /** Переход. Стенды подменяют, чтобы проверить адрес без ухода со страницы. */
    navigate: function (href) { w.location.href = href; },
    /** Перечитать экран после хода: страница рисуется заново из DATA. */
    reload: function () { w.location.reload(); },
    /** Перерисовать открытую панель ведущего после хода, без перезагрузки. */
    refresh: function () { refreshPanel(); },
    /** Открыть или закрыть панель ведущего: true, false или без аргумента — переключить. */
    panel: function (open) { togglePanel(open); },
    /** Своя главная вошедшего: home персоны, иначе главная стороны ('zakazchik' | 'zavod'). */
    glavnaya: function (role) { return glavnaya(role || cfg.role); },
    /** Пункты меню роли: rol из DATA.me().rol ('zakazchik' | 'menedzher' | 'servis' | 'direktor'),
        без аргумента — того, кто вошёл. [{ id, title, href }] */
    nav: function (rol) { return navOf(rol); },
    /** Сторона, с которой смонтирована страница: 'zakazchik' | 'zavod'. */
    role: function () { return cfg.role; },
    /** Ошибки полей формы по правилам слоя данных: pravila — форма из DATA.spravochnik().formy
        ({ поле: { pusto?, format?, min?, posle?, oshibka? } }), znacheniya — { поле: значение }.
        → { поле: текст ошибки из правила }; пустой объект — ошибок нет. Своих правил и текстов
        здесь нет: только сверка значения с тем, что задано в правиле. */
    proverit: function (pravila, znacheniya) {
      var e = {};
      znacheniya = znacheniya || {};
      function zn(k) { var v = znacheniya[k]; return String(v === null || v === undefined ? '' : v).trim(); }
      Object.keys(pravila || {}).forEach(function (k) {
        var p = pravila[k] || {}, v = zn(k);
        if (!v) { if (p.pusto) { e[k] = p.pusto; } return; }
        var ne = (p.format && !new RegExp(p.format).test(v)) || (p.min && v < p.min) || (p.posle && zn(p.posle) && v <= zn(p.posle));
        if (ne) { e[k] = p.oshibka || p.pusto || ''; }
      });
      return e;
    }
  };

  w.Shell = Shell;
})(window);

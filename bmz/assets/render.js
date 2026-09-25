/* Render — общие блоки прототипа: лента этапов, плашка «на ком шаг», таблица,
   окно, пустое состояние, код ответа, дата.
   Владелец — таск 02. После таска 04 не расширяется: блок одной страницы
   живёт в её page-*.js.

   Блоки, отдающие разметку, возвращают строку HTML — экран вставляет её сам.
   Окно (modal, soon) рисуется сразу и возвращает узел с методом close().
   Данные блоки читают только через DATA и только чтобы узнать, кто смотрит. */
(function (w) {
  'use strict';

  var MESYACY = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  /* Коды ответа: здесь только классы, названия — из DATA.spravochnik().kody. */
  var KOD_CLS = { 1: 'kod--1', 2: 'kod--2', 3: 'kod--3', 4: 'kod--4' };
  function kodTitle(kod) {
    try { var k = w.DATA.spravochnik().kody || {}; return k[kod] || ''; } catch (e) { return ''; }
  }

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* --- даты ----------------------------------------------------------------
     ISO читаем как календарную дату без сдвига часового пояса: «2026-10-09»
     в Москве и в Лондоне — 9 октября. Если есть время — берём местное. */
  function parse(iso) {
    if (iso instanceof Date) { return iso; }
    if (!iso) { return null; }
    var s = String(iso);
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) { return new Date(+m[1], +m[2] - 1, +m[3]); }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function daysBetween(a, b) { return Math.round((dayStart(b) - dayStart(a)) / 86400000); }
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) { return many; }
    if (b > 1 && b < 5) { return few; }
    if (b === 1) { return one; }
    return many;
  }
  function dney(n) { return n + ' ' + plural(n, 'день', 'дня', 'дней'); }

  /** format: 'text' (по умолчанию) — «9 октября», чужой год дописывается;
      'full' — «9 октября 2026»; 'doc' — «09.10.2026»; 'docTime' — «09.10.2026 14:05»;
      'rel' — «сегодня», «завтра», «через 3 дня», «5 дней назад». Пусто — «—». */
  function data(iso, o) {
    var d = parse(iso);
    if (!d) { return '—'; }
    var f = (o && o.format) || 'text';
    var now = new Date();
    if (f === 'doc') { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
    if (f === 'docTime') { return data(d, { format: 'doc' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    if (f === 'rel') {
      var n = daysBetween(now, d);
      if (n === 0) { return 'сегодня'; }
      if (n === 1) { return 'завтра'; }
      if (n === -1) { return 'вчера'; }
      return n > 0 ? 'через ' + dney(n) : dney(-n) + ' назад';
    }
    var t = d.getDate() + '\u00a0' + MESYACY[d.getMonth()];  /* число и месяц не рвутся на строки */
    if (f === 'full' || d.getFullYear() !== now.getFullYear()) { t += ' ' + d.getFullYear(); }
    return t;
  }

  /* --- кто смотрит -------------------------------------------------------- */
  function side() {
    try { var me = w.DATA && w.DATA.me ? w.DATA.me() : null; return me ? me.side : null; }
    catch (e) { return null; }
  }

  /* --- лента этапов --------------------------------------------------------
     Пройденные с датой, текущий выделен, будущие с плановой датой.
     o.mini — полоска отрезков для строк списков, подпись текущего этапа в title. */
  function etapy(apparat, o) {
    var list = (apparat && apparat.etapy) || [];
    if (!list.length) { return ''; }
    if (o && o.mini) {
      var cur = null;
      list.forEach(function (e) { if (e.status === 'current') { cur = e; } });
      return '<div class="etapy-mini" role="img" aria-label="Этап: ' + esc(cur ? cur.title : '—') + '"' +
        ' title="' + esc(cur ? cur.title : '') + '">' +
        list.map(function (e) { return '<span class="etapy-mini__seg is-' + esc(e.status) + '"></span>'; }).join('') +
        '</div>';
    }
    return '<ol class="etapy" aria-label="Этапы">' + list.map(function (e) {
      var when = '';
      if (e.status === 'done') { when = data(e.date); }
      else if (e.status === 'current') { when = e.date ? 'сейчас · до ' + data(e.date) : 'сейчас'; }
      else { when = e.date ? 'план · ' + data(e.date) : 'план'; }
      return '<li class="etapy__item is-' + esc(e.status) + '" data-etap="' + esc(e.id) + '"' +
        (e.status === 'current' ? ' aria-current="step"' : '') + '>' +
        '<span class="etapy__dot" aria-hidden="true"></span>' +
        '<span class="etapy__title">' + esc(e.title) + '</span>' +
        '<span class="etapy__date">' + esc(when) + '</span>' +
        '</li>';
    }).join('') + '</ol>';
  }

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(w.location.search);
    if (!m) { return ''; }
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; }
  }

  /* --- на ком шаг ----------------------------------------------------------
     Заказчик видит «Ждём вас» или «У завода», завод — «За нами» или «Ждём заказчика».
     Срок ответа рядом; просрочка — красным. */
  function naKom(apparat) {
    var kto = apparat ? apparat.naKom : null;
    if (!kto) { return '<span class="nakom nakom--none" data-nakom="none">Открытых шагов нет</span>'; }
    var me = side();
    var mine = me ? kto === me : false;
    var text;
    if (me === 'zavod') { text = mine ? 'За нами' : 'Ждём заказчика'; }
    else if (me === 'zakazchik') { text = mine ? 'Ждём вас' : 'У завода'; }
    else { text = kto === 'zavod' ? 'Шаг за заводом' : 'Шаг за заказчиком'; }
    var srok = '', overdue = false;
    if (apparat.srokOtveta) {
      /* Просрочка — одна формула в dannye.js (DATA.srok), та же, что Apparat.prosrocheno. */
      var sr = w.DATA.srok(kto, apparat.srokOtveta), n = sr.dney || 0;
      overdue = sr.prosrocheno;
      srok = overdue
        ? 'срок был ' + data(apparat.srokOtveta) + ', просрочено на ' + dney(-n)
        : 'ответ до ' + data(apparat.srokOtveta);
    }
    return '<span class="nakom ' + (mine ? 'nakom--my' : 'nakom--their') + (overdue ? ' is-overdue' : '') +
      '" data-nakom="' + esc(kto) + '">' + esc(text) +
      (srok ? ' <span class="nakom__srok">· ' + esc(srok) + '</span>' : '') + '</span>';
  }

  /* --- код ответа --------------------------------------------------------- */
  function kodOtveta(kod) {
    var k = KOD_CLS[kod] ? { cls: KOD_CLS[kod], title: kodTitle(kod) } : null;
    if (!k) {
      return '<span class="kod kod--none" data-kod="none"><span class="kod__n">?</span>Ждёт ответа</span>';
    }
    return '<span class="kod ' + k.cls + '" data-kod="' + kod + '" title="Код ' + kod + ' · ' + esc(k.title) + '">' +
      '<span class="kod__n">' + kod + '</span>' + esc(k.title) + '</span>';
  }

  /* --- пусто -------------------------------------------------------------
     action: { label, href } — ссылка; { label, act } — кнопка с data-act для Shell.on. */
  function pusto(o) {
    o = o || {};
    var a = o.action, btn = '';
    if (a && a.href) { btn = '<a class="btn btn--secondary btn--sm" href="' + esc(a.href) + '">' + esc(a.label) + '</a>'; }
    else if (a && a.act) {
      btn = '<button class="btn btn--secondary btn--sm" type="button" data-act="' + esc(a.act) + '"' +
        (a.id ? ' data-id="' + esc(a.id) + '"' : '') + '>' + esc(a.label) + '</button>';
    }
    return '<div class="pusto"><p class="pusto__text">' + esc(o.text || 'Пока пусто') + '</p>' + btn + '</div>';
  }

  /* --- таблица -------------------------------------------------------------
     cols: [{ key, title, render?(row) → HTML, align?: 'right', nowrap?, width? }] или строки-ключи.
     rows: массив объектов. empty: текст или объект для pusto.
     rowHref?(row) → адрес: строка кликается целиком. rowClass?(row) → класс строки. */
  function table(o) {
    o = o || {};
    var cols = (o.cols || []).map(function (c) { return typeof c === 'string' ? { key: c, title: c } : c; });
    var rows = o.rows || [];
    if (!rows.length) {
      var e = o.empty;
      return pusto(typeof e === 'object' && e ? e : { text: e || 'Записей нет' });
    }
    function cls(c) {
      var r = [];
      if (c.align === 'right') { r.push('is-right'); }
      if (c.nowrap) { r.push('is-nowrap'); }
      return r.length ? ' class="' + r.join(' ') + '"' : '';
    }
    var head = '<thead><tr>' + cols.map(function (c, i) {
      /* data-col — на шапке и на ячейках: страница прячет колонку целиком по ключу (04b) */
      return '<th scope="col"' + cls(c) + ' data-col="' + esc(c.key || i) + '"' + (c.width ? ' style="width:' + esc(c.width) + '"' : '') + '>' + esc(c.title) + '</th>';
    }).join('') + '</tr></thead>';
    var body = '<tbody>' + rows.map(function (row) {
      var href = o.rowHref ? o.rowHref(row) : null;
      var rc = [];
      if (href) { rc.push('is-link'); }
      if (o.rowClass) { var x = o.rowClass(row); if (x) { rc.push(x); } }
      return '<tr' + (rc.length ? ' class="' + rc.join(' ') + '"' : '') +
        (href ? ' data-href="' + esc(href) + '"' : '') + '>' +
        cols.map(function (c, i) {
          var v = c.render ? c.render(row) : esc(row[c.key]);
          if (href && i === 0) { v = '<a href="' + esc(href) + '">' + v + '</a>'; }
          return '<td' + cls(c) + ' data-col="' + esc(c.key || i) + '">' + v + '</td>';
        }).join('') + '</tr>';
    }).join('') + '</tbody>';
    return '<div class="table-wrap"><table class="table">' + head + body + '</table></div>';
  }

  /* Строка таблицы с адресом кликается целиком — один слушатель на документ. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) { return; }
    if (e.target.closest('a, button, input, select, textarea, label')) { return; }
    var tr = e.target.closest('tr[data-href]');
    if (!tr) { return; }
    var href = tr.getAttribute('data-href');
    if (w.Shell && w.Shell.navigate) { w.Shell.navigate(href); } else { w.location.href = href; }
  });

  /* --- окно ----------------------------------------------------------------
     { title, text, body: HTML | узел, foot: HTML, wide, onClose } → узел окна с close().
     Без foot внизу одна кнопка «Понятно». Закрывается крестиком, Esc, кликом мимо
     и любой кнопкой с data-close. */
  var openModals = [];
  function modal(o) {
    o = o || {};
    var back = document.createElement('div');
    back.className = 'modal-backdrop';
    var id = 'modal-t-' + Date.now() + '-' + openModals.length;
    back.innerHTML =
      '<div class="modal' + (o.wide ? ' modal--wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '">' +
        '<div class="modal__head"><h2 class="modal__title" id="' + id + '">' + esc(o.title || '') + '</h2>' +
          '<button class="modal__x" type="button" data-close aria-label="Закрыть">×</button></div>' +
        '<div class="modal__body">' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') + '</div>' +
        '<div class="modal__foot">' + (o.foot !== undefined ? o.foot
          : '<button class="btn btn--primary" type="button" data-close>Понятно</button>') + '</div>' +
      '</div>';
    var box = back.querySelector('.modal');
    var bodyEl = back.querySelector('.modal__body');
    if (o.body) {
      if (typeof o.body === 'string') { bodyEl.insertAdjacentHTML('beforeend', o.body); }
      else { bodyEl.appendChild(o.body); }
    }
    if (!bodyEl.innerHTML) { bodyEl.parentNode.removeChild(bodyEl); }
    if (!o.foot && o.foot !== undefined) {
      var f = back.querySelector('.modal__foot'); f.parentNode.removeChild(f);
    }
    var prevFocus = document.activeElement;
    var closed = false;
    function close() {
      if (closed) { return; }
      closed = true;
      document.removeEventListener('keydown', onKey);
      if (back.parentNode) { back.parentNode.removeChild(back); }
      openModals = openModals.filter(function (m) { return m !== box; });
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* узла уже нет */ } }
      if (o.onClose) { o.onClose(); }
    }
    function onKey(e) { if (e.key === 'Escape' && openModals[openModals.length - 1] === box) { close(); } }
    back.addEventListener('click', function (e) {
      if (e.target === back || (e.target.closest && e.target.closest('[data-close]'))) { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    openModals.push(box);
    box.close = close;
    var first = box.querySelector('textarea, input, select, .modal__foot .btn') || box.querySelector('.modal__x');
    if (first) { try { first.focus(); } catch (e) { /* фокус не обязателен */ } }
    return box;
  }

  /** Действия, которых в прототипе нет: скачать, выгрузить в ТОИР, позвонить. */
  function soon(what) {
    return modal({ title: what || 'В прототипе этого нет', text: 'Появится в рабочей версии.' });
  }

  w.Render = {
    etapy: etapy,
    naKom: naKom,
    table: table,
    modal: modal,
    soon: soon,
    pusto: pusto,
    kodOtveta: kodOtveta,
    data: data,
    esc: esc,
    /** «3 дня», «5 дней» — для «сколько дней на этапе». */
    dney: dney,
    plural: plural,
    /** Параметр адреса страницы: единственный разбор адреса для page-*.js (06a). Нет — ''. */
    param: param
  };
})(window);

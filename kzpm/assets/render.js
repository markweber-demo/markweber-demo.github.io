/* Render — общие блоки кабинета: лента этапов, плашка «на ком шаг», таблица,
   окно, «появится в рабочей версии», пустое состояние, дата, параметр адреса.
   Владелец — таск 02, перенесено из каркаса БМЗ. После опорного экрана
   (карточка заказа, таск 03) не расширяется: блок одной страницы живёт в её
   page-*.js.

   Блоки, отдающие разметку, возвращают строку HTML — экран вставляет её сам.
   Окно (modal, soon) рисуется сразу и возвращает узел с методом close().
   Данные блоки читают только через DATA и только чтобы узнать, кто смотрит,
   и посчитать просрочку той же формулой, что карточки (DATA.srok). */
(function (w) {
  'use strict';

  var MESYACY = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля',
    'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* --- даты ----------------------------------------------------------------
     ISO читаем как календарную дату без сдвига часового пояса: «2026-10-09»
     в Нижнекамске и в Лондоне — 9 октября. Если есть время — берём местное. */
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
      'rel' — «сегодня», «завтра», «через 3 дня», «5 дней назад»; 'time' — «14:05». Пусто — «—». */
  function data(iso, o) {
    var d = parse(iso);
    if (!d) { return '—'; }
    var f = (o && o.format) || 'text';
    var now = new Date();
    if (f === 'doc') { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
    if (f === 'docTime') { return data(d, { format: 'doc' }) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    if (f === 'time') { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    if (f === 'rel') {
      var n = daysBetween(now, d);
      if (n === 0) { return 'сегодня'; }
      if (n === 1) { return 'завтра'; }
      if (n === -1) { return 'вчера'; }
      return n > 0 ? 'через ' + dney(n) : dney(-n) + ' назад';
    }
    var t = d.getDate() + ' ' + MESYACY[d.getMonth()];  /* число и месяц не рвутся на строки */
    if (f === 'full' || d.getFullYear() !== now.getFullYear()) { t += ' ' + d.getFullYear(); }
    return t;
  }

  /* --- кто смотрит -------------------------------------------------------- */
  function side() {
    try { var me = w.DATA && w.DATA.me ? w.DATA.me() : null; return me ? me.side : null; }
    catch (e) { return null; }
  }

  /* --- лента этапов --------------------------------------------------------
     Пройденные с датой, текущий выделен, будущие с плановой датой. Колонок
     столько, сколько этапов: число уходит в CSS переменной --n, раскладка
     не зашита (у заказа FFS восемь этапов, у стрейч-худа и компаунда свои).
     o.mini — полоска отрезков для строк списков, подпись текущего этапа в title. */
  function etapy(x, o) {
    var list = (x && x.etapy) || [];
    if (!list.length) { return ''; }
    if (o && o.mini) {
      var cur = null;
      list.forEach(function (e) { if (e.status === 'current') { cur = e; } });
      return '<div class="etapy-mini" role="img" aria-label="Этап: ' + esc(cur ? cur.title : '—') + '"' +
        ' title="' + esc(cur ? cur.title : '') + '">' +
        list.map(function (e) { return '<span class="etapy-mini__seg is-' + esc(e.status) + '"></span>'; }).join('') +
        '</div>';
    }
    return '<ol class="etapy" style="--n:' + list.length + '" aria-label="Этапы">' + list.map(function (e) {
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
     Заказчик видит «Ждём вас» или «У КЗПМ», сотрудник КЗПМ — «За нами» или
     «Ждём заказчика». Ход за тем, кто смотрит, — жёлтая плашка «ждёт»,
     за другой стороной — фиолетовая «в работе». Срок ответа рядом; просрочка
     красным, и считает её слой данных (DATA.srok), а не этот файл.
     Заказчику просрочку шага КЗПМ не показываем: это внутренний план завода,
     его видит только сторона КЗПМ (решение ревью таска 03). Своя просрочка
     заказчика и любая просрочка у КЗПМ — красные.
     o.srok (таск 03): false — срок не показывать; { podpis, bylo, data } или
     строка-podpis — своя подпись срока: «груз прибудет до» вместо «ответ до»,
     «груз ожидался» вместо «срок был», data — своя дата (по умолчанию srokOtveta).
     Просрочку и цвет по-прежнему решает этот блок. Просроченная плашка — в одну
     строку: «За нами · просрочено на 5 дней», а «срок был 8 октября» (или bylo
     с датой) уходит во всплывающую подсказку title. */
  function naKom(x, o) {
    var kto = x ? x.naKom : null;
    if (!kto) { return '<span class="nakom nakom--none" data-nakom="none">Открытых шагов нет</span>'; }
    var me = side();
    var mine = me ? kto === me : false;
    var text;
    if (me === 'zavod') { text = mine ? 'За нами' : 'Ждём заказчика'; }
    else if (me === 'zakazchik') { text = mine ? 'Ждём вас' : 'У КЗПМ'; }
    else { text = kto === 'zavod' ? 'Шаг за КЗПМ' : 'Шаг за заказчиком'; }
    var srok = '', overdue = false, podskazka = '';
    var cfg = o && o.srok !== undefined && o.srok !== null ? o.srok : {};
    if (cfg !== false) {
      if (typeof cfg === 'string') { cfg = { podpis: cfg }; }
      var iso = cfg.data !== undefined && cfg.data !== null ? cfg.data : x.srokOtveta;
      if (iso) {
        var sr = w.DATA.srok(kto, iso), n = sr.dney || 0;
        if (!sr.prosrocheno) { srok = (cfg.podpis || 'ответ до') + ' ' + data(iso); }
        else if (!(me === 'zakazchik' && kto === 'zavod')) {
          /* Плашка в одну строку: на ней только просрочка, дата срока — во всплывающей подсказке. */
          overdue = true;
          srok = 'просрочено на ' + dney(-n);
          podskazka = (cfg.bylo || 'срок был') + ' ' + data(iso);
        }
      }
    }
    return '<span class="nakom ' + (mine ? 'nakom--my' : 'nakom--their') + (overdue ? ' is-overdue' : '') +
      '" data-nakom="' + esc(kto) + '"' + (podskazka ? ' title="' + esc(podskazka) + '"' : '') + '>' + esc(text) +
      (srok ? ' <span class="nakom__srok">· ' + esc(srok) + '</span>' : '') + '</span>';
  }

  /* --- пусто -------------------------------------------------------------
     Что здесь будет и кнопка следующего шага, если он есть.
     action: { label, href } — ссылка; { label, act, id? } — кнопка с data-act для Shell.on. */
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
      /* data-col — на шапке и на ячейках: страница прячет колонку целиком по ключу */
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
          /* первая ячейка становится ссылкой строки, если render сам ссылку не вернул: <a> в <a> нельзя */
          if (href && i === 0 && !/<a[\s>]/i.test(v)) { v = '<a href="' + esc(href) + '">' + v + '</a>'; }
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
     Без foot внизу одна кнопка «Понятно»; foot: '' — без низа. Закрывается
     крестиком, Esc, кликом мимо и любой кнопкой с data-close. */
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

  /** Действия, которых в прототипе нет: «Скачать все», «Выгрузить», «Позвонить». */
  function soon(what) {
    return modal({ title: what || 'В прототипе этого нет', text: 'Появится в рабочей версии.' });
  }

  /* --- карточка: шапка, шаг, документы, история --------------------------------
     Добавлены таском 03 (карточка заказа — опорный экран) для всех карточек:
     заказа, продукта, претензии. Разметка без состояния; документы открывает
     Prevyu.mount() страницы (ссылка #doc=<id> и кнопка data-act="prevyu-skachat"). */

  /** «Имя, должность» — для истории, ответов, замечаний. У КЗПМ имя — должность. */
  function kto(k) { return k ? [k.name, k.position].filter(Boolean).join(', ') : ''; }

  /** Шапка карточки. o: { crumbs: [{ title, href? }], label, title, lead: HTML, side: HTML }. */
  function shapka(o) {
    o = o || {};
    var cr = (o.crumbs || []).map(function (c) {
      return c.href ? '<a href="' + esc(c.href) + '">' + esc(c.title) + '</a>' : '<span>' + esc(c.title) + '</span>';
    }).join('');
    return (cr ? '<nav class="crumbs" aria-label="Путь">' + cr + '</nav>' : '') +
      '<header class="shapka"><div class="shapka__main">' +
        (o.label ? '<p class="label shapka__label">' + esc(o.label) + '</p>' : '') +
        '<h1 class="h1 shapka__title">' + esc(o.title || '') + '</h1>' +
        (o.lead ? '<p class="shapka__lead">' + o.lead + '</p>' : '') +
      '</div>' + (o.side ? '<div class="shapka__side">' + o.side + '</div>' : '') + '</header>';
  }

  /** «На ком шаг» строкой: плашка naKom, текст шага, подпись дней, справа ходы.
      x — карточка из DATA ({ naKom, shag, srokOtveta, dneyNaEtape }).
      o: { knopki: HTML ходов, podskazka: текст под строкой, gotovo: текст, когда шагов нет,
           dni: строка — своя подпись дней («3 дня без ответа»), false — без подписи;
                по умолчанию «N дней на этапе» (карточки с этапами: заказ, продукт),
           srok: false | строка | { podpis, bylo, data } — передаётся плашке, см. naKom }. */
  function shag(x, o) {
    x = x || {}; o = o || {};
    var text = x.naKom ? (x.shag || '') : (o.gotovo || '');
    var dni = '';
    if (typeof o.dni === 'string') { dni = o.dni; }
    else if (o.dni !== false && x.naKom && typeof x.dneyNaEtape === 'number') {
      dni = x.dneyNaEtape === 0 ? 'Этап начат сегодня' : dney(x.dneyNaEtape) + ' на этапе';
    }
    return '<div class="shag" data-nakom="' + esc(x.naKom || 'none') + '"><div class="shag__main">' +
      naKom(x, o.srok === undefined ? undefined : { srok: o.srok }) +
      (text ? '<p class="shag__text">' + esc(text) + '</p>' : '') +
      (dni ? '<p class="shag__dni">' + esc(dni) + '</p>' : '') + '</div>' +
      (o.knopki ? '<div class="shag__knopki">' + o.knopki + '</div>' : '') +
      (o.podskazka ? '<p class="shag__hint">' + esc(o.podskazka) + '</p>' : '') + '</div>';
  }

  /** Документы карточки списком. list — [Dokument] из DATA; название ведёт на #doc=<id>
      (превью), справа «Скачать». o: { empty: текст или объект pusto, k: false — не писать, к чему документ }. */
  function dokumenty(list, o) {
    o = o || {};
    list = list || [];
    if (!list.length) {
      var e = o.empty;
      return pusto(typeof e === 'object' && e ? e : { text: e || 'Документов пока нет' });
    }
    return '<ul class="doks">' + list.map(function (d) {
      var meta = [data(d.data, { format: 'doc' }), o.k === false || !d.k ? '' : d.k.title].filter(Boolean).join(' · ');
      return '<li class="doks__item" data-dok="' + esc(d.id) + '" data-tip="' + esc(d.tip) + '"><div class="doks__main">' +
        '<a class="doks__title" href="#doc=' + esc(encodeURIComponent(d.id)) + '">' + esc(d.title) + '</a>' +
        (meta ? '<span class="doks__meta">' + esc(meta) + '</span>' : '') + '</div>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="prevyu-skachat" data-id="' + esc(d.id) + '">Скачать</button></li>';
    }).join('') + '</ul>';
  }

  /** История карточки: кто, что, когда. list — [{ at, kto, text }], новые сверху (так отдаёт DATA). */
  function istoriya(list, o) {
    o = o || {};
    list = list || [];
    if (!list.length) { return pusto({ text: o.empty || 'История пока пуста' }); }
    return '<ol class="events istoriya">' + list.map(function (h) {
      var who = kto(h.kto);
      return '<li class="events__item"><span class="events__date"><span>' + esc(data(h.at)) + '</span>' +
        '<span class="events__time">' + esc(data(h.at, { format: 'time' })) + '</span></span>' +
        '<div><p class="events__text">' + esc(h.text) + '</p>' + (who ? '<p class="events__who">' + esc(who) + '</p>' : '') + '</div></li>';
    }).join('') + '</ol>';
  }

  /** Чужая карточка у заказчика. o: { title, text, href, label }. */
  function nedostupno(o) {
    o = o || {};
    return '<section class="nedostupno" data-nedostupno><h1 class="h1">' + esc(o.title || 'Нет доступа') + '</h1>' +
      '<p class="lead">' + esc(o.text || '') + '</p>' +
      (o.href ? '<a class="btn btn--primary" href="' + esc(o.href) + '">' + esc(o.label || 'Назад') + '</a>' : '') + '</section>';
  }

  w.Render = {
    etapy: etapy,
    naKom: naKom,
    table: table,
    modal: modal,
    soon: soon,
    pusto: pusto,
    data: data,
    esc: esc,
    /** «3 дня», «5 дней» — для «сколько дней на этапе». */
    dney: dney,
    plural: plural,
    /** Параметр адреса страницы: единственный разбор адреса для page-*.js. Нет — ''. */
    param: param,
    /* таск 03: компоненты карточки */
    shapka: shapka,
    shag: shag,
    dokumenty: dokumenty,
    istoriya: istoriya,
    nedostupno: nedostupno,
    kto: kto
  };
})(window);

/* Карточка аппарата — apparat.html?id=. Опорный экран, таск 04.
   Одна страница для обеих ролей: роль меняет только действия.

   Читает только DATA, пишет только ACT. После каждого действия экран
   перерисовывается из DATA целиком; 3D-модель перед этим разбирается
   (destroy), иначе повторный mount протекает.

   Адрес: ?id=<аппарат>, в хэше вкладка или документ:
   #soglasovanie · #proizvodstvo · #istoriya · #dokumenty · #doc=<id документа>. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA, ACT = w.ACT;

  var TABS = [
    { id: 'soglasovanie', title: 'Согласование' },
    { id: 'proizvodstvo', title: 'Производство и испытания' },
    { id: 'istoriya', title: 'История' },
    { id: 'dokumenty', title: 'Документы' }
  ];
  /* Что согласуется с заказчиком — реестр вкладки «Согласование». */
  var REESTR = ['tkp', 'sborochnyy', 'raschet', 'pmi', 'pasport'];
  var POZ = { 'shtucer-A': 'штуцер А', 'shtucer-B': 'штуцер Б' };
  var TIP_PMI = {
    H: { title: 'Точка остановки', text: 'работы продолжаются только после подтверждения заказчика' },
    W: { title: 'Точка присутствия', text: 'заказчика приглашают, можно отказаться' },
    R: { title: 'Проверка документов', text: 'завод прикладывает протокол' }
  };
  /* Поля опросного листа, которые показываем. Незнакомые ключи не выводим. */
  var OPROS = [
    ['status', 'Статус'], ['techPoz', 'Технологическая позиция'], ['kolichestvo', 'Количество'],
    ['sreda', 'Рабочая среда'], ['rashod', 'Расход'], ['davlenieRaschetnoe', 'Давление расчётное'],
    ['davlenie', 'Давление'], ['tempVhod', 'Температура на входе'], ['tempVyhod', 'Температура на выходе'],
    ['nagruzka', 'Тепловая нагрузка'], ['klimat', 'Климатическое исполнение'], ['kontrolShvov', 'Контроль сварных швов'],
    ['privod', 'Привод'], ['garantiyaMes', 'Гарантия, мес.'], ['zip', 'ЗИП'], ['shefMontazh', 'Шеф-монтаж'],
    ['dokumentaciya', 'Документация'], ['rezhim', 'Режим листа'], ['skhema', 'Схема']
  ];

  function spr() { return DATA.spravochnik() || {}; }
  function etapIdx(id) {
    var l = spr().etapy || [];
    for (var i = 0; i < l.length; i++) { if (l[i].id === id) { return i; } }
    return -1;
  }
  function byId(list, id) {
    for (var i = 0; i < (list || []).length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }
  function lastRev(d) { return d && d.revizii && d.revizii.length ? d.revizii[d.revizii.length - 1] : null; }
  function zavodShort() { return (spr().zavod || {}).short || ''; }
  function pozCode(text) {
    var t = String(text || '').toLowerCase();
    if (/штуцер\s*[аa](?![а-яёa-z])/.test(t)) { return 'shtucer-A'; }
    if (/штуцер\s*[бb](?![а-яёa-z])/.test(t)) { return 'shtucer-B'; }
    return null;
  }
  function docData(iso) { return String(iso || '').indexOf('T') > -1 ? R.data(iso, { format: 'docTime' }) : R.data(iso, { format: 'doc' }); }
  function who(k) { return k ? [k.name, k.position, k.predpriyatie].filter(Boolean).join(' · ') : ''; }
  function zavodLyudi() { return DATA.lyudi({ side: 'zavod' }) || []; }
  function zakName(a) { var z = DATA.zakazchik(a.zakazchikId); return z ? z.name : ''; }
  function etapTitle(a, id) {
    var e = null;
    (a.etapy || []).forEach(function (x) { if (x.id === (id || a.etap)) { e = x; } });
    return e ? e.title : '';
  }

  /* Отгруженный аппарат: этап «отгружен» в данных текущий, на экране — пройденный. */
  function etapyView(a) {
    if (a.etap !== 'otgruzhen') { return a; }
    var c = {};
    for (var k in a) { c[k] = a[k]; }
    c.etapy = a.etapy.map(function (e) {
      return { id: e.id, title: e.title, date: e.date, status: e.id === 'otgruzhen' ? 'done' : e.status };
    });
    return c;
  }

  /* --- ПМИ ------------------------------------------------------------------------
     Какие ходы доступны, отдаёт DATA признаками точки: mozhnoPodtverdit (H),
     mozhnoOtvetit (приглашение в W), mozhnoIspytat (W), zhdyotH (стоит за
     неподтверждённой H). Своих правил здесь нет. */

  /* --- состояние экрана -------------------------------------------------------- */
  var ID = R.param('id') || null;
  var role = w.Store.role();
  if (!w.Shell.mount({ active: role === 'zavod' ? 'voronka' : 'apparaty' })) { return; }
  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var side = me.side;
  var S = { tab: null, docId: null, rev: null, model: null, wEdit: null, vid: '3d' };

  function readHash() {
    var h = String(w.location.hash || '').replace(/^#/, '');
    var m = /(?:^|&)doc=([^&]+)/.exec(h);
    if (m) {
      var v = /(?:^|&)vid=([^&]+)/.exec(h);
      S.tab = 'soglasovanie'; S.docId = decodeURIComponent(m[1]); S.rev = null; S.vid = v && v[1] === 'chertezh' ? 'chertezh' : '3d';
      return true;
    }
    for (var i = 0; i < TABS.length; i++) { if (TABS[i].id === h) { S.tab = h; return true; } }
    return false;
  }
  function writeHash() {
    var h = S.tab === 'soglasovanie' && S.docId ? 'doc=' + encodeURIComponent(S.docId) + (S.vid === 'chertezh' ? '&vid=chertezh' : '') : S.tab;
    try { w.history.replaceState(null, '', '#' + h); } catch (e) { /* file:// без истории — не страшно */ }
  }
  function defaults(a) {
    if (!S.tab) {
      var i = etapIdx(a.etap);
      S.tab = i <= etapIdx('chertezh') ? 'soglasovanie' : (a.postavlen ? 'dokumenty' : 'proizvodstvo');
    }
    if (!S.docId) {
      var open = null;
      a.dokumenty.forEach(function (d) {
        var r = lastRev(d);
        if (!open && REESTR.indexOf(d.vid) > -1 && r && r.naKom) { open = d; }
      });
      if (open) { S.docId = open.id; }
    }
  }

  /* --- шапка карточки ---------------------------------------------------------- */
  function crumbs(a) {
    var tail = '<span>' + esc(a.techPoz ? 'поз. ' + a.techPoz : a.nazvanie) + '</span>';
    if (side === 'zavod') {
      return '<nav class="crumbs" aria-label="Путь"><a href="crm.html">Воронка</a>' +
        '<a href="zakazchik.html?id=' + esc(a.zakazchikId) + '">' + esc(zakName(a)) + '</a>' + tail + '</nav>';
    }
    return '<nav class="crumbs" aria-label="Путь"><a href="apparaty.html">Мои аппараты</a>' + tail + '</nav>';
  }
  function head(a) {
    var tip = (spr().tipy || {})[a.tip];
    var mgr = byId(zavodLyudi(), a.managerId);
    var facts = [
      ['Заказчик', esc(zakName(a))],
      ['Установка', esc(a.ustanovka || '—')],
      ['Техпозиция', '<span class="mono">' + esc(a.techPoz || '—') + '</span>'],
      ['Заводской №', a.zavNomer ? '<span class="mono">' + esc(a.zavNomer) + '</span>' : '<span class="muted">присвоят при изготовлении</span>'],
      ['ТУ', esc(a.tu || '—')],
      ['Количество', esc(a.kolichestvo || 1) + ' шт.']
    ];
    var etapLine = a.postavlen
      ? 'Отгружен ' + R.data(a.etapy[a.etapy.length - 1].date, { format: 'full' })
      : 'Этап «' + etapTitle(a) + '» · ' + R.dney(a.dneyNaEtape || 0) + ' на этапе';
    return crumbs(a) +
      '<header class="ap-head">' +
        '<div class="ap-head__main">' +
          '<p class="label">' + esc([tip ? tip.title : '', a.techPoz ? 'поз. ' + a.techPoz : ''].filter(Boolean).join(' · ')) + '</p>' +
          '<h1 class="h1 ap-head__title">' + esc(a.nazvanie) + '</h1>' +
          '<p class="ap-head__obozn">' + esc(a.oboznachenie) + '</p>' +
        '</div>' +
        '<div class="ap-head__side">' + R.naKom(a) + '<p class="ap-head__etap">' + esc(etapLine) + '</p></div>' +
      '</header>' +
      '<section class="card ap-pasp" aria-label="Сведения об аппарате">' +
        '<dl class="ap-facts">' + facts.map(function (f) {
          return '<div class="ap-facts__i"><dt class="label">' + f[0] + '</dt><dd>' + f[1] + '</dd></div>';
        }).join('') + '</dl>' +
        (mgr ? '<div class="ap-mgr"><p class="label">Менеджер завода</p>' +
          '<p class="ap-mgr__name">' + esc(mgr.name) + '</p>' +
          '<p class="ap-mgr__pos">' + esc(mgr.position) + '</p>' +
          '<p class="ap-mgr__cont"><button class="link-btn" type="button" data-soon="Звонок из сервиса">' + esc(mgr.phone) + '</button>' +
          ' · <button class="link-btn" type="button" data-soon="Письмо из сервиса">' + esc(mgr.email) + '</button>' +
          ' <span class="badge badge--neutral badge--plain">демо</span></p></div>' : '') +
      '</section>' +
      '<section class="card ap-etapy" aria-label="Этапы"><div class="card__body">' + R.etapy(etapyView(a)) + '</div></section>';
  }

  /* --- блок завода: задание конструктору, ТКП ---------------------------------- */
  function zavodBlock(a) {
    if (side !== 'zavod') { return ''; }
    var z = a.zadanie, k = z ? byId(zavodLyudi(), z.konstruktorId) : null;
    var mz = a.mozhno || {}, acts = [];
    var tkp = null;
    a.dokumenty.forEach(function (d) { if (d.vid === 'tkp') { tkp = d; } });
    if (mz.tkp) {
      acts.push('<button class="btn btn--primary" type="button" data-act="ap-tkp">ТКП направлено</button>');
    } else if (mz.dogovor && lastRev(tkp)) {
      acts.push('<p class="small muted">ТКП у заказчика с ' + esc(R.data(lastRev(tkp).date)) + '. Принятие ТКП и подписание договора отмечаются в панели прототипа, в ходах вне системы.</p>');
    }
    if (mz.naznachit) {
      acts.push('<button class="btn ' + (a.etap === 'zayavka' ? 'btn--secondary' : 'btn--primary') + '" type="button" data-act="ap-nk">Назначить конструктору</button>');
    }
    var zad = z
      ? '<dl class="kv">' +
          '<dt>Конструктор</dt><dd>' + esc(k ? k.name + ', ' + k.position : '—') + '</dd>' +
          '<dt>Что сделать</dt><dd>' + esc(z.komment || '—') + '</dd>' +
          '<dt>Срок</dt><dd>' + esc(R.data(z.srok, { format: 'doc' })) + '</dd>' +
          '<dt>Статус</dt><dd>' + (z.status === 'vypolneno'
            ? '<span class="badge badge--ok">Выполнено</span>'
            : '<span class="badge badge--info">Назначено</span>') + '</dd></dl>'
      : '<p class="small muted">Задание не назначено. После договора конструктор получает задание на сборочный чертёж и 3D-модель по опросному листу.</p>';
    return '<section class="card ap-zavod" aria-label="Работа завода">' +
      '<div class="card__head"><h2 class="ap-sec-title">Работа завода</h2><span class="small muted">Заказчик этот блок не видит</span></div>' +
      '<div class="card__body ap-zavod__grid">' +
        '<div><p class="label ap-zavod__label">Задание конструктору</p>' + zad + '</div>' +
        '<div class="ap-zavod__acts">' + (acts.join('') || '<p class="small muted">Действий завода по этапу нет.</p>') + '</div>' +
      '</div></section>';
  }

  /* --- вкладки ------------------------------------------------------------------ */
  function counts(a) {
    var c = { soglasovanie: 0, proizvodstvo: 0 };
    a.dokumenty.forEach(function (d) {
      var r = lastRev(d);
      if (REESTR.indexOf(d.vid) > -1 && r && r.naKom === side) { c.soglasovanie++; }
    });
    a.pmi.forEach(function (p) {
      if (side === 'zakazchik' && (p.mozhnoPodtverdit || (p.mozhnoOtvetit && !p.otvetZakazchika))) { c.proizvodstvo++; }
      if (side === 'zavod' && p.mozhnoIspytat) { c.proizvodstvo++; }
    });
    return c;
  }
  function tabs(a) {
    var c = counts(a);
    return '<div class="tabs ap-tabs" role="tablist">' + TABS.map(function (t) {
      var on = S.tab === t.id, n = c[t.id] || 0;
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + on + '"' +
        ' data-act="ap-tab" data-tab="' + t.id + '">' + esc(t.title) +
        (n ? ' <span class="ap-tabs__n" title="Ждёт вашего ответа">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }

  /* --- «Согласование»: реестр, документ, опросный лист ------------------------- */
  function reestr(a) {
    var docs = a.dokumenty.filter(function (d) { return REESTR.indexOf(d.vid) > -1; });
    var kody = spr().kody || {};
    var table = R.table({
      cols: [
        { key: 'title', title: 'Документ', render: function (d) {
          return lastRev(d) ? '<span class="ap-reg__doc">' + esc(d.title) + '</span>' : '<span class="muted">' + esc(d.title) + '</span>';
        } },
        { key: 'rev', title: 'Рев.', nowrap: true, render: function (d) {
          var r = lastRev(d); return r ? '<span class="mono">' + esc(r.rev) + '</span>' : '<span class="muted">—</span>';
        } },
        { key: 'date', title: 'Выпущен', nowrap: true, render: function (d) {
          var r = lastRev(d); return r ? esc(R.data(r.date, { format: 'doc' })) : '<span class="muted">не выпущен</span>';
        } },
        { key: 'kod', title: 'Ответ заказчика', nowrap: true, render: function (d) {
          var r = lastRev(d);
          if (!r) { return '<span class="muted">—</span>'; }
          if (r.kod) { return R.kodOtveta(r.kod); }
          return r.naKom === 'zakazchik' ? R.kodOtveta(null) : '<span class="muted">—</span>';
        } },
        { key: 'nakom', title: 'На ком шаг', nowrap: true, render: function (d) {
          var r = lastRev(d); return r && r.naKom ? R.naKom({ naKom: r.naKom, srokOtveta: null }) : '<span class="muted">—</span>';
        } },
        { key: 'srok', title: 'Срок ответа', nowrap: true, render: function (d) {
          var r = lastRev(d);
          return r && r.srok ? esc(R.data(r.srok, { format: 'doc' })) + '<span class="ap-reg__rel">' + esc(R.data(r.srok, { format: 'rel' })) + '</span>' : '<span class="muted">—</span>';
        } },
        { key: 'zm', title: 'Замечания', nowrap: true, render: function (d) {
          var all = a.zamechaniya.filter(function (z) { return z.dokumentId === d.id; });
          if (!all.length) { return '<span class="muted">—</span>'; }
          var open = all.filter(function (z) { return !z.otvet; }).length;
          return esc(all.length) + (open ? ' <span class="badge badge--warn">без ответа ' + open + '</span>' : '');
        } }
      ],
      rows: docs,
      empty: 'Документов пока нет',
      /* Строка выпущенного документа кликается целиком: адрес #doc=<id>, открывает его здесь же. */
      rowHref: function (d) { return lastRev(d) ? '#doc=' + encodeURIComponent(d.id) : null; },
      rowClass: function (d) { return d.id === S.docId ? 'is-open' : ''; }
    });
    return '<section class="card ap-reg" aria-label="Реестр документов">' +
      '<div class="card__head"><h2 class="ap-sec-title">Реестр документов</h2>' +
        '<p class="ap-kody" data-block="kody">' + [1, 2, 3, 4].map(function (k) {
          return '<span><span class="mono">' + k + '</span> ' + esc(kody[k] || '') + '</span>';
        }).join('') + '</p></div>' + table + '</section>';
  }

  function docView(a) {
    var d = byId(a.dokumenty, S.docId);
    if (!d || !lastRev(d)) { return ''; }
    var last = lastRev(d);
    var rev = S.rev && d.revizii.some(function (r) { return r.rev === S.rev; }) ? S.rev : last.rev;
    var cur = null;
    d.revizii.forEach(function (r) { if (r.rev === rev) { cur = r; } });
    var isLast = cur === last;
    var revs = '<div class="ap-revs" role="tablist" aria-label="Ревизии">' + d.revizii.map(function (r) {
      var on = r.rev === rev;
      return '<button class="ap-rev' + (on ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + on + '" data-act="ap-rev" data-rev="' + esc(r.rev) + '">' +
        '<span class="ap-rev__n">Рев. ' + esc(r.rev) + '</span><span class="ap-rev__d">' + esc(R.data(r.date, { format: 'doc' })) + '</span></button>';
    }).join('') + '</div>';
    return '<section class="card ap-doc" id="ap-doc" data-doc="' + esc(d.id) + '" data-rev="' + esc(rev) + '" aria-label="' + esc(d.title) + '">' +
      '<div class="card__head ap-doc__head">' +
        '<div class="ap-doc__name"><p class="label">Документ на согласовании</p><h2 class="ap-sec-title">' + esc(d.title) + '</h2></div>' +
        revs +
        '<button class="btn btn--ghost btn--sm" type="button" data-act="ap-doc-close">Свернуть</button>' +
      '</div>' +
      '<div class="ap-doc__grid">' +
        '<div class="ap-doc__view">' + docPicture(a, d, rev) + '</div>' +
        '<aside class="ap-doc__side">' + zamechaniya(a, d, cur, isLast) + otvetForm(a, d, cur, isLast) + '</aside>' +
      '</div></section>';
  }

  /* У АВО слева 3D-модель, рядом переключатель на первый лист чертежа. */
  function docPicture(a, d, rev) {
    if (d.vid === 'sborochnyy' && a.tip === 'avo') {
      var vid = S.vid === 'chertezh' ? 'chertezh' : '3d';
      var sw = '<div class="ap-vid" role="group" aria-label="Вид документа">' + [['3d', '3D-модель'], ['chertezh', 'Чертёж']].map(function (v) {
        var on = v[0] === vid;
        return '<button class="ap-vid__btn' + (on ? ' is-active' : '') + '" type="button" aria-pressed="' + on + '" data-act="ap-vid" data-vid="' + v[0] + '">' + v[1] + '</button>';
      }).join('') + '</div>';
      if (vid === 'chertezh') { return sw + prevyu(a, d, rev, true); }
      return sw + '<div class="ap-model" id="ap-model" data-rev="' + esc(rev) + '"></div>' +
        '<p class="ap-pick" id="ap-pick" aria-live="polite"></p>';
    }
    return prevyu(a, d, rev, true);
  }
  /* --- превью документа: первая страница ------------------------------------------
     Лист рисуется из наших же данных, без сумм, подписей и реквизитов сверх
     справочника. Единица SVG — треть миллиметра: A4 книжный 630×891, A3 альбомный
     1260×891. Рамка и основная надпись — ГОСТ 2.104: форма 1 (185×55 мм) на чертеже,
     форма 2 (185×40 мм) на первом листе текстового документа. ТКП — нейтральная
     страница с пометкой «Образец»: бланка завода у нас нет, мы его не изображаем.
     Мельче токенов шрифт делается масштабом группы, литералов размера нет. */
  var MM = 3;
  var KOD_DOC = { sborochnyy: 'СБ', raschet: 'РР', pmi: 'ПМ', pasport: 'ПС', re: 'РЭ', protokol: 'ПР' };
  var ZAGOLOVOK = { raschet: 'Расчёт на прочность', pmi: 'Программа и методика испытаний', pasport: 'Паспорт', re: 'Руководство по эксплуатации' };
  var LISTOV = { sborochnyy: 1, raschet: 18, pmi: 9, pasport: 14, re: 22, protokol: 2 };
  var SHTUCERY = {
    avo: [['А', 'Вход продукта'], ['Б', 'Выход продукта']],
    teploobmennik: [['А', 'Вход в трубное пространство'], ['Б', 'Выход из трубного пространства'],
      ['В', 'Вход в межтрубное пространство'], ['Г', 'Выход из межтрубного пространства']],
    emkost: [['А', 'Вход продукта'], ['Б', 'Выход продукта'], ['В', 'Люк-лаз']]
  };
  /* Класс текста → токен размера и средняя ширина знака в долях кегля: только чтобы
     ужать длинную строку в графу (textLength), вёрстку это не задаёт. */
  var TXT = { 'apl-lab': ['2xs', .5], 'apl-val': ['2xs', .5], 'apl-obz': ['md', .55], 'apl-name': ['sm', .5],
    'apl-h': ['lg', .62], 'apl-sub': ['base', .5], 'apl-p': ['sm', .5], 'apl-pb': ['sm', .52], 'apl-sm': ['xs', .5], 'apl-mark': ['md', .8] };
  var fsCache = {};
  function fsPx(tok) {
    if (!fsCache[tok]) {
      var v = parseFloat(w.getComputedStyle(document.documentElement).getPropertyValue('--fs-' + tok));
      fsCache[tok] = v > 0 ? v : 15;
    }
    return fsCache[tok];
  }
  function sv(tag, at, inner) {
    var s = '<' + tag;
    for (var k in at) { if (at[k] !== null && at[k] !== undefined && at[k] !== '') { s += ' ' + k + '="' + esc(String(at[k])) + '"'; } }
    return s + (inner === undefined ? '/>' : '>' + inner + '</' + tag + '>');
  }
  function r1(n) { return Math.round(n * 10) / 10; }
  function ln(x1, y1, x2, y2, c) { return sv('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), 'class': c || 'apl-t' }); }
  function rc(x, y, wd, h, c) { return sv('rect', { x: r1(x), y: r1(y), width: r1(wd), height: r1(h), 'class': c || 'apl-t' }); }
  function pth(d, c) { return sv('path', { d: d, 'class': c || 'apl-k' }); }
  function krug(x, y, r, c) { return sv('circle', { cx: r1(x), cy: r1(y), r: r1(r), 'class': c || 'apl-k' }); }
  /* Текст: o.a — выравнивание, o.k — масштаб, o.rot — поворот, o.fit — ширина графы. */
  function tx(x, y, str, c, o) {
    o = o || {};
    str = String(str === null || str === undefined ? '' : str);
    if (!str) { return ''; }
    var k = o.k || 1;
    var at = { 'class': c, transform: 'translate(' + r1(x) + ' ' + r1(y) + ')' + (o.rot ? ' rotate(' + o.rot + ')' : '') + (k !== 1 ? ' scale(' + k + ')' : ''),
      'text-anchor': o.a || null };
    var m = TXT[c];
    if (o.fit && m && str.length * fsPx(m[0]) * m[1] * k > o.fit) {
      at.textLength = r1(o.fit / k); at.lengthAdjust = 'spacingAndGlyphs';
    }
    return sv('text', at, esc(str));
  }
  /* Строки «текста» документа — серые полосы. */
  function bary(x, y, wd, n, shag) {
    var s = '', dl = [1, .97, 1, .92, .64];
    for (var i = 0; i < n; i++) { s += rc(x, y + i * (shag || 21), wd * dl[i % dl.length], 5, 'apl-bar'); }
    return s;
  }
  function perenos(str, max) {
    var out = [], cur = '';
    String(str || '').split(' ').forEach(function (sl) {
      if (cur && (cur + ' ' + sl).length > max) { out.push(cur); cur = sl; } else { cur = cur ? cur + ' ' + sl : sl; }
    });
    if (cur) { out.push(cur); }
    return out;
  }
  function korotkayaData(iso) { return String(R.data(iso, { format: 'doc' })).replace(/\.\d\d(\d\d)$/, '.$1'); }
  function familiya(p) { return p ? String(p.name).split(' ').slice(-1)[0] : ''; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* Кто в основной надписи: конструктор из задания, второй конструктор группы
     проверяет, ОТК — технический контроль; протокол составляет ОТК. «Утв.» пусто:
     главного конструктора в демо нет, придумывать не будем. */
  function podpisi(a, d) {
    var L = zavodLyudi();
    var ggk = L.filter(function (p) { return p.otdel === 'ggk'; });
    var otk = L.filter(function (p) { return p.otdel === 'otk'; })[0] || null;
    var konstr = (a.zadanie && byId(L, a.zadanie.konstruktorId)) || ggk[0] || null;
    var drugoy = ggk.filter(function (p) { return !konstr || p.id !== konstr.id; })[0] || null;
    if (d.vid === 'protokol') { return { razrab: otk, prov: konstr, tkontr: null, nkontr: null }; }
    return { razrab: konstr, prov: drugoy, tkontr: otk, nkontr: drugoy };
  }
  function pmiOf(a, d) {
    for (var i = 0; i < (a.pmi || []).length; i++) {
      var p = a.pmi[i];
      if (d.pmiId === p.id || d.id === p.id + '-protokol' || (p.dokumenty || []).some(function (x) { return x.id === d.id; })) { return { p: p, n: i + 1 }; }
    }
    return null;
  }
  function isAkt(d) { return /^Акт/.test(d.title || ''); }
  function nomerProtokola(a, d) {
    if (d.nomer) { return d.nomer; }
    var t = pmiOf(a, d);
    return (a.zavNomer || String(a.techPoz || a.id).toUpperCase()) + '-' + pad2(t ? t.n : 1) + (isAkt(d) ? 'А' : '');
  }
  /* Обозначение документа: техпозиция вместо децимального номера + код документа ЕСКД. */
  function oboznDoc(a, d) {
    var base = String(a.techPoz || a.id).toUpperCase().replace(/\s+/g, '') + '.00.000';
    if (d.vid === 'protokol') { return base + ' ПР-' + nomerProtokola(a, d).split('-').slice(-1)[0]; }
    return base + (KOD_DOC[d.vid] ? ' ' + KOD_DOC[d.vid] : '');
  }
  function oprosZn(a, k) { var o = a.oprosnyList || {}; return o[k] === undefined || o[k] === null ? '' : String(o[k]); }

  /* Рамка листа: поле 20 мм слева, 5 мм по остальным сторонам; графы 19–23 по
     левому полю и графа 26 (обозначение, повёрнутое на 180°) в левом верхнем углу. */
  function ramka(W, H, obozn) {
    var x0 = 20 * MM, y0 = 5 * MM, x1 = W - 5 * MM, y1 = H - 5 * MM;
    var s = rc(x0, y0, x1 - x0, y1 - y0, 'apl-k');
    var y = y1, xs = 8 * MM;
    [[25, 'Инв. № подл.'], [35, 'Подп. и дата'], [25, 'Взам. инв. №'], [25, 'Инв. № дубл.'], [35, 'Подп. и дата']].forEach(function (g) {
      var h = g[0] * MM;
      s += rc(xs, y - h, 12 * MM, h, 'apl-k') + ln(xs + 5 * MM, y - h, xs + 5 * MM, y, 'apl-k') +
        tx(xs + 3.4 * MM, y - h / 2, g[1], 'apl-lab', { rot: -90, k: .6, a: 'middle' });
      y -= h;
    });
    s += rc(x0, y0, 70 * MM, 14 * MM, 'apl-k') + tx(x0 + 35 * MM, y0 + 7 * MM - 5, obozn, 'apl-obz', { rot: 180, a: 'middle', k: .8, fit: 64 * MM });
    return s;
  }

  /* Основная надпись. o: {forma, obozn, name[], vidDoc, masshtab, listov, org, podp, data, izm} */
  function shtamp(W, H, o) {
    var f1 = o.forma === 1, r = 5 * MM, wd = 185 * MM, h = (f1 ? 55 : 40) * MM;
    var X = W - 5 * MM - wd, Y = H - 5 * MM - h;
    var cx = [0, 7, 17, 40, 55, 65].map(function (m) { return X + m * MM; });
    var nIzm = f1 ? 4 : 2, yH = Y + nIzm * r, RX = cx[5];
    var s = rc(X, Y, wd, h, 'apl-paper apl-k');
    for (var i = 1; i < h / r; i++) { s += ln(X, Y + i * r, RX, Y + i * r, i === nIzm || i === nIzm + 1 ? 'apl-k' : 'apl-t'); }
    s += ln(cx[1], Y, cx[1], yH + r, 'apl-k');
    [2, 3, 4].forEach(function (i) { s += ln(cx[i], Y, cx[i], Y + h, 'apl-k'); });
    s += ln(RX, Y, RX, Y + h, 'apl-k');
    var mid = function (i) { return (cx[i] + cx[i + 1]) / 2; };
    var yT = function (row) { return Y + row * r + r - 4; };
    [['Изм.', 0], ['Лист', 1], ['№ докум.', 2], ['Подп.', 3], ['Дата', 4]].forEach(function (g) {
      s += tx(mid(g[1]), yT(nIzm), g[0], 'apl-lab', { a: 'middle', k: .75 });
    });
    if (o.izm) {
      s += tx(mid(0), yT(nIzm - 1), o.izm.n, 'apl-val', { a: 'middle', k: .85 }) +
        tx(mid(4), yT(nIzm - 1), o.izm.data, 'apl-val', { a: 'middle', k: .6 });
    }
    var roli = f1 ? [['Разраб.', 'razrab'], ['Пров.', 'prov'], ['Т. контр.', 'tkontr'], ['', ''], ['Н. контр.', 'nkontr'], ['Утв.', '']]
      : [['Разраб.', 'razrab'], ['Пров.', 'prov'], ['Т. контр.', 'tkontr'], ['Н. контр.', 'nkontr'], ['Утв.', '']];
    roli.forEach(function (g, j) {
      var row = nIzm + 1 + j, p = g[1] ? o.podp[g[1]] : null;
      s += tx(X + 3, yT(row), g[0], 'apl-lab', { k: .75 });
      if (p) {
        s += tx(cx[2] + 3, yT(row), familiya(p), 'apl-val', { k: .85, fit: 22 * MM });
        if (j < 2) { s += tx(mid(4), yT(row), o.data, 'apl-val', { a: 'middle', k: .6 }); }
      }
    });
    /* Правая часть: обозначение, наименование, литера/масса/масштаб или лист, организация. */
    var RB = RX + 70 * MM, Rw = 50 * MM;
    s += ln(RX, Y + 15 * MM, X + wd, Y + 15 * MM, 'apl-k') + ln(RB, Y + 15 * MM, RB, Y + h, 'apl-k');
    s += tx(RX + 60 * MM, Y + 10 * MM, o.obozn, 'apl-obz', { a: 'middle', fit: 112 * MM });
    var nm = o.name.concat([o.vidDoc]).filter(Boolean), ny0 = Y + 15 * MM + (25 * MM - nm.length * 19) / 2 + 14;
    nm.forEach(function (t, i) { s += tx(RX + 35 * MM, ny0 + i * 19, t, i === nm.length - 1 ? 'apl-name' : 'apl-p', { a: 'middle', fit: 66 * MM }); });
    if (f1) {
      s += ln(RX, Y + 40 * MM, RB, Y + 40 * MM, 'apl-k');
      s += ln(RB, Y + 20 * MM, X + wd, Y + 20 * MM, 'apl-t') + ln(RB, Y + 35 * MM, X + wd, Y + 35 * MM, 'apl-k') + ln(RB, Y + 40 * MM, X + wd, Y + 40 * MM, 'apl-k');
      s += ln(RB + 5 * MM, Y + 20 * MM, RB + 5 * MM, Y + 35 * MM, 'apl-t') + ln(RB + 10 * MM, Y + 20 * MM, RB + 10 * MM, Y + 35 * MM, 'apl-t');
      s += ln(RB + 15 * MM, Y + 15 * MM, RB + 15 * MM, Y + 35 * MM, 'apl-k') + ln(RB + 32 * MM, Y + 15 * MM, RB + 32 * MM, Y + 35 * MM, 'apl-k');
      s += ln(RB + 20 * MM, Y + 35 * MM, RB + 20 * MM, Y + 40 * MM, 'apl-k');
      s += tx(RB + 7.5 * MM, Y + 19 * MM, 'Лит.', 'apl-lab', { a: 'middle', k: .75 }) + tx(RB + 23.5 * MM, Y + 19 * MM, 'Масса', 'apl-lab', { a: 'middle', k: .75 }) +
        tx(RB + 41 * MM, Y + 19 * MM, 'Масштаб', 'apl-lab', { a: 'middle', k: .75 });
      s += tx(RB + 41 * MM, Y + 29.5 * MM, o.masshtab, 'apl-name', { a: 'middle' });
      s += tx(RB + 2, Y + 39 * MM, 'Лист 1', 'apl-lab', { k: .75 }) + tx(RB + 20 * MM + 2, Y + 39 * MM, 'Листов ' + o.listov, 'apl-lab', { k: .75 });
      s += tx(RB + Rw / 2, Y + 49 * MM, o.org, 'apl-name', { a: 'middle', fit: 46 * MM });
    } else {
      s += ln(RB, Y + 20 * MM, X + wd, Y + 20 * MM, 'apl-t') + ln(RB, Y + 25 * MM, X + wd, Y + 25 * MM, 'apl-k');
      s += ln(RB + 5 * MM, Y + 20 * MM, RB + 5 * MM, Y + 25 * MM, 'apl-t') + ln(RB + 10 * MM, Y + 20 * MM, RB + 10 * MM, Y + 25 * MM, 'apl-t');
      s += ln(RB + 15 * MM, Y + 15 * MM, RB + 15 * MM, Y + 25 * MM, 'apl-k') + ln(RB + 30 * MM, Y + 15 * MM, RB + 30 * MM, Y + 25 * MM, 'apl-k');
      s += tx(RB + 7.5 * MM, Y + 19 * MM, 'Лит.', 'apl-lab', { a: 'middle', k: .75 }) + tx(RB + 22.5 * MM, Y + 19 * MM, 'Лист', 'apl-lab', { a: 'middle', k: .75 }) +
        tx(RB + 40 * MM, Y + 19 * MM, 'Листов', 'apl-lab', { a: 'middle', k: .75 });
      s += tx(RB + 22.5 * MM, Y + 24 * MM, '1', 'apl-val', { a: 'middle', k: .85 }) + tx(RB + 40 * MM, Y + 24 * MM, o.listov, 'apl-val', { a: 'middle', k: .85 });
      s += tx(RB + Rw / 2, Y + 34 * MM, o.org, 'apl-name', { a: 'middle', fit: 46 * MM });
    }
    return s;
  }
  function shtampDlya(a, d, rev, forma) {
    var r = null;
    (d.revizii || []).forEach(function (x) { if (x.rev === rev) { r = x; } });
    r = r || lastRev(d) || {};
    var first = (d.revizii || [])[0] || r;
    var izm = /^[B-Z]$/.test(rev) ? { n: String(rev.charCodeAt(0) - 64 - 1), data: korotkayaData(r.date) } : null;
    return shtamp(forma === 1 ? 420 * MM : 210 * MM, 297 * MM, {
      forma: forma, obozn: oboznDoc(a, d), name: perenos(a.nazvanie, 30).slice(0, 2),
      vidDoc: d.vid === 'sborochnyy' ? 'Сборочный чертёж' : d.vid === 'protokol' ? (isAkt(d) ? 'Акт' : 'Протокол') : (ZAGOLOVOK[d.vid] || d.title),
      masshtab: forma === 1 ? (a.tip === 'teploobmennik' ? '1:25' : '1:40') : '', listov: LISTOV[d.vid] || 1,
      org: zavodShort(), podp: podpisi(a, d), data: korotkayaData(first.date), izm: izm
    });
  }
  function svgList(W, H, label, inner, vid) {
    return '<svg class="apl__sheet" viewBox="0 0 ' + W + ' ' + H + '"' + (vid ? ' data-vid="' + esc(vid) + '"' : '') + ' role="img" aria-label="' + esc(label) + '">' +
      rc(0, 0, W, H, 'apl-paper') + inner + '</svg>';
  }

  /* Вид АВО спереди, с торца коллекторов. Габариты — из Model3D.gabarity(вид), те же,
     что у 3D-модели: рама, короб, диффузор с приводом; у АВЗ секции шатром в камерах
     коллекторов, у АВГ три секции плашмя одним ярусом, камеры в ряд. Штуцер А — на
     первой секции (рев. B — на третьей), штуцер Б торцом; в рев. B площадка обслуживания
     с ограждением и лестницей. Масштаб 1:40 — 75 ед. на метр. */
  function vidAvo(vid, rev, cx, gy) {
    var G = w.Model3D && w.Model3D.gabarity ? w.Model3D.gabarity(vid) : null;
    if (!G) { return ''; }
    var S = 75, W2 = G.W / 2, TW = G.TW, Y0 = G.y0;
    function X(z) { return cx + z * S; }
    function Y(h) { return gy - h * S; }
    function P(z, h) { return r1(X(z)) + ' ' + r1(Y(h)); }
    var sA = G.shtucerA, sB = G.shtucerB, sh = G.shtucer;
    var zA = sA.z[rev === 'B' ? 'B' : 'A'], topA = sA.y + sA.len;
    var s = ln(X(-W2 - 1.1), Y(0), X(W2 + 1.1), Y(0), 'apl-k');
    s += ln(X(0), Y(-.3), X(0), Y(topA + .8), 'apl-ax');
    /* Стойки рамы, короб над вентиляторами, диффузор, колесо, привод на своей раме. */
    [-W2, W2].forEach(function (z) { s += rc(X(z) - .13 * S, Y(G.top), .26 * S, G.top * S, 'apl-k'); });
    s += rc(X(-W2), Y(G.wall), G.W * S, (G.wall - G.top) * S, 'apl-k');
    var c0 = G.top - G.coneH, c1 = c0 - G.bandH, rt = G.RT * G.coneZ, pv = G.privod, mz = pv.h + pv.plita + pv.motorH;
    s += pth('M' + P(-rt, G.top) + ' L' + P(-G.RB, c0) + ' L' + P(G.RB, c0) + ' L' + P(rt, G.top));
    s += rc(X(-G.RB), Y(c0), 2 * G.RB * S, G.bandH * S, 'apl-k');
    s += rc(X(-pv.rama), Y(pv.h), 2 * pv.rama * S, pv.h * S, 'apl-t') +
      rc(X(-pv.motorR), Y(mz), 2 * pv.motorR * S, pv.motorH * S, 'apl-k') + ln(X(0), Y(mz), X(0), Y(c1), 'apl-k');
    if (G.vid === 'avg') {
      /* АВГ: камеры секций в ряд на ярусе, пробки в два ряда. */
      var km = G.kamera, cw = km.w;
      G.sekciiZ.forEach(function (zc) {
        var z0 = zc - cw / 2, yc = km.niz + km.h / 2;
        s += rc(X(z0), Y(km.niz + km.h), cw * S, km.h * S, 'apl-paper apl-k');
        for (var i = 0; i < 6; i++) {
          for (var j = 0; j < 2; j++) { s += krug(X(z0 + .25 + i * (cw - .5) / 5), Y(yc + (j - .5) * .26), 3, 'apl-t'); }
        }
      });
    } else {
      /* АВЗ: камеры коллекторов по скатам шатров, пробки кружками, камера на коньке. */
      var RG = Y0 + G.shater, kt = G.kamera.t / 2, kk = G.kamera.konyok;
      var kamera = function (z1, h1, z2, h2) {
        var dx = (z2 - z1) * S, dy = (h1 - h2) * S, l = Math.sqrt(dx * dx + dy * dy), nx = -dy / l * kt * S, ny = dx / l * kt * S;
        var ax = X(z1), ay = Y(h1), bx = X(z2), by = Y(h2);
        var q = pth('M' + r1(ax + nx) + ' ' + r1(ay + ny) + ' L' + r1(bx + nx) + ' ' + r1(by + ny) + ' L' + r1(bx - nx) + ' ' + r1(by - ny) + ' L' + r1(ax - nx) + ' ' + r1(ay - ny) + ' Z', 'apl-paper apl-k');
        for (var i = 0; i < 5; i++) { var t = .15 + i * .175; q += krug(ax + (bx - ax) * t, ay + (by - ay) * t, 4, 'apl-t'); }
        return q;
      };
      G.sekciiZ.forEach(function (zc) {
        s += kamera(zc - TW / 2, Y0, zc, RG) + kamera(zc + TW / 2, Y0, zc, RG);
        s += rc(X(zc) - kk.w / 2 * S, Y(RG + kk.dy + kk.h / 2), kk.w * S, kk.h * S, 'apl-paper apl-k');
      });
    }
    s += ln(X(-W2), Y(Y0), X(W2), Y(Y0), 'apl-k');
    /* Штуцер А — патрубок с фланцем, штуцер Б торцом — фланец и оси. */
    s += rc(X(zA) - sh.r * S, Y(topA), 2 * sh.r * S, sA.len * S, 'apl-paper apl-k') +
      rc(X(zA) - sh.flR * S, Y(topA + sh.flH / 2), 2 * sh.flR * S, sh.flH * S, 'apl-paper apl-k');
    var bx = X(sB.z), by = Y(sB.y);
    s += krug(bx, by, sh.flR * S, 'apl-paper apl-k') + krug(bx, by, sh.r * S, 'apl-k') + ln(bx - 34, by, bx + 34, by, 'apl-ax') + ln(bx, by - 34, bx, by + 34, 'apl-ax');
    if (rev === 'B') {
      var pl = G.ploshchadka, DY = pl.y, RH = pl.rh, DZ = W2 + pl.zapas, g0 = -DZ + pl.laz, g1 = g0 + pl.lazW;
      [-DZ + .05, DZ - .05].forEach(function (z) { s += rc(X(z) - .08 * S, Y(DY - .1), .16 * S, (DY - .2) * S, 'apl-paper apl-k'); });
      s += rc(X(-DZ), Y(DY), 2 * DZ * S, .2 * S, 'apl-paper apl-k');
      [[-DZ, g0], [g1, DZ]].forEach(function (u) {
        s += ln(X(u[0]), Y(DY + RH), X(u[1]), Y(DY + RH), 'apl-t') + ln(X(u[0]), Y(DY + RH / 2), X(u[1]), Y(DY + RH / 2), 'apl-t');
      });
      var stoyki = [-DZ, g0];
      for (var i = 0; i <= 5; i++) { stoyki.push(g1 + (DZ - g1) * i / 5); }
      stoyki.forEach(function (z) { s += ln(X(z), Y(DY), X(z), Y(DY + RH), 'apl-t'); });
      s += ln(X(g0 + .05), Y(0), X(g0 + .05), Y(DY + RH), 'apl-k') + ln(X(g1 - .05), Y(0), X(g1 - .05), Y(DY + RH), 'apl-k');
      for (var h = .35; h < DY; h += .32) { s += ln(X(g0 + .05), Y(h), X(g1 - .05), Y(h), 'apl-t'); }
      s += vynoska(X(DZ - .25), Y(DY - .1), X(DZ + .6), Y(DY - .9), 'Площадка', 1);
    }
    s += vynoska(X(zA) + sh.r * S, Y(topA - .3), X(zA + 1.1), Y(topA + .55), 'А', 1);
    s += vynoska(bx - sh.flR * S * .7, by - sh.flR * S * .7, X(-W2 - .7), Y(sB.y + .83), 'Б', -1);
    return s;
  }
  /* Линия-выноска с полкой; dir: 1 — полка вправо, −1 — влево. */
  function vynoska(x1, y1, x2, y2, text, dir) {
    var wd = Math.max(30, text.length * 8 + 10);
    return ln(x1, y1, x2, y2, 'apl-t') + krug(x1, y1, 2, 'apl-dot') + ln(x2, y2, x2 + dir * wd, y2, 'apl-t') +
      tx(x2 + dir * wd / 2, y2 - 5, text, 'apl-name', { a: 'middle' });
  }

  /* Теплообменник и ёмкость: корпус на седловых опорах, штуцеры с выносками. */
  function vidSosud(a) {
    var te = a.tip === 'teploobmennik';
    var S = te ? 120 : 75, D = te ? .8 : 2.4, Lsh = te ? 4 : 5.5, hd = te ? .5 : .6, L0 = te ? .6 : .6, H0 = te ? .75 : .7;
    var total = L0 + Lsh + hd, x0 = 440 - total * S / 2, ay = 470;
    function X(m) { return x0 + m * S; }
    var top = ay - D / 2 * S, bot = ay + D / 2 * S, gy = bot + H0 * S;
    var s = ln(X(-.4), gy, X(total + .4), gy, 'apl-k');
    s += ln(X(-.3), ay, X(total + .3), ay, 'apl-ax');
    /* Седловые опоры. */
    [L0 + Lsh * .22, L0 + Lsh * .78].forEach(function (m) {
      s += pth('M' + X(m - .22 * D) + ' ' + (bot - 4) + ' L' + X(m - .32 * D) + ' ' + gy + ' L' + X(m + .32 * D) + ' ' + gy + ' L' + X(m + .22 * D) + ' ' + (bot - 4));
      s += ln(X(m), bot, X(m), gy, 'apl-t');
    });
    s += rc(X(L0), top, Lsh * S, D * S, 'apl-paper apl-k');
    var re = X(L0 + Lsh);
    s += pth('M' + re + ' ' + top + ' A ' + hd * S + ' ' + D / 2 * S + ' 0 0 1 ' + re + ' ' + bot);
    if (te) {
      var e = .06 * S;
      s += rc(X(L0) - e, top - e, e, D * S + 2 * e, 'apl-paper apl-k') + rc(X(0), top, (L0 * S) - e, D * S, 'apl-paper apl-k') +
        rc(X(0) - e, top - e, e, D * S + 2 * e, 'apl-paper apl-k') + rc(re, top - e, e, D * S + 2 * e, 'apl-paper apl-k');
    } else {
      s += pth('M' + X(L0) + ' ' + top + ' A ' + hd * S + ' ' + D / 2 * S + ' 0 0 0 ' + X(L0) + ' ' + bot);
    }
    var nz = te
      ? [['А', .3, 1, .2], ['Б', .3, -1, .2], ['В', L0 + Lsh - .45, 1, .2], ['Г', L0 + .35, -1, .2]]
      : [['А', L0 + .8, 1, .2], ['Б', L0 + Lsh * .5, -1, .2], ['В', L0 + Lsh - 1.2, 1, .5]];
    nz.forEach(function (n) {
      var m = n[1], up = n[2] > 0, dd = n[3] * S, len = (te ? .3 : .35) * S, fl = .08 * S;
      var y0 = up ? top - len : bot;
      s += rc(X(m) - dd / 2, y0, dd, len, 'apl-paper apl-k') + rc(X(m) - dd / 2 - 8, up ? y0 - fl : bot + len, dd + 16, fl, 'apl-paper apl-k');
      s += up ? vynoska(X(m) + dd / 2, y0 + 6, X(m) + dd / 2 + 40, y0 - 50, n[0], 1)
        : vynoska(X(m) - dd / 2, bot + len - 6, X(m) - dd / 2 - 40, bot + len + 44, n[0], -1);
    });
    return s;
  }

  /* Правая колонка чертежа над основной надписью: таблица штуцеров,
     техническая характеристика из опросного листа, технические требования. */
  function tablicyChertezha(a) {
    var x = 830, wd = 400, y = 70, s = '';
    var sht = SHTUCERY[a.tip] || [];
    s += tx(x + wd / 2, y, 'Таблица штуцеров', 'apl-pb', { a: 'middle' });
    y += 12;
    s += rc(x, y, wd, 30 * (sht.length + 1), 'apl-k') + ln(x + 70, y, x + 70, y + 30 * (sht.length + 1), 'apl-k');
    s += tx(x + 35, y + 20, 'Обозн.', 'apl-sm', { a: 'middle' }) + tx(x + 80, y + 20, 'Назначение', 'apl-sm');
    sht.forEach(function (r, i) {
      var yy = y + 30 * (i + 1);
      s += ln(x, yy, x + wd, yy, i ? 'apl-t' : 'apl-k') + tx(x + 35, yy + 20, r[0], 'apl-p', { a: 'middle' }) + tx(x + 80, yy + 20, r[1], 'apl-p', { fit: wd - 90 });
    });
    y += 30 * (sht.length + 1) + 50;
    var har = [['Рабочая среда', oprosZn(a, 'sreda')], ['Давление расчётное', oprosZn(a, 'davlenieRaschetnoe')],
      ['Температура на входе', oprosZn(a, 'tempVhod')], ['Объём', oprosZn(a, 'obyom')]].filter(function (r) { return r[1]; });
    s += tx(x + wd / 2, y, 'Техническая характеристика', 'apl-pb', { a: 'middle' });
    y += 30;
    har.forEach(function (r, i) { s += tx(x, y + i * 24, (i + 1) + '. ' + r[0] + ' — ' + r[1].charAt(0).toLowerCase() + r[1].slice(1), 'apl-p', { fit: wd }); });
    y += har.length * 24;
    s += bary(x, y - 8, wd, 2, 24);
    y += 70;
    s += tx(x + wd / 2, y, 'Технические требования', 'apl-pb', { a: 'middle' });
    s += bary(x, y + 22, wd, 5, 24);
    return s;
  }
  function listChertezh(a, d, rev) {
    var W = 420 * MM, H = 297 * MM;
    var vid = a.vidModeli ? vidAvo(a.vidModeli, rev, 440, 800) : vidSosud(a);
    return svgList(W, H, d.title + ', рев. ' + rev + ', первый лист', vid + tablicyChertezha(a) + ramka(W, H, oboznDoc(a, d)) + shtampDlya(a, d, rev, 1), a.vidModeli);
  }

  /* Текстовый документ ЕСКД: заголовок, 3–5 строк сути из данных, дальше полосы. */
  function listTekst(a, d, rev) {
    var W = 210 * MM, H = 297 * MM, x = 30 * MM, xv = 92 * MM, wd = 165 * MM;
    var r = lastRev(d) || {}, pm = d.vid === 'protokol' ? pmiOf(a, d) : null;
    var obj = a.nazvanie + (a.techPoz ? ', поз. ' + a.techPoz : '');
    var h, sub, sut, razdely;
    if (d.vid === 'protokol') {
      var akt = isAkt(d), gidro = /гидравлич/i.test(d.title);
      h = (akt ? 'Акт № ' : 'Протокол № ') + nomerProtokola(a, d);
      sub = String(d.title).replace(/^(Протокол|Акт)\s+/, '');
      sut = [['Аппарат', obj], ['Заводской №', a.zavNomer || ''], ['Дата проведения', R.data(r.date, { format: 'doc' })]];
      if (gidro) { sut.push(['Пробное давление', a.davlenieProbnoe || '']); }
      if (pm) {
        var pmiDoc = null;
        a.dokumenty.forEach(function (x) { if (x.vid === 'pmi') { pmiDoc = x; } });
        sut.push(['Основание', (pmiDoc ? oboznDoc(a, pmiDoc) : 'ПМИ') + ', точка ' + pm.n]);
      }
      sut.push([akt ? 'Результат' : 'Заключение', akt ? 'испытания выдержал, соответствует' : 'соответствует требованиям ПМИ']);
      razdely = [['1. Объект контроля', 3], ['2. Средства контроля', 3], ['3. Результаты', 4]];
    } else {
      h = ZAGOLOVOK[d.vid] || d.title;
      sub = obj;
      sut = [['Аппарат', a.nazvanie], ['Обозначение', a.oboznachenie]];
      if (d.vid === 'raschet') {
        sut.push(['Давление расчётное', oprosZn(a, 'davlenieRaschetnoe')], ['Температура на входе', oprosZn(a, 'tempVhod')], ['Рабочая среда', oprosZn(a, 'sreda')]);
        razdely = [['1. Исходные данные', 5], ['2. Расчёт элементов', 5]];
      } else if (d.vid === 'pmi') {
        var c = { H: 0, W: 0, R: 0 };
        (a.pmi || []).forEach(function (p) { c[p.tip] = (c[p.tip] || 0) + 1; });
        sut.push(['Заводской №', a.zavNomer || 'присваивается при изготовлении']);
        if ((a.pmi || []).length) { sut.push(['Точки контроля', a.pmi.length + ': H — ' + c.H + ', W — ' + c.W + ', R — ' + c.R]); }
        sut.push(['Давление расчётное', oprosZn(a, 'davlenieRaschetnoe')]);
        razdely = [['1. Объект испытаний', 4], ['2. Точки контроля и порядок приёмки', 5]];
      } else {
        sut.push(['Заводской №', a.zavNomer || ''], ['ТУ', a.tu || ''], ['Изготовитель', (spr().zavod || {}).name || '']);
        razdely = [['1. Общие сведения', 5], ['2. Технические данные', 5]];
      }
    }
    sut = sut.filter(function (x) { return x[1]; }).slice(0, 5);
    var s = tx(W / 2 + 7 * MM, 50 * MM, h.toUpperCase(), 'apl-h', { a: 'middle', fit: wd });
    perenos(sub, 56).slice(0, 2).forEach(function (t, i) { s += tx(W / 2 + 7 * MM, 50 * MM + 30 + i * 22, t, 'apl-sub', { a: 'middle', fit: wd }); });
    var y = 76 * MM;
    sut.forEach(function (x2) {
      s += tx(x, y, x2[0], 'apl-p apl-muted') + tx(xv, y, x2[1], 'apl-pb', { fit: wd - (xv - x) });
      y += 26;
    });
    y += 30;
    razdely.forEach(function (rz) {
      if (y > 232 * MM) { return; }
      s += tx(x, y, rz[0], 'apl-pb');
      s += bary(x, y + 16, wd, rz[1]);
      y += 16 + rz[1] * 21 + 34;
    });
    return svgList(W, H, d.title + ', первая страница', s + ramka(W, H, oboznDoc(a, d)) + shtampDlya(a, d, rev, 2));
  }

  /* ТКП: нейтральная первая страница. Шапка — из справочника (наименование, группа,
     город, телефон), адресат — заказчик и его контакт из демо, предмет и таблица
     характеристик — из опросного листа. Вместо коммерческой части — одна строка. */
  function listTkp(a, d, rev) {
    var W = 210 * MM, H = 297 * MM, x = 20 * MM, x2 = 200 * MM, wd = x2 - x;
    var z = spr().zavod || {}, zk = DATA.zakazchik(a.zakazchikId) || { contacts: [] };
    var r = null;
    d.revizii.forEach(function (q) { if (q.rev === rev) { r = q; } });
    r = r || lastRev(d) || {};
    var kont = (zk.contacts || []).filter(function (p) { return /снабж|материально/i.test(p.position || ''); })[0] || (zk.contacts || [])[0] || null;
    var s = sv('image', { href: 'assets/img/logo-bmz-70-siniy.svg', x: x, y: 40, width: 170, height: 49 });
    [[z.name, 'apl-pb'], [z.gruppa, 'apl-sm'], [z.gorod ? 'г. ' + z.gorod : '', 'apl-sm'], [z.telefon ? 'Тел. ' + z.telefon : '', 'apl-sm']]
      .filter(function (q) { return q[0]; }).forEach(function (q, i) { s += tx(x2, 52 + i * 19, q[0], q[1], { a: 'end', fit: 105 * MM }); });
    s += ln(x, 130, x2, 130, 'apl-k');
    s += tx(x, 170, 'Исх. № ' + (d.nomer || '11-2/' + String(1000 + (a.id.length * 97 + a.id.charCodeAt(a.id.length - 1) * 13) % 9000)), 'apl-p');
    s += tx(x, 192, 'от ' + R.data(r.date, { format: 'doc' }), 'apl-p');
    var ax = 118 * MM, ay = 170;
    s += tx(ax, ay, zk.name || '', 'apl-pb', { fit: x2 - ax });
    if (kont) {
      s += tx(ax, ay + 22, kont.name, 'apl-p');
      perenos(kont.position, 34).slice(0, 3).forEach(function (t, i) { s += tx(ax, ay + 42 + i * 18, t, 'apl-sm', { fit: x2 - ax }); });
    }
    s += tx(W / 2, 290, 'ТЕХНИКО-КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', 'apl-h', { a: 'middle', fit: wd });
    s += tx(W / 2, 318, 'на изготовление аппарата' + (a.techPoz ? ' поз. ' + a.techPoz : ''), 'apl-sub', { a: 'middle' });
    s += bary(x, 348, wd, 2);
    var y = 410;
    [['Предмет', a.nazvanie + ', ' + a.oboznachenie], ['Установка', a.ustanovka || ''], ['Количество', (a.kolichestvo || 1) + ' шт.']]
      .filter(function (q) { return q[1]; }).forEach(function (q) {
        s += tx(x, y, q[0], 'apl-p apl-muted') + tx(x + 110, y, q[1], 'apl-pb', { fit: wd - 110 });
        y += 24;
      });
    var har = [['Рабочая среда', oprosZn(a, 'sreda')], ['Давление расчётное', oprosZn(a, 'davlenieRaschetnoe')],
      ['Температура вход / выход', [oprosZn(a, 'tempVhod'), oprosZn(a, 'tempVyhod')].filter(Boolean).join(' / ')],
      ['Расход', oprosZn(a, 'rashod')], ['Тепловая нагрузка', oprosZn(a, 'nagruzka')], ['Объём', oprosZn(a, 'obyom')]]
      .filter(function (q) { return q[1]; }).slice(0, 4);
    y += 10;
    if (har.length) {
      var th = 26, tw = har.length + 1;
      s += rc(x, y, wd, th * tw, 'apl-k') + ln(x + wd * .45, y, x + wd * .45, y + th * tw, 'apl-t');
      s += rc(x, y, wd, th, 'apl-head') + tx(x + 8, y + 18, 'Характеристика', 'apl-sm') + tx(x + wd * .45 + 8, y + 18, 'Значение', 'apl-sm');
      har.forEach(function (q, i) {
        var yy = y + th * (i + 1);
        s += ln(x, yy, x + wd, yy, 'apl-t') + tx(x + 8, yy + 18, q[0], 'apl-p') + tx(x + wd * .45 + 8, yy + 18, q[1], 'apl-pb', { fit: wd * .55 - 16 });
      });
      y += th * tw + 34;
    }
    var dog = null, otg = null;
    (a.etapy || []).forEach(function (e) { if (e.id === 'dogovor') { dog = e.date; } if (e.id === 'otgruzhen') { otg = e.date; } });
    var ned = dog && otg ? Math.round((new Date(otg) - new Date(dog)) / 864e5 / 7) : 0;
    var gar = +oprosZn(a, 'garantiyaMes') || (a.postavka && a.postavka.garantiyaMes) || 0;
    if (ned > 0) { s += tx(x, y, 'Срок изготовления', 'apl-p apl-muted') + tx(x + 150, y, ned + ' ' + R.plural(ned, 'неделя', 'недели', 'недель') + ' с даты договора', 'apl-pb'); y += 24; }
    if (gar) { s += tx(x, y, 'Гарантия', 'apl-p apl-muted') + tx(x + 150, y, gar + ' мес.', 'apl-pb'); y += 24; }
    y += 20;
    s += rc(x, y, wd, 36, 'apl-note') + tx(x + 12, y + 23, 'Стоимость и условия оплаты — в подписанном экземпляре', 'apl-pb', { fit: wd - 24 });
    y += 70;
    s += bary(x, y, wd, Math.max(0, Math.min(5, Math.floor((H - 90 - y) / 21))));
    s += rc(x2 - 120, H - 62, 120, 34, 'apl-markbox') + tx(x2 - 60, H - 38, 'ОБРАЗЕЦ', 'apl-mark', { a: 'middle', fit: 104 });
    return svgList(W, H, 'Технико-коммерческое предложение, первая страница, образец', s);
  }

  /* Лист по виду документа. */
  function prevyu(a, d, rev, podpis) {
    var a4 = d.vid !== 'sborochnyy';
    var list = d.vid === 'tkp' ? listTkp(a, d, rev) : a4 ? listTekst(a, d, rev) : listChertezh(a, d, rev);
    return '<figure class="apl apl--' + (a4 ? 'a4' : 'a3') + '" data-prevyu="' + esc(d.vid) + '" data-rev="' + esc(rev) + '">' +
      '<div class="apl__desk">' + list + '</div>' +
      (podpis ? '<figcaption class="apl__cap">' + (d.vid === 'sborochnyy' ? 'Первый лист чертежа, схематично.' : 'Первая страница, схематично.') +
        ' <button class="link-btn" type="button" data-soon="Просмотр и скачивание документа">Открыть документ</button></figcaption>' : '') +
      '</figure>';
  }

  function zamechaniya(a, d, cur, isLast) {
    var list = a.zamechaniya.filter(function (z) { return z.dokumentId === d.id && z.rev === cur.rev; });
    var next = d.sledRev;
    var items = list.map(function (z, i) {
      var canAnswer = side === 'zavod' && z.mozhnoOtvetit;
      var code = pozCode(z.poziciya);
      var otvet = z.otvet
        ? '<div class="ap-zm__otvet ' + (z.otvet.prinyato ? 'is-ok' : 'is-no') + '">' +
            '<p class="ap-zm__otvet-text"><span class="ap-zm__verdict">' + (z.otvet.prinyato ? 'Принято' : 'Отклонено') + '</span>' +
              (z.otvet.text ? (z.otvet.prinyato ? ', ' : ': ') + esc(z.otvet.text) : '') + '</p>' +
            '<p class="ap-zm__who">' + esc(who(z.otvet.avtor)) + ' · ' + esc(docData(z.otvet.date)) + '</p></div>'
        : (canAnswer
          ? '<div class="ap-zm__form"><label class="field"><span class="field__label label">Ответ завода</span>' +
              '<textarea class="textarea" rows="2" id="otv-' + esc(z.id) + '" placeholder="Будет в рев. ' + esc(next) + '"></textarea></label>' +
              '<div class="row ap-zm__btns">' +
                '<button class="btn btn--primary btn--sm" type="button" data-act="ap-otvet" data-id="' + esc(z.id) + '" data-prinyato="1">Принять</button>' +
                '<button class="btn btn--secondary btn--sm" type="button" data-act="ap-otvet" data-id="' + esc(z.id) + '" data-prinyato="0">Отклонить</button>' +
              '</div></div>'
          : '<p class="ap-zm__wait"><span class="badge badge--warn">Ждёт ответа завода</span></p>');
      return '<li class="ap-zm__item" data-zm="' + esc(z.id) + '"' + (z.otvet ? ' data-otvet="' + (z.otvet.prinyato ? 'prinyato' : 'otkloneno') + '"' : '') + '>' +
        '<div class="ap-zm__top"><span class="ap-zm__n">' + (i + 1) + '</span>' +
          (z.poziciya
            ? (code ? '<button class="ap-zm__poz" type="button" data-act="ap-hl" data-poz="' + code + '" title="Показать на модели">' + esc(z.poziciya) + '</button>'
                    : '<span class="ap-zm__poz is-plain">' + esc(z.poziciya) + '</span>')
            : '<span class="ap-zm__poz is-plain">общее</span>') +
          '<span class="ap-zm__date">' + esc(docData(z.date)) + '</span></div>' +
        '<p class="ap-zm__text">' + esc(z.text) + '</p>' +
        '<p class="ap-zm__who">' + esc(who(z.avtor)) + '</p>' + otvet + '</li>';
    }).join('');
    return '<div class="ap-zm-head"><h3 class="ap-sub">Замечания к рев. ' + esc(cur.rev) + '</h3>' +
        '<span class="ap-zm-head__n">' + list.length + '</span></div>' +
      (list.length ? '<ol class="ap-zm">' + items + '</ol>' : '<p class="ap-zm-empty small muted">Замечаний к этой ревизии нет.</p>');
  }

  function otvetForm(a, d, cur, isLast) {
    var kody = spr().kody || {};
    if (!isLast) {
      return '<p class="ap-doc__status">Рев. ' + esc(cur.rev) + ' заменена следующей ревизией. Ответ: ' + (cur.kod ? R.kodOtveta(cur.kod) : '—') + '</p>';
    }
    var mz = d.mozhno || {};
    if (side === 'zakazchik' && (mz.zamechanie || (mz.kody || []).length)) {
      return '<div class="ap-form" id="ap-zm-form">' +
          '<h3 class="ap-sub">Новое замечание</h3>' +
          '<label class="field"><span class="field__label label">Позиция</span>' +
            '<input class="input" id="zm-poz" type="text" autocomplete="off" placeholder="' + (a.tip === 'avo' && d.vid === 'sborochnyy' ? 'Клик по штуцеру в модели' : 'Лист, узел, позиция') + '"></label>' +
          '<label class="field"><span class="field__label label">Текст замечания</span><textarea class="textarea" id="zm-text" rows="3"></textarea></label>' +
          '<p class="ap-form__err" id="zm-err" hidden></p>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="ap-zm-add">Добавить замечание</button>' +
        '</div>' +
        '<div class="ap-form ap-kod-form">' +
          '<h3 class="ap-sub">Ответ по рев. ' + esc(cur.rev) + '</h3>' +
          '<div class="ap-kod-list" role="radiogroup" aria-label="Код ответа">' + [1, 2, 3, 4].map(function (k) {
            var on = (mz.kody || []).indexOf(k) > -1;
            return '<label class="choice ap-kod"' + (on ? '' : ' title="' + esc(kodOtkaz(d, k)) + '"') + '><input type="radio" name="ap-kod" value="' + k + '"' +
              (on ? '' : ' disabled') + '><span>' + R.kodOtveta(k) + '</span></label>';
          }).join('') + '</div>' +
          '<p class="ap-form__err" id="kod-err" hidden></p>' +
          '<button class="btn btn--primary btn--block" type="button" data-act="ap-kod-send">Отправить ответ</button>' +
          (cur.srok ? '<p class="ap-form__note">Срок ответа до ' + esc(R.data(cur.srok, { format: 'full' })) + '</p>' : '') +
        '</div>';
    }
    if (cur.kod === 1) {
      return '<p class="ap-doc__status is-ok">' + R.kodOtveta(1) + '<span>Рев. ' + esc(cur.rev) + ' согласована.</span></p>';
    }
    if (side === 'zavod' && (cur.kod === 2 || cur.kod === 3)) {
      var k = a.zadanie ? byId(zavodLyudi(), a.zadanie.konstruktorId) : null;
      if (!mz.reviziyu) {
        return '<p class="ap-doc__status"><span>Заказчик ответил:</span>' + R.kodOtveta(cur.kod) + '<span>Ответьте на каждое замечание, после этого конструктор выпустит рев. ' + esc(d.sledRev) + '.</span></p>';
      }
      return '<div class="ap-form"><p class="ap-doc__status">На все замечания ответ дан. Ход конструктора' + (k ? ' (' + esc(k.name) + ')' : '') + ':</p>' +
        '<button class="btn btn--primary btn--block" type="button" data-act="ap-reviziya">Выпустить рев. ' + esc(d.sledRev) + '</button></div>';
    }
    if (side === 'zakazchik' && cur.kod) {
      return '<p class="ap-doc__status"><span>Ответ отправлен:</span>' + R.kodOtveta(cur.kod) +
        (cur.kod === 2 || cur.kod === 3 ? '<span>Завод отвечает на замечания и готовит рев. ' + esc(d.sledRev) + '.</span>' : '') + '</p>';
    }
    if (side === 'zavod' && cur.naKom === 'zakazchik') {
      return '<p class="ap-doc__status">Ждём ответа заказчика' + (cur.srok ? ' до ' + esc(R.data(cur.srok)) : '') + '.</p>';
    }
    return cur.kod ? '<p class="ap-doc__status">Ответ: ' + R.kodOtveta(cur.kod) + '</p>' : '';
  }

  /* Почему код недоступен — по признаку документа: kody пуст — ревизия не ждёт
     ответа; kody без этого кода — к ревизии нет замечания (так DATA сужает список). */
  function kodOtkaz(d, kod) {
    var kody = (d && d.mozhno && d.mozhno.kody) || [];
    if (!kody.length) { return 'Ревизия уже не ждёт вашего ответа.'; }
    if (kody.indexOf(kod) < 0) { return 'Для кода ' + kod + ' добавьте хотя бы одно замечание к этой ревизии.'; }
    return 'Ответ не отправился.';
  }

  function oprosny(a) {
    var o = a.oprosnyList;
    if (!o) { return ''; }
    var rows = OPROS.filter(function (f) { return o[f[0]] !== undefined && o[f[0]] !== null && o[f[0]] !== ''; }).map(function (f) {
      var v = o[f[0]];
      if (v === true) { v = 'да'; } else if (v === false) { v = 'нет'; }
      if (f[0] === 'skhema' && v && typeof v === 'object') { v = v.name || 'приложена'; }
      return '<dt>' + esc(f[1]) + '</dt><dd>' + esc(v) + '</dd>';
    }).join('');
    var open = etapIdx(a.etap) <= etapIdx('dogovor');
    return '<details class="card ap-opros"' + (open ? ' open' : '') + '><summary class="card__head"><span class="ap-sec-title">Опросный лист заказчика</span>' +
      '<span class="small muted">' + esc(R.data(a.etapy[0].date, { format: 'doc' })) + '</span></summary>' +
      '<div class="card__body"><dl class="kv ap-opros__kv">' + rows + '</dl></div></details>';
  }

  function tabSoglasovanie(a) {
    return reestr(a) + docView(a) + oprosny(a);
  }

  /* --- «Производство и испытания»: ПМИ лентой ---------------------------------- */
  function pmiItem(a, p, i) {
    var zn = zakName(a);
    var status = '', acts = '';
    var blocked = !!p.zhdyotH;
    if (p.status === 'done') {
      status = '<span class="badge badge--ok">Пройдена</span>';
    } else if (p.mozhnoPodtverdit) {
      status = '<span class="badge badge--warn">Ждёт подтверждения заказчика</span>';
      if (side === 'zakazchik') {
        acts = '<button class="btn btn--primary btn--sm" type="button" data-act="ap-hold" data-id="' + esc(p.id) + '">Подтвердить, продолжайте</button>';
      }
    } else if (blocked) {
      status = '<span class="badge badge--neutral">Ждёт подтверждения</span>';
    } else if (p.status === 'current') {
      status = '<span class="badge badge--info">Идёт</span>';
    } else {
      status = '<span class="ap-pmi__plan">План</span>';
    }
    if (p.tip === 'W' && p.status !== 'done') {
      var ans = p.otvetZakazchika;
      var ansText = ans === 'priedu' ? (side === 'zavod' ? zn + ' приедет на инспекцию, ' : 'Приедем на инспекцию, ') + (p.priedut || 1) + ' чел.'
        : ans === 'bez-nas' ? (side === 'zavod' ? zn + ': проводите без нас' : 'Проводите без нас') : '';
      status += ' <span class="ap-pmi__when">' + esc(R.data(p.date, { format: 'rel' })) + '</span>';
      if (side === 'zakazchik') {
        if (!p.mozhnoOtvetit) {
          acts = ansText ? '<span class="ap-pmi__ans' + (ans === 'priedu' ? ' is-priedu' : '') + '">' + esc(ansText) + '</span>' : '';
        } else if (!ans || S.wEdit === p.id) {
          acts = '<button class="btn btn--primary btn--sm" type="button" data-act="ap-priedu" data-id="' + esc(p.id) + '">Приеду на инспекцию</button>' +
            '<button class="btn btn--secondary btn--sm" type="button" data-act="ap-beznas" data-id="' + esc(p.id) + '">Проводите без нас</button>';
        } else {
          acts = '<span class="ap-pmi__ans' + (ans === 'priedu' ? ' is-priedu' : '') + '">' + esc(ansText) + '</span>' +
            '<button class="link-btn small" type="button" data-act="ap-w-change" data-id="' + esc(p.id) + '">Изменить ответ</button>';
        }
      } else {
        acts = '<span class="ap-pmi__ans' + (ans === 'priedu' ? ' is-priedu' : '') + '">' + esc(ansText || 'Заказчик ещё не ответил на приглашение') + '</span>';
        if (p.mozhnoIspytat) {
          acts += '<button class="btn btn--primary btn--sm" type="button" data-act="ap-ispytanie" data-id="' + esc(p.id) + '">Испытание проведено</button>';
        }
      }
    }
    if (p.mozhnoPodtverdit && side === 'zavod') {
      acts = '<span class="ap-pmi__ans">Ждём подтверждения от ' + esc(zn) + '</span>';
    }
    var prot = (p.dokumenty || []).map(function (d) {
      return '<button class="link-btn ap-pmi__prot" type="button" data-act="ap-prevyu" data-id="' + esc(d.id) + '">' + esc(d.title) + '</button>';
    }).join('');
    var t = TIP_PMI[p.tip] || { title: '', text: '' };
    return '<li class="ap-pmi__item is-' + esc(p.status) + (blocked ? ' is-blocked' : '') + '" data-pmi="' + esc(p.id) + '" data-tip="' + esc(p.tip) + '">' +
      '<span class="ap-pmi__n">' + (i + 1) + '</span>' +
      '<span class="ap-pmi__tip ap-pmi__tip--' + esc(p.tip) + '" title="' + esc(t.title) + '">' + esc(p.tip) + '</span>' +
      '<div class="ap-pmi__main"><p class="ap-pmi__title">' + esc(p.title) + '</p>' +
        '<p class="ap-pmi__meta">' + esc(t.title + ': ' + t.text) + '</p>' +
        '<p class="ap-pmi__status">' + status + '</p></div>' +
      '<div class="ap-pmi__date">' + esc(R.data(p.date, { format: 'doc' })) + '</div>' +
      '<div class="ap-pmi__docs">' + (prot || '<span class="muted small">—</span>') + '</div>' +
      '<div class="ap-pmi__acts">' + acts + '</div></li>';
  }
  function tabProizvodstvo(a) {
    var gidro = null;
    a.pmi.forEach(function (p) { if (!gidro && p.tip === 'W') { gidro = p; } });
    var isp = null, otgr = null;
    a.etapy.forEach(function (e) { if (e.id === 'ispytaniya') { isp = e; } if (e.id === 'otgruzhen') { otgr = e; } });
    var gDate = gidro ? gidro.date : (isp ? isp.date : null);
    var gDone = gidro ? gidro.status === 'done' : (isp && isp.status === 'done');
    var stats = '<div class="ap-stats">' +
      '<div class="ap-stat"><p class="label">Текущий этап</p><p class="ap-stat__v">' + esc(a.postavlen ? 'Отгружен' : etapTitle(a)) + '</p>' +
        '<p class="ap-stat__n">' + esc(a.postavlen ? R.data(otgr.date, { format: 'full' }) : R.dney(a.dneyNaEtape || 0) + ' на этапе') + '</p></div>' +
      '<div class="ap-stat"><p class="label">Гидроиспытания</p><p class="ap-stat__v">' + esc(gDate ? R.data(gDate) : '—') + '</p>' +
        '<p class="ap-stat__n">' + esc(gDate ? (gDone ? 'проведены' : R.data(gDate, { format: 'rel' })) : '') + '</p></div>' +
      '<div class="ap-stat"><p class="label">Отгрузка</p><p class="ap-stat__v">' + esc(otgr ? R.data(otgr.date) : '—') + '</p>' +
        '<p class="ap-stat__n">' + esc(otgr ? (otgr.status === 'plan' ? 'плановая дата' : a.postavlen ? 'отгружен' : 'плановая дата') : '') + '</p></div>' +
      '</div>';
    if (!a.pmi.length) {
      var txt = a.postavlen
        ? 'Аппарат изготовлен и отгружен. Протоколы испытаний находятся во вкладке «Документы».'
        : 'Программа и методика испытаний появится после согласования чертежа. В ней будут точки контроля типов H, W и R.';
      return stats + '<section class="card">' + R.pusto({ text: txt, action: a.postavlen ? { label: 'Открыть документы', act: 'ap-tab-docs' } : null }) + '</section>';
    }
    return stats +
      '<section class="card ap-pmi-card" aria-label="Программа и методика испытаний">' +
        '<div class="card__head"><h2 class="ap-sec-title">Точки контроля по ПМИ</h2>' +
          '<p class="ap-legend">' + ['H', 'W', 'R'].map(function (k) {
            return '<span><span class="ap-pmi__tip ap-pmi__tip--' + k + '">' + k + '</span>' + esc(TIP_PMI[k].title.toLowerCase()) + '</span>';
          }).join('') + '</p></div>' +
        '<div class="ap-pmi__cols" aria-hidden="true"><span></span><span></span><span>Точка</span><span>Дата</span><span>Протоколы</span><span>Действие</span></div>' +
        '<ol class="ap-pmi">' + a.pmi.map(function (p, i) { return pmiItem(a, p, i); }).join('') + '</ol>' +
        '<p class="ap-pmi__foot small muted">Типы точек и сроки в демо-данных условные.</p>' +
      '</section>';
  }

  /* --- «История» ------------------------------------------------------------------ */
  function tabIstoriya(a) {
    var list = a.istoriya.slice().reverse();
    if (!list.length) { return '<section class="card">' + R.pusto({ text: 'Событий пока нет' }) + '</section>'; }
    return '<section class="card ap-ist" aria-label="История"><div class="card__head"><h2 class="ap-sec-title">Лента событий</h2>' +
      '<span class="small muted">' + list.length + ' ' + R.plural(list.length, 'событие', 'события', 'событий') + ', новые сверху</span></div>' +
      '<ol class="events ap-ist__list">' + list.map(function (h) {
        var k = h.kto || {};
        return '<li class="events__item ap-ist__item" data-side="' + esc(k.side || '') + '">' +
          '<span class="events__date">' + esc(docData(h.date)) + '</span>' +
          '<div><p class="ap-ist__what">' + esc(h.chto) + '</p>' +
          '<p class="events__who"><span class="ap-ist__name">' + esc(k.name || '') + '</span>' +
            esc([k.position, k.predpriyatie].filter(Boolean).map(function (x) { return ' · ' + x; }).join('')) + '</p></div></li>';
      }).join('') + '</ol></section>';
  }

  /* --- «Документы» ---------------------------------------------------------------- */
  function tabDokumenty(a) {
    var docs = a.dokumenty.filter(function (d) { return lastRev(d); });
    var postavlen = a.postavlen;
    var top = postavlen
      ? '<section class="blok-siniy ap-post"><div><p class="label">Аппарат поставлен</p>' +
          '<h2 class="h2">Паспорт и сервис</h2><p>Паспорт, гарантия, освидетельствования, запрос ЗИП и заявка на ремонт собраны на одной странице.</p></div>' +
          '<a class="btn btn--on-blue btn--lg" href="pasport.html?id=' + esc(a.id) + '" data-link="pasport">Паспорт и сервис</a></section>'
      : '';
    var table = R.table({
      cols: [
        { key: 'title', title: 'Документ', render: function (d) {
          return '<button class="link-btn ap-doc-link" type="button" data-act="ap-prevyu" data-id="' + esc(d.id) + '">' + esc(d.title) + '</button>';
        } },
        { key: 'vid', title: 'Вид', nowrap: true, render: function (d) { return '<span class="muted">' + esc(d.vid === 'protokol' ? 'Протокол, акт' : (spr().vidy || {})[d.vid] || '') + '</span>'; } },
        { key: 'rev', title: 'Рев.', nowrap: true, render: function (d) { return '<span class="mono">' + esc(lastRev(d).rev) + '</span>'; } },
        { key: 'date', title: 'Дата', nowrap: true, render: function (d) { return esc(R.data(lastRev(d).date, { format: 'doc' })); } },
        { key: 'kod', title: 'Статус', nowrap: true, render: function (d) {
          var r = lastRev(d);
          if (r.kod) { return R.kodOtveta(r.kod); }
          return r.naKom === 'zakazchik' ? R.kodOtveta(null) : '<span class="badge badge--neutral badge--plain">Выпущен</span>';
        } },
        { key: 'dl', title: '', align: 'right', render: function () {
          return '<button class="btn btn--ghost btn--sm" type="button" data-soon="Скачать документ">Скачать</button>';
        } }
      ],
      rows: docs,
      empty: 'Документов пока нет'
    });
    var komplekt = postavlen ? '' : '<section class="card ap-komplekt"><div class="card__head"><h2 class="ap-sec-title">Комплект к поставке</h2>' +
      '<span class="small muted">выпускается к отгрузке</span></div><div class="card__body"><ul class="ap-komplekt__list">' +
      ['Паспорт сосуда', 'Руководство по эксплуатации', 'Протоколы испытаний', 'Сертификаты на материалы'].map(function (x, i) {
        var est = i === 2 ? a.dokumenty.some(function (d) { return d.vid === 'protokol' && lastRev(d); }) : false;
        return '<li><span>' + esc(x) + '</span>' + (est ? '<span class="badge badge--ok">частично выпущены</span>' : '<span class="badge badge--neutral badge--plain">к отгрузке</span>') + '</li>';
      }).join('') + '</ul></div></section>';
    return top + '<section class="card" aria-label="Документы"><div class="card__head"><h2 class="ap-sec-title">Выпущено на аппарат</h2>' +
      '<span class="small muted">' + docs.length + ' ' + R.plural(docs.length, 'документ', 'документа', 'документов') + '</span></div>' + table + '</section>' +
      komplekt;
  }

  /* --- отрисовка ------------------------------------------------------------------ */
  function unmountModel() {
    if (S.model) { try { S.model.destroy(); } catch (e) { /* уже разобрана */ } S.model = null; }
  }
  function mountModel() {
    var el = document.getElementById('ap-model');
    if (!el || !w.Model3D) { return; }
    S.model = w.Model3D.mount(el, { rev: el.getAttribute('data-rev'), highlight: null, onPick: onPick,
      vid: (DATA.apparat(ID) || {}).vidModeli });
  }
  function onPick(poz) {
    var t = POZ[poz] || '';
    var inp = document.getElementById('zm-poz');
    if (inp) { inp.value = t; }
    var note = document.getElementById('ap-pick');
    if (note) { note.textContent = t ? 'Выбрано: ' + t + (inp ? ', подставлено в новое замечание' : '') : ''; }
    if (S.model) { S.model.highlight(poz); }
  }

  function render() {
    unmountModel();
    var a = ID ? DATA.apparat(ID) : null;
    if (!a) {
      page.innerHTML = '<div class="page-head"><h1 class="h1">Аппарат не найден</h1></div>' +
        '<section class="card">' + R.pusto({ text: 'Аппарата с таким номером нет или он не относится к вашему предприятию.',
          action: { label: side === 'zavod' ? 'К воронке' : 'К моим аппаратам', href: w.Shell.home(side) } }) + '</section>';
      return;
    }
    defaults(a);
    document.title = a.nazvanie + (a.techPoz ? ', поз. ' + a.techPoz : '') + (side === 'zavod' ? ' — Работа с заказчиками' : ' — Сервис заказчика БМЗ');
    var body = S.tab === 'proizvodstvo' ? tabProizvodstvo(a)
      : S.tab === 'istoriya' ? tabIstoriya(a)
      : S.tab === 'dokumenty' ? tabDokumenty(a)
      : tabSoglasovanie(a);
    page.setAttribute('data-apparat', a.id);
    page.setAttribute('data-tab', S.tab);
    page.innerHTML = head(a) + zavodBlock(a) + tabs(a) +
      '<div class="ap-body" role="tabpanel" data-tab="' + esc(S.tab) + '">' + body + '</div>';
    mountModel();
  }
  function after() { render(); w.Shell.refresh(); }
  function fail(text) { R.modal({ title: 'Не получилось', text: text }); }

  /* --- действия ---------------------------------------------------------------- */
  var Sh = w.Shell;
  Sh.on('ap-tab', function (t) { S.tab = t.getAttribute('data-tab'); writeHash(); render(); });
  Sh.on('ap-tab-docs', function () { S.tab = 'dokumenty'; writeHash(); render(); });
  Sh.on('ap-doc-close', function () { S.docId = '-'; S.rev = null; writeHash(); render(); });
  Sh.on('ap-rev', function (t) { S.rev = t.getAttribute('data-rev'); render(); });
  Sh.on('ap-vid', function (t) { S.vid = t.getAttribute('data-vid') === 'chertezh' ? 'chertezh' : '3d'; writeHash(); render(); });
  /* Протокол, акт, паспорт — первая страница в окне. */
  Sh.on('ap-prevyu', function (t) {
    var a = DATA.apparat(ID), d = a ? byId(a.dokumenty, t.getAttribute('data-id')) : null;
    if (!d || !lastRev(d)) { fail('Документ ещё не выпущен.'); return; }
    R.modal({
      title: d.title, wide: true, body: prevyu(a, d, lastRev(d).rev, false),
      foot: '<button class="btn btn--secondary" type="button" data-soon="Скачивание документа">Скачать</button>' +
        '<button class="btn btn--primary" type="button" data-close>Закрыть</button>'
    });
  });
  Sh.on('ap-hl', function (t) {
    var poz = t.getAttribute('data-poz');
    /* «Показать на модели» с листа чертежа — сначала вернуть модель. */
    if (S.vid === 'chertezh') { S.vid = '3d'; writeHash(); render(); }
    if (S.model) { S.model.highlight(poz); }
    var note = document.getElementById('ap-pick');
    if (note) { note.textContent = 'На модели: ' + (POZ[poz] || ''); }
  });

  Sh.on('ap-zm-add', function () {
    var text = document.getElementById('zm-text'), poz = document.getElementById('zm-poz'), err = document.getElementById('zm-err');
    var v = text ? text.value.trim() : '';
    if (!v) {
      if (text) { text.classList.add('input--error'); text.focus(); }
      if (err) { err.textContent = 'Напишите, что поправить.'; err.hidden = false; }
      return;
    }
    var id = ACT.dobavitZamechanie(ID, { dokumentId: S.docId, poziciya: poz && poz.value.trim() ? poz.value.trim() : null, text: v });
    if (!id) { fail('Замечание не сохранилось. Проверьте, что документ выпущен.'); return; }
    after();
  });
  Sh.on('ap-kod-send', function () {
    var r = document.querySelector('input[name="ap-kod"]:checked'), err = document.getElementById('kod-err');
    function show(t) { if (err) { err.textContent = t; err.hidden = false; } }
    if (!r) { show('Выберите код ответа.'); return; }
    var kod = +r.value;
    /* Правило кода живёт в ACT: отказ показываем здесь же, под кнопкой. */
    if (!ACT.otvetitNaDokument(ID, S.docId, kod)) {
      var a = DATA.apparat(ID);
      show(kodOtkaz(a ? byId(a.dokumenty, S.docId) : null, kod));
      return;
    }
    after();
  });
  Sh.on('ap-otvet', function (t) {
    var id = t.getAttribute('data-id'), prin = t.getAttribute('data-prinyato') === '1';
    var f = document.getElementById('otv-' + id);
    var v = f ? f.value.trim() : '';
    if (!v && !prin) { if (f) { f.classList.add('input--error'); f.placeholder = 'Причина отказа, её увидит заказчик'; f.focus(); } return; }
    if (!v) {
      var a = DATA.apparat(ID), z = byId(a.zamechaniya, id), d = z ? byId(a.dokumenty, z.dokumentId) : null;
      v = 'будет в рев. ' + (d ? d.sledRev : '');
    }
    if (!ACT.otvetitNaZamechanie(ID, id, { text: v, prinyato: prin })) { fail('Ответ не сохранился.'); return; }
    after();
  });
  Sh.on('ap-reviziya', function () {
    var a = DATA.apparat(ID), d = byId(a.dokumenty, S.docId);
    if (!d || !ACT.vypustitReviziyu(ID, d.vid)) { fail('Ревизия не выпущена.'); return; }
    S.rev = null;
    after();
  });

  Sh.on('ap-hold', function (t) {
    if (!ACT.podtverditHold(ID, t.getAttribute('data-id'))) { fail('Подтверждение не прошло.'); return; }
    after();
  });
  Sh.on('ap-beznas', function (t) {
    if (!ACT.otvetNaPriglashenie(ID, t.getAttribute('data-id'), { otvet: 'bez-nas' })) { fail('Ответ не отправился.'); return; }
    S.wEdit = null; after();
  });
  Sh.on('ap-w-change', function (t) { S.wEdit = t.getAttribute('data-id'); render(); });
  var priezd = null;
  Sh.on('ap-priedu', function (t) {
    var a = DATA.apparat(ID), p = byId(a.pmi, t.getAttribute('data-id'));
    if (!p) { return; }
    priezd = R.modal({
      title: 'Приеду на инспекцию',
      text: 'Точка «' + p.title + '», ' + R.data(p.date, { format: 'full' }) + ', ' + R.data(p.date, { format: 'rel' }) + '. Дата подтверждена заводом.',
      body: '<div class="stack--tight">' +
        '<label class="field"><span class="field__label label">Сколько человек</span>' +
          '<input class="input ap-num" id="pr-n" type="number" min="1" max="10" value="1" data-pmi="' + esc(p.id) + '"></label>' +
        '<label class="field"><span class="field__label label">ФИО и должности, по желанию</span>' +
          '<textarea class="textarea" id="pr-fio" rows="2"></textarea>' +
          '<span class="field__hint">Для пропуска на завод. Можно сообщить позже.</span></label></div>',
      foot: '<button class="btn btn--primary" type="button" data-act="ap-priedu-do">Подтвердить приезд</button>' +
        '<button class="btn btn--secondary" type="button" data-close>Отмена</button>',
      onClose: function () { priezd = null; }
    });
  });
  Sh.on('ap-priedu-do', function () {
    var n = document.getElementById('pr-n'), fio = document.getElementById('pr-fio');
    var k = Math.max(1, Math.min(10, parseInt(n && n.value, 10) || 1));
    var pmiId = n ? n.getAttribute('data-pmi') : null;
    if (!ACT.otvetNaPriglashenie(ID, pmiId, { otvet: 'priedu', priedut: k, fio: fio && fio.value.trim() ? fio.value.trim() : null })) { fail('Ответ не отправился.'); return; }
    if (priezd) { priezd.close(); }
    S.wEdit = null; after();
  });
  Sh.on('ap-ispytanie', function (t) {
    if (!ACT.provestiIspytanie(ID, t.getAttribute('data-id'))) { fail('Испытание можно отметить только после подтверждения всех точек остановки.'); return; }
    after();
  });

  Sh.on('ap-tkp', function () {
    if (!ACT.napravitTkp(ID)) { fail('ТКП не отмечено.'); return; }
    after();
  });
  var nkModal = null;
  Sh.on('ap-nk', function () {
    var ggk = zavodLyudi().filter(function (p) { return p.otdel === 'ggk'; });
    var otdel = '';
    ((spr().zavod || {}).otdely || []).forEach(function (o) { if (o.id === 'ggk') { otdel = o.title; } });
    var nz = (DATA.apparat(ID) || {}).mozhno || {};
    var iso = nz.naznachit ? nz.naznachit.srok : '';
    nkModal = R.modal({
      title: 'Назначить конструктору',
      text: otdel ? otdel + '.' : '',
      body: '<div class="stack--tight">' +
        '<label class="field"><span class="field__label label">Конструктор</span><select class="select" id="nk-kto">' +
          ggk.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name + ', ' + p.position) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="field__label label">Срок</span><input class="input" id="nk-srok" type="date" value="' + iso + '"></label>' +
        '<label class="field"><span class="field__label label">Комментарий</span><textarea class="textarea" id="nk-komm" rows="3">Сборочный чертёж и 3D-модель по опросному листу</textarea></label></div>',
      foot: '<button class="btn btn--primary" type="button" data-act="ap-nk-do">Назначить</button>' +
        '<button class="btn btn--secondary" type="button" data-close>Отмена</button>',
      onClose: function () { nkModal = null; }
    });
  });
  Sh.on('ap-nk-do', function () {
    var kto = document.getElementById('nk-kto'), srok = document.getElementById('nk-srok'), komm = document.getElementById('nk-komm');
    var ok = ACT.naznachitKonstruktora(ID, { konstruktorId: kto ? kto.value : null, srok: srok && srok.value ? srok.value : null, komment: komm ? komm.value.trim() : '' });
    if (!ok) { fail('Задание не назначено.'); return; }
    if (nkModal) { nkModal.close(); }
    after();
  });

  /* Документ открывается адресом #doc=<id> (строка реестра — Render.table, rowHref). */
  w.addEventListener('hashchange', function () {
    if (!readHash()) { return; }
    render();
    var v = S.docId && document.getElementById('ap-doc');
    if (v && v.scrollIntoView) { try { v.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { v.scrollIntoView(); } }
  });
  w.addEventListener('pagehide', unmountModel);

  readHash();
  render();
})(window);

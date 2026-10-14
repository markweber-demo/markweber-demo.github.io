/* Карточка продукта — produkt.html?id=<продукт>[#maket|#dokumenty|#istoriya]. Владелец — таск 04.

   Сценарий А: путь продукта от запроса до одобренного образца. Менеджер отправляет
   расчёт, отмечает «Рецептура подобрана» и «Образцы отправлены» (в истории эти шаги
   подписаны «Лаборатория»). Заказчик начинает испытания, прикладывает протокол и
   решает «Подходит» или «Не подходит» (без причины не принимается). Одобренный
   продукт заказчик оформляет в заказ: объём, желаемая дата, вагон или самовывоз.

   Что кому доступно, решают признаки mozhno из DATA.produkt — страница своих условий
   не пишет. Директор смотрит без кнопок. Чужой продукт у заказчика — «Нет доступа».

   Разделы: #etapy (лента, на ком шаг, ходы), #maket (его строит assets/maket.js, если
   подключён, — страница только держит место и зовёт Maket.mount(узел, id)), #parametry,
   #dokumenty, #zakazy, #istoriya. Документы открывает Prevyu (#doc=<id>).
   Черновик полей ходов — Store, ключ 'produkt:<id>'. Читает DATA, пишет ACT. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, ACT = w.ACT, Shell = w.Shell, Store = w.Store;

  if (!Shell.mount({ active: 'produkty' })) { return; }

  var page = document.getElementById('page');
  var id = R.param('id');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var KEY = 'produkt:' + id;      /* черновик полей ходов этого продукта */
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var oshibki = {};               /* ошибки полей по имени */
  var vidno = 0;                  /* сколько записей журнала отражено на экране */

  function trim(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  /* Кусок из ввода посреди фразы: пробелы схлопнуты, без знака в конце — иначе «компанией., отправлены». */
  function maloy(s) { s = trim(s).replace(/\s+/g, ' ').replace(/\s*[.,;:]+$/, ''); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function chistoe(v) { return trim(v).replace(/\s/g, '').replace(',', '.'); }
  function chislo(v) { var s = chistoe(v); return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null; }
  function tonn(n) { return String(n).replace('.', ',') + ' т'; }
  /* Правила полей форм и тексты ошибок — в слое данных (formy). imena — поле правила → поле
     формы там, где имена разные (у двух форм панели общий черновик: sposobObraztsov, sposobPolucheniya). */
  var FORMY = DATA.spravochnik().formy;
  function proverit(pravila, d, imena) {
    var zn = {}, e = {}, o;
    imena = imena || {};
    Object.keys(pravila).forEach(function (k) { zn[k] = d[imena[k] || k]; });
    o = Shell.proverit(pravila, zn);
    Object.keys(o).forEach(function (k) { e[imena[k] || k] = o[k]; });
    return e;
  }
  /* Куда ведёт крошка: список продуктов роли, у директора — его «Сводка». */
  function spisok() {
    var nav = Shell.nav();
    for (var i = 0; i < nav.length; i++) { if (nav[i].id === 'produkty') { return nav[i]; } }
    return nav[0] || { title: 'Продукты и образцы', href: 'produkty.html' };
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }
  function blok(idBloka, title, body, cls) {
    return '<section class="card pd-blok' + (cls ? ' ' + cls : '') + '" id="' + idBloka + '" aria-labelledby="' + idBloka + '-h">' +
      '<h2 class="h2 pd-blok__h" id="' + idBloka + '-h">' + esc(title) + '</h2>' + body + '</section>';
  }

  /* --- черновик полей ходов ------------------------------------------------------- */
  /* Оформленная заявка помечает черновик: следующая заявка получит новый draftId, а повтор
     той же отправки (двойной щелчок) — прежний, и заказ не задвоится. */
  function chernovik() {
    var d = Store.draft(KEY);
    if (d.oformlen) { Store.setDraft(KEY, null); d = Store.draft(KEY); }
    return d;
  }
  function sobrat() {
    var d = Store.draft(KEY);
    Array.prototype.forEach.call(page.querySelectorAll('.pd-panel [name]'), function (el) {
      if (el.type === 'file') { return; }
      if (el.type === 'radio') { if (el.checked) { d[el.name] = el.value; } return; }
      d[el.name] = el.value;
    });
    return Store.setDraft(KEY, d);
  }
  function zabyt(polya) {
    var d = Store.draft(KEY);
    polya.forEach(function (k) { delete d[k]; });
    Store.setDraft(KEY, d);
  }

  /* --- шапка ------------------------------------------------------------------------- */
  function shapka(p) {
    var s = spisok(), odobren = p.etap === 'odobren';
    var side = '<span class="badge ' + (odobren ? 'badge--done' : 'badge--work') + '">' + esc(odobren ? 'Одобрен' : 'Этап «' + p.etapTitle + '»') + '</span>';
    if (p.maket && odobren) {
      var mk = p.maket.soglasovano ? 'Макет согласован' : (p.maket.versii.length ? 'Макет на согласовании' : 'Макет не загружен');
      side += '<span class="badge ' + (p.maket.soglasovano ? 'badge--done' : 'badge--work') + '">' + mk + '</span>';
    }
    return R.shapka({
      crumbs: [{ title: s.title, href: s.href }, { title: p.nazvanie }],
      label: [p.tipTitle, zavod && p.zakazchik ? p.zakazchik.name : ''].filter(Boolean).join(' · '),
      title: p.nazvanie,
      lead: 'Запрос от ' + esc(R.data(p.data)),
      side: side
    });
  }

  /* --- лента, на ком шаг, ходы ------------------------------------------------------ */
  /* У текущего этапа дата в данных — когда он начался; лента печатает у текущего «до …»,
     поэтому текущему даём пустую дату: срок виден в плашке «на ком шаг». */
  function etapyKarty(p) {
    return { etapy: p.etapy.map(function (e) {
      return e.status === 'current' ? { id: e.id, title: e.title, status: e.status, date: null, vid: e.vid } : e;
    }) };
  }
  /* submit — кнопка отправки панели: Enter в поле нажимает её. */
  function knopka(act, text, cls, submit) {
    return '<button class="btn ' + (cls || 'btn--primary') + '" type="' + (submit ? 'submit' : 'button') + '" data-act="' + act + '">' + esc(text) + '</button>';
  }
  function hody(p) {
    var m = p.mozhno || {}, b = '';
    if (m.raschet) { b += knopka('pd-raschet', 'Отправить расчёт'); }
    if (m.retseptura) { b += knopka('pd-retseptura', 'Рецептура подобрана'); }
    if (m.ispytaniya) { b += knopka('pd-ispytaniya', 'Начать испытания'); }
    if (p.etap === 'odobren' && p.maket && p.maket.naKom) { b += '<a class="btn btn--primary" href="#maket">К макету печати</a>'; }
    return b;
  }
  function podskazka(p) {
    var m = p.mozhno || {};
    if (m.raschet) { return 'Нажмите «Отправить расчёт», и заказчик получит документ «Расчёт» с параметрами запроса.'; }
    if (m.retseptura) { return 'Нажмите «Рецептура подобрана». В истории шаг будет подписан «Лаборатория».'; }
    if (m.ispytaniya) { return 'Когда образцы будут у вас, нажмите «Начать испытания».'; }
    /* Образцы, протокол и решение: что делать, говорит форма под строкой шага, здесь не повторяем. */
    return '';
  }
  function gotovo(p) {
    if (p.etap !== 'odobren') { return ''; }
    var t = 'Продукт одобрен ' + R.data(p.etapy[p.etapy.length - 1].date) + '.';
    if (p.maket && p.maket.soglasovano) {
      t += ' Макет печати, версия ' + p.maket.soglasovano.versiya + ', согласован ' + R.data(p.maket.soglasovano.data) + '.';
    }
    return t + (p.mozhno && p.mozhno.zakaz ? ' Можно оформить заявку.' : '');
  }

  /* --- поля и панели ходов -------------------------------------------------------------- */
  function val(d, k) { return d[k] === undefined || d[k] === null ? '' : d[k]; }
  function err(name) {
    return '<span class="field__err" data-err="' + name + '" aria-live="polite"' + (oshibki[name] ? '' : ' hidden') + '>' + esc(oshibki[name] || '') + '</span>';
  }
  function inp(d, name, type, extra) {
    return '<input class="input' + (oshibki[name] ? ' input--error' : '') + '" type="' + (type || 'text') + '" name="' + name + '" value="' + esc(val(d, name)) + '"' +
      (oshibki[name] ? ' aria-invalid="true"' : '') + ' autocomplete="off"' + (extra || '') + '>';
  }
  function pole(name, label, input, hint, cls) {
    return '<label class="field pd-pole' + (cls ? ' ' + cls : '') + '"><span class="field__label">' + esc(label) + '</span>' + input +
      (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') + err(name) + '</label>';
  }
  function obshchaya() {
    return oshibki.obshchaya ? '<p class="field__err pd-panel__oshibka" role="alert">' + esc(oshibki.obshchaya) + '</p>' : '';
  }

  function panelObraztsy(d) {
    return '<form class="pd-panel" id="pd-obraztsy" novalidate>' +
      '<p class="h3 pd-panel__title">Отправка образцов</p>' +
      '<p class="pd-panel__lead">Укажите количество образцов и способ отправки, затем нажмите «Образцы отправлены». В истории шаг будет подписан «Лаборатория».</p>' +
      '<div class="pd-panel__polya">' +
        pole('kolvo', 'Количество образцов, шт.', inp(d, 'kolvo', 'text', ' inputmode="numeric"')) +
        pole('sposobObraztsov', 'Способ отправки', inp(d, 'sposobObraztsov'), 'Например, транспортной компанией.') +
      '</div>' + obshchaya() +
      '<div class="pd-panel__knopki">' + knopka('pd-obraztsy', 'Образцы отправлены', '', true) +
        knopka('pd-obraztsy-demo', 'Заполнить демо-данными', 'btn--secondary') + '</div></form>';
  }
  function panelProtokol(d) {
    return '<form class="pd-panel" id="pd-protokol" novalidate>' +
      '<p class="h3 pd-panel__title">Протокол испытаний</p>' +
      '<p class="pd-panel__lead">Проведите испытания образцов на своей линии и приложите протокол своим файлом или демо-протоколом.</p>' +
      '<div class="pd-fayl"><label class="btn btn--secondary pd-fayl__vybor">Выбрать файл<input type="file" name="fayl"></label>' +
        '<span class="pd-fayl__imya" data-fayl-imya>' + esc(d.fayl || 'Файл не выбран') + '</span></div>' +
      err('fayl') + obshchaya() +
      '<div class="pd-panel__knopki">' + knopka('pd-protokol', 'Приложить протокол', '', true) +
        knopka('pd-protokol-demo', 'Приложить демо-протокол', 'btn--secondary') + '</div></form>';
  }
  function panelReshenie(p, d) {
    var dok = null;
    (p.dokumenty || []).forEach(function (x) { if (x.id === p.protokolId) { dok = x; } });
    return '<form class="pd-panel" id="pd-reshenie" novalidate>' +
      '<p class="h3 pd-panel__title">Решение по образцу</p>' +
      '<p class="pd-panel__lead">' + (dok ? 'Протокол приложен: <a href="#doc=' + esc(encodeURIComponent(dok.id)) + '">' + esc(dok.title) + '</a>. ' : '') +
        'Если образец не подходит, укажите причину.</p>' +
      '<label class="field pd-pole"><span class="field__label">Причина, если образец не подходит</span>' +
        '<textarea class="textarea' + (oshibki.prichina ? ' input--error' : '') + '" name="prichina" rows="3"' + (oshibki.prichina ? ' aria-invalid="true"' : '') + '>' +
        esc(val(d, 'prichina')) + '</textarea>' + err('prichina') + '</label>' + obshchaya() +
      '<div class="pd-panel__knopki">' + knopka('pd-podhodit', 'Подходит') + knopka('pd-ne-podhodit', 'Не подходит', 'btn--danger') + '</div></form>';
  }
  function panelZayavka(p, d) {
    var sp = DATA.spravochnik().sposoby || {};
    var vybory = Object.keys(sp).map(function (k) {
      return '<label class="pd-vybor"><input type="radio" name="sposobPolucheniya" value="' + esc(k) + '"' + (d.sposobPolucheniya === k ? ' checked' : '') + '><span>' + esc(sp[k]) + '</span></label>';
    }).join('');
    return '<form class="pd-panel" id="pd-zayavka" novalidate>' +
      '<p class="h3 pd-panel__title">Оформить заявку</p>' +
      '<p class="pd-panel__lead">' + (p.maket ? 'Образец одобрен, макет печати согласован. ' : 'Образец одобрен. ') + 'Укажите объём, желаемую дату и способ получения.</p>' +
      '<div class="pd-panel__polya">' +
        pole('obem', 'Объём, т', inp(d, 'obem', 'text', ' inputmode="decimal"')) +
        pole('data', 'Желаемая дата', inp(d, 'data', 'date')) +
        '<fieldset class="field pd-pole pd-pole--vse"><legend class="field__label">Способ получения</legend><span class="pd-vybory">' + vybory + '</span>' + err('sposobPolucheniya') + '</fieldset>' +
      '</div>' + obshchaya() +
      '<div class="pd-panel__knopki">' + knopka('pd-zayavka', 'Оформить заявку', '', true) +
        knopka('pd-zayavka-demo', 'Заполнить демо-данными', 'btn--secondary') + '</div></form>';
  }
  function paneli(p) {
    var m = p.mozhno || {}, out = '';
    var protokol = m.protokol && !p.protokolId;
    if (m.obraztsy || protokol || m.reshenie || m.zakaz) {
      var d = chernovik();   /* черновик заводится, только когда на экране есть поля */
      if (m.obraztsy) { out += panelObraztsy(d); }
      if (protokol) { out += panelProtokol(d); }
      if (m.reshenie) { out += panelReshenie(p, d); }
      if (m.zakaz) { out += panelZayavka(p, d); }
    }
    return '<div id="pd-forma-slot">' + out + '</div>';
  }
  function lenta(p) {
    return '<section class="card pd-lenta" id="etapy" aria-labelledby="pd-lenta-h"><h2 class="h2 pd-blok__h" id="pd-lenta-h">Отработка продукта</h2>' +
      R.etapy(etapyKarty(p)) +
      R.shag(p, { knopki: hody(p), podskazka: podskazka(p), gotovo: gotovo(p) }) +
      paneli(p) + '</section>';
  }

  /* --- параметры, документы, заказы, история -------------------------------------------- */
  function parametry(p) {
    var rows = [];
    if (zavod && p.zakazchik) { rows.push(['Заказчик', esc(p.zakazchik.name)]); }
    (p.parametrySpisok || []).forEach(function (x) { rows.push([x.title, esc(x.znachenie)]); });
    if (p.obraztsy) { rows.push(['Образцы', esc(p.obraztsy.kolvo + ' шт., ' + maloy(p.obraztsy.sposob) + ', отправлены ' + R.data(p.obraztsy.data))]); }
    return blok('parametry', 'Параметры', kv(rows));
  }
  function dokumenty(p) {
    return blok('dokumenty', 'Документы', R.dokumenty(p.dokumenty, {
      empty: 'Документов пока нет. Здесь появятся расчёт, протокол испытаний и макеты печати.'
    }));
  }
  function zakazy(p) {
    var list = p.zakazy || [];
    if (!list.length) { return ''; }
    return blok('zakazy', 'Заказы по продукту', R.table({
      cols: [
        { key: 'nomer', title: 'Заказ', render: function (z) { return '<a href="zakaz.html?id=' + esc(encodeURIComponent(z.id)) + '">Заказ № ' + esc(z.nomer) + '</a>'; } },
        { key: 'obem', title: 'Объём', nowrap: true, render: function (z) { return esc(tonn(z.obem)); } },
        { key: 'etap', title: 'Этап', render: function (z) { return esc(z.etapTitle); } },
        { key: 'data', title: 'Дата заявки', nowrap: true, render: function (z) { return esc(R.data(z.data)); } }
      ],
      rows: list,
      rowHref: function (z) { return 'zakaz.html?id=' + encodeURIComponent(z.id); }
    }));
  }
  function istoriya(p) { return blok('istoriya', 'История', R.istoriya(p.istoriya)); }

  /* --- макет печати: место и вызов модуля -------------------------------------------------
     Раздел строит assets/maket.js. Страница зовёт Maket.mount, когда модуль есть и макет уже
     в работе (образец одобрен или версии загружены); иначе рисует короткий текст. */
  function maketGotov(p) { return !!p.maket && (p.etap === 'odobren' || (p.maket.versii || []).length > 0); }
  function maket(p) {
    var uzel = document.getElementById('maket');
    if (!uzel) { return; }
    if (maketGotov(p) && w.Maket && typeof w.Maket.mount === 'function') {
      w.Maket.mount(uzel, p.id);
      return;
    }
    uzel.innerHTML = '<div class="card pd-maket__zhdet"><h2 class="h2 pd-blok__h">Макет печати</h2><p class="muted">' +
      (maketGotov(p) ? 'Раздел макета печати временно недоступен.' : 'Макет печати согласуется после того, как образец будет одобрен.') + '</p></div>';
  }

  /* --- экран --------------------------------------------------------------------------------- */
  function zony(p) {
    document.getElementById('pd-verh').innerHTML = shapka(p) + lenta(p);
    document.getElementById('pd-niz').innerHTML =
      '<div class="grid grid--2 pd-ryad">' + parametry(p) + dokumenty(p) + '</div>' +
      (p.zakazy && p.zakazy.length ? '<div class="pd-ryad">' + zakazy(p) + '</div>' : '') +
      '<div class="pd-ryad">' + istoriya(p) + '</div>';
    vidno = Store.journal().length;
  }
  /* Раздел макета меняет данные сам (согласовал, ответил, загрузил версию): остальные блоки
     карточки — шаг, заявка, история — догоняют по записи в журнале. */
  function sledit() {
    var uzel = document.getElementById('maket');
    if (!uzel || !w.MutationObserver) { return; }
    new w.MutationObserver(function () {
      if (Store.journal().length === vidno) { return; }
      var p = DATA.produkt(id);
      if (p) { zony(p); }
    }).observe(uzel, { childList: true, subtree: true, characterData: true });
  }
  function risovat() {
    var s = spisok();
    if (!id) {
      document.title = 'Продукт — ' + NAZVANIE;
      page.innerHTML = R.shapka({ crumbs: [{ title: s.title, href: s.href }, { title: 'Продукт' }], title: 'Продукт' }) +
        R.pusto({ text: 'В карточке продукта собраны этапы отработки, параметры, документы и история. Выберите продукт в списке.',
          action: { label: s.title, href: 'produkty.html' } });
      return;
    }
    var p = DATA.produkt(id);
    if (!p) {
      document.title = 'Нет доступа — ' + NAZVANIE;
      page.innerHTML = zavod
        ? R.nedostupno({ title: 'Продукт не найден', text: 'Продукта с таким номером в кабинете нет.', href: s.href, label: s.title })
        : R.nedostupno({ text: 'Этот продукт относится к другому предприятию или его нет в кабинете. Ваши продукты собраны в разделе «Продукты и образцы».',
          href: 'produkty.html', label: 'Мои продукты и образцы' });
      return;
    }
    document.title = p.nazvanie + ' — ' + NAZVANIE;
    if (!document.getElementById('pd-verh')) {
      page.innerHTML = '<div id="pd-verh"></div>' +
        (p.maket ? '<section class="pd-maket" id="maket" aria-label="Макет печати"></section>' : '') + '<div id="pd-niz"></div>';
      sledit();
    }
    zony(p);
    maket(p);
  }
  function perersovatPaneli() {
    var p = DATA.produkt(id), slot = document.getElementById('pd-forma-slot');
    if (!p || !slot) { risovat(); return; }
    slot.outerHTML = paneli(p);
    var bad = document.querySelector('#pd-forma-slot [aria-invalid="true"]');
    if (bad) { try { bad.focus(); } catch (e) { /* фокус не обязателен */ } }
  }
  function snyatOshibku(name) {
    if (!oshibki[name]) { return; }
    delete oshibki[name];
    var e = page.querySelector('.pd-panel [data-err="' + name + '"]'), el = page.querySelector('.pd-panel [name="' + name + '"]');
    if (e) { e.textContent = ''; e.hidden = true; }
    if (el) { el.classList.remove('input--error'); el.removeAttribute('aria-invalid'); }
  }

  /* После хода: экран заново из DATA, панель ведущего — тоже. */
  function posle() { oshibki = {}; risovat(); Shell.refresh(); }
  function neVyshlo() {
    R.modal({ title: 'Действие не выполнено', text: 'Состояние продукта уже изменилось. Обновите страницу, чтобы увидеть текущий шаг.' });
  }
  function hod(rezultat) { if (rezultat) { posle(); } else { neVyshlo(); } }
  function oshibka(e) { oshibki = e; perersovatPaneli(); }

  /* --- ходы менеджера ----------------------------------------------------------------------- */
  Shell.on('pd-raschet', function () { hod(ACT.otpravitRaschet(id)); });
  Shell.on('pd-retseptura', function () { hod(ACT.retsepturaPodobrana(id)); });
  Shell.on('pd-obraztsy-demo', function () {
    var d = sobrat(), x = DATA.demo('obraztsy') || {};
    d.kolvo = x.kolvo === undefined ? '' : String(x.kolvo);
    d.sposobObraztsov = x.sposob || '';
    Store.setDraft(KEY, d);
    oshibki = {};
    perersovatPaneli();
  });
  Shell.on('pd-obraztsy', function () {
    var d = sobrat(), e = proverit(FORMY.obraztsy, { kolvo: chistoe(d.kolvo), sposobObraztsov: d.sposobObraztsov }, { sposob: 'sposobObraztsov' });
    if (Object.keys(e).length) { oshibka(e); return; }
    var ok = ACT.obraztsyOtpravleny(id, { kolvo: chislo(d.kolvo), sposob: trim(d.sposobObraztsov) });
    if (ok) { zabyt(['kolvo', 'sposobObraztsov']); }
    hod(ok);
  });

  /* --- ходы заказчика ------------------------------------------------------------------------- */
  Shell.on('pd-ispytaniya', function () { hod(ACT.nachatIspytaniya(id)); });
  Shell.on('pd-protokol-demo', function () {
    var x = DATA.demo('protokol') || {};
    var ok = ACT.prilozhitProtokol(id, { name: x.name });
    if (ok) { zabyt(['fayl']); }
    hod(ok);
  });
  Shell.on('pd-protokol', function () {
    var d = sobrat(), e = proverit(FORMY.protokol, d);
    if (Object.keys(e).length) { oshibka(e); return; }
    var ok = ACT.prilozhitProtokol(id, { name: trim(d.fayl) });
    if (ok) { zabyt(['fayl']); }
    hod(ok);
  });
  Shell.on('pd-podhodit', function () {
    sobrat();
    var ok = ACT.reshenieObrazets(id, true);
    if (ok) { zabyt(['prichina']); }
    hod(ok);
  });
  Shell.on('pd-ne-podhodit', function () {
    var d = sobrat(), e = proverit(FORMY.reshenie, d);
    if (Object.keys(e).length) { oshibka(e); return; }
    var ok = ACT.reshenieObrazets(id, false, d.prichina);
    if (ok) { zabyt(['prichina']); }
    hod(ok);
  });

  /* --- заявка из одобренного продукта ---------------------------------------------------------- */
  Shell.on('pd-zayavka-demo', function () {
    var d = sobrat(), x = DATA.demo('zakaz') || {};
    d.obem = x.obem === undefined ? '' : String(x.obem);
    d.data = x.data || '';
    d.sposobPolucheniya = x.sposob || '';
    Store.setDraft(KEY, d);
    oshibki = {};
    perersovatPaneli();
  });
  Shell.on('pd-zayavka', function () {
    var d = sobrat(), e = proverit(FORMY.zakaz, { obem: chistoe(d.obem), data: d.data, sposobPolucheniya: d.sposobPolucheniya }, { sposob: 'sposobPolucheniya' });
    if (Object.keys(e).length) { oshibka(e); return; }
    var zid = ACT.oformitZakaz(d.draftId, id, { obem: chislo(d.obem), data: d.data, sposob: d.sposobPolucheniya });
    if (!zid) { oshibka({ obshchaya: 'Заявку не удалось оформить. Проверьте объём и дату и попробуйте ещё раз.' }); return; }
    d.oformlen = zid;
    Store.setDraft(KEY, d);
    Shell.navigate('zakaz.html?id=' + encodeURIComponent(zid));
  });

  /* --- ввод: поля пишутся в черновик, ошибка снимается ---------------------------------------- */
  function vvod(e) {
    var el = e.target;
    if (!el || !el.name || !el.closest || !el.closest('.pd-panel')) { return; }
    if (el.type === 'file') {
      var d = Store.draft(KEY);
      d.fayl = el.files && el.files[0] ? el.files[0].name : '';
      Store.setDraft(KEY, d);
      snyatOshibku('fayl');
      var imya = page.querySelector('[data-fayl-imya]');
      if (imya) { imya.textContent = d.fayl || 'Файл не выбран'; }
      return;
    }
    if (e.type === 'input' && el.type === 'radio') { return; }
    sobrat();
    snyatOshibku(el.name);
  }
  page.addEventListener('input', vvod);
  page.addEventListener('change', vvod);
  /* Enter в поле нажимает кнопку отправки панели через data-act; сама форма никуда не отправляется. */
  page.addEventListener('submit', function (e) { e.preventDefault(); });

  risovat();
  w.Prevyu.mount();
})(window);

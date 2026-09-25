/* Паспорт и после поставки — pasport.html?id=. Таск 06, обе роли.

   Табличка с QR (Shildik), гарантия и ввод, календарь освидетельствований,
   паспорт по мотивам приложения Т ГОСТ 34347-2017 (печать раздела в PDF),
   ЗИП по заводскому номеру, заявка на ремонт с фото, рекламация, выгрузка
   в 1С:ТОИР (окно), обращения по аппарату.

   Читает только DATA, пишет только ACT. Своих правил нет: можно ли подать
   рекламацию — признак garantiya.status из DATA.poNomeru (правило в dannye.js),
   ACT.obrashchenie откажет сам. Чей ход — решает экран: формы у заказчика,
   «Взять в работу» у завода. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA, ACT = w.ACT;

  /* Гарантия, ближайшее освидетельствование, напоминание, статусы и виды
     обращений, «можно взять» — признаки из DATA (06a). Своих сроков здесь нет. */
  var param = R.param;
  function spr() { return DATA.spravochnik() || {}; }
  /* Подписи видов освидетельствования — из справочника DATA. */
  var OSVID = spr().vidyOsvid || {};
  /* Фраза заканчивается одной точкой, даже если текст заказчика уже с точкой. */
  function sTochkoy(t) { t = String(t || '').trim(); return /[.!?…]$/.test(t) ? t : t + '.'; }
  function vidTitle(vid) { var x = (spr().vidyObr || {})[vid]; return x ? x.title : vid; }
  function byId(list, id) {
    for (var i = 0; i < (list || []).length; i++) { if (list[i].id === id) { return list[i]; } }
    return null;
  }
  function mes(n) { return n + ' ' + R.plural(n, 'месяц', 'месяца', 'месяцев'); }
  function zakName(a) { var z = DATA.zakazchik(a.zakazchikId); return z ? z.name : ''; }
  function dl(rows, cls) {
    return '<dl class="pp-dl' + (cls ? ' ' + cls : '') + '">' + rows.map(function (r) {
      return '<div class="pp-dl__i"' + (r[2] ? ' data-pole="' + r[2] + '"' : '') + '><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('') + '</dl>';
  }
  function v(x) { return esc(x === null || x === undefined || x === '' ? '—' : x); }

  /* --- состояние экрана -------------------------------------------------------- */
  var ID = param('id');
  var role = w.Store.role();
  if (!w.Shell.mount({ active: role === 'zavod' ? 'servis' : 'apparaty' })) { return; }
  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var side = me.side;
  var S = { foto: null, fotoName: null };

  /* Признак из dannye.js: гарантия идёт — рекламация возможна. */
  function naGarantii(a) { return !!a.mozhno.reklamaciyu; }

  /* --- шапка ---------------------------------------------------------------------- */
  function crumbs(a) {
    var poz = '<a href="apparat.html?id=' + esc(a.id) + '#dokumenty">' + esc(a.techPoz ? 'поз. ' + a.techPoz : a.nazvanie) + '</a>';
    var tail = '<span>Паспорт и сервис</span>';
    if (side === 'zavod') {
      return '<nav class="crumbs" aria-label="Путь"><a href="crm.html#servis">Сервис</a>' +
        '<a href="zakazchik.html?id=' + esc(a.zakazchikId) + '">' + esc(zakName(a)) + '</a>' + poz + tail + '</nav>';
    }
    return '<nav class="crumbs" aria-label="Путь"><a href="apparaty.html">Мои аппараты</a>' + poz + tail + '</nav>';
  }
  function head(a) {
    var tip = (spr().tipy || {})[a.tip];
    return crumbs(a) +
      '<header class="pp-head">' +
        '<div class="pp-head__main">' +
          '<p class="label">' + esc([tip ? tip.title : '', a.techPoz ? 'поз. ' + a.techPoz : '', 'зав. № ' + (a.zavNomer || '—')].filter(Boolean).join(' · ')) + '</p>' +
          '<h1 class="h1 pp-head__title">' + esc(a.nazvanie) + '</h1>' +
          '<p class="pp-head__obozn">' + esc(a.oboznachenie) + '</p>' +
          '<p class="pp-head__where">' + esc([zakName(a), a.ustanovka].filter(Boolean).join(' · ')) + '</p>' +
        '</div>' +
        '<div class="pp-head__acts">' +
          '<button class="btn btn--primary" type="button" data-act="pp-print">Скачать паспорт</button>' +
          '<button class="btn btn--secondary" type="button" data-soon="Файл руководства по эксплуатации">Скачать руководство по эксплуатации</button>' +
          '<button class="btn btn--secondary" type="button" data-act="pp-toir">Выгрузить в 1С:ТОИР</button>' +
        '</div>' +
      '</header>';
  }

  /* --- гарантия и календарь ------------------------------------------------------ */
  function garantiya(a) {
    var p = a.postavka, on = a.garantiya.status === 'active', n = a.garantiya.ostalosDney;
    var ostatok = on
      ? '<p class="pp-gar__big" data-block="ostatok"><span class="num">' + esc(n) + '</span> ' + R.plural(n, 'день', 'дня', 'дней') + '</p>' +
        '<p class="pp-gar__sub">до конца гарантии' + (n >= 30 ? ', около ' + mes(Math.round(n / 30.4)) : '') + '</p>'
      : '<p class="pp-gar__big pp-gar__big--off" data-block="ostatok">Истекла</p>' +
        '<p class="pp-gar__sub">' + esc(R.data(p.garantiyaDo, { format: 'rel' })) + '</p>';
    return '<section class="card pp-gar" data-garantiya="' + (on ? 'active' : 'expired') + '">' +
      '<div class="card__head"><h2 class="pp-sec-title">Гарантия и ввод</h2>' +
        (on ? '<span class="badge badge--ok">На гарантии</span>' : '<span class="badge badge--neutral">Гарантия истекла</span>') + '</div>' +
      '<div class="card__body pp-gar__body">' +
        '<div class="pp-gar__ost">' + ostatok + '</div>' +
        dl([
          ['Ввод в эксплуатацию', esc(R.data(p.vvod, { format: 'full' })), 'vvod'],
          ['Гарантия до', esc(R.data(p.garantiyaDo, { format: 'full' })), 'garantiyaDo'],
          ['Срок гарантии', esc(mes(p.garantiyaMes)) + '<span class="pp-dl__note">из поля «Гарантия, мес.» опросного листа</span>', 'garantiyaMes'],
          ['Шеф-монтаж', p.shefMontazh ? 'проведён заводом' : 'не заказан']
        ]) +
      '</div></section>';
  }

  function kalendar(a) {
    var list = (a.postavka.osvid || []).slice().sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    var b = a.osvidBlizh, blizh = b ? b.date : null;
    var napom = a.napominanie
      ? '<p class="pp-napom" data-block="napominanie"><span class="strong">Напоминание: ' + esc(R.data(blizh, { format: 'rel' })) + '</span>, ' +
        esc(b.vidy.map(function (v) { return (OSVID[v] || {}).title; }).join(' и ').toLowerCase()) +
        ', ' + esc(R.data(blizh, { format: 'full' })) + '. Подготовьте аппарат и сообщите инспектору.</p>'
      : '';
    return '<section class="card pp-kal">' +
      '<div class="card__head"><h2 class="pp-sec-title">Освидетельствования по ФНП 536</h2></div>' +
      '<div class="card__body">' + napom +
        '<ol class="pp-kal__list">' + list.map(function (o) {
          var t = OSVID[o.vid] || { title: o.vid, period: '' }, is = o.date === blizh;
          return '<li class="pp-kal__i' + (is ? ' is-blizh' : '') + '" data-osvid="' + esc(o.vid) + '">' +
            '<span class="pp-kal__what"><span class="pp-kal__t">' + esc(t.title) + '</span><span class="pp-kal__p">' + esc(t.period) + '</span></span>' +
            '<span class="pp-kal__when"><span class="pp-kal__d">' + esc(R.data(o.date, { format: 'full' })) + '</span>' +
              '<span class="pp-kal__rel">' + esc(R.data(o.date, { format: 'rel' })) + '</span></span>' +
            (is ? '<span class="badge badge--info pp-kal__b">ближайшее</span>' : '') + '</li>';
        }).join('') + '</ol>' +
        '<p class="pp-cap">Периодичность — по паспорту и ФНП 536, значения демо.</p>' +
      '</div></section>';
  }

  /* --- паспорт -------------------------------------------------------------------- */
  function otkKontroler() {
    var l = (DATA.lyudi({ side: 'zavod' }) || []).filter(function (p) { return p.otdel === 'otk'; });
    return l[0] || null;
  }
  function pasport(a) {
    var p = a.postavka.pasport, o = p.obshchie || {}, h = p.harakteristiki || {}, g = p.gidro || {};
    var otk = otkKontroler(), zavod = spr().zavod || {};
    var sobytiya = [{ date: a.postavka.vvod, chto: 'Ввод в эксплуатацию' }];
    (a.obrashcheniya || []).filter(function (x) { return x.vid !== 'zip'; }).forEach(function (x) {
      sobytiya.push({ date: x.date, chto: x.vidInfo.title + ': ' + sTochkoy(x.text) + ' Статус: ' + x.statusInfo.title.toLowerCase() });
    });
    (a.postavka.osvid || []).forEach(function (x) {
      sobytiya.push({ date: x.date, chto: (OSVID[x.vid] || {}).title + ', по плану' });
    });
    sobytiya.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
    var sec = function (n, title, body) {
      return '<section class="pp-ps__sec" data-razdel="' + n + '"><h3 class="pp-ps__h">' + n + '. ' + esc(title) + '</h3>' + body + '</section>';
    };
    return '<section class="card pp-ps" id="pp-pasport" aria-label="Паспорт">' +
      '<div class="card__head pp-ps__head"><div><p class="label">Упрощённая форма по приложению Т ГОСТ 34347-2017</p>' +
        '<h2 class="pp-sec-title pp-ps__title">Паспорт сосуда, работающего под давлением</h2></div>' +
        '<button class="btn btn--secondary btn--sm pp-noprint" type="button" data-act="pp-print">Скачать паспорт</button></div>' +
      '<div class="card__body">' +
        '<p class="pp-ps__note">Значения демо. Состав полей сверяется с ГОСТ в рабочей версии.</p>' +
        sec(1, 'Общие сведения', dl([
          ['Изготовитель', v(zavod.short || o.izgotovitel) + (zavod.gorod ? ', г. ' + esc(zavod.gorod) : '')],
          ['Наименование', v(o.naimenovanie)],
          ['Обозначение', '<span class="mono">' + v(o.oboznachenie) + '</span>'],
          ['Заводской №', '<span class="mono">' + v(o.zavNomer) + '</span>'],
          ['Дата изготовления', esc(R.data(o.dataIzgotovleniya, { format: 'doc' }))],
          ['Технические условия', v(o.tu)],
          ['Назначение', v(o.naznachenie)]
        ], 'pp-dl--2')) +
        sec(2, 'Технические характеристики', dl([
          ['Давление рабочее', v(h.davlenieRabochee)], ['Давление расчётное', v(h.davlenieRaschetnoe)],
          ['Давление пробное', v(h.davlenieProbnoe)], ['Температура расчётная', v(h.tempRaschetnaya)],
          ['Температура стенки минимальная', v(h.tempMinStenki)], ['Рабочая среда', v(h.sreda)],
          ['Группа аппарата', v(h.gruppa)], ['Объём', v(h.obyom)],
          ['Масса', v(h.massa)], ['Прибавка на коррозию', v(h.pribavka)]
        ], 'pp-dl--2')) +
        sec(3, 'Материалы основных элементов', R.table({
          cols: [
            { key: 'element', title: 'Элемент', render: function (m) { return esc(m.element); } },
            { key: 'marka', title: 'Марка стали', nowrap: true, render: function (m) { return '<span class="mono">' + esc(m.marka) + '</span>'; } },
            { key: 'gost', title: 'Стандарт', render: function (m) { return esc(m.gost); } }
          ],
          rows: p.materialy || [], empty: 'Материалы не указаны'
        })) +
        sec(4, 'Сварка и контроль сварных швов', '<p class="pp-ps__p">' + v(p.svarka) + '</p>') +
        sec(5, 'Режим термообработки', '<p class="pp-ps__p" data-pole="termoobrabotka">' + v(p.termoobrabotka) + '</p>') +
        sec(6, 'Гидравлические испытания', dl([
          ['Пробное давление', v(g.davlenie)], ['Выдержка', v(g.vyderzhka)],
          ['Испытательная среда', v(g.sreda)], ['Результат', v(g.rezultat)]
        ], 'pp-dl--2')) +
        sec(7, 'Заключение ОТК', '<p class="pp-ps__p">' + v(p.otk) + '</p>' +
          (otk ? '<p class="pp-ps__sign">' + esc(otk.position) + ' · ' + esc(otk.name) + ' · ' + esc(R.data(o.dataIzgotovleniya, { format: 'doc' })) + '</p>' : '')) +
        sec(8, 'Сведения о ремонтах и освидетельствованиях', R.table({
          cols: [
            { key: 'date', title: 'Дата', nowrap: true, width: '130px', render: function (x) { return esc(R.data(x.date, { format: 'doc' })); } },
            { key: 'chto', title: 'Запись', render: function (x) { return esc(x.chto); } }
          ],
          rows: sobytiya, empty: 'Записей нет'
        })) +
        '<p class="pp-ps__foot">Сформировано в цифровом сервисе БМЗ ' + esc(R.data(new Date().toISOString(), { format: 'doc' })) + '. Прототип, данные демонстрационные.</p>' +
      '</div></section>';
  }

  /* --- ЗИП ------------------------------------------------------------------------- */
  function zip(a) {
    var list = a.postavka.zip || [], moy = side === 'zakazchik';
    var cols = [];
    if (moy) {
      cols.push({ key: 'vybor', title: '', width: '44px', render: function (z) {
        return '<input class="pp-zip__chk" type="checkbox" name="pp-zip" value="' + esc(z.id) + '" aria-label="' + esc(z.title) + '">';
      } });
    }
    cols.push(
      { key: 'title', title: 'Позиция', render: function (z) { return '<span class="pp-zip__t">' + esc(z.title) + '</span>'; } },
      { key: 'obozn', title: 'Обозначение', nowrap: true, render: function (z) { return '<span class="mono">' + esc(z.oboznachenie) + '</span>'; } },
      { key: 'kolvo', title: 'В комплекте', nowrap: true, align: 'right', render: function (z) { return esc(z.kolvo) + ' шт.'; } },
      { key: 'srok', title: 'Срок изготовления', nowrap: true, align: 'right', render: function (z) { return esc(R.dney(z.srokIzgotovleniyaDney)); } }
    );
    return '<section class="card pp-zip" aria-label="ЗИП">' +
      '<div class="card__head"><h2 class="pp-sec-title">ЗИП по заводскому № <span class="mono">' + esc(a.zavNomer) + '</span></h2>' +
        '<span class="small muted">' + list.length + ' ' + R.plural(list.length, 'позиция', 'позиции', 'позиций') + ' · сроки демо</span></div>' +
      R.table({ cols: cols, rows: list, empty: 'Ведомость ЗИП не приложена' }) +
      (moy ? '<div class="card__foot pp-zip__foot"><button class="btn btn--primary" type="button" data-act="pp-zip">Запросить ЗИП</button>' +
        '<p class="pp-err" id="pp-zip-err" hidden></p>' +
        '<span class="small muted">Запрос будет передан в сервис завода вместе с заводским номером аппарата.</span></div>' : '') +
    '</section>';
  }

  /* --- обращения ------------------------------------------------------------------ */
  function forma(a) {
    var on = naGarantii(a);
    return '<section class="card pp-forma" id="pp-forma" aria-label="Заявка на ремонт и рекламация">' +
      '<div class="card__head"><h2 class="pp-sec-title">Заявка на ремонт · рекламация</h2></div>' +
      '<div class="card__body stack--tight">' +
        '<label class="field"><span class="field__label label">Что случилось</span>' +
          '<textarea class="textarea" id="pp-text" rows="4" placeholder="Например: течь по фланцу штуцера Б, давление держит"></textarea></label>' +
        '<div class="field"><span class="field__label label">Фото</span>' +
          '<label class="btn btn--secondary btn--sm pp-file"><input type="file" id="pp-foto" accept="image/*">Выбрать фото</label>' +
          '<div class="pp-prev" id="pp-prev"' + (S.foto ? '' : ' hidden') + '>' + (S.foto ? prevHtml() : '') + '</div></div>' +
        '<p class="pp-err" id="pp-err" hidden></p>' +
        '<div class="pp-forma__acts">' +
          '<button class="btn btn--primary" type="button" data-act="pp-send" data-vid="remont">Отправить заявку на ремонт</button>' +
          '<button class="btn btn--secondary" type="button" data-act="pp-send" data-vid="reklamaciya"' + (on ? '' : ' disabled aria-disabled="true"') + '>Подать рекламацию</button>' +
        '</div>' +
        '<p class="pp-cap" data-block="reklamaciya">' + (on
          ? 'Рекламацию можно подать до ' + esc(R.data(a.postavka.garantiyaDo, { format: 'full' })) + ', пока действует гарантия.'
          : 'Гарантия истекла, доступна заявка на ремонт.') + '</p>' +
      '</div></section>';
  }
  function prevHtml() {
    return '<img src="' + esc(S.foto) + '" alt="Превью фото">' +
      '<span class="pp-prev__name">' + esc(S.fotoName || 'фото') + '</span>' +
      '<button class="link-btn" type="button" data-act="pp-foto-x">Убрать</button>';
  }
  function obrashcheniya(a) {
    var list = (a.obrashcheniya || []).slice().sort(function (x, y) { return x.date < y.date ? 1 : -1; });
    var zipList = a.postavka.zip || [];
    var items = list.map(function (o) {
      var zipT = (o.zip || []).map(function (id) { var z = byId(zipList, id); return z ? z.title : id; });
      return '<li class="pp-ob__i" data-ob="' + esc(o.id) + '" data-vid="' + esc(o.vid) + '" data-status="' + esc(o.status) + '">' +
        '<div class="pp-ob__top"><span class="pp-ob__vid">' + esc(o.vidInfo.title) + '</span>' +
          '<span class="badge ' + esc(o.statusInfo.cls) + '">' + esc(o.statusInfo.title) + '</span></div>' +
        '<p class="pp-ob__meta">' + esc(R.data(o.date, { format: 'docTime' })) + (o.ot ? ' · ' + esc(o.ot.name) : '') +
          (o.pometka ? ' · ' + esc(o.ot.predpriyatie) + ' · <span data-qr="1">' + esc(o.pometka) + '</span>' : '') + '</p>' +
        (o.text ? '<p class="pp-ob__text">' + esc(o.text) + '</p>' : '') +
        (zipT.length ? '<p class="pp-ob__text">' + esc(zipT.join('; ')) + '</p>' : '') +
        (o.foto && /^data:image\//.test(o.foto) ? '<img class="pp-ob__foto" src="' + esc(o.foto) + '" alt="Фото к обращению">' : '') +
        (side === 'zavod' && o.mozhnoVzyat ? '<button class="btn btn--primary btn--sm" type="button" data-act="pp-vrabotu" data-id="' + esc(o.id) + '">Взять в работу</button>' : '') +
      '</li>';
    }).join('');
    return '<section class="card pp-ob" aria-label="Обращения">' +
      '<div class="card__head"><h2 class="pp-sec-title">' + (side === 'zavod' ? 'Обращения по аппарату' : 'Мои обращения') + '</h2>' +
        '<span class="small muted">' + list.length + '</span></div>' +
      (list.length ? '<ul class="pp-ob__list">' + items + '</ul>'
        : R.pusto({ text: side === 'zavod' ? 'Обращений по аппарату нет.' : 'Обращений пока нет. Заявка на ремонт, рекламация и запрос ЗИП появятся здесь со статусом.' })) +
    '</section>';
  }

  /* --- отрисовка ------------------------------------------------------------------ */
  function render() {
    var a = ID ? DATA.apparat(ID) : null;
    if (!a) {
      page.innerHTML = '<div class="page-head"><h1 class="h1">Аппарат не найден</h1></div>' +
        '<section class="card">' + R.pusto({ text: 'Аппарата с таким номером нет или он не относится к вашему предприятию.',
          action: { label: side === 'zavod' ? 'К воронке' : 'К моим аппаратам', href: w.Shell.home(side) } }) + '</section>';
      return;
    }
    page.setAttribute('data-apparat', a.id);
    if (!a.postavka) {
      page.innerHTML = head(a).replace(/<div class="pp-head__acts">[\s\S]*?<\/div><\/header>/, '</header>') +
        '<section class="card">' + R.pusto({ text: 'Паспорт и сервис откроются, когда аппарат отгрузят.',
          action: { label: 'К карточке аппарата', href: 'apparat.html?id=' + a.id } }) + '</section>';
      return;
    }
    document.title = 'Паспорт: ' + a.nazvanie + (a.techPoz ? ', поз. ' + a.techPoz : '') + (side === 'zavod' ? ' — Работа с заказчиками' : ' — Сервис заказчика БМЗ');
    page.innerHTML = head(a) +
      '<div class="pp-top">' +
        '<section class="card pp-shl" aria-label="Табличка аппарата"><div class="card__head"><h2 class="pp-sec-title">Табличка аппарата</h2></div>' +
          '<div class="card__body"><div id="pp-shildik"></div><p class="pp-cap">QR на табличке ведёт на страницу проверки.</p></div></section>' +
        '<div class="pp-top__side">' + garantiya(a) + kalendar(a) + '</div>' +
      '</div>' +
      pasport(a) + zip(a) +
      '<div class="pp-servis' + (side === 'zakazchik' ? '' : ' pp-servis--one') + '">' + (side === 'zakazchik' ? forma(a) : '') + obrashcheniya(a) + '</div>';
    w.Shildik.render(document.getElementById('pp-shildik'), a);
  }
  function after() { render(); w.Shell.refresh(); }
  function fail(text) { R.modal({ title: 'Не получилось', text: text }); }
  function err(id, text) {
    var e = document.getElementById(id);
    if (e) { e.textContent = text || ''; e.hidden = !text; }
  }
  function sent(vid) {
    R.modal({ title: vidTitle(vid) + ' отправлен' + (vid === 'zip' ? '' : 'а'),
      text: 'Завод видит обращение в очереди сервиса. Статус виден в блоке «Мои обращения».' });
  }

  /* --- действия ---------------------------------------------------------------- */
  var Sh = w.Shell;
  Sh.on('pp-print', function () {
    var a = DATA.apparat(ID), old = document.title;
    if (a) { document.title = 'Паспорт ' + a.nazvanie + ', зав. № ' + (a.zavNomer || ''); }
    w.print();
    document.title = old;
  });
  Sh.on('pp-toir', function () {
    var a = DATA.apparat(ID);
    if (!a || !a.postavka) { return; }
    var o = a.postavka.pasport.obshchie || {};
    var rows = [
      ['Объект ремонта', a.nazvanie], ['Модель (обозначение)', a.oboznachenie], ['Заводской №', a.zavNomer],
      ['Технологическая позиция', a.techPoz], ['Дата ввода в эксплуатацию', R.data(a.postavka.vvod, { format: 'doc' })],
      ['Изготовитель', o.izgotovitel], ['Гарантия до', R.data(a.postavka.garantiyaDo, { format: 'doc' })]
    ];
    (a.postavka.osvid || []).forEach(function (x) { rows.push([(OSVID[x.vid] || {}).title + ', срок', R.data(x.date, { format: 'doc' })]); });
    R.modal({
      title: 'Выгрузить в 1С:ТОИР', wide: true,
      text: 'Эти данные будут переданы в карточку объекта ремонта.',
      body: '<div class="pp-toir">' + R.table({
        cols: [
          { key: 'pole', title: 'Реквизит в 1С:ТОИР', render: function (r) { return esc(r[0]); } },
          { key: 'znach', title: 'Значение из сервиса', render: function (r) { return '<span class="mono">' + v(r[1]) + '</span>'; } }
        ],
        rows: rows
      }) + '<p class="pp-toir__later">Выгрузка появится после обследования ИТ-систем заказчика.</p></div>',
      foot: '<button class="btn btn--secondary" type="button" data-close>Закрыть</button>'
    });
  });

  Sh.on('pp-zip', function () {
    var ids = Array.prototype.map.call(document.querySelectorAll('input[name="pp-zip"]:checked'), function (x) { return x.value; });
    if (!ids.length) { err('pp-zip-err', 'Отметьте позиции, которые нужны.'); return; }
    var a = DATA.apparat(ID);
    var t = ids.map(function (id) { var z = byId(a.postavka.zip, id); return z ? z.title + ' (' + z.oboznachenie + ')' : id; });
    if (!ACT.obrashchenie(ID, { vid: 'zip', text: 'Запрос ЗИП: ' + t.join('; '), zip: ids })) { fail('Запрос не отправился.'); return; }
    after(); sent('zip');
  });

  Sh.on('pp-send', function (t) {
    var vid = t.getAttribute('data-vid');
    var f = document.getElementById('pp-text'), text = f ? f.value.trim() : '';
    if (!text) {
      if (f) { f.classList.add('input--error'); f.focus(); }
      err('pp-err', 'Опишите, что случилось.');
      return;
    }
    if (!ACT.obrashchenie(ID, { vid: vid, text: text, foto: S.foto })) {
      fail(vid === 'reklamaciya' ? 'Гарантия истекла, подайте заявку на ремонт.' : 'Заявка не отправилась.');
      return;
    }
    S.foto = null; S.fotoName = null;
    after(); sent(vid);
  });

  Sh.on('pp-foto-x', function () {
    S.foto = null; S.fotoName = null;
    var p = document.getElementById('pp-prev'), i = document.getElementById('pp-foto');
    if (p) { p.innerHTML = ''; p.hidden = true; }
    if (i) { i.value = ''; }
  });

  Sh.on('pp-vrabotu', function (t) {
    if (!ACT.vzyatVRabotu(t.getAttribute('data-id'))) { fail('Обращение уже в работе.'); return; }
    after();
  });

  /* Фото: уменьшаем до 800 px по длинной стороне — в журнал ложится десятки КБ, а не мегабайты. */
  function showPrev() {
    var p = document.getElementById('pp-prev');
    if (p) { p.innerHTML = prevHtml(); p.hidden = false; }
  }
  document.addEventListener('change', function (e) {
    var inp = e.target;
    if (!inp || inp.id !== 'pp-foto' || !inp.files || !inp.files[0]) { return; }
    var file = inp.files[0];
    if (!/^image\//.test(file.type)) { err('pp-err', 'Нужно изображение в формате JPG или PNG.'); return; }
    err('pp-err', '');
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 800 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        var small = null;
        try {
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          small = c.toDataURL('image/jpeg', 0.72);
        } catch (x) { small = null; }
        /* Не уменьшилось — полноразмерный файл в журнал не пишем. */
        if (!small || small.indexOf('data:image/jpeg') !== 0) {
          S.foto = null; S.fotoName = null; inp.value = '';
          err('pp-err', 'Фото не удалось уменьшить. Выберите другое или отправьте заявку без фото.');
          return;
        }
        S.foto = small;
        S.fotoName = file.name;
        showPrev();
      };
      img.onerror = function () { err('pp-err', 'Фото не читается. Выберите другое.'); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });

  render();
})(window);

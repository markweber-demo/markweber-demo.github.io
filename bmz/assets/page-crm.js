/* Воронка и сервис завода — crm.html. Таск 07.
   Менеджер отдела маркетинга и продаж видит свою работу целиком: на ком шаг,
   сколько дней висит, что происходит в производстве.

   Читает только DATA, пишет только ACT. Правил ходов здесь нет: колонки
   воронки отдаёт DATA.voronka, «можно взять в работу» — статус обращения.

   Адрес: crm.html — воронка, crm.html#servis — очередь сервиса.
   Параметры для ссылок и стендов: ?zak=<заказчик>&tip=<тип>&nami=1&vid=tablica. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA, ACT = w.ACT;

  if (!w.Shell.mount({ active: 'voronka', role: 'zavod' })) { return; }

  /* Статусы и виды обращений, «новая», «просрочено», «можно взять» — признаки
     из DATA (06a); своих карт и сравнений дат здесь нет. */
  var param = R.param;
  var st = {
    zak: param('zak'),
    tip: param('tip'),
    nami: param('nami') === '1',
    vid: param('vid') === 'tablica' ? 'tablica' : 'kolonki'
  };

  function spr() { return DATA.spravochnik() || {}; }
  function prosrocheno(a) { return !!a.prosrocheno; }

  var zakazchiki = null, lyudiZavoda = null;
  function zakList() { return zakazchiki || (zakazchiki = DATA.zakazchiki() || []); }
  function zak(id) {
    var l = zakList();
    for (var i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i]; } }
    return null;
  }
  /* «АО «ТАНЕКО»» → «ТАНЕКО»: для плашек событий берём последнее имя в кавычках. */
  function korotko(name) {
    var all = String(name || '').match(/«([^«»]+)»/g);
    return all ? all[all.length - 1].replace(/[«»]/g, '') : String(name || '');
  }
  function manager(id) {
    lyudiZavoda = lyudiZavoda || DATA.lyudi({ side: 'zavod' }) || [];
    for (var i = 0; i < lyudiZavoda.length; i++) {
      if (lyudiZavoda[i].id === id) {
        var p = lyudiZavoda[i].name.split(' ');
        return p.length > 1 ? p[0].charAt(0) + '. ' + p.slice(1).join(' ') : lyudiZavoda[i].name;
      }
    }
    return '—';
  }
  function tipShort(t) { var x = (spr().tipy || {})[t]; return x ? x.short : ''; }
  function vremya(iso) {
    var s = String(iso || '');
    if (s.indexOf('T') < 0) { return R.data(s, { format: 'rel' }); }
    var d = new Date(s);
    return R.data(s, { format: 'rel' }) + ', ' + (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }

  /* Заявка «новая», пока завод по ней ничего не сделал — признак из DATA: время подачи или null. */
  function novaya(a) { return a.novaya || null; }

  /* Плашки событий: что происходит с аппаратом прямо сейчас. Только чтение признаков. */
  function sobytiya(a) {
    var out = [], kto = korotko((zak(a.zakazchikId) || {}).name);
    (a.pmi || []).forEach(function (p) {
      var chto = p.kratko;
      if (p.tip === 'W' && p.status !== 'done' && p.otvetZakazchika === 'priedu') {
        var n = p.priedut || 1;
        out.push({ cls: 'info', text: kto + ' приедет на ' + chto + ', ' + n + ' ' + R.plural(n, 'человек', 'человека', 'человек') });
      } else if (p.tip === 'W' && p.status !== 'done' && p.otvetZakazchika === 'bez-nas') {
        out.push({ cls: 'neutral', text: kto + ': ' + chto + ' проводим без инспекции' });
      }
      if (p.mozhnoPodtverdit) {
        out.push({ cls: 'warn', text: 'Ждём подтверждения ' + p.kratko });
      }
    });
    var bezOtveta = (a.zamechaniya || []).filter(function (z) { return z.mozhnoOtvetit; }).length;
    if (bezOtveta) {
      out.push({ cls: 'warn', text: bezOtveta + ' ' + R.plural(bezOtveta, 'замечание ждёт', 'замечания ждут', 'замечаний ждут') + ' ответа завода' });
    }
    if (a.etap === 'raschet' || a.etap === 'dogovor') {
      (a.dokumenty || []).forEach(function (d) {
        if (d.vid !== 'tkp' || !d.revizii.length) { return; }
        var r = d.revizii[d.revizii.length - 1];
        out.push({ cls: r.kod ? 'ok' : 'neutral', text: 'ТКП, рев. ' + r.rev + (r.kod ? ', принято' : ', ждёт ответа заказчика') });
      });
    }
    if (a.zadanie && a.zadanie.status === 'naznacheno') {
      out.push({ cls: 'neutral', text: 'Задание конструктору: ' + manager(a.zadanie.konstruktorId) + ', до ' + R.data(a.zadanie.srok, { format: 'doc' }) });
    }
    return out;
  }

  /* Порядок в колонке: просроченное, потом шаг за нами, потом по сроку. */
  function poryadok(list) {
    return list.slice().sort(function (p, q) {
      var d = (prosrocheno(q) ? 1 : 0) - (prosrocheno(p) ? 1 : 0);
      if (d) { return d; }
      d = (q.naKom === 'zavod' ? 1 : 0) - (p.naKom === 'zavod' ? 1 : 0);
      if (d) { return d; }
      return String(p.srokOtveta || '9999') < String(q.srokOtveta || '9999') ? -1 : 1;
    });
  }

  function href(a) { return 'apparat.html?id=' + encodeURIComponent(a.id); }

  function kartochka(a) {
    var z = zak(a.zakazchikId) || {}, nov = novaya(a);
    var sob = sobytiya(a);
    return '<a class="crm-card' + (prosrocheno(a) ? ' is-overdue' : '') + (nov ? ' is-new' : '') + '" href="' + esc(href(a)) + '"' +
      ' data-apparat="' + esc(a.id) + '" data-etap="' + esc(a.etap) + '" draggable="false">' +
      '<span class="crm-card__top">' +
        '<span class="crm-card__poz mono">' + esc(a.techPoz || '—') + '</span>' +
        '<span class="crm-card__tip">' + esc(tipShort(a.tip)) + '</span>' +
        (nov ? '<span class="badge badge--warn crm-card__new">новая · ' + esc(vremya(nov)) + '</span>' : '') +
      '</span>' +
      '<span class="crm-card__name">' + esc(a.nazvanie) + '</span>' +
      '<span class="crm-card__zak">' + esc(z.name || '') + '</span>' +
      R.naKom(a) +
      (sob.length ? '<span class="crm-card__sob">' + sob.map(function (s) {
        return '<span class="crm-sob crm-sob--' + s.cls + '">' + esc(s.text) + '</span>';
      }).join('') + '</span>' : '') +
      '<span class="crm-card__foot">' +
        '<span class="crm-card__dney" title="Дней на этапе"><span class="mono">' + a.dneyNaEtape + '</span> ' +
          esc(R.plural(a.dneyNaEtape, 'день', 'дня', 'дней')) + ' на этапе</span>' +
        '<span class="crm-card__mgr" title="Ответственный">' + esc(manager(a.managerId)) + '</span>' +
      '</span>' +
    '</a>';
  }

  /* Что лежит на доске сейчас: аппарат по id и колонки по порядку — для перетаскивания. */
  var naDoske = {}, kolonkiDoski = [];

  function kolonki(vor) {
    naDoske = {};
    kolonkiDoski = vor.map(function (k) {
      k.apparaty.forEach(function (a) { naDoske[a.id] = a; });
      return { kolonka: k.kolonka, title: k.title };
    });
    return '<div class="crm-board" data-vid="kolonki">' + vor.map(function (k) {
      var list = poryadok(k.apparaty);
      return '<section class="crm-col" data-kolonka="' + esc(k.kolonka) + '">' +
        '<h2 class="crm-col__head"><span class="crm-col__title">' + esc(k.title) + '</span>' +
          '<span class="crm-col__n mono">' + list.length + '</span></h2>' +
        (list.length ? '<div class="crm-col__list">' + list.map(kartochka).join('') + '</div>'
          : '<p class="crm-col__empty">Заявок нет</p>') +
      '</section>';
    }).join('') + '</div>';
  }

  function tablica(vor) {
    var rows = [];
    vor.forEach(function (k) { poryadok(k.apparaty).forEach(function (a) { rows.push({ a: a, kolonka: k.title }); }); });
    return '<div class="card crm-table" data-vid="tablica">' + R.table({
      cols: [
        { key: 'apparat', title: 'Аппарат', render: function (r) {
          var nov = novaya(r.a);
          return '<span class="crm-t__name">' + esc(r.a.nazvanie) + '</span> <span class="mono crm-t__poz">' + esc(r.a.techPoz) + '</span>' +
            (nov ? ' <span class="badge badge--warn">новая · ' + esc(vremya(nov)) + '</span>' : '');
        } },
        { key: 'zakazchik', title: 'Заказчик', render: function (r) { return esc((zak(r.a.zakazchikId) || {}).name || ''); } },
        { key: 'etap', title: 'Этап воронки', render: function (r) { return esc(r.kolonka); } },
        { key: 'nakom', title: 'На ком шаг', render: function (r) { return R.naKom(r.a); } },
        { key: 'dney', title: 'Дней на этапе', align: 'right', render: function (r) { return '<span class="mono">' + r.a.dneyNaEtape + '</span>'; } },
        { key: 'manager', title: 'Ответственный', nowrap: true, render: function (r) { return esc(manager(r.a.managerId)); } }
      ],
      rows: rows,
      rowHref: function (r) { return href(r.a); },
      rowClass: function (r) { return prosrocheno(r.a) ? 'is-overdue' : ''; }
    }) + '</div>';
  }

  function filtry() {
    var tipy = spr().tipy || {};
    var aktivny = st.zak || st.tip || st.nami;
    return '<div class="crm-bar">' +
      '<label class="crm-bar__f"><span class="label">Заказчик</span><select class="select" id="crm-zak">' +
        '<option value="">Все заказчики</option>' +
        zakList().map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === st.zak ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="crm-bar__f"><span class="label">Тип аппарата</span><select class="select" id="crm-tip">' +
        '<option value="">Все типы</option>' +
        Object.keys(tipy).map(function (t) { return '<option value="' + esc(t) + '"' + (t === st.tip ? ' selected' : '') + '>' + esc(tipy[t].title) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="choice crm-bar__nami"><input type="checkbox" id="crm-nami"' + (st.nami ? ' checked' : '') + '> Шаг за нами</label>' +
      (aktivny ? '<button class="btn btn--ghost btn--sm" type="button" data-act="crm-reset">Сбросить фильтр</button>' : '') +
      '<span class="crm-bar__vid" role="group" aria-label="Вид">' +
        ['kolonki', 'tablica'].map(function (v) {
          return '<button class="btn btn--sm ' + (st.vid === v ? 'btn--primary' : 'btn--secondary') + '" type="button" data-act="crm-vid" data-vid="' + v + '"' +
            ' aria-pressed="' + (st.vid === v) + '">' + (v === 'kolonki' ? 'Колонки' : 'Таблица') + '</button>';
        }).join('') +
      '</span>' +
    '</div>';
  }

  function schetchiki() {
    var all = [];
    (DATA.voronka({}) || []).forEach(function (k) { all = all.concat(k.apparaty); });
    var n = all.filter(function (a) { return !!novaya(a); }).length;
    var zhdut = all.filter(function (a) { return a.naKom === 'zavod'; }).length;
    var pr = all.filter(prosrocheno).length;
    function stat(key, v, t, cls) {
      return '<div class="crm-stat' + (cls ? ' ' + cls : '') + '" data-stat="' + key + '"><span class="crm-stat__v mono">' + v + '</span>' +
        '<span class="crm-stat__t">' + esc(t) + '</span></div>';
    }
    return '<div class="crm-stats">' +
      stat('vsego', all.length, 'в работе') +
      stat('novye', n, R.plural(n, 'новая заявка', 'новые заявки', 'новых заявок'), n ? 'is-new' : '') +
      stat('zhdut', zhdut, 'ждут ответа завода') +
      stat('prosrocheno', pr, 'просрочено', pr ? 'is-danger' : '') +
    '</div>';
  }

  function voronka() {
    var vor = DATA.voronka({ zakazchikId: st.zak || undefined, tip: st.tip || undefined, naMne: st.nami || undefined }) || [];
    var n = vor.reduce(function (s, k) { return s + k.apparaty.length; }, 0);
    var body = !n
      ? '<div class="card">' + R.pusto({ text: 'Нет заявок по этому фильтру', action: { label: 'Сбросить фильтр', act: 'crm-reset' } }) + '</div>'
      : (st.vid === 'tablica' ? tablica(vor) : kolonki(vor));
    return filtry() + body +
      '<p class="crm-note">Отгруженные аппараты переходят из воронки в парк заказчика. Парк открывается в разделе <a href="zakazchiki.html">«Заказчики»</a>.</p>';
  }

  function servis() {
    var list = DATA.servis() || [];
    var novyh = list.filter(function (o) { return o.status === 'novoe'; }).length;
    var tbl = R.table({
      cols: [
        { key: 'vid', title: 'Тип', render: function (o) {
          return '<span class="crm-obr__vid crm-obr__vid--' + esc(o.vid) + '">' + esc(o.vidInfo.short) + '</span>' +
            (o.text ? '<span class="crm-obr__text">' + esc(o.text) + '</span>' : '') +
            (o.pometka ? '<span class="crm-obr__text" data-qr="1">' + esc(o.pometka) + ': ' + esc(o.ot.predpriyatie) + ', ' + esc(o.ot.name) + '</span>' : '');
        } },
        { key: 'apparat', title: 'Аппарат', render: function (o) {
          var a = o.apparat || {};
          return '<a href="apparat.html?id=' + esc(encodeURIComponent(a.id)) + '">' + esc(a.nazvanie) + '</a> <span class="mono crm-t__poz">' + esc(a.techPoz) + '</span>' +
            (a.zavNomer ? '<span class="crm-obr__text">зав. № ' + esc(a.zavNomer) + '</span>' : '');
        } },
        { key: 'zakazchik', title: 'Заказчик', render: function (o) {
          return o.zakazchik ? '<a href="zakazchik.html?id=' + esc(encodeURIComponent(o.zakazchik.id)) + '">' + esc(o.zakazchik.name) + '</a>' : '—';
        } },
        { key: 'date', title: 'Дата', nowrap: true, render: function (o) { return esc(R.data(o.date, { format: String(o.date).indexOf('T') > -1 ? 'docTime' : 'doc' })); } },
        { key: 'status', title: 'Статус', render: function (o) {
          var s = o.statusInfo;
          return '<span class="badge ' + s.cls + '" data-status="' + esc(o.status) + '">' + esc(s.title) + '</span>';
        } },
        { key: 'act', title: '', align: 'right', render: function (o) {
          return o.mozhnoVzyat
            ? '<button class="btn btn--primary btn--sm" type="button" data-act="crm-vzyat" data-id="' + esc(o.id) + '">Взять в работу</button>'
            : '';
        } }
      ],
      rows: list,
      rowClass: function (o) { return 'crm-obr crm-obr--' + o.status; },
      empty: { text: 'Обращений нет. Заявка на ремонт, рекламация и запрос ЗИП появятся здесь, когда заказчик подаст их из паспорта аппарата.' }
    });
    return '<div class="card crm-servis" data-obr="' + list.length + '">' +
      '<div class="card__head"><h2 class="ap-sec-title crm-sec-title">Очередь сервиса</h2>' +
        '<span class="muted crm-servis__n">' + (list.length ? list.length + ' ' + R.plural(list.length, 'обращение', 'обращения', 'обращений') + (novyh ? ', новых ' + novyh : '') : '') + '</span></div>' +
      tbl + '</div>' +
      '<p class="crm-note">Ответы на приглашения к испытаниям относятся к производству. Они видны на карточке аппарата в воронке и в его истории.</p>';
  }

  function tab() { return w.location.hash === '#servis' ? 'servis' : 'voronka'; }

  function render() {
    ubratPodskazku();
    var page = document.getElementById('page');
    var t = tab();
    page.setAttribute('data-tab', t);
    page.setAttribute('data-vid', st.vid);
    page.innerHTML =
      '<header class="page-head crm-head">' +
        '<div><p class="label">Отдел маркетинга и продаж · ' + esc((spr().zavod || {}).short || '') + '</p>' +
          '<h1 class="h1">Заявки и аппараты</h1>' +
          '<p class="crm-demo">Предприятия взяты из материалов завода о покупателях. Аппараты, даты и люди выдуманы, данные демонстрационные.</p></div>' +
        schetchiki() +
      '</header>' +
      '<nav class="tabs crm-tabs" aria-label="Разделы">' +
        '<a class="tab' + (t === 'voronka' ? ' is-active' : '') + '" href="#voronka" data-tab="voronka"' + (t === 'voronka' ? ' aria-current="page"' : '') + '>Воронка</a>' +
        '<a class="tab' + (t === 'servis' ? ' is-active' : '') + '" href="#servis" data-tab="servis"' + (t === 'servis' ? ' aria-current="page"' : '') + '>Сервис</a>' +
      '</nav>' +
      '<div class="crm-body">' + (t === 'servis' ? servis() : voronka()) + '</div>';
  }

  /* --- перетаскивание карточек (07a) -----------------------------------------------
     Этапы двигаются событиями: карточку можно перенести, только если следующий шаг
     за менеджером и это тот же ход, что у кнопки в карточке аппарата. Можно ли —
     решает признак `mozhno.*` из DATA; куда ведёт ход — таблица ниже. В остальных
     случаях карточка возвращается, а подсказка словами из данных говорит, кто держит
     шаг и до какого срока. Pointer Events: мышь, тачпад, палец; клик без сдвига
     по-прежнему открывает аппарат. Ниже 768 px, где воронка списком, не таскаем. */
  var HODY = [
    { priznak: 'tkp', kolonka: 'raschet', act: 'napravitTkp', hod: 'ТКП направлено' },
    { priznak: 'tkpPrinyato', kolonka: 'dogovor', act: 'tkpPrinyato', hod: 'ТКП принято' },
    { priznak: 'dogovorPodpisan', kolonka: 'chertezh', act: 'dogovorPodpisan', hod: 'Договор подписан' }
  ];
  var POROG = 6, ZHIZN_PODSKAZKI = 4500;
  var drag = null, glushitKlik = false, podskazkaTimer = null;

  /* Ход, который уводит карточку из колонки `ot` дальше. «ТКП направлено» на расчёте
     колонку не меняет — такой ход доской не делается. */
  function hod(a, ot) {
    for (var i = 0; i < HODY.length; i++) {
      if (a && a.mozhno && a.mozhno[HODY[i].priznak] && HODY[i].kolonka !== ot) { return HODY[i]; }
    }
    return null;
  }
  function nazvanieKolonki(id) {
    for (var i = 0; i < kolonkiDoski.length; i++) { if (kolonkiDoski[i].kolonka === id) { return kolonkiDoski[i].title; } }
    return '';
  }
  function nomerKolonki(id) {
    for (var i = 0; i < kolonkiDoski.length; i++) { if (kolonkiDoski[i].kolonka === id) { return i; } }
    return -1;
  }
  function pmiPo(a, id) { return (a.pmi || []).filter(function (p) { return p.id === id; })[0] || null; }

  /* Что должно случиться, чтобы этап сдвинулся: этап, ближайшая точка W и её `kratko`. */
  function uslovie(a) {
    var w1 = pmiPo(a, a.tekushchayaW || a.blizhW);
    switch (a.etap) {
      case 'zayavka': return { text: 'направим ТКП' };
      case 'raschet': return a.mozhno && a.mozhno.tkp
        ? { text: 'заказчик примет ТКП', snachala: 'Сначала направьте ТКП кнопкой в карточке аппарата. ' }
        : { text: 'заказчик примет ТКП', zakazchik: true };
      case 'dogovor': return { text: 'договор будет подписан' };
      case 'chertezh': return { text: 'заказчик согласует чертёж', zakazchik: true };
      case 'gotov': return { text: 'аппарат будет отгружен' };
      default: return { text: w1 ? 'пройдём ' + w1.kratko : 'закончим производство' };
    }
  }
  /* Кто держит шаг и до какого срока: `naKom`, `srokOtveta`, `prosrocheno`, точка H, которую ждём. */
  function ktoDerzhit(a, u) {
    var srok = a.srokOtveta ? R.data(a.srokOtveta) : '';
    if (a.naKom === 'zakazchik') {
      var h = (a.pmi || []).filter(function (p) { return p.mozhnoPodtverdit; })[0];
      var chego = h ? 'подтверждения ' + h.kratko + ' от заказчика' : (u.zakazchik ? 'ответ' : 'ответ заказчика');
      return '. Ждём ' + chego + (srok ? (a.prosrocheno ? ', срок был ' + srok : ' до ' + srok) : '') + '.';
    }
    if (a.naKom === 'zavod') {
      return '. Шаг за нами' + (srok ? (a.prosrocheno ? ', срок был ' + srok : ', до ' + srok) : '') + '.';
    }
    return '.';
  }
  function prichina(a, cel, ot) {
    var u = uslovie(a), h = hod(a, ot);
    if (h) {
      return 'Отсюда карточку можно перенести только в «' + nazvanieKolonki(h.kolonka) + '», это ход «' + h.hod + '»' + ktoDerzhit(a, u);
    }
    var nazad = nomerKolonki(cel) < nomerKolonki(ot) ? 'Назад по воронке карточку перенести нельзя. ' : '';
    return nazad + (u.snachala || '') + 'Этап сдвинется, когда ' + u.text + ktoDerzhit(a, u);
  }

  function ubratPodskazku() {
    if (podskazkaTimer) { clearTimeout(podskazkaTimer); podskazkaTimer = null; }
    Array.prototype.forEach.call(document.querySelectorAll('.crm-hint'), function (x) { x.parentNode.removeChild(x); });
  }
  /* Подсказка под карточкой, в пределах доски; уходит сама. */
  function podskazka(card, text, vid) {
    ubratPodskazku();
    var board = card && card.closest('.crm-board');
    if (!board) { return; }
    /* Место карточки в раскладке, без сдвига transform: подсказка встаёт под её гнездом,
       даже пока карточка ещё едет обратно. */
    var x = 0, y = 0, n = card;
    while (n && n !== board) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    var br = { width: board.clientWidth }, cr = { left: x, top: y, width: card.offsetWidth, bottom: y + card.offsetHeight };
    var width = Math.min(Math.max(cr.width, 280), br.width);
    var el = document.createElement('div');
    el.className = 'crm-hint crm-hint--' + vid;
    el.setAttribute('role', 'status');
    el.setAttribute('data-apparat', card.getAttribute('data-apparat'));
    el.textContent = text;
    el.style.width = width + 'px';
    el.style.left = Math.max(0, Math.min(cr.left, br.width - width)) + 'px';
    el.style.top = (cr.bottom + 6) + 'px';
    board.appendChild(el);
    /* Под карточкой не помещается в окне — над ней. */
    var niz = board.getBoundingClientRect().top + cr.bottom + 6 + el.offsetHeight;
    if (niz > w.innerHeight && cr.top - el.offsetHeight - 6 >= 0) { el.style.top = (cr.top - el.offsetHeight - 6) + 'px'; }
    w.requestAnimationFrame(function () { el.classList.add('is-shown'); });
    podskazkaTimer = setTimeout(function () {
      el.classList.remove('is-shown');
      podskazkaTimer = setTimeout(function () { podskazkaTimer = null; if (el.parentNode) { el.parentNode.removeChild(el); } }, 250);
    }, ZHIZN_PODSKAZKI);
  }

  function mozhnoTaskat() {
    return tab() === 'voronka' && st.vid === 'kolonki' && !(w.matchMedia && w.matchMedia('(max-width: 767px)').matches);
  }
  function kolonkaPod(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest('.crm-board .crm-col') : null;
  }
  function podsvetka(nad) {
    qqDoc('.crm-board .crm-col').forEach(function (c) { c.classList.toggle('is-over', c === nad && c.classList.contains('is-drop-ok')); });
  }
  function qqDoc(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function nachat(d) {
    d.idet = true;
    var h = hod(naDoske[d.id], d.ot);
    var board = d.card.closest('.crm-board');
    board.classList.add('is-dragging');
    document.body.classList.add('crm-drag');
    qqDoc('.crm-board .crm-col').forEach(function (c) {
      var k = c.getAttribute('data-kolonka');
      if (k === d.ot) { c.classList.add('is-drop-home'); }
      else { c.classList.add(h && h.kolonka === k ? 'is-drop-ok' : 'is-drop-no'); }
    });
    d.card.classList.add('is-drag');
    try { d.card.setPointerCapture(d.pid); } catch (e) { /* синтетический указатель стенда */ }
  }
  function zakonchit(d) {
    var board = d.card.closest('.crm-board');
    if (board) { board.classList.remove('is-dragging'); }
    document.body.classList.remove('crm-drag');
    qqDoc('.crm-board .crm-col').forEach(function (c) { c.classList.remove('is-drop-ok', 'is-drop-no', 'is-drop-home', 'is-over'); });
    try { d.card.releasePointerCapture(d.pid); } catch (e) { /* уже отпущен */ }
  }
  /* Карточка спокойно возвращается на место, короткий переход. */
  function vernut(d, text) {
    var card = d.card;
    card.classList.remove('is-drag');
    card.classList.add('is-returning');
    card.style.transform = '';
    var done = false;
    function snyat() { if (done) { return; } done = true; card.classList.remove('is-returning'); }
    card.addEventListener('transitionend', snyat, { once: true });
    setTimeout(snyat, 300);
    if (text) { podskazka(card, text, 'net'); }
  }
  function brosit(d, x, y) {
    var col = kolonkaPod(x, y), cel = col ? col.getAttribute('data-kolonka') : null;
    zakonchit(d);
    var a = naDoske[d.id];
    if (!a || !cel || cel === d.ot) { vernut(d, ''); return; }
    var h = hod(a, d.ot);
    if (h && h.kolonka === cel && ACT[h.act](a.id)) {
      render();
      w.Shell.refresh();
      var card = document.querySelector('.crm-board .crm-card[data-apparat="' + a.id + '"]');
      if (!card) { return; }
      var svezhiy = DATA.apparat(a.id) || {}, ist = svezhiy.istoriya || [];
      var tam = card.closest('.crm-col').getAttribute('data-kolonka');
      card.classList.add('is-moved');
      setTimeout(function () { card.classList.remove('is-moved'); }, 1600);
      podskazka(card, (ist.length ? ist[ist.length - 1].chto : h.hod) +
        (tam !== cel ? '. Карточка перенесена в «' + nazvanieKolonki(tam) + '»' : '') + '.', 'ok');
      return;
    }
    vernut(d, prichina(a, cel, d.ot));
  }

  document.addEventListener('pointerdown', function (e) {
    if (drag || e.button !== 0 || e.isPrimary === false) { return; }
    var card = e.target.closest ? e.target.closest('.crm-board .crm-card') : null;
    if (!card || !mozhnoTaskat()) { return; }
    ubratPodskazku();
    var col = card.closest('.crm-col');
    drag = { card: card, id: card.getAttribute('data-apparat'), ot: col ? col.getAttribute('data-kolonka') : '',
             pid: e.pointerId, x0: e.clientX, y0: e.clientY, idet: false };
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pid) { return; }
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.idet) {
      if (Math.abs(dx) < POROG && Math.abs(dy) < POROG) { return; }
      nachat(drag);
    }
    e.preventDefault();
    drag.card.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    podsvetka(kolonkaPod(e.clientX, e.clientY));
  });
  document.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.pid) { return; }
    var d = drag; drag = null;
    if (!d.idet) { return; }
    /* Клик, который браузер пришлёт за отпусканием, — не переход в аппарат. */
    glushitKlik = true;
    setTimeout(function () { glushitKlik = false; }, 0);
    brosit(d, e.clientX, e.clientY);
  });
  function otmena() {
    if (!drag) { return; }
    var d = drag; drag = null;
    if (d.idet) { zakonchit(d); vernut(d, ''); }
  }
  document.addEventListener('pointercancel', function (e) { if (drag && e.pointerId === drag.pid) { otmena(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drag && drag.idet) { otmena(); } });
  document.addEventListener('click', function (e) {
    if (!glushitKlik) { return; }
    glushitKlik = false;
    e.preventDefault(); e.stopPropagation();
  }, true);
  /* Ссылка не должна уезжать родным перетаскиванием браузера. */
  document.addEventListener('dragstart', function (e) {
    if (e.target.closest && e.target.closest('.crm-board .crm-card')) { e.preventDefault(); }
  });

  document.addEventListener('change', function (e) {
    var id = e.target && e.target.id;
    if (id === 'crm-zak') { st.zak = e.target.value; render(); }
    else if (id === 'crm-tip') { st.tip = e.target.value; render(); }
    else if (id === 'crm-nami') { st.nami = !!e.target.checked; render(); }
  });
  w.Shell.on('crm-reset', function () { st.zak = ''; st.tip = ''; st.nami = false; render(); });
  w.Shell.on('crm-vid', function (b) { st.vid = b.getAttribute('data-vid') === 'tablica' ? 'tablica' : 'kolonki'; render(); });
  w.Shell.on('crm-vzyat', function (b) {
    if (ACT.vzyatVRabotu(b.getAttribute('data-id'))) { render(); w.Shell.refresh(); }
  });
  w.addEventListener('hashchange', render);

  render();
})(window);

/* Сводка руководителя — svodka.html. Таск 08.

   Главная генерального директора. Четыре блока, всё в штуках и тоннах, без сумм:
   запросы и образцы, заказы и риск срока, отгрузки, претензии. В каждом — ключевые числа
   (крупные фиолетовые цифры с подписью, как характеристики на сайте) и списки того, что
   требует внимания. Каждая строка ведёт в карточку; директор смотрит в них без кнопок
   ходов (у него все mozhno — false).

   Читает только DATA.svodka(): числа, списки, просрочку и риск срока считает слой данных,
   страница их рисует. Плашку «на ком шаг» и цвет просрочки решает Render.naKom.
   Ходов и кнопок на странице нет. Адрес: svodka.html, параметров нет. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'svodka', role: 'zavod' })) { return; }

  var page = document.getElementById('page');
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var NBSP = ' ';
  var S = DATA.svodka();

  document.title = 'Сводка — ' + NAZVANIE;
  if (!S) { page.innerHTML = R.pusto({ text: 'Сводка доступна руководству КЗПМ.' }); return; }

  function enc(v) { return encodeURIComponent(v); }
  function tonn(n) { return String(n).replace('.', ',') + NBSP + 'т'; }
  function ton(n) { return String(n).replace('.', ','); }
  function zakazHref(id) { return 'zakaz.html?id=' + enc(id); }

  /* --- общие куски ----------------------------------------------------------------------- */
  function chislo(key, v, t, cls) {
    return '<div class="chislo' + (cls ? ' ' + cls : '') + '" data-stat="' + key + '"><span class="chislo__v">' + esc(String(v)) + '</span>' +
      '<span class="chislo__t">' + esc(t) + '</span></div>';
  }
  function blok(key, title, body, more) {
    return '<section class="card sv-blok" data-blok="' + key + '" aria-labelledby="sv-' + key + '-h">' +
      '<div class="section__head"><h2 class="h2" id="sv-' + key + '-h">' + esc(title) + '</h2>' +
      '<a class="link-more" href="' + esc(more.href) + '">' + esc(more.title) + ' →</a></div>' + body + '</section>';
  }
  function sub(title) { return '<h3 class="h3 sv-sub">' + esc(title) + '</h3>'; }
  /* Список под своим именем data-spisok: таблица или пустое состояние. */
  function spisok(name, list, tablica, pustoText) {
    return '<div class="sv-spisok" data-spisok="' + name + '">' + (list.length ? tablica(list) : R.pusto({ text: pustoText })) + '</div>';
  }
  function zakazchik(x) { return esc(x && x.kratko ? x.kratko : ''); }
  function nakom(r) { return R.naKom(r, { srok: { podpis: 'до', data: r.srok } }); }
  function dni(r) { return esc(R.dney(r.dney)); }
  function link(r, text) { return '<a class="sv-link" href="' + esc(r.href) + '" data-id="' + esc(r.id) + '">' + esc(text || r.title) + '</a>'; }

  /* --- 1. Запросы и образцы -------------------------------------------------------------- */
  function zaprosy() {
    var z = S.zaprosy;
    var cols = [
      { key: 'title', title: 'Запрос или образец', width: '27%', render: function (r) { return link(r); } },
      { key: 'zakazchik', title: 'Заказчик', width: '16%', render: function (r) { return zakazchik(r.zakazchik); } },
      { key: 'shag', title: 'Шаг', width: '19%', render: function (r) { return esc(r.shag); } },
      { key: 'nakom', title: 'На ком шаг', width: '27%', render: nakom },
      { key: 'dney', title: 'Дней на этапе', width: '11%', nowrap: true, render: dni }
    ];
    return blok('zaprosy', 'Запросы и образцы',
      '<div class="chisla sv-chisla">' +
        chislo('novyh', z.novyh, R.plural(z.novyh, 'новый запрос', 'новых запроса', 'новых запросов')) +
        chislo('laboratoriya', z.vLaboratorii, R.plural(z.vLaboratorii, 'запрос в лаборатории', 'запроса в лаборатории', 'запросов в лаборатории')) +
        chislo('ispytaniya', z.naIspytaniyah, R.plural(z.naIspytaniyah, 'образец на испытаниях у заказчика', 'образца на испытаниях у заказчиков', 'образцов на испытаниях у заказчиков')) +
        chislo('odobreno', z.odobrenoZaMesyats, R.plural(z.odobrenoZaMesyats, 'образец одобрен за месяц', 'образца одобрено за месяц', 'образцов одобрено за месяц')) +
      '</div>' + sub('Просроченные запросы и образцы') +
      spisok('prosrocheny', z.prosrocheny, function (list) {
        return R.table({ cols: cols, rows: list, rowHref: function (r) { return r.href; }, rowClass: function () { return 'sv-row--overdue'; } });
      }, 'Просроченных запросов и образцов нет.'),
      { href: 'produkty.html', title: 'Все запросы и образцы' });
  }

  /* --- 2. Заказы и риск срока ------------------------------------------------------------ */
  /* Только этапы, на которых сейчас есть заказы: этапы всех видов продукции с нулями читаются как шум. */
  function etapy(z) {
    var est = z.poEtapam.filter(function (e) { return e.n > 0; });
    if (!est.length) { return R.pusto({ text: 'Заказов в работе нет.' }); }
    return '<ol class="sv-etapy" aria-label="Заказы по этапам">' + est.map(function (e) {
      return '<li class="sv-etap" data-etap="' + esc(e.id) + '"><span class="sv-etap__n">' + e.n + '</span> ' +
        '<span class="sv-etap__t">' + esc(e.title) + '</span></li>';
    }).join('') + '</ol>';
  }
  function zakazy() {
    var z = S.zakazy, risk = z.riskSroka;
    var cols = [
      { key: 'title', title: 'Заказ', width: '26%', render: function (r) { return link(r); } },
      { key: 'zakazchik', title: 'Заказчик', width: '15%', render: function (r) { return zakazchik(r.zakazchik); } },
      { key: 'etap', title: 'Этап и шаг', width: '22%', render: function (r) {
        return esc(r.etapTitle) + ' <span class="sv-sub-t">' + esc(r.shag) + '</span>';
      } },
      { key: 'nakom', title: 'На ком шаг', width: '26%', render: nakom },
      { key: 'dney', title: 'Дней на этапе', width: '11%', nowrap: true, render: dni }
    ];
    return blok('zakazy', 'Заказы и риск срока',
      '<div class="chisla sv-chisla">' +
        chislo('vrabote', z.vRabote, R.plural(z.vRabote, 'заказ в работе', 'заказа в работе', 'заказов в работе')) +
        chislo('risk', risk.length, R.plural(risk.length, 'заказ с риском срока', 'заказа с риском срока', 'заказов с риском срока'), risk.length ? 'is-overdue' : '') +
      '</div>' + sub('Заказы по этапам') + etapy(z) +
      sub('Заказы, где текущий этап просрочен против плана') +
      spisok('risk', risk, function (list) {
        return R.table({ cols: cols, rows: list, rowHref: function (r) { return r.href; }, rowClass: function () { return 'sv-row--overdue'; } });
      }, 'Заказов с риском срока нет.'),
      { href: 'zakazy.html', title: 'Все заказы' });
  }

  /* --- 3. Отгрузки ----------------------------------------------------------------------- */
  /* Полоса «факт к плану» — только рисунок: числа приходят из DATA. */
  function polosa(d) {
    var p = d.plan > 0 ? Math.min(100, Math.round(d.fakt / d.plan * 100)) : 0;
    return '<span class="sv-bar" role="img" aria-label="' + esc('Факт ' + d.fakt + ' т из плана ' + d.plan + ' т') + '"><span class="sv-bar__fill" style="width:' + p + '%"></span></span>';
  }
  function otgruzki() {
    var o = S.otgruzki;
    var dogovory = R.table({
      cols: [
        { key: 'dogovor', title: 'Договор', width: '24%', render: function (d) {
          return '<a class="sv-link" href="otgruzki.html?dogovor=' + esc(enc(d.dogovor.id)) + '">Договор № ' + esc(d.dogovor.nomer) + '</a>';
        } },
        { key: 'zakazchik', title: 'Заказчик', width: '26%', render: function (d) { return zakazchik(d.zakazchik); } },
        { key: 'plan', title: 'План квартала, т', align: 'right', nowrap: true, width: '16%', render: function (d) { return esc(ton(d.plan)); } },
        { key: 'fakt', title: 'Факт квартала, т', align: 'right', nowrap: true, width: '16%', render: function (d) { return esc(ton(d.fakt)); } },
        { key: 'bar', title: 'Факт к плану', width: '18%', render: polosa }
      ],
      rows: o.dogovory,
      rowHref: function (d) { return 'otgruzki.html?dogovor=' + enc(d.dogovor.id); }
    });
    function ogHref(x) { return zakazHref(x.zakazId) + '#otgruzki'; }
    function ogLink(x) { return '<a class="sv-link" href="' + esc(ogHref(x)) + '" data-otgruzka="' + esc(x.id) + '">Отгрузка № ' + esc(x.nomer) + '</a>' +
      ' <span class="sv-sub-t">Заказ № ' + esc(x.zakazNomer) + '</span>'; }
    var vputi = function (list) {
      return R.table({
        cols: [
          { key: 'otgruzka', title: 'Отгрузка', width: '24%', render: ogLink },
          { key: 'zakazchik', title: 'Заказчик', width: '26%', render: function (x) { return zakazchik(x.zakazchik); } },
          { key: 'vagon', title: 'Вагон', width: '24%', render: function (x) {
            return x.vagon ? 'Вагон № ' + esc(x.vagon.nomer) + (x.vagon.stantsiya ? ' <span class="sv-sub-t">Станция назначения: ' + esc(x.vagon.stantsiya) + '</span>' : '') : '—';
          } },
          { key: 'eta', title: 'Прибытие', width: '17%', render: function (x) {
            return x.vagon && x.vagon.eta ? esc(R.data(x.vagon.eta)) + ' <span class="sv-sub-t">' + esc(R.data(x.vagon.eta, { format: 'rel' })) + '</span>' : '—';
          } },
          { key: 'obem', title: 'Объём', nowrap: true, width: '9%', render: function (x) { return esc(tonn(x.obem)); } }
        ],
        rows: list,
        rowHref: ogHref
      });
    };
    var samovyvoz = function (list) {
      return R.table({
        cols: [
          { key: 'otgruzka', title: 'Отгрузка', width: '24%', render: ogLink },
          { key: 'zakazchik', title: 'Заказчик', width: '26%', render: function (x) { return zakazchik(x.zakazchik); } },
          { key: 'okno', title: 'Окно', width: '24%', render: function (x) {
            var ok = x.samovyvoz.okno;
            return esc(R.data(ok.data) + (ok.s && ok.po ? ', ' + ok.s + '–' + ok.po : '')) + ' <span class="sv-sub-t">' + esc(R.data(ok.data, { format: 'rel' })) + '</span>';
          } },
          { key: 'ploshchadka', title: 'Площадка', width: '17%', render: function (x) {
            var s = x.samovyvoz, pl = s.ploshchadka;
            return esc(pl ? pl.adres : '') + (s.vorota ? ' <span class="sv-sub-t">' + esc(s.vorota) + '</span>' : '');
          } },
          { key: 'obem', title: 'Объём', nowrap: true, width: '9%', render: function (x) { return esc(tonn(x.obem)); } }
        ],
        rows: list,
        rowHref: ogHref
      });
    };
    return blok('otgruzki', 'Отгрузки',
      '<div class="chisla sv-chisla">' +
        chislo('plan', tonn(o.plan), 'План квартала по договорам') +
        chislo('fakt', tonn(o.fakt), 'Факт квартала: отгружено и в пути') +
        chislo('vputi', tonn(o.vPutiTonn), 'Сейчас в пути') +
      '</div>' + sub('По договорам') +
      spisok('dogovory', o.dogovory, function () { return dogovory; }, 'Договоров с графиком отгрузок нет.') +
      sub('В пути сейчас') + spisok('vputi', o.vPuti, vputi, 'Отгрузок в пути сейчас нет.') +
      sub('Ближайшие окна самовывоза') + spisok('samovyvoz', o.samovyvoz, samovyvoz, 'Ближайших окон самовывоза нет.'),
      { href: 'otgruzki.html', title: 'График отгрузок' });
  }

  /* --- 4. Претензии ---------------------------------------------------------------------- */
  function pretenzii() {
    var p = S.pretenzii;
    var vidy = '<ul class="sv-vidy" aria-label="По видам проблем">' + p.poVidam.map(function (v) {
      return '<li class="sv-vid" data-vid="' + esc(v.vid) + '"><span class="sv-vid__t">' + esc(v.title) + '</span> <span class="sv-vid__n">' + v.n + '</span></li>';
    }).join('') + '</ul>';
    var tablica = function (list) {
      return R.table({
        cols: [
          { key: 'title', title: 'Претензия', width: '22%', render: function (r) { return link(r); } },
          { key: 'zakazchik', title: 'Заказчик', width: '15%', render: function (r) { return zakazchik(r.zakazchik); } },
          { key: 'vid', title: 'Вид и шаг', width: '23%', render: function (r) {
            return esc(r.vidTitle) + ' <span class="sv-sub-t">' + esc(r.shag) + '</span>';
          } },
          { key: 'nakom', title: 'На ком шаг', width: '27%', render: nakom },
          { key: 'bezotveta', title: 'Без ответа', width: '13%', render: function (r) {
            return r.dneyBezOtveta === null || r.dneyBezOtveta === undefined ? '—' : esc(R.dney(r.dneyBezOtveta) + ' без ответа');
          } }
        ],
        rows: list,
        rowHref: function (r) { return r.href; }
      });
    };
    return blok('pretenzii', 'Претензии',
      '<div class="chisla sv-chisla">' +
        chislo('otkrytyh', p.otkrytyh, R.plural(p.otkrytyh, 'открытая претензия', 'открытые претензии', 'открытых претензий')) +
        chislo('dni', p.maxDneyBezOtveta, R.plural(p.maxDneyBezOtveta, 'день', 'дня', 'дней') + ' без ответа у самой давней претензии') +
      '</div>' +
      (p.otkrytye.length
        ? sub('По видам проблем') + vidy + sub('Открытые претензии') + spisok('otkrytye', p.otkrytye, tablica, '')
        : R.pusto({ text: 'Открытых претензий нет.' })),
      { href: 'pretenzii.html', title: 'Все претензии' });
  }

  /* --- экран ----------------------------------------------------------------------------- */
  /* Число заказчиков — из DATA.svodka(): масштаб сводки читается как подключённая часть завода. */
  page.innerHTML = R.shapka({
    label: 'Руководство КЗПМ',
    title: 'Сводка',
    lead: 'Состояние на ' + esc(R.data(S.na, { format: 'full' })) + '. Объёмы указаны в тоннах.' +
      '<span class="sv-zakazchikov" data-zakazchikov="' + esc(String(S.zakazchikov)) + '">Заказчиков в кабинете: ' + esc(String(S.zakazchikov)) + '</span>'
  }) + '<div class="sv-bloki">' + zaprosy() + zakazy() + otgruzki() + pretenzii() + '</div>';
})(window);

/* Продукты и образцы — produkty.html. Владелец — таск 04 (сценарий А).

   Заказчик: «Продукты и образцы» — карточки как в каталоге сайта, отдельно «В отработке»
   (образец идёт от запроса до одобрения) и «В поставке» (продукт одобрен, по нему
   оформляются заказы), и кнопка «Запросить расчёт и образец».
   Сотрудник КЗПМ и директор: «Запросы и образцы» — очередь всех заказчиков таблицей,
   у каждой строки на ком шаг и сколько дней продукт на этапе.

   Читает только DATA.produkty (заказчик видит своё предприятие, сотрудник — всё).
   Ходов на странице нет: запрос оформляется в zapros-novyy.html, ходы по продукту —
   в его карточке. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'produkty' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var KARTINKI = {
    'ffs-meshki': 'ffs-meshki.png', 'ffs-plenka': 'ffs-plenka.png', 'stretch-hood': 'stretch-hood.png',
    termousadka: 'termousadka.png', kolpaki: 'kolpaki.png', carbolen: 'carbolen.jpg', kamlen: 'kamlen.jpg'
  };

  function href(p) { return 'produkt.html?id=' + encodeURIComponent(p.id); }
  /* Где продукт сейчас: этап отработки; у одобренного с печатью — согласование макета. */
  function gde(p) {
    if (p.etap === 'odobren' && p.maket && !p.maket.soglasovano) { return 'Согласование макета печати'; }
    return p.etap === 'odobren' ? 'Одобрен' : 'Этап «' + p.etapTitle + '»';
  }
  function zakazov(p) {
    var n = (p.zakazy || []).length;
    return n ? n + ' ' + R.plural(n, 'заказ', 'заказа', 'заказов') : 'заказов пока нет';
  }

  /* --- заказчик: карточки как в каталоге сайта ---------------------------------- */
  function kartinka(p) {
    var f = KARTINKI[p.tip];
    return f
      ? '<img src="assets/img/katalog/' + f + '" alt="" width="300" height="300">'
      : '<span class="pk-karta__net">' + esc(p.tipTitle) + '</span>';
  }
  function karta(p) {
    var otrabotka = p.gruppa === 'otrabotka';
    var meta = otrabotka
      ? p.tipTitle + ' · ' + gde(p)
      : p.tipTitle + ' · ' + zakazov(p);
    return '<a class="card card--link pk-karta" href="' + esc(href(p)) + '" data-produkt="' + esc(p.id) + '" data-gruppa="' + esc(p.gruppa) + '">' +
      '<span class="card__img">' + kartinka(p) + '<span class="card__more">Подробнее →</span></span>' +
      '<span class="card__title">' + esc(p.nazvanie) + '</span>' +
      '<span class="card__meta">' + esc(meta) + '</span>' +
      (otrabotka && p.naKom
        ? '<span class="pk-karta__shag">' + R.naKom(p) + '<span class="pk-karta__dni">' + esc(p.dneyNaEtape === 0 ? 'Этап начат сегодня' : R.dney(p.dneyNaEtape) + ' на этапе') + '</span></span>'
        : '') +
      '</a>';
  }
  function gruppaZakazchika(id, title, list, pustoText) {
    return '<section class="section pk-gruppa" id="' + id + '" aria-labelledby="' + id + '-h">' +
      '<div class="section__head"><h2 class="h2" id="' + id + '-h">' + esc(title) + '</h2>' +
        '<span class="muted pk-gruppa__n">' + list.length + '</span></div>' +
      (list.length
        ? '<div class="grid grid--4 pk-karty">' + list.map(karta).join('') + '</div>'
        : R.pusto({ text: pustoText, action: id === 'pk-otrabotka' ? { label: 'Запросить расчёт и образец', href: 'zapros-novyy.html' } : null })) +
      '</section>';
  }
  function dlyaZakazchika(list) {
    var head = '<div class="page-head"><div class="page-head__main"><h1 class="h1">Продукты и образцы</h1>' +
      '<p class="page-lead">В разделе собраны образцы вашего предприятия в отработке и продукты в поставке.</p></div>' +
      '<div class="page-head__actions"><a class="btn btn--primary" href="zapros-novyy.html">Запросить расчёт и образец</a></div></div>';
    if (!list.length) {
      return head + R.pusto({
        text: 'Продуктов и образцов пока нет. Запросите расчёт и образец, и продукт появится здесь на этапе «Запрос».',
        action: { label: 'Запросить расчёт и образец', href: 'zapros-novyy.html' }
      });
    }
    var otr = list.filter(function (p) { return p.gruppa === 'otrabotka'; });
    var pos = list.filter(function (p) { return p.gruppa === 'postavka'; });
    return head +
      gruppaZakazchika('pk-otrabotka', 'В отработке', otr, 'Продуктов в отработке нет. Запросите расчёт и образец, чтобы начать отработку нового продукта.') +
      gruppaZakazchika('pk-postavka', 'В поставке', pos, 'Продуктов в поставке пока нет. Продукт появится здесь, когда образец будет одобрен.');
  }

  /* --- сотрудник КЗПМ и директор: очередь всех заказчиков ------------------------ */
  function tablica(list, pustoText) {
    return R.table({
      cols: [
        { key: 'nazvanie', title: 'Продукт', width: '25%', render: function (p) {
          return '<a class="pk-tablica__nazvanie" href="' + esc(href(p)) + '">' + esc(p.nazvanie) + '</a><span class="pk-tablica__tip">' + esc(p.tipTitle) + '</span>';
        } },
        { key: 'zakazchik', title: 'Заказчик', width: '20%', render: function (p) { return esc(p.zakazchik ? p.zakazchik.name : ''); } },
        { key: 'etap', title: 'Этап', width: '17%', render: function (p) {
          return '<span class="pk-tablica__etap">' + esc(gde(p)) + '</span>' + (p.gruppa === 'otrabotka' ? R.etapy(p, { mini: true }) : '');
        } },
        { key: 'shag', title: 'На ком шаг', width: '27%', render: function (p) {
          return p.naKom ? R.naKom(p) + '<span class="pk-tablica__shag">' + esc(p.shag || '') + '</span>' : '<span class="muted">Открытых шагов нет</span>';
        } },
        { key: 'dni', title: 'Дней на этапе', align: 'right', width: '11%', render: function (p) { return p.naKom ? esc(String(p.dneyNaEtape)) : '—'; } }
      ],
      rows: list,
      rowHref: href,
      empty: pustoText
    });
  }
  function dlyaSotrudnika(list) {
    var otr = list.filter(function (p) { return p.gruppa === 'otrabotka'; });
    var pos = list.filter(function (p) { return p.gruppa === 'postavka'; });
    var zaNami = otr.filter(function (p) { return p.naKom === 'zavod'; }).length;
    var zhdem = otr.filter(function (p) { return p.naKom === 'zakazchik'; }).length;
    return '<div class="page-head"><div class="page-head__main"><h1 class="h1">Запросы и образцы</h1>' +
      '<p class="page-lead">В списке запросы и образцы всех заказчиков. По каждому видно, на ком следующий шаг и сколько дней продукт на этапе.</p></div></div>' +
      '<div class="chisla pk-chisla">' +
        '<div class="chislo"><span class="chislo__v">' + zaNami + '</span><span class="chislo__t">' + esc(R.plural(zaNami, 'шаг за КЗПМ', 'шага за КЗПМ', 'шагов за КЗПМ')) + '</span></div>' +
        '<div class="chislo"><span class="chislo__v">' + zhdem + '</span><span class="chislo__t">' + esc(R.plural(zhdem, 'шаг за заказчиком', 'шага за заказчиком', 'шагов за заказчиком')) + '</span></div>' +
        '<div class="chislo"><span class="chislo__v">' + pos.length + '</span><span class="chislo__t">' + esc(R.plural(pos.length, 'продукт в поставке', 'продукта в поставке', 'продуктов в поставке')) + '</span></div>' +
      '</div>' +
      '<section class="section pk-gruppa" id="pk-otrabotka" aria-labelledby="pk-otrabotka-h"><div class="section__head"><h2 class="h2" id="pk-otrabotka-h">В отработке</h2>' +
        '<span class="muted pk-gruppa__n">' + otr.length + '</span></div>' +
        '<div class="card pk-tablica">' + tablica(otr, 'Запросов и образцов в отработке нет.') + '</div></section>' +
      '<section class="section pk-gruppa" id="pk-postavka" aria-labelledby="pk-postavka-h"><div class="section__head"><h2 class="h2" id="pk-postavka-h">В поставке</h2>' +
        '<span class="muted pk-gruppa__n">' + pos.length + '</span></div>' +
        '<div class="card pk-tablica">' + tablica(pos, 'Продуктов в поставке нет.') + '</div></section>';
  }

  document.title = (zavod ? 'Запросы и образцы' : 'Продукты и образцы') + ' — ' + NAZVANIE;
  var list = DATA.produkty() || [];
  page.innerHTML = zavod ? dlyaSotrudnika(list) : dlyaZakazchika(list);
})(window);

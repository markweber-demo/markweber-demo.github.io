/* Отгрузки по рамочному договору — otgruzki.html. Сценарий Г. Таск 06.

   График на 13 недель вокруг текущей: план по неделям из договора, отгружено
   (груз получен), в пути, запланировано, итог плана и факта. Ниже отгрузки
   договора по группам: в пути, запланированы, получены. У каждой ушедшей отгрузки
   вагон с номером или окно самовывоза с площадкой и три закрывающих документа
   с превью: УПД, транспортная накладная, паспорт качества партии.

   Заказчик видит договор своего предприятия; у заказчика без договора пустое
   состояние с пояснением. Сотрудник и директор выбирают договор из списка.
   Читает только DATA: недели, суммы, итог квартала и документы отгрузки считает
   слой данных, здесь они только выводятся. Ходов на экране нет.

   Адрес: otgruzki.html?dogovor=<id>. Без параметра — договор предприятия
   (у сотрудника — первый из списка). Документ открывает Prevyu по ссылке #doc=<id>. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'otgruzki' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var NBSP = ' ';
  var st = { dogovor: R.param('dogovor') };

  /* Порядок закрывающих документов отгрузки на экране. */
  var PORYADOK_DOK = ['upd', 'nakladnaya', 'pasport'];
  var GRUPPY = [['v-puti', 'В пути'], ['plan', 'Запланированы'], ['poluchena', 'Получены']];
  var STATUS = { plan: 'badge--work', 'v-puti': 'badge--work', poluchena: 'badge--done' };

  function enc(v) { return encodeURIComponent(v); }
  function tonn(n) { return String(n).replace('.', ',') + NBSP + 'т'; }
  /* ноль в колонке графика — прочерк: строка читается быстрее */
  function ton(n) { return n ? String(n).replace('.', ',') : '—'; }
  /* «16 октября, через 3 дня» */
  function denIKogda(iso) { return iso ? R.data(iso) + ', ' + R.data(iso, { format: 'rel' }) : '—'; }
  /* «12–18 октября» или «28 сентября – 4 октября» */
  function nedelya(n) {
    var a = R.data(n.nedelya), b = R.data(n.do);
    return a.split(/\s+/)[1] === b.split(/\s+/)[1] ? parseInt(a, 10) + '–' + b : a + ' – ' + b;
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }

  /* --- какой договор показывать ---------------------------------------------------- */
  /* Договоры, видимые смотрящему: у заказчика один или ни одного, у сотрудника все. */
  function dogovory() {
    return (DATA.zakazchiki() || []).filter(function (z) { return !!z.dogovorId; })
      .map(function (z) { return DATA.dogovor(z.dogovorId); }).filter(Boolean);
  }
  function kroshki() {
    return me.rol === 'direktor' ? [{ title: 'Сводка', href: 'svodka.html' }, { title: 'Отгрузки' }] : [];
  }

  /* --- шапка и выбор договора ------------------------------------------------------- */
  function shapka(d) {
    var dok = (d.dokumenty || [])[0];
    return R.shapka({
      crumbs: kroshki(),
      label: 'Договор поставки № ' + d.nomer + (d.zakazchik ? ' · ' + d.zakazchik.name : ''),
      title: 'Отгрузки по рамочному договору',
      lead: 'Договор действует с ' + R.data(d.s, { format: 'full' }) + ' по ' + R.data(d.po, { format: 'full' }) + '.',
      side: dok ? '<a class="btn btn--secondary btn--sm" href="#doc=' + esc(enc(dok.id)) + '">Открыть договор</a>' : ''
    });
  }
  function vybor(spisok, d) {
    if (!zavod) { return ''; }
    return '<div class="tabs og-dogovory" role="group" aria-label="Договор">' + spisok.map(function (x) {
      var on = x.id === d.id;
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" data-act="og-dogovor" data-id="' + esc(x.id) + '" aria-pressed="' + on + '">' +
        'Договор № ' + esc(x.nomer) + (x.zakazchik ? ' · ' + esc(x.zakazchik.kratko) : '') + '</button>';
    }).join('') + '</div>';
  }

  /* --- график по неделям -------------------------------------------------------------- */
  function chislo(key, v, t) {
    return '<div class="chislo" data-stat="' + key + '"><span class="chislo__v">' + esc(tonn(v)) + '</span><span class="chislo__t">' + esc(t) + '</span></div>';
  }
  /* Полоса недели: отгружено, в пути, запланировано и отметка плана на одной шкале
     для всех недель. Доли — только для рисунка, суммы приходят из DATA. */
  function polosa(n, shkala) {
    function pr(v) { return Math.round(v / shkala * 1000) / 10; }
    function seg(cls, v) { return v ? '<span class="og-bar__seg og-bar__seg--' + cls + '" style="width:' + pr(v) + '%"></span>' : ''; }
    return '<div class="og-bar" role="img" aria-label="' + esc('План ' + n.plan + ' т, отгружено ' + n.otgruzheno + ' т, в пути ' + n.vPuti + ' т, запланировано ' + n.zaplanirovano + ' т') + '">' +
      seg('poluchena', n.otgruzheno) + seg('v-puti', n.vPuti) + seg('zaplan', n.zaplanirovano) +
      (n.plan ? '<span class="og-bar__plan" style="left:' + pr(n.plan) + '%"></span>' : '') + '</div>';
  }
  function grafik(d) {
    var g = d.grafik, it = g.itog;
    var shkala = Math.max(1, Math.max.apply(null, g.nedeli.map(function (n) { return Math.max(n.plan, n.otgruzheno + n.vPuti + n.zaplanirovano); })));
    var tabl = R.table({
      cols: [
        { key: 'nedelya', title: 'Неделя', nowrap: true, render: function (n) {
          return '<span class="og-nedelya" data-nedelya="' + esc(n.nedelya) + '">' + esc(nedelya(n)) + '</span>' +
            (n.status === 'tekushchaya' ? ' <span class="badge badge--work og-sejchas">Эта неделя</span>' : '');
        } },
        { key: 'plan', title: 'План, т', align: 'right', render: function (n) { return ton(n.plan); } },
        { key: 'otgruzheno', title: 'Отгружено, т', align: 'right', render: function (n) { return ton(n.otgruzheno); } },
        { key: 'vputi', title: 'В пути, т', align: 'right', render: function (n) { return ton(n.vPuti); } },
        { key: 'zaplanirovano', title: 'Запланировано, т', align: 'right', render: function (n) { return ton(n.zaplanirovano); } },
        { key: 'bar', title: 'План и факт', render: function (n) { return polosa(n, shkala); } },
        { key: 'og', title: 'Отгрузки', render: function (n) {
          return n.otgruzki.map(function (o) { return '<a href="#og-' + esc(o.id) + '">' + esc(o.nomer) + '</a>'; }).join(', ');
        } }
      ],
      rows: g.nedeli,
      rowClass: function (n) { return 'og-row og-row--' + n.status + (n.status === 'tekushchaya' ? ' is-hl' : ''); }
    });
    var itogo = '<tfoot><tr class="og-itogo"><th scope="row" data-col="nedelya">Итого</th>' +
      '<td class="is-right" data-col="plan">' + ton(it.plan) + '</td><td class="is-right" data-col="otgruzheno">' + ton(it.otgruzheno) + '</td>' +
      '<td class="is-right" data-col="vputi">' + ton(it.vPuti) + '</td><td class="is-right" data-col="zaplanirovano">' + ton(it.zaplanirovano) + '</td>' +
      '<td data-col="bar"></td><td data-col="og"></td></tr></tfoot>';
    return '<section class="card og-blok" id="grafik" aria-labelledby="grafik-h">' +
      '<h2 class="h2 og-blok__h" id="grafik-h">График отгрузок</h2>' +
      '<p class="og-period">Квартал с ' + esc(R.data(g.s)) + ' по ' + esc(R.data(g.po)) + '. План по неделям взят из договора, объёмы указаны в тоннах.</p>' +
      '<div class="chisla og-chisla">' +
        chislo('plan', it.plan, 'План квартала по договору') +
        chislo('fakt', it.fakt, 'Факт квартала: отгружено и в пути') +
        chislo('vputi', it.vPuti, 'Сейчас в пути') +
        chislo('zaplanirovano', it.zaplanirovano, 'Запланировано до конца квартала') +
      '</div>' +
      '<p class="og-legend">' +
        '<span class="og-legend__i"><span class="og-swatch og-swatch--poluchena" aria-hidden="true"></span>Отгружено: груз получен заказчиком.</span>' +
        '<span class="og-legend__i"><span class="og-swatch og-swatch--v-puti" aria-hidden="true"></span>В пути: груз отправлен, получение не подтверждено.</span>' +
        '<span class="og-legend__i"><span class="og-swatch og-swatch--zaplan" aria-hidden="true"></span>Запланировано: отгрузка назначена на неделю.</span>' +
        '<span class="og-legend__i"><span class="og-swatch og-swatch--plan" aria-hidden="true"></span>Отметка плана недели.</span>' +
      '</p>' +
      tabl.replace('</tbody></table>', '</tbody>' + itogo + '</table>') + '</section>';
  }

  /* --- отгрузки ------------------------------------------------------------------------- */
  function dokumenty(o, note) {
    if (o.status === 'plan') {
      return '<p class="og-card__note">' + esc((note ? note + ' ' : '') + 'Закрывающие документы оформляются при отгрузке. Это УПД, транспортная накладная и паспорт качества партии.') + '</p>';
    }
    var list = (o.dokumenty || []).slice().sort(function (a, b) { return PORYADOK_DOK.indexOf(a.tip) - PORYADOK_DOK.indexOf(b.tip); });
    if (!list.length) { return ''; }
    return '<p class="label og-card__dok-h">Закрывающие документы</p><ul class="og-dok">' + list.map(function (d) {
      return '<li class="og-dok__item" data-dok="' + esc(d.id) + '" data-tip="' + esc(d.tip) + '"><a href="#doc=' + esc(enc(d.id)) + '">' + esc(d.title) + '</a>' +
        '<span class="og-dok__meta">' + esc(R.data(d.data, { format: 'doc' })) + '</span></li>';
    }).join('') + '</ul>';
  }
  function karta(o) {
    var rows = [], title, note = '';
    rows.push(['Заказ', '<a href="zakaz.html?id=' + esc(enc(o.zakazId)) + '">Заказ № ' + esc(o.zakazNomer) + '</a>' + (o.produkt ? ', ' + esc(o.produkt.nazvanie) : '')]);
    var nomerVZagolovke = !(o.vagon && o.vagon.nomer) && !(o.samovyvoz && o.samovyvoz.okno && o.samovyvoz.okno.data);
    if (!nomerVZagolovke) { rows.push(['Отгрузка', '№ ' + esc(o.nomer)]); }
    if (o.vagon && o.vagon.nomer) {
      title = 'Вагон № <span class="num">' + esc(o.vagon.nomer) + '</span>';
      rows.push(['Станция назначения', esc(o.vagon.stantsiya)]);
      if (o.status !== 'poluchena') { rows.push(['Ожидаемая дата прибытия', esc(denIKogda(o.vagon.eta))]); }
      rows.push(['Отгружен', esc(R.data(o.data))]);
    } else if (o.samovyvoz && o.samovyvoz.okno && o.samovyvoz.okno.data) {
      var sv = o.samovyvoz, ok = sv.okno, pl = sv.ploshchadka;
      title = 'Окно самовывоза';
      rows.push(['Дата', esc(denIKogda(ok.data))]);
      if (ok.s && ok.po) { rows.push(['Время', esc('с ' + ok.s + ' до ' + ok.po)]); }
      if (pl) { rows.push(['Площадка', '<span class="og-card__pl">' + esc(pl.gorod) + '</span><span class="og-card__adres">' + esc(pl.adres) + '</span>']); }
      rows.push(['Ворота', esc(sv.vorota || '')]);
    } else {
      title = 'Отгрузка № ' + esc(o.nomer);
      rows.push(['Плановая дата', esc(denIKogda(o.data))]);
      note = o.sposob === 'samovyvoz' ? 'Окно самовывоза КЗПМ назначит на этапе «Отгрузка».' : 'Номер вагона и станцию назначения КЗПМ укажет на этапе «Отгрузка».';
    }
    if (o.partii.length) {
      rows.push([o.partii.length > 1 ? 'Партии' : 'Партия', esc(o.partii.map(function (p) { return '№ ' + p.nomer + ', ' + tonn(p.obem); }).join('; '))]);
    } else { rows.push(['Объём', esc(tonn(o.obem))]); }
    if (o.status === 'poluchena') { rows.push(['Получена', esc(R.data(o.dataPolucheniya))]); }
    return '<li class="og-card" id="og-' + esc(o.id) + '" data-otgruzka="' + esc(o.id) + '" data-status="' + esc(o.status) + '" data-sposob="' + esc(o.vagon && o.vagon.nomer ? 'vagon' : o.sposob) + '">' +
      '<div class="og-card__main"><div class="og-card__head"><p class="og-card__title">' + title + '</p>' +
        '<span class="badge ' + (STATUS[o.status] || 'badge--neutral') + '">' + esc(o.statusTitle) + '</span></div>' +
        kv(rows) + '</div>' +
      '<div class="og-card__dok">' + dokumenty(o, note) + '</div></li>';
  }
  function otgruzki(d) {
    var list = DATA.otgruzki({ dogovorId: d.id }) || [];
    var body;
    if (!list.length) { body = R.pusto({ text: 'Отгрузок по этому договору пока нет.' }); }
    else {
      body = GRUPPY.map(function (g) {
        var v = list.filter(function (o) { return o.status === g[0]; });
        if (g[0] === 'poluchena') { v = v.slice().reverse(); }
        return v.length ? '<section class="og-gruppa" data-gruppa="' + g[0] + '"><h3 class="h3 og-gruppa__h"><span class="og-gruppa__title">' + esc(g[1]) +
          '</span> <span class="og-gruppa__n">' + v.length + '</span></h3><ul class="og-spisok">' + v.map(karta).join('') + '</ul></section>' : '';
      }).join('');
    }
    return '<section class="card og-blok" id="otgruzki" aria-labelledby="otgruzki-h"><h2 class="h2 og-blok__h" id="otgruzki-h">Отгрузки по договору</h2>' + body + '</section>';
  }

  /* --- экран ---------------------------------------------------------------------------- */
  function risovat() {
    var spisok = dogovory(), d = null;
    if (!st.dogovor) { d = spisok[0] || null; }
    else {
      for (var i = 0; i < spisok.length; i++) { if (spisok[i].id === st.dogovor) { d = spisok[i]; } }
      if (!d) {
        document.title = 'Нет доступа — ' + NAZVANIE;
        page.innerHTML = zavod
          ? R.nedostupno({ title: 'Договор не найден', text: 'Договора с таким номером в кабинете нет.', href: 'otgruzki.html', label: 'Все договоры' })
          : R.nedostupno({ text: 'Этот договор относится к другому предприятию или его нет в кабинете. Отгрузки вашего предприятия собраны в разделе «Отгрузки».',
            href: 'otgruzki.html', label: 'Мои отгрузки' });
        return;
      }
    }
    document.title = 'Отгрузки — ' + NAZVANIE;
    if (!d) {
      page.innerHTML = R.shapka({ crumbs: kroshki(), label: zavod ? '' : me.predpriyatie, title: 'Отгрузки' }) + R.pusto(zavod
        ? { text: 'Рамочных договоров с графиком отгрузок в кабинете нет.' }
        : { text: 'У вашего предприятия нет рамочного договора с графиком отгрузок. Вагон или окно самовывоза по каждому заказу указаны в карточке заказа.',
          action: { label: 'Заказы', href: 'zakazy.html' } });
      return;
    }
    page.innerHTML = shapka(d) + vybor(spisok, d) + grafik(d) + '<div class="og-ryad">' + otgruzki(d) + '</div>';
  }

  Shell.on('og-dogovor', function (b) {
    st.dogovor = b.getAttribute('data-id') || '';
    risovat();
  });

  risovat();
  w.Prevyu.mount();
})(window);

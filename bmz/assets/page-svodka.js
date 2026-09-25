/* Сводка для руководства завода — svodka.html. Таск 11.
   Четыре блока: воронка в цифрах, на ком шаг, производство, повторные продажи.
   Все числа и списки считает DATA.svodka(); страница только рисует и ведёт
   к деталям. Ходов на странице нет. Читает только DATA. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA;

  if (!w.Shell.mount({ active: 'svodka', role: 'zavod' })) { return; }

  var S = DATA.svodka();
  var page = document.getElementById('page');
  if (!S) { page.innerHTML = R.pusto({ text: 'Сводка доступна заводу' }); return; }

  function n(v) { return '<span class="mono">' + esc(String(v)) + '</span>'; }
  function apparatHref(a, hash) { return 'apparat.html?id=' + encodeURIComponent(a.id) + (hash ? '#' + hash : ''); }
  function zakazchikLink(z) {
    return z ? '<a href="zakazchik.html?id=' + encodeURIComponent(z.id) + '">' + esc(z.name) + '</a>' : '—';
  }
  function apparatCell(a) {
    return '<span class="sv-a__name">' + esc(a.nazvanie) + '</span>' +
      '<span class="sv-a__poz mono">' + esc(a.techPoz || a.zavNomer || '') + '</span>';
  }
  function plitka(key, v, t, cls) {
    return '<div class="plitka' + (cls ? ' ' + cls : '') + '" data-stat="' + key + '">' +
      '<span class="plitka__v mono">' + esc(String(v)) + '</span><span class="plitka__t">' + esc(t) + '</span></div>';
  }
  function blok(key, title, body, hint) {
    return '<section class="card sv-blok" data-blok="' + key + '">' +
      '<div class="card__head"><h2 class="sec-title">' + esc(title) + '</h2></div>' +
      (hint ? '<p class="sv-hint">' + esc(hint) + '</p>' : '') +
      '<div class="card__body">' + body + '</div></section>';
  }

  /* 1. Воронка в цифрах: этапы воронки, как колонки crm.html. */
  function voronka() {
    var v = S.voronka, max = 1;
    v.kolonki.forEach(function (k) { if (k.n > max) { max = k.n; } });
    var d = v.dogovor;
    var stats = '<div class="plitki sv-stats">' +
      plitka('v-rabote', v.vsego, R.plural(v.vsego, 'аппарат в работе', 'аппарата в работе', 'аппаратов в работе')) +
      plitka('dogovor', d.dolya === null ? '—' : d.dolya + ' %', 'дошли до договора: ' + d.doshli + ' из ' + d.iz) +
    '</div>';
    var rows = '<ol class="sv-vor">' + v.kolonki.map(function (k) {
      var w1 = Math.round(k.n * 100 / max);
      return '<li class="sv-vor__row' + (k.dolgiy ? ' is-dolgiy' : '') + '" data-kolonka="' + esc(k.kolonka) + '" data-n="' + k.n + '">' +
        '<span class="sv-vor__title">' + esc(k.title) + '</span>' +
        '<span class="sv-vor__bar" aria-hidden="true"><span class="sv-vor__fill" style="width:' + w1 + '%"></span></span>' +
        '<span class="sv-vor__n mono">' + k.n + '</span>' +
        '<span class="sv-vor__dney">' + (k.dneySredn === null ? '<span class="muted">—</span>'
          : 'в среднем ' + n(k.dneySredn) + ' ' + esc(R.plural(k.dneySredn, 'день', 'дня', 'дней')) + ' на этапе') +
          (k.dolgiy ? ' <span class="badge badge--warn">дольше всех</span>' : '') + '</span>' +
      '</li>';
    }).join('') + '</ol>';
    return blok('voronka', 'Воронка заявок', stats + rows + '<p class="sv-more"><a href="crm.html">Открыть воронку</a></p>');
  }

  /* 2. На ком шаг: сколько ждёт завод, сколько заказчик, три самых долгих ожидания. */
  function shagi() {
    var s = S.shagi;
    var stats = '<div class="plitki sv-stats">' +
      plitka('zavod', s.zavod.n, 'ждут завод, просрочено ' + s.zavod.prosrocheno, s.zavod.prosrocheno ? 'is-danger' : '') +
      plitka('zakazchik', s.zakazchik.n, 'ждут заказчика, просрочено ' + s.zakazchik.prosrocheno, s.zakazchik.prosrocheno ? 'is-danger' : '') +
    '</div>';
    var tbl = R.table({
      cols: [
        { key: 'apparat', title: 'Аппарат', render: apparatCell },
        { key: 'zakazchik', title: 'Заказчик', render: function (a) { return zakazchikLink(a.zakazchik); } },
        { key: 'nakom', title: 'На ком шаг', render: function (a) { return R.naKom(a); } },
        { key: 'dney', title: 'Дней на этапе', align: 'right', render: function (a) { return n(a.dneyNaEtape); } }
      ],
      rows: s.dolgie,
      rowHref: function (a) { return apparatHref(a); },
      rowClass: function (a) { return a.prosrocheno ? 'is-overdue' : ''; },
      empty: 'Открытых шагов нет'
    });
    return blok('shagi', 'На ком шаг', stats + '<h3 class="sv-sub">Дольше всех на этапе</h3>' + tbl);
  }

  /* 3. Производство: по этапам, плановая отгрузка, риск срока по датам этапов. */
  function proizvodstvo() {
    var p = S.proizvodstvo;
    var stats = '<div class="plitki sv-stats">' + p.etapy.map(function (e) {
      return plitka(e.id, e.n, e.title);
    }).join('') + '</div>';
    var tbl = R.table({
      cols: [
        { key: 'apparat', title: 'Аппарат', render: apparatCell },
        { key: 'zakazchik', title: 'Заказчик', render: function (a) { return zakazchikLink(a.zakazchik); } },
        { key: 'etap', title: 'Этап', render: function (a) {
          return esc(a.etapTitle) + (a.srokEtapa ? '<span class="sv-rel">план до ' + esc(R.data(a.srokEtapa)) + '</span>' : '');
        } },
        { key: 'otgruzka', title: 'Плановая отгрузка', nowrap: true, render: function (a) {
          return (a.otgruzka ? '<time datetime="' + esc(a.otgruzka) + '">' + esc(R.data(a.otgruzka, { format: 'doc' })) + '</time>' : '—') +
            (a.riskSroka ? ' <span class="badge badge--danger" data-risk="1">риск срока</span>' : '');
        } }
      ],
      rows: p.apparaty,
      rowHref: function (a) { return apparatHref(a, 'proizvodstvo'); },
      rowClass: function (a) { return a.riskSroka ? 'is-overdue' : ''; },
      empty: 'В производстве аппаратов нет'
    });
    return blok('proizvodstvo', 'Производство', stats + tbl);
  }

  /* 4. Повторные продажи: одна строка на аппарат, ближайшие по дате; счётчики — по всему парку. */
  function povtornye() {
    var p = S.povtornye;
    var stats = '<div class="plitki sv-stats">' +
      plitka('osvid', p.osvid, R.plural(p.osvid, 'освидетельствование', 'освидетельствования', 'освидетельствований')) +
      plitka('garantii', p.garantii, R.plural(p.garantii, 'окончание гарантии', 'окончания гарантии', 'окончаний гарантии')) +
    '</div>';
    function den(iso) { return '<time datetime="' + esc(iso) + '">' + esc(R.data(iso, { format: 'doc' })) + '</time>'; }
    var tbl = R.table({
      cols: [
        { key: 'apparat', title: 'Аппарат', render: function (r) { return apparatCell(r.apparat); } },
        { key: 'zakazchik', title: 'Заказчик', render: function (r) { return zakazchikLink(r.apparat.zakazchik); } },
        { key: 'chto', title: 'Повод', render: function (r) {
          return r.povody.map(function (x) {
            return '<span class="sv-povod" data-povod="' + esc(x.vid) + '">' + esc(x.title) +
              (x.date !== r.date ? '<span class="sv-povod__d">, ' + den(x.date) + '</span>' : '') + '</span>';
          }).join('');
        } },
        { key: 'kogda', title: 'Когда', nowrap: true, render: function (r) {
          return den(r.date) + '<span class="sv-rel">' + esc(R.data(r.date, { format: 'rel' })) + '</span>';
        } }
      ],
      rows: p.blizhayshie,
      rowHref: function (r) { return 'pasport.html?id=' + encodeURIComponent(r.apparat.id); },
      empty: 'В ближайшие полгода освидетельствований и конца гарантии нет'
    });
    var eshchyo = p.eshchyo
      ? '<p class="sv-more" data-eshchyo="' + p.eshchyo + '"><a href="zakazchiki.html">Ещё ' + p.eshchyo + ' — в карточках заказчиков</a></p>' : '';
    return blok('povtornye', 'Повторные продажи', stats + tbl + eshchyo,
      'По каждой дате можно предложить заказчику ремонт, ЗИП или замену аппарата.');
  }

  page.innerHTML =
    '<header class="page-head page-head--zavod">' +
      '<div><p class="label">Руководство завода</p>' +
        '<h1 class="h1">Сводка</h1>' +
        '<p class="page-lead">Заявки, производство и парк заказчиков на ' + esc(R.data(S.na, { format: 'full' })) + '.</p></div>' +
    '</header>' +
    '<div class="sv-grid">' + voronka() + shagi() + '</div>' +
    proizvodstvo() +
    povtornye() +
    '<p class="sv-dengi" data-blok="dengi">Деньги: портфель договоров, отгрузки, дебиторская задолженность — после интеграции с 1С.</p>';
})(window);

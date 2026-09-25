/* Карточка заказчика — zakazchik.html?id=. Таск 07.
   Контакты, парк аппаратов БМЗ с подсветкой «повод связаться»,
   открытые заявки мини-воронкой, история по всем его аппаратам.
   Читает только DATA. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA;

  if (!w.Shell.mount({ active: 'zakazchiki', role: 'zavod' })) { return; }

  var OSVID = (DATA.spravochnik() || {}).vidyOsvid || {};
  var ISTORIYA_SRAZU = 12;

  var z = DATA.zakazchik(R.param('id'));
  var page = document.getElementById('page');
  var vsyaIstoriya = false;

  /* Ближайшее освидетельствование аппарата — признак из данных; здесь только подписи видов. */
  function blizh(a) {
    var b = a.osvidBlizh;
    return b ? { date: b.date, dney: b.dney, vidy: b.vidy.map(function (v) { return OSVID[v] ? OSVID[v].strochno : v; }) } : null;
  }
  function otkrytyeObr(a) { return (a.obrashcheniya || []).filter(function (o) { return o.status !== 'zakryto'; }).length; }

  function kontakty() {
    var list = z.contacts || [];
    if (!list.length) { return R.pusto({ text: 'Контактов нет' }); }
    return '<ul class="zk-kont">' + list.map(function (p) {
      return '<li class="zk-kont__i" data-kontakt="' + esc(p.id) + '">' +
        '<p class="zk-kont__name">' + esc(p.name) + ' <span class="badge badge--neutral badge--plain">демо</span></p>' +
        '<p class="zk-kont__pos">' + esc(p.position) + '</p>' +
        (p.ustanovka ? '<p class="zk-kont__ust">' + esc(p.ustanovka) + '</p>' : '') +
        '<p class="zk-kont__cont"><span class="mono">' + esc(p.phone) + '</span> · ' + esc(p.email) + '</p>' +
      '</li>';
    }).join('') + '</ul>';
  }

  function park(list) {
    var rows = list.map(function (a) { return { a: a, b: blizh(a) }; }).sort(function (p, q) {
      var x = p.b ? p.b.dney : Infinity, y = q.b ? q.b.dney : Infinity;
      return x < y ? -1 : x > y ? 1 : String(p.a.techPoz).localeCompare(String(q.a.techPoz), 'ru');
    });
    function skoro(r) { return r.a.povodSvyazatsya; }
    return R.table({
      cols: [
        { key: 'apparat', title: 'Аппарат', render: function (r) { return '<span class="zk-name">' + esc(r.a.nazvanie) + '</span>'; } },
        { key: 'obozn', title: 'Обозначение', render: function (r) { return '<span class="mono zk-obozn">' + esc(r.a.oboznachenie) + '</span>'; } },
        { key: 'poz', title: 'Техпозиция', render: function (r) {
          return '<span class="mono">' + esc(r.a.techPoz) + '</span><span class="zk-rel">' + esc(r.a.ustanovka) + '</span>';
        } },
        { key: 'god', title: 'Поставка', align: 'right', render: function (r) { return '<span class="mono">' + esc(String((r.a.postavka || {}).vvod || '').slice(0, 4) || '—') + '</span>'; } },
        { key: 'garantiya', title: 'Гарантия до', nowrap: true, render: function (r) {
          var g = r.a.garantiya;
          if (!g) { return '—'; }
          return esc(R.data(g.do, { format: 'doc' })) + (g.status === 'expired' ? '<span class="zk-rel">истекла</span>' : '<span class="zk-rel">идёт</span>');
        } },
        { key: 'osvid', title: 'Ближайшее освидетельствование', render: function (r) {
          if (!r.b) { return '<span class="muted">—</span>'; }
          return '<time datetime="' + esc(r.b.date) + '">' + esc(R.data(r.b.date, { format: 'doc' })) + '</time>' +
            ' <span class="zk-rel zk-rel--in">' + esc(R.data(r.b.date, { format: 'rel' })) + '</span>' +
            '<span class="zk-rel">' + esc(r.b.vidy.join(', ')) + '</span>' +
            (skoro(r) ? '<span class="badge badge--warn zk-povod">повод связаться</span>' : '');
        } },
        { key: 'obr', title: 'Открытые обращения', align: 'right', render: function (r) {
          var n = otkrytyeObr(r.a);
          return n ? '<span class="badge badge--info">' + n + '</span>' : '<span class="mono muted">0</span>';
        } }
      ],
      rows: rows,
      rowHref: function (r) { return 'pasport.html?id=' + encodeURIComponent(r.a.id); },
      rowClass: function (r) { return skoro(r) ? 'is-hl' : ''; },
      empty: { text: 'Поставленных аппаратов БМЗ нет' }
    });
  }

  function miniVoronka() {
    var vor = DATA.voronka({ zakazchikId: z.id }) || [];
    var n = vor.reduce(function (s, k) { return s + k.apparaty.length; }, 0);
    if (!n) { return R.pusto({ text: 'Открытых заявок нет', action: { label: 'Вся воронка', href: 'crm.html' } }); }
    return '<ol class="zk-vor">' + vor.map(function (k) {
      return '<li class="zk-vor__col' + (k.apparaty.length ? ' is-full' : '') + '" data-kolonka="' + esc(k.kolonka) + '">' +
        '<p class="zk-vor__head"><span>' + esc(k.title) + '</span><span class="mono">' + k.apparaty.length + '</span></p>' +
        k.apparaty.map(function (a) {
          return '<a class="zk-vor__a" href="apparat.html?id=' + esc(encodeURIComponent(a.id)) + '" data-apparat="' + esc(a.id) + '">' +
            '<span class="mono">' + esc(a.techPoz) + '</span> ' + esc(a.nazvanie) +
            '<span class="zk-rel">' + esc(R.dney(a.dneyNaEtape)) + ' на этапе</span>' + R.naKom(a) + '</a>';
        }).join('') +
      '</li>';
    }).join('') + '</ol>';
  }

  function istoriya(all) {
    var ev = [];
    all.forEach(function (a) {
      (a.istoriya || []).forEach(function (h) { ev.push({ date: h.date, kto: h.kto, chto: h.chto, a: a }); });
    });
    ev.sort(function (p, q) { return p.date < q.date ? 1 : p.date > q.date ? -1 : 0; });
    if (!ev.length) { return R.pusto({ text: 'Событий пока нет' }); }
    var pokaz = vsyaIstoriya ? ev : ev.slice(0, ISTORIYA_SRAZU);
    return '<ul class="events zk-ist" data-n="' + ev.length + '">' + pokaz.map(function (h) {
      var dt = String(h.date).indexOf('T') > -1 ? R.data(h.date, { format: 'docTime' }) : R.data(h.date, { format: 'doc' });
      return '<li class="events__item"><span class="events__date"><time datetime="' + esc(h.date) + '">' + esc(dt) + '</time></span>' +
        '<span><a href="apparat.html?id=' + esc(encodeURIComponent(h.a.id)) + '" class="mono">' + esc(h.a.techPoz) + '</a> ' + esc(h.chto) +
        '<span class="events__who">' + esc([h.kto && h.kto.name, h.kto && h.kto.predpriyatie].filter(Boolean).join(' · ')) + '</span></span></li>';
    }).join('') + '</ul>' +
    (ev.length > ISTORIYA_SRAZU && !vsyaIstoriya
      ? '<p class="zk-more"><button class="btn btn--secondary btn--sm" type="button" data-act="zk-ist">Показать всю историю · ' + ev.length + '</button></p>' : '');
  }

  function render() {
    if (!z) {
      page.innerHTML = '<nav class="crumbs" aria-label="Путь"><a href="zakazchiki.html">Заказчики</a></nav>' +
        '<div class="page-head"><h1 class="h1">Заказчик не найден</h1></div>' +
        R.pusto({ text: 'Такого заказчика нет в демо-данных.', action: { label: 'Все заказчики', href: 'zakazchiki.html' } });
      return;
    }
    page.setAttribute('data-zakazchik', z.id);
    var all = DATA.apparaty({ zakazchikId: z.id }) || [];
    var postavleny = all.filter(function (a) { return a.postavlen; });
    var p = z.park;
    function stat(key, v, t) { return '<div class="crm-stat" data-stat="' + key + '"><span class="crm-stat__v mono">' + v + '</span><span class="crm-stat__t">' + esc(t) + '</span></div>'; }
    page.innerHTML =
      '<nav class="crumbs" aria-label="Путь"><a href="zakazchiki.html">Заказчики</a><span>' + esc(z.name) + '</span></nav>' +
      '<header class="page-head crm-head zk-head">' +
        '<div><p class="label">' + esc(z.group) + ' · ' + esc(z.city) + '</p>' +
          '<h1 class="h1">' + esc(z.name) + '</h1>' +
          '<p class="crm-demo">Предприятие настоящее. Аппараты, даты и люди выдуманы, данные демонстрационные.</p></div>' +
        '<div class="crm-stats">' +
          stat('park', p.vEkspluatacii, 'в эксплуатации') +
          stat('zayavki', p.otkrytyhZayavok, 'открытых заявок') +
          stat('povod', p.povodov, 'освидетельствований в ближайшие полгода') +
          stat('obr', p.obrashcheniy, 'обращений в сервисе') +
        '</div>' +
      '</header>' +
      '<section class="card zk-kontakty"><div class="card__head"><h2 class="crm-sec-title">Контакты</h2>' +
        '<span class="zk-rel">люди заказчика выдуманы</span></div>' +
        '<div class="card__body">' + kontakty() + '</div></section>' +
      '<section class="card zk-park"><div class="card__head"><h2 class="crm-sec-title">Парк аппаратов БМЗ</h2>' +
        '<span class="zk-rel">Жёлтым отмечено освидетельствование в ближайшие шесть месяцев, это повод связаться. Периодичность в демо-данных условная.</span></div>' +
        park(postavleny) + '</section>' +
      '<section class="card zk-zayavki"><div class="card__head"><h2 class="crm-sec-title">Открытые заявки</h2>' +
        '<a class="btn btn--ghost btn--sm" href="crm.html?zak=' + esc(encodeURIComponent(z.id)) + '">В воронке</a></div>' +
        '<div class="card__body">' + miniVoronka() + '</div></section>' +
      '<section class="card zk-istoriya"><div class="card__head"><h2 class="crm-sec-title">История</h2>' +
        '<span class="zk-rel">по всем аппаратам заказчика</span></div>' +
        '<div class="card__body">' + istoriya(all) + '</div></section>';
  }

  w.Shell.on('zk-ist', function () { vsyaIstoriya = true; render(); });

  render();
})(window);

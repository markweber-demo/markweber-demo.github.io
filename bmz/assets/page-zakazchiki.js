/* Заказчики — zakazchiki.html. Таск 07.
   Таблица с парком, по умолчанию отсортирована по ближайшему
   освидетельствованию: это повод для следующей продажи. Поиск по названию.
   Читает только DATA. Параметр ?q= — начальный запрос поиска. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA;

  if (!w.Shell.mount({ active: 'zakazchiki', role: 'zavod' })) { return; }

  var q = R.param('q');
  /* Сверху — у кого раньше освидетельствование: дни до него посчитаны в данных. */
  var vse = (DATA.zakazchiki() || []).slice().sort(function (a, b) {
    var x = a.park.osvidBlizh ? a.park.osvidBlizh.dney : Infinity, y = b.park.osvidBlizh ? b.park.osvidBlizh.dney : Infinity;
    return x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name, 'ru');
  });

  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function spisok() {
    var t = norm(q).trim();
    if (!t) { return vse; }
    return vse.filter(function (z) { return norm(z.name + ' ' + z.group + ' ' + z.city).indexOf(t) > -1; });
  }

  function osvidCell(z) {
    var d = z.park.blizhOsvid;
    if (!d) { return '<span class="muted">—</span>'; }
    var skoro = z.park.povodSvyazatsya;
    return '<time datetime="' + esc(d) + '">' + esc(R.data(d, { format: 'doc' })) + '</time>' +
      '<span class="zk-rel">' + esc(R.data(d, { format: 'rel' })) + '</span>' +
      (skoro ? ' <span class="badge badge--warn zk-povod">повод связаться</span>' : '');
  }

  function tablica() {
    return R.table({
      cols: [
        { key: 'name', title: 'Предприятие', render: function (z) { return '<span class="zk-name">' + esc(z.name) + '</span>'; } },
        { key: 'group', title: 'Группа компаний' },
        { key: 'city', title: 'Город' },
        { key: 'park', title: 'Аппаратов БМЗ в эксплуатации', align: 'right', render: function (z) { return '<span class="mono">' + z.park.vEkspluatacii + '</span>'; } },
        { key: 'zayavki', title: 'Открытых заявок', align: 'right', render: function (z) { return '<span class="mono">' + z.park.otkrytyhZayavok + '</span>'; } },
        { key: 'osvid', title: 'Ближайшее освидетельствование', render: osvidCell },
        { key: 'obr', title: 'Обращений в сервисе', align: 'right', render: function (z) { return '<span class="mono">' + z.park.obrashcheniy + '</span>'; } }
      ],
      rows: spisok(),
      rowHref: function (z) { return 'zakazchik.html?id=' + encodeURIComponent(z.id); },
      rowClass: function (z) { return z.park.povodSvyazatsya ? 'is-hl' : ''; },
      empty: { text: 'Нет заказчиков по запросу «' + q + '»', action: { label: 'Сбросить поиск', act: 'zk-sbros' } }
    });
  }

  function svodka() {
    var park = 0, zay = 0, skoro = 0;
    vse.forEach(function (z) {
      park += z.park.vEkspluatacii; zay += z.park.otkrytyhZayavok;
      if (z.park.povodSvyazatsya) { skoro++; }
    });
    function s(key, v, t) { return '<div class="crm-stat" data-stat="' + key + '"><span class="crm-stat__v mono">' + v + '</span><span class="crm-stat__t">' + esc(t) + '</span></div>'; }
    return '<div class="crm-stats">' +
      s('zakazchikov', vse.length, 'заказчиков') +
      s('park', park, 'аппаратов в эксплуатации') +
      s('zayavki', zay, 'открытых заявок') +
      s('povod', skoro, R.plural(skoro, 'заказчик', 'заказчика', 'заказчиков') + ' с освидетельствованием в ближайшие полгода') +
    '</div>';
  }

  function tbody() {
    var box = document.getElementById('zk-tbl');
    if (box) { box.innerHTML = tablica(); box.setAttribute('data-n', String(spisok().length)); }
  }

  function render() {
    document.getElementById('page').innerHTML =
      '<header class="page-head crm-head">' +
        '<div><p class="label">Отдел маркетинга и продаж</p>' +
          '<h1 class="h1">Заказчики</h1>' +
          '<p class="crm-demo">Предприятия взяты из материалов завода о покупателях. Что им поставлено, выдумано, данные демонстрационные.</p></div>' +
        svodka() +
      '</header>' +
      '<div class="card zk-list">' +
        '<div class="card__head zk-list__head">' +
          '<h2 class="crm-sec-title">Парк аппаратов и освидетельствования</h2>' +
          '<label class="zk-search"><span class="label">Поиск</span>' +
            '<input class="input" type="search" id="zk-q" placeholder="Название, группа или город" value="' + esc(q) + '" autocomplete="off"></label>' +
        '</div>' +
        '<p class="zk-hint">Сверху заказчики, у которых освидетельствование аппаратов БМЗ наступает раньше всех. Жёлтым отмечены освидетельствования в ближайшие шесть месяцев, это повод предложить ремонт, ЗИП или замену.</p>' +
        '<div id="zk-tbl" class="zk-tbl" data-n="' + spisok().length + '">' + tablica() + '</div>' +
      '</div>';
  }

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'zk-q') { q = e.target.value; tbody(); }
  });
  w.Shell.on('zk-sbros', function () {
    q = '';
    var i = document.getElementById('zk-q');
    if (i) { i.value = ''; i.focus(); }
    tbody();
  });

  render();
})(window);

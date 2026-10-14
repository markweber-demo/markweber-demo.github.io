/* Очередь — ochered.html. Таск 08.

   Рабочий стол сотрудника КЗПМ: всё, где следующий шаг за КЗПМ, по сроку — запросы и образцы,
   макеты, заказы, претензии. У строки тип, заказчик, шаг, срок (с просрочкой красным) и дни
   на этапе; под шагом — кто из сотрудников его делает. Фильтр по типу — вкладки. Каждая строка
   ведёт в карточку. У службы сервиса домашняя — претензии, но очередь ей тоже открыта;
   директор смотрит очередь без ходов (ходов на странице нет ни у кого).

   Читает только DATA.ochered(): состав, порядок по сроку, срок и просрочку отдаёт слой
   данных, страница ничего не пересчитывает. После хода строка уходит сама: на следующем
   открытии шаг уже за другой стороной. Плашку и просрочку решает Render.naKom.

   Адрес: ochered.html?tip=produkt|maket|zakaz|pretenziya. Без параметра — вся очередь. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'ochered', role: 'zavod' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var NBSP = '\u00a0';
  /* Вкладки по типам: id — тип строки из DATA.ochered(); подпись вкладки и подпись типа в строке. */
  var TIPY = [
    { id: 'produkt', tab: 'Запросы и образцы', one: 'Запрос или образец' },
    { id: 'maket', tab: 'Макеты', one: 'Макет' },
    { id: 'zakaz', tab: 'Заказы', one: 'Заказ' },
    { id: 'pretenziya', tab: 'Претензии', one: 'Претензия' }
  ];
  /* Кто из сотрудников КЗПМ делает шаг: должности без имён. */
  var KTO = { menedzher: 'Менеджер по продажам', servis: 'Служба сервиса' };

  function tipOf(id) {
    for (var i = 0; i < TIPY.length; i++) { if (TIPY[i].id === id) { return TIPY[i]; } }
    return null;
  }
  var st = { tip: tipOf(R.param('tip')) ? R.param('tip') : '' };

  /* --- данные ---------------------------------------------------------------------------- */
  function otfiltrovano(all) {
    return st.tip ? all.filter(function (r) { return r.tip === st.tip; }) : all;
  }
  function chisla(all) {
    var late = all.filter(function (r) { return r.prosrocheno; }).length;
    function c(key, v, t, cls) {
      return '<div class="chislo' + (cls ? ' ' + cls : '') + '" data-stat="' + key + '"><span class="chislo__v">' + v + '</span>' +
        '<span class="chislo__t">' + esc(t) + '</span></div>';
    }
    return '<div class="chisla oc-chisla">' +
      c('vsego', all.length, R.plural(all.length, 'шаг за КЗПМ', 'шага за КЗПМ', 'шагов за КЗПМ')) +
      c('prosrocheno', late, R.plural(late, 'шаг просрочен', 'шага просрочено', 'шагов просрочено'), late ? 'is-overdue' : '') +
      '</div>';
  }

  /* --- шапка и вкладки ------------------------------------------------------------------- */
  function shapka() {
    return R.shapka({
      crumbs: me.rol === 'direktor' ? [{ title: 'Сводка', href: 'svodka.html' }, { title: 'Очередь' }] : [],
      title: 'Очередь',
      lead: 'В очереди всё, где следующий шаг за КЗПМ. Строки отсортированы по сроку, самый ранний срок вверху.'
    });
  }
  function vkladki(all) {
    var spisok = [{ id: '', tab: 'Все' }].concat(TIPY);
    return '<div class="tabs oc-tabs" role="group" aria-label="Тип">' + spisok.map(function (t) {
      var n = t.id ? all.filter(function (r) { return r.tip === t.id; }).length : all.length;
      var on = st.tip === t.id;
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" data-act="oc-tip" data-id="' + esc(t.id) + '" aria-pressed="' + on + '">' +
        '<span class="tab__name">' + esc(t.tab) + '</span>' + NBSP + '<span class="tab__count">' + n + '</span></button>';
    }).join('') + '</div>';
  }

  /* --- таблица --------------------------------------------------------------------------- */
  function tablica(list) {
    return '<div class="card oc-tablica">' + R.table({
      cols: [
        { key: 'title', title: 'Карточка', render: function (r) {
          var t = tipOf(r.tip);
          return '<a class="oc-title" href="' + esc(r.href) + '" data-tip="' + esc(r.tip) + '" data-id="' + esc(r.id) + '">' + esc(r.title) + '</a>' +
            ' <span class="oc-sub oc-sub--tip">' + esc(t ? t.one : r.tip) + '</span>';
        } },
        { key: 'tip', title: 'Тип', render: function (r) { var t = tipOf(r.tip); return esc(t ? t.one : r.tip); } },
        { key: 'zakazchik', title: 'Заказчик', render: function (r) { return esc(r.zakazchik ? r.zakazchik.kratko : ''); } },
        { key: 'shag', title: 'Шаг', render: function (r) {
          return esc(r.shag) + (KTO[r.kto] ? ' <span class="oc-sub">' + esc(KTO[r.kto]) + '</span>' : '');
        } },
        { key: 'srok', title: 'Срок', render: function (r) { return R.naKom(r, { srok: { podpis: 'до', data: r.srok } }); } },
        { key: 'dney', title: 'Дней на этапе', nowrap: true, render: function (r) { return esc(R.dney(r.dney)); } }
      ],
      rows: list,
      rowHref: function (r) { return r.href; },
      rowClass: function (r) { return 'oc-row' + (r.prosrocheno ? ' oc-row--overdue' : ''); }
    }) + '</div>';
  }

  function pusto(all) {
    if (!all.length) { return R.pusto({ text: 'Очередь пуста. Шагов за КЗПМ сейчас нет.' }); }
    return R.pusto({ text: 'Шагов этого типа за КЗПМ сейчас нет.', action: { label: 'Показать всю очередь', act: 'oc-reset' } });
  }

  /* --- экран ----------------------------------------------------------------------------- */
  function risovat() {
    document.title = 'Очередь — ' + NAZVANIE;
    var all = DATA.ochered() || [];
    var list = otfiltrovano(all);
    page.innerHTML = shapka() + chisla(all) + (all.length ? vkladki(all) : '') +
      '<div class="oc-body">' + (list.length ? tablica(list) : pusto(all)) + '</div>';
  }

  Shell.on('oc-tip', function (b) {
    var id = b.getAttribute('data-id');
    st.tip = tipOf(id) ? id : '';
    risovat();
  });
  Shell.on('oc-reset', function () { st.tip = ''; risovat(); });

  risovat();
})(window);

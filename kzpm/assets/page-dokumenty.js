/* Документы — dokumenty.html. Таск 06.

   Все документы предприятия (у сотрудника и директора — всех заказчиков) списком,
   новые сверху, с фильтром по типу. Название и вся строка открывают лист документа
   (превью, ссылка #doc=<id>), справа кнопка «Скачать», в колонке «К чему относится»
   ссылка на карточку: продукт, заказ, отгрузка, претензия или договор.

   Читает только DATA.dokumenty и справочник типов. Листы и «Скачать» — Prevyu.mount().

   Адрес: dokumenty.html. Параметры для ссылок и стендов: ?tip=<тип>, у сотрудника
   ещё ?zakazchik=<id>. Документ из адреса (#doc=<id>) открывается при загрузке. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'dokumenty' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var TIPY = DATA.spravochnik().tipyDokumentov || {};

  /* Начальное состояние — из адреса; дальше его двигают вкладки и список заказчиков. */
  var st = {
    tip: Object.prototype.hasOwnProperty.call(TIPY, R.param('tip')) ? R.param('tip') : 'vse',
    zak: zavod ? R.param('zakazchik') : ''
  };

  function enc(v) { return encodeURIComponent(v); }

  function shapka() {
    return R.shapka({
      crumbs: me.rol === 'direktor' ? [{ title: 'Сводка', href: 'svodka.html' }, { title: 'Документы' }] : [],
      label: zavod ? '' : me.predpriyatie,
      title: 'Документы',
      lead: (zavod ? 'Документы всех заказчиков по продуктам, заказам и отгрузкам. ' : 'Документы вашего предприятия по продуктам, заказам и отгрузкам. ') +
        'Лист документа открывается по щелчку на названии, скачать его можно кнопкой справа.'
    });
  }

  /* --- фильтры ------------------------------------------------------------------------ */
  /* Вкладки: «Все» и типы из справочника по порядку пути заказчика. Числа считаются
     по всем документам выбранного заказчика, а не по выбранному типу. */
  function vkladki(base) {
    var n = {};
    base.forEach(function (d) { n[d.tip] = (n[d.tip] || 0) + 1; });
    var spisok = [['vse', 'Все', base.length]].concat(Object.keys(TIPY).map(function (k) { return [k, TIPY[k], n[k] || 0]; }));
    return '<div class="tabs dk-tabs" role="group" aria-label="Тип документа">' + spisok.map(function (t) {
      var on = st.tip === t[0];
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" data-act="dk-tip" data-id="' + esc(t[0]) + '" aria-pressed="' + on + '">' +
        '<span class="tab__name">' + esc(t[1]) + '</span> <span class="tab__count">' + t[2] + '</span></button>';
    }).join('') + '</div>';
  }
  function panel() {
    return '<div class="dk-bar"><label class="dk-bar__f"><span class="label">Заказчик</span><select class="select" id="dk-zak" name="zakazchik">' +
      '<option value="">Все заказчики</option>' +
      (DATA.zakazchiki() || []).map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === st.zak ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') +
      '</select></label></div>';
  }

  /* --- таблица ------------------------------------------------------------------------ */
  function tablica(list) {
    var cols = [{ key: 'dokument', title: 'Документ', render: function (d) {
      return '<a class="dk-title" href="#doc=' + esc(enc(d.id)) + '" data-dok="' + esc(d.id) + '">' + esc(d.title) + '</a>';
    } }];
    if (zavod) { cols.push({ key: 'zakazchik', title: 'Заказчик', render: function (d) { return esc(d.zakazchik ? d.zakazchik.kratko : ''); } }); }
    cols.push({ key: 'tip', title: 'Тип', render: function (d) { return esc(d.tipTitle); } });
    cols.push({ key: 'data', title: 'Дата', nowrap: true, render: function (d) { return esc(R.data(d.data, { format: 'doc' })); } });
    cols.push({ key: 'k', title: 'К чему относится', render: function (d) {
      return d.k && d.k.href ? '<a href="' + esc(d.k.href) + '">' + esc(d.k.title) + '</a>' : esc(d.k ? d.k.title : '');
    } });
    cols.push({ key: 'file', title: 'Файл', align: 'right', render: function (d) {
      return '<button class="btn btn--secondary btn--sm" type="button" data-act="prevyu-skachat" data-id="' + esc(d.id) + '">Скачать</button>';
    } });
    /* Строка целиком открывает лист: адрес #doc=<id> ловит Prevyu. */
    return '<div class="card dk-tablica">' + R.table({ cols: cols, rows: list, rowHref: function (d) { return '#doc=' + enc(d.id); } }) + '</div>';
  }

  function pusto(base) {
    if (!base.length) {
      return R.pusto(zavod
        ? { text: 'Документов пока нет. Они появятся здесь по ходу работы над продуктами и заказами.' }
        : { text: 'Документов пока нет. Расчёт, протокол испытаний, паспорт качества и другие документы появляются в кабинете по ходу работы над продуктами и заказами.',
          action: { label: 'Продукты и образцы', href: 'produkty.html' } });
    }
    return R.pusto({ text: 'Документов этого типа пока нет. Они появятся здесь по ходу работы над продуктами и заказами.',
      action: { label: 'Показать все документы', act: 'dk-tip', id: 'vse' } });
  }

  /* --- экран -------------------------------------------------------------------------- */
  function risovat(focusId) {
    document.title = 'Документы — ' + NAZVANIE;
    var base = DATA.dokumenty(zavod && st.zak ? { zakazchikId: st.zak } : {}) || [];
    var list = st.tip === 'vse' ? base : base.filter(function (d) { return d.tip === st.tip; });
    page.innerHTML = shapka() + (zavod ? panel() : '') + (base.length ? vkladki(base) : '') +
      '<div class="dk-body">' + (list.length ? tablica(list) : pusto(base)) + '</div>';
    if (focusId) {
      var el = document.getElementById(focusId);
      if (el) { try { el.focus(); } catch (e) { /* фокус не обязателен */ } }
    }
  }

  Shell.on('dk-tip', function (b) {
    var id = b.getAttribute('data-id');
    st.tip = Object.prototype.hasOwnProperty.call(TIPY, id) ? id : 'vse';
    risovat();
  });
  page.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'dk-zak') { st.zak = e.target.value; risovat('dk-zak'); }
  });

  risovat();
  w.Prevyu.mount();
})(window);

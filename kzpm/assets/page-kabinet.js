/* Главная заказчика — kabinet.html. Таск 08.

   Первым блоком «Ждёт вас»: всё, где следующий шаг за заказчиком (согласовать макет,
   приложить протокол испытаний, подтвердить получение). Ниже заказы в работе с мини-лентой
   этапов, ближайшие отгрузки (вагон или окно самовывоза) и продукты в отработке. Каждая
   строка ведёт в свою карточку.

   Читает только DATA: «Ждёт вас» — DATA.ochered() (у заказчика это его шаги), остальное —
   DATA.zakazy, DATA.otgruzki, DATA.produkty. Своих правил доступности и сроков нет: плашку
   «на ком шаг» и просрочку решает Render.naKom (у заказчика просрочка КЗПМ не видна).
   Ходов на странице нет: они в карточках.

   Адрес: kabinet.html, параметров нет. Страница заказчика: сотрудник и директор уходят
   на свою главную (Shell.mount). */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'kabinet', role: 'zakazchik' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var NBSP = '\u00a0';
  var OTGRUZOK = 5;   /* сколько ближайших отгрузок на главной; остальные — на экране «Отгрузки» */
  var STATUS = { plan: 'badge--work', 'v-puti': 'badge--work', poluchena: 'badge--done' };

  function enc(v) { return encodeURIComponent(v); }
  function tonn(n) { return String(n).replace('.', ',') + NBSP + 'т'; }

  /* --- блок и заголовок ------------------------------------------------------------------ */
  function blok(id, title, body, more) {
    return '<section class="section kb-sec" id="' + id + '" aria-labelledby="' + id + '-h">' +
      '<div class="section__head"><h2 class="h2" id="' + id + '-h">' + esc(title) + '</h2>' +
      (more ? '<a class="link-more" href="' + esc(more.href) + '">' + esc(more.title) + ' →</a>' : '') + '</div>' + body + '</section>';
  }

  /* --- 1. Ждёт вас ----------------------------------------------------------------------- */
  /* Плашка шага: срок — «до 16 октября»; своя просрочка заказчика красная, решает Render.naKom. */
  function plashka(r) { return R.naKom(r, { srok: { podpis: 'до', data: r.srok } }); }
  function otkryt(r) { return r.dney === 0 ? 'Шаг открыт сегодня' : 'Шаг открыт ' + R.dney(r.dney) + ' назад'; }
  function stroka(r) {
    return '<li><a class="kb-row" href="' + esc(r.href) + '" data-tip="' + esc(r.tip) + '" data-id="' + esc(r.id) + '">' +
      '<span class="kb-row__main"><span class="kb-row__title">' + esc(r.title) + '</span>' +
      ' <span class="kb-row__shag">' + esc(r.shag) + '</span>' +
      ' <span class="kb-row__dni">' + esc(otkryt(r)) + '</span></span>' +
      '<span class="kb-row__side">' + plashka(r) + '<span class="link-more kb-row__go">Открыть →</span></span></a></li>';
  }
  function zhdet() {
    var rows = DATA.ochered() || [];
    if (!rows.length) {
      return blok('zhdet', 'Ждёт вас', R.pusto({ text: 'Сейчас ни один шаг не ждёт вашего решения. Когда КЗПМ понадобится ваше решение, шаг появится здесь.' }));
    }
    return blok('zhdet', 'Ждёт вас',
      '<div class="card kb-zhdet">' +
        '<div class="chislo kb-zhdet__chislo" data-stat="zhdet"><span class="chislo__v">' + rows.length + '</span>' +
          '<span class="chislo__t">' + esc(R.plural(rows.length, 'шаг ждёт вашего решения', 'шага ждут вашего решения', 'шагов ждут вашего решения')) + '</span></div>' +
        '<ul class="kb-zhdet__list">' + rows.map(stroka).join('') + '</ul></div>');
  }

  /* --- 2. Заказы в работе ---------------------------------------------------------------- */
  /* Срок шага с подписью — Zakaz.srokShaga из слоя данных: та же дата, что в «Ждёт вас» и в карточке. */
  function zakazHref(z) { return 'zakaz.html?id=' + enc(z.id); }
  function zakazy() {
    var rabota = (DATA.zakazy() || []).filter(function (z) { return z.etap !== 'polucheno'; });
    var more = { href: 'zakazy.html', title: 'Все заказы' };
    if (!rabota.length) {
      return blok('zakazy', 'Заказы в работе', R.pusto({
        text: 'Заказов в работе нет. Заказ оформляется в карточке одобренного продукта.',
        action: { label: 'Продукты и образцы', href: 'produkty.html' }
      }), more);
    }
    return blok('zakazy', 'Заказы в работе', '<div class="card kb-tablica">' + R.table({
      cols: [
        { key: 'zakaz', title: 'Заказ', width: '30%', render: function (z) {
          return '<a class="kb-zakaz" href="' + esc(zakazHref(z)) + '">Заказ № ' + esc(z.nomer) + '</a>' +
            ' <span class="kb-sub">' + esc(z.produkt ? z.produkt.nazvanie : '') + '</span>';
        } },
        { key: 'obem', title: 'Объём', nowrap: true, width: '9%', render: function (z) { return esc(tonn(z.obem)); } },
        { key: 'etap', title: 'Этап', width: '21%', render: function (z) {
          return R.etapy(z, { mini: true }) + '<span class="kb-etap">' + esc(z.etapTitle) + '</span>';
        } },
        { key: 'nakom', title: 'На ком шаг', width: '40%', render: function (z) {
          return R.naKom(z, { srok: z.srokShaga }) + (z.shag ? ' <span class="kb-sub">' + esc(z.shag) + '</span>' : '');
        } }
      ],
      rows: rabota,
      rowHref: zakazHref
    }) + '</div>', more);
  }

  /* --- 3. Ближайшие отгрузки ------------------------------------------------------------- */
  /* Сначала идущие (в пути), затем запланированные; порядок внутри — по дате, как отдаёт DATA. */
  function bliz() {
    return (DATA.otgruzki({ status: 'v-puti' }) || []).concat(DATA.otgruzki({ status: 'plan' }) || []).slice(0, OTGRUZOK);
  }
  function kak(o) {
    if (o.sposob === 'samovyvoz' && o.samovyvoz) {
      var pl = o.samovyvoz.ploshchadka;
      return '<span class="kb-og__t">Самовывоз</span>' +
        (pl ? ' <span class="kb-sub">' + esc(pl.adres) + '</span>' : '') +
        (o.samovyvoz.vorota ? ' <span class="kb-sub">' + esc(o.samovyvoz.vorota) + '</span>' : '');
    }
    if (o.vagon && o.vagon.nomer) {
      return '<span class="kb-og__t">Вагон № ' + esc(o.vagon.nomer) + '</span>' +
        (o.vagon.stantsiya ? ' <span class="kb-sub">Станция назначения: ' + esc(o.vagon.stantsiya) + '</span>' : '');
    }
    return '<span class="kb-og__t">Вагон</span> <span class="kb-sub">Номер вагона КЗПМ укажет при отправке</span>';
  }
  function kogda(o) {
    var t, iso;
    if (o.sposob === 'samovyvoz' && o.samovyvoz && o.samovyvoz.okno) {
      var ok = o.samovyvoz.okno;
      iso = ok.data;
      t = 'Окно ' + R.data(ok.data) + (ok.s && ok.po ? ', ' + ok.s + '–' + ok.po : '');
    } else if (o.status === 'v-puti' && o.vagon && o.vagon.eta) {
      iso = o.vagon.eta;
      t = 'Прибытие ' + R.data(iso);
    } else {
      iso = o.data;
      t = 'Отгрузка ' + R.data(iso);
    }
    return '<span class="kb-og__t">' + esc(t) + '</span> <span class="kb-sub">' + esc(R.data(iso, { format: 'rel' })) + '</span>';
  }
  function otgruzki() {
    var list = bliz();
    var more = { href: 'otgruzki.html', title: 'График отгрузок' };
    if (!list.length) {
      return blok('otgruzki', 'Ближайшие отгрузки', R.pusto({
        text: 'Отгрузок в пути и запланированных отгрузок нет. Они появятся здесь, когда по вашему заказу назначат вагон или окно самовывоза.'
      }), more);
    }
    return blok('otgruzki', 'Ближайшие отгрузки', '<div class="card kb-tablica">' + R.table({
      cols: [
        { key: 'otgruzka', title: 'Отгрузка', width: '27%', render: function (o) {
          return '<a class="kb-zakaz" href="' + esc(zakazHref({ id: o.zakazId }) + '#otgruzki') + '" data-otgruzka="' + esc(o.id) + '">Отгрузка № ' + esc(o.nomer) + '</a>' +
            ' <span class="kb-sub">Заказ № ' + esc(o.zakazNomer) + ', ' + esc(tonn(o.obem)) + '</span>';
        } },
        { key: 'kak', title: 'Способ получения', width: '30%', render: kak },
        { key: 'kogda', title: 'Когда', width: '25%', render: kogda },
        { key: 'status', title: 'Статус', width: '18%', render: function (o) {
          return '<span class="badge ' + (STATUS[o.status] || '') + '" data-status="' + esc(o.status) + '">' + esc(o.statusTitle) + '</span>';
        } }
      ],
      rows: list,
      rowHref: function (o) { return zakazHref({ id: o.zakazId }) + '#otgruzki'; }
    }) + '</div>', more);
  }

  /* --- 4. Продукты в отработке ----------------------------------------------------------- */
  function karta(p) {
    return '<a class="card card--link kb-karta" href="produkt.html?id=' + esc(enc(p.id)) + '" data-produkt="' + esc(p.id) + '">' +
      '<span class="kb-karta__tip">' + esc(p.tipTitle) + '</span>' +
      '<span class="card__title">' + esc(p.nazvanie) + '</span>' +
      '<span class="kb-karta__etap">' + R.etapy(p, { mini: true }) + '<span class="kb-etap">' + esc(p.etapTitle) + '</span></span>' +
      '<span class="kb-karta__shag">' + R.naKom(p, { srok: { podpis: 'до' } }) + (p.shag ? ' <span class="kb-sub">' + esc(p.shag) + '</span>' : '') + '</span>' +
      '<span class="card__more">Подробнее →</span></a>';
  }
  function otrabotka() {
    var list = DATA.produkty({ gruppa: 'otrabotka' }) || [];
    var more = { href: 'produkty.html', title: 'Все продукты и образцы' };
    if (!list.length) {
      return blok('otrabotka', 'Продукты в отработке', R.pusto({
        text: 'Продуктов в отработке нет. Запросите расчёт и образец, чтобы начать отработку нового продукта.',
        action: { label: 'Запросить расчёт и образец', href: 'zapros-novyy.html' }
      }), more);
    }
    return blok('otrabotka', 'Продукты в отработке', '<div class="grid grid--3 kb-karty">' + list.map(karta).join('') + '</div>', more);
  }

  /* --- экран ----------------------------------------------------------------------------- */
  document.title = 'Главная — ' + NAZVANIE;
  page.innerHTML = R.shapka({
    label: me.predpriyatie,
    title: 'Главная',
    lead: 'На главной собраны шаги, которые ждут вашего решения, заказы в работе, ближайшие отгрузки и продукты в отработке.',
    side: '<a class="btn btn--primary" href="zapros-novyy.html">Запросить расчёт и образец</a>'
  }) + zhdet() + zakazy() + otgruzki() + otrabotka();
})(window);

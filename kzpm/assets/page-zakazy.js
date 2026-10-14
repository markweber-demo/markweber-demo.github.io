/* Список заказов — zakazy.html. Таск 06.

   Заказчик видит заказы своего предприятия таблицей: продукт, объём, мини-лента
   этапа, на ком шаг со сроком, желаемая дата; вкладки «Все», «В работе»,
   «Получены». Сотрудник КЗПМ и директор видят заказы всех заказчиков по этапам:
   доска из шести колонок или таблица с заказчиком и днями на этапе, фильтр по
   заказчику и «Шаг за КЗПМ». Перетаскивания нет: этап двигается в карточке заказа.

   Читает только DATA, пишет ничего: ходов на списке нет. Просрочку и то, кому
   она видна, решает Render.naKom; «риск срока» и дни на этапе приходят из DATA
   признаками. Заказчик внутренних признаков КЗПМ не видит.

   Адрес: zakazy.html. Параметры для ссылок и стендов (только у сотрудника):
   ?zakazchik=<id>&nami=1&vid=tablica|kolonki. У заказчика: ?tab=vse|rabota|polucheny. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, Shell = w.Shell;

  if (!Shell.mount({ active: 'zakazy' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var NBSP = ' ';
  var TABY = ['vse', 'rabota', 'polucheny'];

  /* Состояние экрана. Начальные значения берутся из адреса, дальше их двигают
     фильтры на странице; у заказчика фильтров сотрудника нет, параметры не действуют. */
  var st = {
    zak: zavod ? R.param('zakazchik') : '',
    nami: zavod && R.param('nami') === '1',
    vid: R.param('vid') === 'tablica' ? 'tablica' : 'kolonki',
    tab: TABY.indexOf(R.param('tab')) > -1 ? R.param('tab') : 'vse'
  };

  /* Колонки доски — группы этапов. У типов продукта этапы производства разные
     (экструзия, печать, изготовление, резка, ламинирование, компаундирование),
     поэтому они сведены в одну колонку «Производство»; точное название этапа
     остаётся на карточке. Остальные колонки названы этапами из справочника. */
  var KOLONKI = ['prinyata', 'proizvodstvo', 'kontrol', 'otgruzka', 'v-puti', 'polucheno'];

  function tonn(n) { return String(n).replace('.', ',') + NBSP + 'т'; }
  function enc(v) { return encodeURIComponent(v); }
  function href(z) { return 'zakaz.html?id=' + enc(z.id); }
  function otkryt(z) { return z.etap !== 'polucheno'; }

  function nazvanieEtapa(id) {
    var lenta = (DATA.spravochnik().etapyZakaza || {}).ffs || [];
    for (var i = 0; i < lenta.length; i++) { if (lenta[i].id === id) { return lenta[i].title; } }
    return id;
  }
  function titleKolonki(id) { return id === 'proizvodstvo' ? 'Производство' : nazvanieEtapa(id); }
  function kolonkaZakaza(z) { return KOLONKI.indexOf(z.etap) > -1 && z.etap !== 'proizvodstvo' ? z.etap : 'proizvodstvo'; }

  /* Срок шага с подписью — Zakaz.srokShaga из слоя данных, тот же, что в карточке заказа
     и в «Ждёт вас». Просрочку и то, кому она видна, решает Render.naKom. */
  function dataPolucheniya(z) {
    var posled = (z.etapy || [])[z.etapy.length - 1];
    return posled ? posled.date : null;
  }
  /* «На ком шаг» с текстом шага; у полученного заказа — дата получения. */
  function shag(z) {
    if (!otkryt(z)) {
      return R.naKom(z) + '<span class="zy-shag">Заказ получен ' + esc(R.data(dataPolucheniya(z))) + '</span>';
    }
    return R.naKom(z, { srok: z.srokShaga }) + (z.shag ? '<span class="zy-shag">' + esc(z.shag) + '</span>' : '');
  }
  function etap(z) { return R.etapy(z, { mini: true }) + '<span class="zy-etap">' + esc(z.etapTitle) + '</span>'; }
  function dni(z) { return otkryt(z) ? R.dney(z.dneyNaEtape || 0) : '—'; }
  function risk(z) { return z.riskSroka && zavod ? '<span class="badge badge--overdue zy-risk">Риск срока</span>' : ''; }

  /* --- данные ------------------------------------------------------------------------ */
  function vse() { return DATA.zakazy({}) || []; }
  function otfiltrovano(all) {
    if (!zavod) {
      return all.filter(function (z) { return st.tab === 'rabota' ? otkryt(z) : st.tab === 'polucheny' ? !otkryt(z) : true; });
    }
    if (!st.zak && !st.nami) { return all; }
    var opts = {};
    if (st.zak) { opts.zakazchikId = st.zak; }
    if (st.nami) { opts.naMne = true; }
    return DATA.zakazy(opts) || [];
  }
  function filtrAktiven() { return zavod && (!!st.zak || st.nami); }

  /* --- шапка и ключевые числа --------------------------------------------------------- */
  function shapka() {
    return R.shapka({
      crumbs: me.rol === 'direktor' ? [{ title: 'Сводка', href: 'svodka.html' }, { title: 'Заказы' }] : [],
      label: zavod ? '' : me.predpriyatie,
      title: 'Заказы',
      lead: zavod ? 'Заказы всех заказчиков разложены по этапам. Перевести заказ на следующий этап можно в его карточке.'
        : 'Для каждого заказа видно, на каком он этапе, чей сейчас шаг и к какой дате.'
    });
  }
  function chislo(key, v, t, cls) {
    return '<div class="chislo' + (cls ? ' ' + cls : '') + '" data-stat="' + key + '"><span class="chislo__v">' + v + '</span>' +
      '<span class="chislo__t">' + esc(t) + '</span></div>';
  }
  function chisla(all) {
    var rabota = all.filter(otkryt).length;
    if (!zavod) {
      var zhdut = all.filter(function (z) { return z.naKom === 'zakazchik'; }).length;
      return '<div class="chisla zy-chisla">' +
        chislo('rabota', rabota, R.plural(rabota, 'заказ в работе', 'заказа в работе', 'заказов в работе')) +
        chislo('zhdut', zhdut, R.plural(zhdut, 'заказ ждёт вас', 'заказа ждут вас', 'заказов ждут вас')) +
        chislo('polucheny', all.length - rabota, R.plural(all.length - rabota, 'заказ получен', 'заказа получено', 'заказов получено')) +
        '</div>';
    }
    var kmzp = all.filter(function (z) { return z.naKom === 'zavod'; }).length;
    var rs = all.filter(function (z) { return z.riskSroka; }).length;
    return '<div class="chisla zy-chisla">' +
      chislo('rabota', rabota, R.plural(rabota, 'заказ в работе', 'заказа в работе', 'заказов в работе')) +
      chislo('zhdut', kmzp, R.plural(kmzp, 'шаг за КЗПМ', 'шага за КЗПМ', 'шагов за КЗПМ')) +
      chislo('risk', rs, R.plural(rs, 'заказ с риском срока', 'заказа с риском срока', 'заказов с риском срока'), rs ? 'is-overdue' : '') +
      '</div>';
  }

  /* --- фильтры ------------------------------------------------------------------------ */
  function vkladki(all) {
    var nOpen = all.filter(otkryt).length;
    var spisok = [['vse', 'Все', all.length], ['rabota', 'В работе', nOpen], ['polucheny', 'Получены', all.length - nOpen]];
    return '<div class="tabs zy-tabs" role="group" aria-label="Заказы">' + spisok.map(function (t) {
      var on = st.tab === t[0];
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" data-act="zy-tab" data-id="' + t[0] + '" aria-pressed="' + on + '">' +
        '<span class="tab__name">' + esc(t[1]) + '</span>' + NBSP + '<span class="tab__count">' + t[2] + '</span></button>';
    }).join('') + '</div>';
  }
  function panel() {
    var zakazchiki = DATA.zakazchiki() || [];
    return '<div class="zy-bar">' +
      '<label class="zy-bar__f"><span class="label">Заказчик</span><select class="select" id="zy-zak" name="zakazchik">' +
        '<option value="">Все заказчики</option>' +
        zakazchiki.map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === st.zak ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="choice zy-bar__nami"><input type="checkbox" id="zy-nami"' + (st.nami ? ' checked' : '') + '> Только шаг за КЗПМ</label>' +
      (filtrAktiven() ? '<button class="btn btn--ghost btn--sm" type="button" data-act="zy-reset">Сбросить фильтр</button>' : '') +
      '<span class="zy-bar__vid" role="group" aria-label="Вид">' + [['kolonki', 'Колонки'], ['tablica', 'Таблица']].map(function (v) {
        var on = st.vid === v[0];
        return '<button class="btn btn--sm ' + (on ? 'btn--primary' : 'btn--secondary') + '" type="button" data-act="zy-vid" data-vid="' + v[0] + '" aria-pressed="' + on + '">' + v[1] + '</button>';
      }).join('') + '</span></div>';
  }

  /* --- таблица ------------------------------------------------------------------------ */
  function zakazCell(z) {
    return '<a class="zy-zakaz" href="' + esc(href(z)) + '" data-zakaz="' + esc(z.id) + '">Заказ № ' + esc(z.nomer) + '</a>' +
      '<span class="zy-produkt">' + esc(z.produkt ? z.produkt.nazvanie : '') + '</span>' + risk(z);
  }
  function tablica(list) {
    var cols = [{ key: 'zakaz', title: 'Заказ', render: zakazCell }];
    if (zavod) { cols.push({ key: 'zakazchik', title: 'Заказчик', render: function (z) { return esc(z.zakazchik ? z.zakazchik.kratko : ''); } }); }
    cols.push({ key: 'obem', title: 'Объём', nowrap: true, render: function (z) { return esc(tonn(z.obem)); } });
    cols.push({ key: 'etap', title: 'Этап', render: etap });
    cols.push({ key: 'nakom', title: 'На ком шаг', render: shag });
    if (zavod) { cols.push({ key: 'dney', title: 'Дней на этапе', nowrap: true, render: dni }); }
    else { cols.push({ key: 'data', title: 'Желаемая дата', nowrap: true, render: function (z) { return esc(R.data(z.zhelaemayaData)); } }); }
    return '<div class="card zy-tablica">' + R.table({ cols: cols, rows: list, rowHref: href }) + '</div>';
  }

  /* --- доска -------------------------------------------------------------------------- */
  function kartochka(z) {
    return '<a class="zy-card' + (z.riskSroka ? ' is-risk' : '') + '" href="' + esc(href(z)) + '" data-zakaz="' + esc(z.id) + '" data-etap="' + esc(z.etap) + '" draggable="false">' +
      '<span class="zy-card__top"><span class="zy-card__nomer">Заказ № ' + esc(z.nomer) + '</span>' + risk(z) + '</span>' +
      '<span class="zy-card__produkt">' + esc(z.produkt ? z.produkt.nazvanie : '') + '</span>' +
      '<span class="zy-card__zakazchik">' + esc(z.zakazchik ? z.zakazchik.kratko : '') + '</span>' +
      '<span class="zy-card__obem">' + esc(tonn(z.obem)) + '</span>' +
      etap(z) + shag(z) +
      (otkryt(z) ? '<span class="zy-card__dney">' + esc(z.dneyNaEtape ? R.dney(z.dneyNaEtape) + ' на этапе' : 'Этап начат сегодня') + '</span>' : '') +
      '</a>';
  }
  /* В колонке сначала риск срока, потом по порядку, который отдаёт DATA (по плану этапа). */
  function poryadok(list) {
    return list.map(function (z, i) { return { z: z, i: i }; }).sort(function (a, b) {
      return ((b.z.riskSroka ? 1 : 0) - (a.z.riskSroka ? 1 : 0)) || (a.i - b.i);
    }).map(function (x) { return x.z; });
  }
  /* В колонке «Получено» — только последние полученные, новые сверху: история заказов
     длиннее доски, целиком она в виде «Таблица». Дата получения — та же, что на карточке. */
  var POLUCHENO_NA_DOSKE = 5;
  function kolonka(k, v) {
    var skryto = 0;
    if (k === 'polucheno' && v.length > POLUCHENO_NA_DOSKE) {
      skryto = v.length - POLUCHENO_NA_DOSKE;
      v = v.slice().sort(function (a, b) {
        var da = dataPolucheniya(a) || '', db = dataPolucheniya(b) || '';
        return da < db ? 1 : da > db ? -1 : 0;
      }).slice(0, POLUCHENO_NA_DOSKE);
    }
    return (v.length ? '<div class="zy-col__list">' + v.map(kartochka).join('') + '</div>' : '<p class="zy-col__empty">Заказов нет</p>') +
      (skryto ? '<button class="btn btn--ghost btn--sm zy-col__more" type="button" data-act="zy-vid" data-vid="tablica">Ещё ' + skryto + ' в таблице</button>' : '');
  }
  function doska(list) {
    return '<div class="zy-board">' + KOLONKI.map(function (k) {
      var v = poryadok(list.filter(function (z) { return kolonkaZakaza(z) === k; }));
      return '<section class="zy-col" data-kolonka="' + k + '"><h2 class="zy-col__head"><span class="zy-col__title">' + esc(titleKolonki(k)) + '</span>' +
        '<span class="zy-col__n">' + v.length + '</span></h2>' + kolonka(k, v) + '</section>';
    }).join('') + '</div>';
  }

  /* --- пустые состояния --------------------------------------------------------------- */
  function pusto(all) {
    if (filtrAktiven()) { return R.pusto({ text: 'Заказов по этому фильтру нет.', action: { label: 'Сбросить фильтр', act: 'zy-reset' } }); }
    if (!all.length) {
      return zavod
        ? R.pusto({ text: 'Заказов пока нет. Заказ появляется, когда заказчик оформляет заявку на одобренный продукт.' })
        : R.pusto({ text: 'Заказов пока нет. Заказ оформляется в карточке одобренного продукта.', action: { label: 'Продукты и образцы', href: 'produkty.html' } });
    }
    return R.pusto({
      text: st.tab === 'polucheny' ? 'Полученных заказов пока нет. Заказ появится здесь после того, как вы подтвердите получение груза.' : 'Заказов в работе нет.'
    });
  }

  /* --- экран -------------------------------------------------------------------------- */
  function risovat(focusId) {
    document.title = 'Заказы — ' + NAZVANIE;
    var all = vse(), list = otfiltrovano(all), telo;
    if (!list.length) { telo = pusto(all); }
    else if (zavod) { telo = st.vid === 'tablica' ? tablica(list) : doska(list); }
    else { telo = tablica(list); }
    page.setAttribute('data-vid', zavod ? st.vid : 'tablica');
    page.innerHTML = shapka() + chisla(all) + (zavod ? panel() : (all.length ? vkladki(all) : '')) + '<div class="zy-body">' + telo + '</div>';
    if (focusId) {
      var el = document.getElementById(focusId);
      if (el) { try { el.focus(); } catch (e) { /* фокус не обязателен */ } }
    }
  }

  Shell.on('zy-tab', function (b) {
    var id = b.getAttribute('data-id');
    st.tab = TABY.indexOf(id) > -1 ? id : 'vse';
    risovat();
  });
  Shell.on('zy-vid', function (b) {
    st.vid = b.getAttribute('data-vid') === 'tablica' ? 'tablica' : 'kolonki';
    risovat();
  });
  Shell.on('zy-reset', function () {
    st.zak = ''; st.nami = false; st.tab = 'vse';
    risovat();
  });
  page.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.id) { return; }
    if (el.id === 'zy-zak') { st.zak = el.value; risovat('zy-zak'); }
    else if (el.id === 'zy-nami') { st.nami = !!el.checked; risovat('zy-nami'); }
  });

  risovat();
})(window);

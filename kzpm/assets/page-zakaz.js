/* Карточка заказа — опорный экран, сценарий Б «Где мой заказ». Владелец — таск 03.

   zakaz.html?id=<заказ>[#doc=<документ>]. Одна страница на обе стороны:
   заказчик видит ленту этапов, вагоны или окно самовывоза, партии с паспортами
   качества, документы, на ком шаг и историю; на этапе «в пути» жмёт «Получено».
   Менеджер на той же карточке двигает этапы: на «контроле качества» выпускает
   партию с паспортом, на «отгрузке» указывает вагон или окно самовывоза.
   Директор смотрит без ходов. Чужой заказ у заказчика — «Нет доступа».

   Общие блоки карточки — Render.shapka, Render.etapy, Render.shag,
   Render.dokumenty, Render.istoriya, Render.nedostupno; документы — Prevyu.
   Читает DATA.zakaz, пишет ACT.sleduyushchiyEtap и ACT.polucheno; правила
   ходов — признаки mozhno из данных. Черновик формы отгрузки — Store. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, ACT = w.ACT, Shell = w.Shell, Store = w.Store;

  if (!Shell.mount({ active: 'zakazy' })) { return; }

  var page = document.getElementById('page');
  var id = R.param('id');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var KEY = 'otgruzka:' + id;     /* черновик формы отгрузки этого заказа */
  var oshibki = {};               /* ошибки формы отгрузки по полям */
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';

  function trim(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function tonn(n) { return String(n).replace('.', ',') + ' т'; }
  /* «16 октября, через 3 дня» */
  function denIKogda(iso) { return iso ? R.data(iso) + ', ' + R.data(iso, { format: 'rel' }) : '—'; }
  /* Куда ведёт крошка: «Заказы» роли, у директора — его «Сводка». */
  function spisok() {
    var nav = Shell.nav();
    for (var i = 0; i < nav.length; i++) { if (nav[i].id === 'zakazy') { return nav[i]; } }
    return nav[0] || { title: 'Заказы', href: 'zakazy.html' };
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }
  function blok(idBloka, title, body) {
    return '<section class="card zk-blok" id="' + idBloka + '" aria-labelledby="' + idBloka + '-h">' +
      '<h2 class="h2 zk-blok__h" id="' + idBloka + '-h">' + esc(title) + '</h2>' + body + '</section>';
  }

  /* --- шапка ----------------------------------------------------------------- */
  function shapka(z) {
    var s = spisok(), konets = z.etap === 'polucheno';
    var side = '<span class="badge ' + (konets ? 'badge--done' : 'badge--work') + '">' +
      esc(konets ? 'Заказ получен' : 'Этап «' + z.etapTitle + '»') + '</span>' +
      /* риск срока — внутренний план КЗПМ: его видит только сторона завода */
      (z.riskSroka && zavod ? '<span class="badge badge--overdue">Риск срока</span>' : '');
    return R.shapka({
      crumbs: [{ title: s.title, href: s.href }, { title: z.title }],
      label: [z.produkt ? z.produkt.tipTitle : '', zavod && z.zakazchik ? z.zakazchik.name : ''].filter(Boolean).join(' · '),
      title: z.title,
      lead: z.produkt ? '<a href="produkt.html?id=' + esc(encodeURIComponent(z.produkt.id)) + '">' + esc(z.produkt.nazvanie) + '</a>' : '',
      side: side
    });
  }

  /* --- лента и ходы ----------------------------------------------------------- */
  function nuzhnaForma(z) { return !!(z.mozhno && z.mozhno.sleduyushchiy && z.etap === 'otgruzka' && z.nuzhnaOtgruzka); }
  function nadpisDalee(z) {
    if (z.etap === 'kontrol') { return 'Выпустить партию с паспортом качества'; }
    if (z.etap === 'otgruzka') { return z.shag; }
    return z.dalee ? 'Начать этап «' + z.dalee.title + '»' : 'Следующий этап';
  }
  function hody(z) {
    var m = z.mozhno || {}, b = '';
    if (m.polucheno) { b += '<button class="btn btn--primary" type="button" data-act="zk-polucheno">Получено</button>'; }
    if (m.sleduyushchiy && !nuzhnaForma(z)) { b += '<button class="btn btn--primary" type="button" data-act="zk-dalee">' + esc(nadpisDalee(z)) + '</button>'; }
    return b;
  }
  function podskazka(z) {
    var m = z.mozhno || {};
    if (m.polucheno) { return 'Нажмите «Получено», когда груз будет у вас.'; }
    if (m.sleduyushchiy && z.etap === 'kontrol') { return 'Партия получит номер и паспорт качества, а заказ перейдёт на этап «Отгрузка».'; }
    return '';
  }
  /* Срок в плашке «на ком шаг» с подписью отдаёт слой данных (Zakaz.srokShaga): на «в пути»
     это прибытие последнего вагона, на остальных этапах — план этапа. Просрочку и то, кому
     она видна, решает Render.naKom: заказчик просрочку шагов КЗПМ не видит, КЗПМ видит красным. */
  function lenta(z) {
    var posled = z.etapy[z.etapy.length - 1];
    return '<section class="card zk-lenta" aria-labelledby="zk-lenta-h"><h2 class="h2 zk-blok__h" id="zk-lenta-h">Этапы заказа</h2>' +
      R.etapy(z) +
      R.shag(z, { knopki: hody(z), podskazka: podskazka(z), srok: z.srokShaga,
        gotovo: posled && z.etap === 'polucheno' ? 'Заказ получен ' + R.data(posled.date) : '' }) +
      (nuzhnaForma(z) ? '<div id="zk-forma-slot">' + forma(z) + '</div>' : '') +
      '</section>';
  }

  /* --- форма отгрузки: вагон или окно самовывоза ------------------------------ */
  function chernovik(z) {
    var d = Store.draft(KEY);
    if (!d.sposob) {
      var zk = z.zakazchik ? DATA.zakazchik(z.zakazchik.id) : null;
      d.sposob = z.sposob === 'samovyvoz' ? 'samovyvoz' : 'vagon';
      d.stantsiya = zk && zk.stantsiya ? zk.stantsiya : '';
      d = Store.setDraft(KEY, d);
    }
    return d;
  }
  function forma(z) {
    var d = chernovik(z), sp = d.sposob;
    function inp(name, type, extra) {
      return '<input class="input' + (oshibki[name] ? ' input--error' : '') + '" type="' + type + '" name="' + name + '" value="' + esc(d[name] || '') + '"' +
        (oshibki[name] ? ' aria-invalid="true"' : '') + (extra || '') + '>';
    }
    function pole(name, label, input, hint, cls) {
      var err = oshibki[name] || '';
      return '<label class="field zk-forma__pole' + (cls ? ' ' + cls : '') + '"><span class="field__label">' + esc(label) + '</span>' + input +
        (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') +
        '<span class="field__err" data-err="' + name + '" aria-live="polite"' + (err ? '' : ' hidden') + '>' + esc(err) + '</span></label>';
    }
    var polya;
    if (sp === 'vagon') {
      polya = pole('nomer', 'Номер вагона', inp('nomer', 'text', ' inputmode="numeric" maxlength="8" autocomplete="off"'), 'Восемь цифр') +
        pole('stantsiya', 'Станция назначения', inp('stantsiya', 'text', ' autocomplete="off"')) +
        pole('eta', 'Ожидаемая дата прибытия', inp('eta', 'date'), 'Если дату не указать, прибытие ожидается через три дня после отгрузки.');
    } else {
      var pl = (DATA.spravochnik().ploshchadki || []).map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (d.ploshchadka === p.id ? ' selected' : '') + '>' + esc(p.gorod + ', ' + p.title.toLowerCase()) + '</option>';
      }).join('');
      polya = pole('data', 'Дата окна', inp('data', 'date')) +
        pole('s', 'Окно с', inp('s', 'time')) +
        pole('po', 'Окно до', inp('po', 'time')) +
        pole('ploshchadka', 'Площадка', '<select class="select' + (oshibki.ploshchadka ? ' input--error' : '') + '" name="ploshchadka"' +
          (oshibki.ploshchadka ? ' aria-invalid="true"' : '') + '><option value=""' + (d.ploshchadka ? '' : ' selected') + '>Выберите площадку</option>' + pl + '</select>', '', 'zk-forma__pole--shire') +
        pole('vorota', 'Ворота', inp('vorota', 'text', ' autocomplete="off"'));
    }
    var sposoby = [['vagon', 'Вагон'], ['samovyvoz', 'Самовывоз']].map(function (b) {
      var on = sp === b[0];
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" data-act="zk-sposob" data-vid="' + b[0] + '" aria-pressed="' + on + '">' + b[1] + '</button>';
    }).join('');
    return '<form class="zk-forma" id="zk-forma" novalidate>' +
      '<p class="h3 zk-forma__title">Отгрузка</p>' +
      '<p class="zk-forma__lead">Укажите вагон или окно самовывоза. Заказчик увидит их в карточке заказа сразу после отгрузки.</p>' +
      '<div class="zk-forma__sposob" role="group" aria-label="Как заказчик получит груз">' + sposoby + '</div>' +
      '<div class="zk-forma__polya">' + polya + '</div>' +
      (oshibki.obshchaya ? '<p class="field__err zk-forma__oshibka" role="alert">' + esc(oshibki.obshchaya) + '</p>' : '') +
      '<div class="zk-forma__knopki"><button class="btn btn--primary" type="submit" data-act="zk-otgruzit">' +
        (sp === 'vagon' ? 'Отгрузить вагон' : 'Выдать груз по окну самовывоза') + '</button>' +
        '<button class="btn btn--secondary" type="button" data-act="zk-demo">Заполнить демо-данными</button></div>' +
      '</form>';
  }
  /* Поля формы → черновик: введённое переживает ошибку, смену способа и уход со страницы. */
  function sobrat() {
    var f = document.getElementById('zk-forma');
    var d = Store.draft(KEY);
    if (f) { Array.prototype.forEach.call(f.querySelectorAll('[name]'), function (el) { d[el.name] = el.value; }); }
    return Store.setDraft(KEY, d);
  }
  /* Правила полей и тексты ошибок — в слое данных (formy.otgruzka), по варианту формы: вагон
     или окно самовывоза. Площадка в форме — поле ploshchadka, в правилах — ploshchadkaId. */
  function proverit(d) {
    var F = DATA.spravochnik().formy.otgruzka;
    if (d.sposob === 'vagon') { return Shell.proverit(F.vagon, d); }
    var e = Shell.proverit(F.samovyvoz, { data: d.data, s: d.s, po: d.po, ploshchadkaId: d.ploshchadka });
    if (e.ploshchadkaId) { e.ploshchadka = e.ploshchadkaId; delete e.ploshchadkaId; }
    return e;
  }
  function perersovatFormu() {
    var z = DATA.zakaz(id), slot = document.getElementById('zk-forma-slot');
    if (!z || !slot) { risovat(); return; }
    slot.innerHTML = forma(z);
    var bad = slot.querySelector('[aria-invalid="true"]');
    if (bad) { try { bad.focus(); } catch (e) { /* фокус не обязателен */ } }
  }
  function snyatOshibku(name) {
    if (!oshibki[name]) { return; }
    delete oshibki[name];
    var f = document.getElementById('zk-forma');
    if (!f) { return; }
    var err = f.querySelector('[data-err="' + name + '"]'), el = f.querySelector('[name="' + name + '"]');
    if (err) { err.textContent = ''; err.hidden = true; }
    if (el) { el.classList.remove('input--error'); el.removeAttribute('aria-invalid'); }
  }

  /* --- отгрузки, партии, о заказе, документы, история ------------------------- */
  var STATUS = { plan: 'badge--work', 'v-puti': 'badge--work', poluchena: 'badge--done' };
  function otgruzka(o) {
    var rows = [], title, note = '';
    var partii = o.partii.map(function (p) { return '№ ' + p.nomer + ', ' + tonn(p.obem); }).join('; ');
    if (o.vagon && o.vagon.nomer) {
      title = 'Вагон № <span class="num">' + esc(o.vagon.nomer) + '</span>';
      rows.push(['Станция назначения', esc(o.vagon.stantsiya)]);
      if (o.status !== 'poluchena') { rows.push(['Ожидаемая дата прибытия', esc(denIKogda(o.vagon.eta))]); }
      if (o.status !== 'plan') { rows.push(['Отгружен', esc(R.data(o.data))]); }
    } else if (o.samovyvoz && o.samovyvoz.okno && o.samovyvoz.okno.data) {
      var sv = o.samovyvoz, ok = sv.okno, pl = sv.ploshchadka;
      title = 'Окно самовывоза';
      rows.push(['Дата', esc(denIKogda(ok.data))]);
      if (ok.s && ok.po) { rows.push(['Время', esc('с ' + ok.s + ' до ' + ok.po)]); }
      if (pl) { rows.push(['Площадка', '<span class="zk-otgr__pl">' + esc(pl.gorod) + '</span><span class="zk-otgr__adres">' + esc(pl.adres) + '</span>']); }
      rows.push(['Ворота', esc(sv.vorota || '')]);
    } else {
      title = 'Отгрузка № ' + esc(o.nomer);
      rows.push(['Плановая дата', esc(denIKogda(o.data))]);
      note = o.sposob === 'samovyvoz' ? 'Окно самовывоза КЗПМ назначит на этапе «Отгрузка».' : 'Номер вагона и станцию назначения КЗПМ укажет на этапе «Отгрузка».';
    }
    rows.push([o.partii.length > 1 ? 'Партии' : 'Партия', esc(partii)]);
    if (!o.partii.length) { rows.push(['Объём', esc(tonn(o.obem))]); }
    if (o.status === 'poluchena') { rows.push(['Получение подтверждено', esc(R.data(o.dataPolucheniya))]); }
    return '<li class="zk-otgr__item" data-otgruzka="' + esc(o.id) + '" data-sposob="' + esc(o.vagon && o.vagon.nomer ? 'vagon' : o.sposob) + '" data-status="' + esc(o.status) + '">' +
      '<div class="zk-otgr__head"><p class="zk-otgr__title">' + title + '</p><span class="badge ' + (STATUS[o.status] || 'badge--neutral') + '">' + esc(o.statusTitle) + '</span></div>' +
      kv(rows) + (note ? '<p class="zk-otgr__note">' + esc(note) + '</p>' : '') + '</li>';
  }
  function otgruzki(z) {
    var list = z.otgruzki || [];
    return blok('otgruzki', 'Отгрузки', list.length ? '<ul class="zk-otgr">' + list.map(otgruzka).join('') + '</ul>' : R.pusto({
      text: z.sposob === 'samovyvoz'
        ? 'Отгрузок пока нет. Окно самовывоза с датой, временем, площадкой и воротами появится здесь на этапе «Отгрузка».'
        : 'Отгрузок пока нет. Номер вагона, станция назначения и ожидаемая дата прибытия появятся здесь на этапе «Отгрузка».'
    }));
  }
  function partii(z) {
    var list = z.partii || [];
    return blok('partii', 'Партии и паспорта качества', list.length ? '<ul class="zk-partii">' + list.map(function (p) {
      var meta = [tonn(p.obem), 'выпущена ' + R.data(p.data), p.poluchena && p.dataPolucheniya ? 'получена ' + R.data(p.dataPolucheniya) : ''].filter(Boolean).join(' · ');
      return '<li class="zk-partii__item" data-partiya="' + esc(p.id) + '"><div class="zk-partii__main">' +
        '<p class="zk-partii__title">Партия № ' + esc(p.nomer) + '</p><p class="zk-partii__meta">' + esc(meta) + '</p></div>' +
        '<div class="zk-partii__knopki">' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="prevyu-open" data-id="' + esc(p.pasportId) + '">Паспорт качества</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-act="prevyu-skachat" data-id="' + esc(p.pasportId) + '">Скачать</button>' +
        '</div></li>';
    }).join('') + '</ul>' : R.pusto({ text: 'Партий пока нет. Партия получит номер и паспорт качества на этапе «Контроль качества».' }));
  }
  function oZakaze(z) {
    var n = (z.partii || []).length;
    var rows = [];
    if (zavod && z.zakazchik) { rows.push(['Заказчик', esc(z.zakazchik.name)]); }
    rows.push(['Способ получения', esc(z.sposobTitle)]);
    rows.push(['Желаемая дата', esc(R.data(z.zhelaemayaData))]);
    rows.push(['Заявка оформлена', esc(R.data(z.data))]);
    if (z.dogovor) {
      rows.push(['Договор', '<a href="otgruzki.html?dogovor=' + esc(encodeURIComponent(z.dogovor.id)) + '">Договор поставки № ' + esc(z.dogovor.nomer) + '</a>']);
    }
    return blok('o-zakaze', 'О заказе',
      '<div class="chisla zk-chisla">' +
        '<div class="chislo"><span class="chislo__v">' + esc(tonn(z.obem)) + '</span><span class="chislo__t">Объём заказа</span></div>' +
        '<div class="chislo"><span class="chislo__v">' + n + '</span><span class="chislo__t">' +
          R.plural(n, 'партия выпущена', 'партии выпущены', 'партий выпущено') + '</span></div>' +
      '</div>' + kv(rows));
  }
  function dokumenty(z) {
    return blok('dokumenty', 'Документы заказа', R.dokumenty(z.dokumenty, {
      empty: 'Документов пока нет. Паспорт качества появится с выпуском партии, а УПД и транспортная накладная появятся с отгрузкой.'
    }));
  }
  function istoriya(z) { return blok('istoriya', 'История', R.istoriya(z.istoriya)); }

  /* --- экран ------------------------------------------------------------------ */
  function risovat() {
    var s = spisok();
    if (!id) {
      document.title = 'Заказ — ' + NAZVANIE;
      page.innerHTML = R.shapka({ crumbs: [{ title: s.title, href: s.href }, { title: 'Заказ' }], title: 'Заказ' }) +
        R.pusto({ text: 'В карточке заказа собраны этапы, отгрузки, партии и документы. Выберите заказ в списке.',
          action: { label: 'Все заказы', href: 'zakazy.html' } });
      return;
    }
    var z = DATA.zakaz(id);
    if (!z) {
      document.title = 'Нет доступа — ' + NAZVANIE;
      page.innerHTML = zavod
        ? R.nedostupno({ title: 'Заказ не найден', text: 'Заказа с таким номером в кабинете нет.', href: s.href, label: s.title })
        : R.nedostupno({ text: 'Этот заказ относится к другому предприятию или его нет в кабинете. Ваши заказы собраны в разделе «Заказы».',
          href: 'zakazy.html', label: 'Мои заказы' });
      return;
    }
    document.title = z.title + ' — ' + NAZVANIE;
    page.innerHTML = shapka(z) + lenta(z) +
      '<div class="grid grid--2 zk-ryad">' + otgruzki(z) + oZakaze(z) + '</div>' +
      '<div class="grid grid--2 zk-ryad">' + partii(z) + dokumenty(z) + '</div>' +
      '<div class="zk-ryad">' + istoriya(z) + '</div>';
  }
  /* После хода: экран заново из DATA, панель ведущего — тоже. */
  function posleHoda() { oshibki = {}; risovat(); Shell.refresh(); }
  function neVyshlo() {
    R.modal({ title: 'Действие не выполнено', text: 'Этап заказа уже изменился. Обновите страницу, чтобы увидеть текущий шаг.' });
  }

  Shell.on('zk-polucheno', function () { if (ACT.polucheno(id)) { posleHoda(); } else { neVyshlo(); } });
  Shell.on('zk-dalee', function () { if (ACT.sleduyushchiyEtap(id)) { posleHoda(); } else { neVyshlo(); } });
  Shell.on('zk-sposob', function (b) {
    var d = sobrat();
    d.sposob = b.getAttribute('data-vid') === 'samovyvoz' ? 'samovyvoz' : 'vagon';
    Store.setDraft(KEY, d);
    oshibki = {};
    perersovatFormu();
  });
  Shell.on('zk-demo', function () {
    var d = sobrat(), x = DATA.demo('otgruzka', id) || {};
    if (d.sposob === 'vagon' && x.vagon) {
      d.nomer = x.vagon.nomer || ''; d.stantsiya = x.vagon.stantsiya || d.stantsiya || '';
    } else if (x.samovyvoz) {
      var ok = x.samovyvoz.okno || {};
      d.data = ok.data || ''; d.s = ok.s || ''; d.po = ok.po || ''; d.ploshchadka = x.samovyvoz.ploshchadkaId || ''; d.vorota = x.samovyvoz.vorota || '';
    }
    Store.setDraft(KEY, d);
    oshibki = {};
    perersovatFormu();
  });
  Shell.on('zk-otgruzit', function () {
    var d = sobrat();
    oshibki = proverit(d);
    if (Object.keys(oshibki).length) { perersovatFormu(); return; }
    var dannye = d.sposob === 'vagon'
      ? { vagon: { nomer: trim(d.nomer), stantsiya: trim(d.stantsiya), eta: d.eta || null } }
      : { samovyvoz: { okno: { data: d.data, s: d.s, po: d.po }, ploshchadkaId: d.ploshchadka, vorota: trim(d.vorota) } };
    if (!ACT.sleduyushchiyEtap(id, dannye)) {
      oshibki = { obshchaya: 'Отгрузку не удалось записать. Проверьте поля и попробуйте ещё раз.' };
      perersovatFormu();
      return;
    }
    Store.setDraft(KEY, null);
    posleHoda();
  });

  function vvod(e) {
    var el = e.target;
    if (!el || !el.name || !el.closest || !el.closest('#zk-forma')) { return; }
    sobrat();
    snyatOshibku(el.name);
  }
  page.addEventListener('input', vvod);
  page.addEventListener('change', vvod);
  /* Enter в поле нажимает «Отгрузить» через data-act; сама форма никуда не отправляется. */
  page.addEventListener('submit', function (e) { e.preventDefault(); });

  risovat();
  w.Prevyu.mount();
})(window);

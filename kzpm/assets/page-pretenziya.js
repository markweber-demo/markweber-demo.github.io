/* Претензия — карточка и форма новой претензии. Сценарий Д «Претензия по партии». Владелец — таск 07.

   pretenziya.html?id=<претензия> — карточка: партия со ссылкой на заказ, вид,
   описание, фото, ответы службы сервиса, решение, история. Служба сервиса
   ходит по признакам mozhno: берёт в работу, отвечает, запрашивает образцы,
   записывает решение и закрывает. Менеджер и директор смотрят без ходов, у
   менеджера в карточке строка, что на претензии отвечает служба сервиса.
   Чужая претензия у заказчика — «Нет доступа».

   pretenziya.html без id у заказчика — форма новой претензии: партия только из
   полученных своего предприятия, вид проблемы из справочника, описание, фото
   (своё, уменьшенное до 800 px, или демо). Черновик формы лежит в Store под
   ключом 'pretenziya', повторная отправка не создаёт дубль (draftId из черновика).

   Общие блоки — Render.shapka, Render.shag, Render.dokumenty, Render.istoriya,
   Render.nedostupno; паспорт качества партии открывает Prevyu. Читает
   DATA.pretenziya, DATA.partii, DATA.demo; пишет ACT.otpravitPretenziyu,
   vzyatPretenziyu, otvetitNaPretenziyu, zaprositObraztsy, zakrytPretenziyu. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, ACT = w.ACT, Shell = w.Shell, Store = w.Store;

  if (!Shell.mount({ active: 'pretenzii' })) { return; }

  var page = document.getElementById('page');
  var id = R.param('id');
  var me = DATA.me() || {};
  var zakazchik = me.side === 'zakazchik';
  var zavod = me.side === 'zavod';
  var servis = me.rol === 'servis';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var KEY = 'pretenziya';                 /* черновик формы новой претензии */
  var FORMY = DATA.spravochnik().formy;   /* правила полей форм и тексты ошибок */
  var KEY_HOD = 'pretenziya-hod:' + id;   /* черновик ответа и решения службы сервиса */
  var MAX_FOTO = 3;                       /* фото в одной претензии */
  var DLINNAYA = 800;                     /* длинная сторона уменьшенного фото, px */
  var oshibki = {};                       /* ошибки полей по имени */
  var otpravleno = false;                 /* форма отправлена, идёт переход в карточку */

  function trim(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function enc(v) { return encodeURIComponent(v); }
  function vremya(iso) { return R.data(iso) + ', ' + R.data(iso, { format: 'time' }); }
  /* Куда ведёт крошка: «Претензии» роли, у директора — его «Сводка». */
  function spisok() {
    var nav = Shell.nav();
    for (var i = 0; i < nav.length; i++) { if (nav[i].id === 'pretenzii') { return nav[i]; } }
    return nav[0] || { title: 'Претензии', href: 'pretenzii.html' };
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }
  function blok(idBloka, title, body) {
    return '<section class="card pr-blok" id="' + idBloka + '" aria-labelledby="' + idBloka + '-h">' +
      '<h2 class="h2 pr-blok__h" id="' + idBloka + '-h">' + esc(title) + '</h2>' + body + '</section>';
  }

  /* --- фото ----------------------------------------------------------------------
     Демо-фото рисуется здесь же образцом: фрагмент мешка со швом на ленте
     транспортёра. Своё фото приходит как dataUrl, уже уменьшенное. Цвета и
     кегли — классами pr-ph__* из pretenziya.css, литералов нет. */
  function fotoSvg(key, podpis) {
    var scena = '<rect class="pr-ph__fon" width="320" height="240"/>' +
      '<rect class="pr-ph__lenta" y="198" width="320" height="42"/>' +
      [30, 110, 190, 270].map(function (x) { return '<circle class="pr-ph__rolik" cx="' + x + '" cy="219" r="9"/>'; }).join('') +
      '<rect class="pr-ph__meshok" x="62" y="30" width="196" height="176" rx="10"/>' +
      '<path class="pr-ph__shov" d="M72 30H88V206H72A10 10 0 0 1 62 196V40A10 10 0 0 1 72 30Z"/>' +
      '<path class="pr-ph__liniya" d="M75 40V196M82 40V196"/>';
    var detal = '';
    if (key === 'foto-shov') {
      detal = '<path class="pr-ph__prosvet" d="M88 76L104 92L92 108L110 124L94 140L88 152Z"/>' +
        '<path class="pr-ph__defekt" d="M88 76L104 92L92 108L110 124L94 140L88 152"/>' +
        [[118, 168], [132, 180], [108, 186], [126, 192], [144, 190]].map(function (p) { return '<circle class="pr-ph__granula" cx="' + p[0] + '" cy="' + p[1] + '" r="3"/>'; }).join('');
    } else if (key === 'foto-razryv') {
      detal = '<path class="pr-ph__prosvet" d="M150 88L172 102L164 116L192 126L170 140L188 158L150 148L130 134L146 120L126 106Z"/>' +
        '<path class="pr-ph__defekt" d="M150 88L172 102L164 116L192 126L170 140L188 158L150 148L130 134L146 120L126 106Z"/>' +
        [[150, 170], [166, 180], [140, 184], [180, 190], [158, 192], [196, 176]].map(function (p) { return '<circle class="pr-ph__granula" cx="' + p[0] + '" cy="' + p[1] + '" r="3"/>'; }).join('');
    } else if (key === 'foto-pechat') {
      detal = '<text class="pr-ph__pechat pr-ph__smaz" x="170" y="118" text-anchor="middle">50 кг</text>' +
        '<text class="pr-ph__pechat" x="160" y="112" text-anchor="middle">50 кг</text>' +
        '<rect class="pr-ph__polosa" x="112" y="140" width="104" height="10" rx="5"/>';
    }
    return '<svg class="pr-ph" viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(podpis || 'Фото') + '">' + scena + detal + '</svg>';
  }
  /* Фото из данных претензии или черновика: { name, title, dataUrl, demo }. */
  function fotoVid(f) {
    var podpis = f.title || f.name || 'Фото';
    if (f.dataUrl) { return '<img class="pr-ph" src="' + esc(f.dataUrl) + '" alt="' + esc(podpis) + '">'; }
    return fotoSvg(f.demo, podpis);
  }
  function fotoPodpis(f) { return f.title || f.name || 'Фото'; }
  function demoFoto(key) {
    var list = DATA.demo('foto') || [];
    for (var i = 0; i < list.length; i++) { if (list[i].key === key) { return list[i]; } }
    return { key: key, name: key, title: '' };
  }

  /* --- шапка карточки и шаг ----------------------------------------------------- */
  function shapka(x) {
    var s = spisok(), p = x.partiya;
    var lead = (p ? 'Партия № ' + esc(p.nomer) : '') +
      (x.zakaz ? ' · <a href="zakaz.html?id=' + esc(enc(x.zakaz.id)) + '">Заказ № ' + esc(x.zakaz.nomer) + '</a>' : '');
    return R.shapka({
      crumbs: [{ title: s.title, href: s.href }, { title: x.title }],
      label: [x.vidTitle, zavod && x.zakazchik ? x.zakazchik.name : ''].filter(Boolean).join(' · '),
      title: x.title,
      lead: lead,
      side: '<span class="badge ' + esc(x.statusCls) + '" data-status="' + esc(x.status) + '">' + esc(x.statusTitle) + '</span>'
    });
  }
  function hody(x) {
    var m = x.mozhno || {}, b = '';
    if (m.vzyat) { b += '<button class="btn btn--primary" type="button" data-act="pr-vzyat">Взять в работу</button>'; }
    if (m.zaprositObraztsy) { b += '<button class="btn btn--secondary" type="button" data-act="pr-obraztsy">Запросить образцы</button>'; }
    return b;
  }
  function podskazka(x) {
    if (!x.naKom) { return ''; }
    if (servis) {
      return x.mozhno && x.mozhno.vzyat
        ? 'Нажмите «Взять в работу», и заказчик увидит, что претензию разбирают.'
        : 'Ответьте заказчику, при необходимости запросите образцы из партии, затем запишите решение и закройте претензию.';
    }
    if (zavod) { return 'На претензии отвечает служба сервиса.'; }
    /* заказчику шаг уже говорит, что делает служба сервиса, а блок ответов ниже — где появится ответ */
    return '';
  }
  function srokShaga(x) {
    return x.otvety && x.otvety.length ? { podpis: 'решение до', bylo: 'решение ожидалось' } : { podpis: 'ответ до', bylo: 'ответ ожидался' };
  }
  function dniPodpis(x) {
    if (!x.naKom) { return false; }
    if (x.dneyBezOtveta !== null && x.dneyBezOtveta !== undefined) {
      return x.dneyBezOtveta === 0 ? 'Подана сегодня' : R.dney(x.dneyBezOtveta) + ' без ответа';
    }
    return x.dneyNaEtape === 0 ? 'Последний шаг сегодня' : R.dney(x.dneyNaEtape) + ' с последнего шага';
  }
  function rabota(x) {
    var d = Store.draft(KEY_HOD), m = x.mozhno || {};
    function pole(name, label, hint) {
      var err = oshibki[name] || '';
      return '<label class="field"><span class="field__label">' + esc(label) + '</span>' +
        '<textarea class="textarea' + (err ? ' input--error' : '') + '" name="' + name + '" rows="4"' + (err ? ' aria-invalid="true"' : '') + '>' + esc(d[name] || '') + '</textarea>' +
        (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') +
        '<span class="field__err" data-err="' + name + '" aria-live="polite"' + (err ? '' : ' hidden') + '>' + esc(err) + '</span></label>';
    }
    var paneli = '';
    if (m.otvetit) {
      paneli += '<form class="pr-hod" id="pr-hod-otvet" novalidate><h3 class="h3 pr-hod__title">Ответ заказчику</h3>' +
        pole('otvet', 'Текст ответа', 'Заказчик увидит ответ в карточке претензии.') +
        '<div class="pr-hod__knopki"><button class="btn btn--primary" type="submit" data-act="pr-otvet">Ответить</button>' +
        '<button class="btn btn--secondary" type="button" data-act="pr-otvet-demo">Заполнить демо-данными</button></div></form>';
    }
    if (m.zakryt) {
      paneli += '<form class="pr-hod" id="pr-hod-reshenie" novalidate><h3 class="h3 pr-hod__title">Решение по претензии</h3>' +
        pole('reshenie', 'Решение', 'Заказчик увидит решение в карточке претензии.') +
        '<div class="pr-hod__knopki"><button class="btn btn--primary" type="submit" data-act="pr-zakryt">Закрыть претензию</button>' +
        '<button class="btn btn--secondary" type="button" data-act="pr-reshenie-demo">Заполнить демо-данными</button></div></form>';
    }
    return paneli ? '<div class="pr-hody">' + paneli + '</div>' : '';
  }
  function shag(x) {
    return '<section class="card pr-shag" aria-labelledby="pr-shag-h"><h2 class="h2 pr-blok__h" id="pr-shag-h">Рассмотрение претензии</h2>' +
      R.shag(x, { knopki: hody(x), podskazka: podskazka(x), srok: srokShaga(x), dni: dniPodpis(x),
        gotovo: x.reshenie ? 'Претензия закрыта ' + R.data(x.reshenie.data) : '' }) +
      rabota(x) + '</section>';
  }

  /* --- блоки карточки ------------------------------------------------------------ */
  function oPretenzii(x) {
    var p = x.partiya, rows = [];
    if (zavod && x.zakazchik) { rows.push(['Заказчик', esc(x.zakazchik.name)]); }
    if (p) {
      rows.push(['Партия', '№ ' + esc(p.nomer) + ', ' + esc(String(p.obem).replace('.', ',')) + ' т']);
      if (p.dataPolucheniya) { rows.push(['Получена', esc(R.data(p.dataPolucheniya))]); }
    }
    if (x.zakaz) { rows.push(['Заказ', '<a href="zakaz.html?id=' + esc(enc(x.zakaz.id)) + '">Заказ № ' + esc(x.zakaz.nomer) + '</a>']); }
    if (x.produkt) { rows.push(['Продукт', '<a href="produkt.html?id=' + esc(enc(x.produkt.id)) + '">' + esc(x.produkt.nazvanie) + '</a>']); }
    rows.push(['Вид проблемы', esc(x.vidTitle)]);
    rows.push(['Подана', esc(vremya(x.data))]);
    return blok('o-pretenzii', 'О претензии', kv(rows) +
      (p && p.pasportId ? '<p class="pr-pasport"><button class="btn btn--secondary btn--sm" type="button" data-act="prevyu-open" data-id="' + esc(p.pasportId) + '">Паспорт качества партии</button></p>' : '') +
      '<h3 class="h3 pr-podzagolovok">Описание</h3><p class="pr-opisanie">' + esc(x.opisanie) + '</p>');
  }
  function fotoBlok(x) {
    var list = x.foto || [];
    return blok('foto', 'Фото', list.length
      ? '<ul class="pr-foto">' + list.map(function (f, i) {
        return '<li class="pr-foto__item"><button class="pr-foto__btn" type="button" data-act="pr-foto-open" data-i="' + i + '" aria-label="Открыть фото: ' + esc(fotoPodpis(f)) + '">' +
          '<span class="pr-foto__img">' + fotoVid(f) + '</span></button><p class="pr-foto__cap">' + esc(fotoPodpis(f)) + '</p></li>';
      }).join('') + '</ul>'
      : R.pusto({ text: 'Фото к претензии не приложены.' }));
  }
  function otvety(x) {
    var list = x.otvety || [];
    return blok('otvety', 'Ответы службы сервиса', list.length
      ? '<ol class="pr-otvety">' + list.map(function (o) {
        var obr = o.vid === 'obraztsy';
        return '<li class="pr-otvet" data-vid="' + esc(o.vid) + '"><div class="pr-otvet__head">' +
          '<span class="badge ' + (obr ? 'badge--wait' : 'badge--work') + '">' + (obr ? 'Запрос образцов' : 'Ответ') + '</span>' +
          '<span class="pr-otvet__kogda">' + esc(vremya(o.data)) + '</span></div>' +
          '<p class="pr-otvet__text">' + esc(o.text) + '</p><p class="pr-otvet__kto">' + esc(R.kto(o.kto)) + '</p></li>';
      }).join('') + '</ol>'
      : R.pusto({ text: zakazchik ? 'Служба сервиса пока не ответила. Ответ появится в этой карточке.' : 'Ответов пока нет.' }));
  }
  function reshenie(x) {
    var r = x.reshenie;
    return blok('reshenie', 'Решение', r
      ? '<div class="pr-reshenie"><div class="pr-otvet__head"><span class="badge badge--done">Претензия закрыта</span>' +
        '<span class="pr-otvet__kogda">' + esc(vremya(r.data)) + '</span></div>' +
        '<p class="pr-otvet__text">' + esc(r.text) + '</p><p class="pr-otvet__kto">' + esc(R.kto(r.kto)) + '</p></div>'
      : R.pusto({ text: 'Решение появится здесь, когда служба сервиса закроет претензию.' }));
  }
  function dokumenty(x) {
    if (!(x.dokumenty || []).length) { return ''; }
    return '<div class="pr-ryad">' + blok('dokumenty', 'Документы претензии', R.dokumenty(x.dokumenty)) + '</div>';
  }
  function istoriya(x) { return blok('istoriya', 'История', R.istoriya(x.istoriya)); }

  /* --- форма новой претензии ----------------------------------------------------- */
  function chernovik() {
    var d = Store.draft(KEY);
    if (!d.foto) { d.foto = []; }
    return d;
  }
  /* Поля формы → черновик: введённое переживает ошибку, перерисовку и уход со страницы. */
  function sobrat() {
    var f = document.getElementById('pr-forma');
    var d = Store.draft(KEY);
    if (!d.foto) { d.foto = []; }
    if (f) { Array.prototype.forEach.call(f.querySelectorAll('[name]'), function (el) { d[el.name] = el.value; }); }
    return Store.setDraft(KEY, d);
  }
  function polya(d, partii) {
    var vidy = DATA.spravochnik().vidyPretenziy || {};
    function pole(name, label, input, hint) {
      var err = oshibki[name] || '';
      return '<label class="field"><span class="field__label">' + esc(label) + '</span>' + input +
        (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') +
        '<span class="field__err" data-err="' + name + '" aria-live="polite"' + (err ? '' : ' hidden') + '>' + esc(err) + '</span></label>';
    }
    function opcii(pairs, vybrano, pusto) {
      return '<option value=""' + (vybrano ? '' : ' selected') + '>' + esc(pusto) + '</option>' + pairs.map(function (p) {
        return '<option value="' + esc(p[0]) + '"' + (vybrano === p[0] ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
      }).join('');
    }
    function sel(name, options) {
      return '<select class="select' + (oshibki[name] ? ' input--error' : '') + '" name="' + name + '"' + (oshibki[name] ? ' aria-invalid="true"' : '') + '>' + options + '</select>';
    }
    var pt = partii.map(function (p) {
      return [p.id, '№ ' + p.nomer + ' · ' + (p.produkt ? p.produkt.nazvanie : '') + ' · получена ' + R.data(p.dataPolucheniya)];
    });
    var vd = Object.keys(vidy).map(function (k) { return [k, vidy[k]]; });
    return pole('partiyaId', 'Партия', sel('partiyaId', opcii(pt, d.partiyaId, 'Выберите партию')), 'Только полученные партии вашего предприятия.') +
      pole('vid', 'Вид проблемы', sel('vid', opcii(vd, d.vid, 'Выберите вид проблемы'))) +
      pole('opisanie', 'Описание', '<textarea class="textarea' + (oshibki.opisanie ? ' input--error' : '') + '" name="opisanie" rows="6"' +
        (oshibki.opisanie ? ' aria-invalid="true"' : '') + '>' + esc(d.opisanie || '') + '</textarea>', 'Опишите проблему и укажите, какая доля партии затронута.');
  }
  function fotoForma(d) {
    var list = d.foto || [];
    var err = oshibki.foto || '';
    return '<div class="pr-fotoforma"><p class="field__label">Фото</p>' +
      (list.length ? '<ul class="pr-foto">' + list.map(function (f, i) {
        return '<li class="pr-foto__item"><span class="pr-foto__img pr-foto__img--forma">' + fotoVid(f) + '</span>' +
          '<p class="pr-foto__cap">' + esc(fotoPodpis(f)) + '</p>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-act="pr-foto-x" data-i="' + i + '">Убрать</button></li>';
      }).join('') + '</ul>' : '') +
      '<div class="pr-fotoforma__knopki">' +
        '<label class="btn btn--secondary btn--sm pr-file"><input class="pr-file__input" type="file" id="pr-file" accept="image/*">Выбрать фото</label>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="pr-foto-demo">Приложить демо-фото</button></div>' +
      '<span class="field__hint">До трёх снимков JPG или PNG. Большие снимки уменьшаются автоматически.</span>' +
      '<span class="field__err" data-err="foto" aria-live="polite"' + (err ? '' : ' hidden') + '>' + esc(err) + '</span></div>';
  }
  function forma(partii) {
    var d = chernovik();
    return '<form class="card pr-forma" id="pr-forma" novalidate>' +
      '<div class="pr-forma__kol">' + polya(d, partii) + '</div>' +
      '<div class="pr-forma__kol"><div id="pr-foto-slot">' + fotoForma(d) + '</div></div>' +
      '<div class="pr-forma__niz">' +
        (oshibki.obshchaya ? '<p class="field__err pr-forma__oshibka" role="alert">' + esc(oshibki.obshchaya) + '</p>' : '') +
        '<div class="pr-forma__knopki"><button class="btn btn--primary" type="submit" data-act="pr-send">Отправить претензию</button>' +
        '<button class="btn btn--secondary" type="button" data-act="pr-demo">Заполнить демо-данными</button></div></div>' +
      '</form>';
  }
  function polucheny() { return DATA.partii({ poluchennye: true }) || []; }
  function risovatForma() {
    var s = spisok();
    document.title = 'Новая претензия — ' + NAZVANIE;
    var partii = polucheny();
    var head = R.shapka({
      crumbs: [{ title: s.title, href: s.href }, { title: 'Новая претензия' }],
      title: 'Новая претензия',
      lead: 'Выберите партию, опишите проблему и приложите фото. Ответ службы сервиса появится в карточке претензии.'
    });
    page.innerHTML = head + (partii.length ? forma(partii) : R.pusto({
      text: 'Полученных партий пока нет. Претензию можно подать по партии после того, как вы подтвердите её получение в карточке заказа.',
      action: { label: 'Мои заказы', href: 'zakazy.html' } }));
  }
  function perersovatFormu() {
    var f = document.getElementById('pr-forma');
    if (!f) { risovatForma(); return; }
    var focus = document.activeElement && document.activeElement.name;
    f.outerHTML = forma(polucheny());
    var bad = document.querySelector('#pr-forma [aria-invalid="true"]');
    if (bad) { try { bad.focus(); } catch (e) { /* фокус не обязателен */ } }
    else if (focus) { var el = document.querySelector('#pr-forma [name="' + focus + '"]'); if (el) { try { el.focus(); } catch (e) { /* фокус не обязателен */ } } }
  }
  function perersovatFoto() {
    var slot = document.getElementById('pr-foto-slot');
    if (slot) { slot.innerHTML = fotoForma(chernovik()); }
  }
  /* Обязательные поля и тексты ошибок — в слое данных (formy.pretenziya). Партию и вид человек
     выбирает из списков: полученные партии своего предприятия и виды справочника; чужое
     значение отклоняет ACT, и форма показывает общую ошибку. */
  function proverit(d) { return Shell.proverit(FORMY.pretenziya, d); }
  function snyatOshibku(el) {
    var name = el.name;
    if (!oshibki[name]) { return; }
    delete oshibki[name];
    var box = el.closest('.field'), err = box && box.querySelector('[data-err]');
    if (err) { err.textContent = ''; err.hidden = true; }
    el.classList.remove('input--error'); el.removeAttribute('aria-invalid');
  }
  function oshibkaFoto(text) {
    if (text) { oshibki.foto = text; } else { delete oshibki.foto; }
    var err = document.querySelector('#pr-forma [data-err="foto"]');
    if (err) { err.textContent = text || ''; err.hidden = !text; }
  }

  /* Фото: уменьшаем до 800 px по длинной стороне. В журнал ложатся десятки килобайт, а не мегабайты. */
  function umenshit(file, gotovo, ne) {
    var rd = new FileReader();
    rd.onerror = function () { ne('Не удалось открыть фото. Выберите другое.'); };
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, DLINNAYA / Math.max(img.width, img.height, 1));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        var small = null;
        try {
          var g = c.getContext('2d');
          g.fillStyle = w.getComputedStyle(document.documentElement).getPropertyValue('--c-surface').trim();
          g.fillRect(0, 0, c.width, c.height);   /* прозрачные места PNG не становятся чёрными */
          g.drawImage(img, 0, 0, c.width, c.height);
          small = c.toDataURL('image/jpeg', 0.72);
        } catch (x) { small = null; }
        /* Не уменьшилось: полноразмерный файл в журнал не пишем. */
        if (!small || small.indexOf('data:image/jpeg') !== 0) { ne('Фото не удалось уменьшить. Выберите другое или отправьте претензию без фото.'); return; }
        gotovo(small);
      };
      img.onerror = function () { ne('Не удалось открыть фото. Выберите другое.'); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }

  /* --- экран -------------------------------------------------------------------- */
  function risovat() {
    var s = spisok();
    if (!id) {
      if (zakazchik) { risovatForma(); return; }
      document.title = 'Претензия — ' + NAZVANIE;
      page.innerHTML = R.shapka({ crumbs: [{ title: s.title, href: s.href }, { title: 'Претензия' }], title: 'Претензия' }) +
        R.pusto({ text: 'В карточке претензии собраны ответы службы сервиса и решение. Выберите претензию в списке.',
          action: { label: 'Все претензии', href: 'pretenzii.html' } });
      return;
    }
    var x = DATA.pretenziya(id);
    if (!x) {
      document.title = 'Нет доступа — ' + NAZVANIE;
      page.innerHTML = zavod
        ? R.nedostupno({ title: 'Претензия не найдена', text: 'Претензии с таким номером в кабинете нет.', href: s.href, label: s.title })
        : R.nedostupno({ text: 'Эта претензия относится к другому предприятию или её нет в кабинете. Ваши претензии собраны в разделе «Претензии».',
          href: 'pretenzii.html', label: 'Мои претензии' });
      return;
    }
    document.title = x.title + ' — ' + NAZVANIE;
    page.innerHTML = shapka(x) + shag(x) +
      '<div class="grid grid--2 pr-ryad">' + oPretenzii(x) + fotoBlok(x) + '</div>' +
      '<div class="grid grid--2 pr-ryad">' + otvety(x) + reshenie(x) + '</div>' +
      dokumenty(x) + '<div class="pr-ryad">' + istoriya(x) + '</div>';
  }
  /* После хода: карточка заново из DATA, панель ведущего — тоже. */
  function posleHoda() { oshibki = {}; risovat(); Shell.refresh(); }
  function neVyshlo() {
    R.modal({ title: 'Действие не выполнено', text: 'Статус претензии уже изменился. Обновите страницу, чтобы увидеть текущий шаг.' });
  }

  /* --- ходы службы сервиса --------------------------------------------------------- */
  function hodTekst() {
    var d = Store.draft(KEY_HOD);
    Array.prototype.forEach.call(document.querySelectorAll('.pr-hod [name]'), function (el) { d[el.name] = el.value; });
    return Store.setDraft(KEY_HOD, d);
  }
  function perersovatHod() {
    var x = DATA.pretenziya(id), box = document.querySelector('.pr-shag');
    if (!x || !box) { risovat(); return; }
    var old = box.querySelector('.pr-hody'), nov = document.createElement('div');
    nov.innerHTML = rabota(x);
    if (old) { old.parentNode.removeChild(old); }
    if (nov.firstChild) { box.appendChild(nov.firstChild); }
    var bad = box.querySelector('[aria-invalid="true"]');
    if (bad) { try { bad.focus(); } catch (e) { /* фокус не обязателен */ } }
  }
  Shell.on('pr-vzyat', function () { if (ACT.vzyatPretenziyu(id)) { posleHoda(); } else { neVyshlo(); } });
  Shell.on('pr-obraztsy', function () {
    hodTekst();
    if (ACT.zaprositObraztsy(id)) { posleHoda(); } else { neVyshlo(); }
  });
  /* Ответ и решение — по одному полю формы хода; правило и текст ошибки — formy.hodPretenzii. */
  function zapisat(pole, fn) {
    var d = hodTekst(), text = trim(d[pole]), pravila = {}, e;
    pravila[pole] = FORMY.hodPretenzii[pole];
    e = Shell.proverit(pravila, d);
    if (e[pole]) { oshibki = e; perersovatHod(); return; }
    if (!fn(id, text)) { neVyshlo(); return; }
    d[pole] = '';
    Store.setDraft(KEY_HOD, d);
    posleHoda();
  }
  Shell.on('pr-otvet', function () { zapisat('otvet', ACT.otvetitNaPretenziyu); });
  Shell.on('pr-zakryt', function () { zapisat('reshenie', ACT.zakrytPretenziyu); });
  function podstavit(pole, tekst) {
    var d = hodTekst();
    d[pole] = tekst || '';
    Store.setDraft(KEY_HOD, d);
    oshibki = {};
    perersovatHod();
  }
  Shell.on('pr-otvet-demo', function () { podstavit('otvet', DATA.demo('otvet')); });
  Shell.on('pr-reshenie-demo', function () { podstavit('reshenie', DATA.demo('reshenie')); });

  /* Фото в карточке открывается крупно, в окне. */
  Shell.on('pr-foto-open', function (b) {
    var x = DATA.pretenziya(id), f = x && (x.foto || [])[+b.getAttribute('data-i')];
    if (!f) { return; }
    R.modal({ title: fotoPodpis(f), wide: true, body: '<div class="pr-krupno">' + fotoVid(f) + '</div>',
      foot: '<button class="btn btn--primary" type="button" data-close>Закрыть</button>' });
  });

  /* --- форма: фото, демо, отправка --------------------------------------------------- */
  Shell.on('pr-foto-demo', function () {
    var d = sobrat(), ostalos = (DATA.demo('foto') || []).filter(function (f) {
      return !d.foto.some(function (x) { return x.demo === f.key; });
    });
    if (d.foto.length >= MAX_FOTO || !ostalos.length) { oshibkaFoto('Можно приложить не больше трёх фото.'); return; }
    d.foto.push({ demo: ostalos[0].key, name: ostalos[0].name, title: ostalos[0].title });
    Store.setDraft(KEY, d);
    delete oshibki.foto;
    perersovatFoto();
  });
  Shell.on('pr-foto-x', function (b) {
    var d = sobrat();
    d.foto.splice(+b.getAttribute('data-i'), 1);
    Store.setDraft(KEY, d);
    delete oshibki.foto;
    perersovatFoto();
  });
  Shell.on('pr-demo', function () {
    var d = sobrat(), x = DATA.demo('pretenziya') || {};
    if (x.partiyaId) { d.partiyaId = x.partiyaId; }
    d.vid = x.vid || d.vid; d.opisanie = x.opisanie || d.opisanie;
    d.foto = (x.foto || []).map(function (k) { var f = demoFoto(k); return { demo: f.key, name: f.name, title: f.title }; });
    Store.setDraft(KEY, d);
    oshibki = {};
    perersovatFormu();
  });
  Shell.on('pr-send', function () {
    if (otpravleno) { return; }
    var d = sobrat();
    oshibki = proverit(d);
    if (Object.keys(oshibki).length) { perersovatFormu(); return; }
    /* Демо-фото уходят ключом (картинку рисует карточка), своё — уменьшенным файлом. */
    var foto = (d.foto || []).map(function (f) { return f.demo ? f.demo : { name: f.name, dataUrl: f.dataUrl }; });
    var pid = ACT.otpravitPretenziyu(d.draftId, { partiyaId: d.partiyaId, vid: d.vid, opisanie: trim(d.opisanie), foto: foto });
    if (!pid) {
      oshibki = { obshchaya: 'Претензию не удалось отправить. Проверьте поля и попробуйте ещё раз.' };
      perersovatFormu();
      return;
    }
    otpravleno = true;
    Store.setDraft(KEY, null);
    Shell.navigate('pretenziya.html?id=' + enc(pid));
  });

  /* Поля формы и текст ответа → черновик; ошибка у поля уходит, когда человек начал править. */
  function vvod(e) {
    var el = e.target;
    if (!el || !el.name || !el.closest) { return; }
    if (el.closest('#pr-forma')) { sobrat(); snyatOshibku(el); }
    else if (el.closest('.pr-hod')) { hodTekst(); snyatOshibku(el); }
  }
  page.addEventListener('input', vvod);
  page.addEventListener('change', function (e) {
    var inp = e.target;
    if (inp && inp.id === 'pr-file') {
      var file = inp.files && inp.files[0];
      if (!file) { return; }
      var d = sobrat();
      if (d.foto.length >= MAX_FOTO) { oshibkaFoto('Можно приложить не больше трёх фото.'); inp.value = ''; return; }
      if (!/^image\//.test(file.type)) { oshibkaFoto('Нужно изображение в формате JPG или PNG.'); inp.value = ''; return; }
      oshibkaFoto('');
      umenshit(file, function (small) {
        var t = sobrat();
        if (t.foto.length < MAX_FOTO) { t.foto.push({ name: file.name, dataUrl: small }); Store.setDraft(KEY, t); }
        perersovatFoto();
      }, function (text) { oshibkaFoto(text); });
      inp.value = '';
      return;
    }
    vvod(e);
  });
  /* Enter в поле нажимает кнопку через data-act; сама форма никуда не отправляется. */
  page.addEventListener('submit', function (e) { e.preventDefault(); });

  risovat();
  w.Prevyu.mount();
})(window);

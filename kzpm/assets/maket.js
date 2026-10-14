/* Макет печати — согласование по версиям (сценарий В, история 8, R12 и R39–R41).

   Maket.risunok(версия, { metki }) -> строка SVG: мешок с печатью для версии. Версия — как в
   DATA.produkt(id).maket.versii: { n, data, kto, risunok{ nadpis, produkt, massa, krupnoeNazvanie,
   krupnayaMassa, znaki[] }, ispravleno[] }. metki — пронумерованные точки замечаний [{ nomer, x, y, otvet?,
   novaya? }], x и y в процентах рисунка. Рисунок нейтральный: выдуманный завод удобрений, без
   настоящих брендов; цвета и кегли только токены styles.css. Правила рисунка лежат в самом SVG,
   поэтому он выглядит одинаково и в разделе карточки, и на листе документа (prevyu.js). */
(function (w) {
  'use strict';

  /* --- рисунок ------------------------------------------------------------------------------
     Рамка 400 × 580. Положение частей закреплено так, чтобы метки замечаний из демо-данных
     (x и y в процентах) приходились на свои части: логотип слева вверху (30 %, 18 %), название по
     центру (50 %, 40 %), ряд знаков справа (82 %), масса справа внизу (64 %, 72 %). */
  var RW = 400, RH = 580;
  var CENTR_NAZV = [176, 232];           /* центр блока названия продукта */
  var CENTR_MASSA = [256, 418];          /* центр надписи массы */
  var STOLB_ZNAKOV = 328;                /* ось ряда знаков */
  var SLOTY = { vlaga: 174, verh: 230, 'ne-brosat': 286 };   /* знак всегда на своём месте */
  var ZNAKI = {
    verh: { title: 'Верх', glif: '<path class="mkr-glif" d="M-6 9V-8M-10 -4L-6 -9L-2 -4M6 9V-8M2 -4L6 -9L10 -4"/>' },
    vlaga: { title: 'Беречь от влаги', glif: '<path class="mkr-glif" d="M-12 -2A12 12 0 0 1 12 -2ZM0 -2V8Q0 12 -3.5 11"/>' +
      '<circle class="mkr-kapl" cx="-8" cy="6" r="1.6"/><circle class="mkr-kapl" cx="8" cy="6" r="1.6"/><circle class="mkr-kapl" cx="-12" cy="11" r="1.6"/>' },
    'ne-brosat': { title: 'Не бросать', glif: '<rect class="mkr-glif" x="-7" y="-11" width="14" height="12" rx="1"/>' +
      '<path class="mkr-glif" d="M-5 6V10M0 6V12M5 6V10"/><path class="mkr-glif" d="M-13 -13L13 13"/>' }
  };
  var PODPIS = 'Изготовитель мешка: КЗПМ, Нижнекамск';
  var PIN_R = 13;

  /* Правила рисунка. Только токены: цвет — var(--c-*), кегль — var(--fs-*). */
  var STILI =
    '.mkr{font-family:var(--font);letter-spacing:0}' +
    '.mkr text{fill:var(--c-text)}' +
    '.mkr .mkr-fon{fill:var(--c-surface);stroke:var(--c-line);stroke-width:1}' +
    '.mkr .mkr-lab{font-size:var(--fs-xs);fill:var(--c-muted)}' +
    '.mkr .mkr-plenka{fill:var(--c-block-2);stroke:var(--c-muted);stroke-width:1.5}' +
    '.mkr .mkr-falts{fill:var(--c-block);stroke:var(--c-line);stroke-width:1}' +
    '.mkr .mkr-shov{fill:var(--c-block);stroke:var(--c-muted);stroke-width:1.5}' +
    '.mkr .mkr-shtrih{stroke:var(--c-line);stroke-width:1}' +
    '.mkr .mkr-polosa{fill:var(--c-wait)}' +
    '.mkr .mkr-znak-fon{fill:var(--c-text)}' +
    '.mkr .mkr-gran{fill:var(--c-surface)}' +
    '.mkr .mkr-zavod{font-size:var(--fs-sm);font-weight:500}' +
    '.mkr .mkr-nazv-b{font-size:var(--fs-xl)}' +
    '.mkr .mkr-nazv-m{font-size:var(--fs-lg)}' +
    '.mkr .mkr-nazv-k{font-size:var(--fs-num)}' +
    '.mkr .mkr-massa-b{font-size:var(--fs-num)}' +
    '.mkr .mkr-massa-m{font-size:var(--fs-sm)}' +
    '.mkr .mkr-znak{fill:var(--c-surface);stroke:var(--c-text);stroke-width:2}' +
    '.mkr .mkr-glif{fill:none;stroke:var(--c-text);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.mkr .mkr-kapl{fill:var(--c-text)}' +
    '.mkr .mkr-plashka{fill:var(--c-text)}' +
    '.mkr .mkr-podpis{font-size:var(--fs-2xs);fill:var(--c-surface)}' +
    '.mkr .mkr-pin-o{fill:var(--c-primary)}' +
    '.mkr .mkr-pin-k{fill:var(--c-primary);stroke:var(--c-surface);stroke-width:2}' +
    '.mkr .mkr-pin-n{font-size:var(--fs-xs);font-weight:500;fill:var(--c-on-primary)}' +
    '.mkr .is-otvecheno .mkr-pin-k{fill:var(--c-surface);stroke:var(--c-primary)}' +
    '.mkr .is-otvecheno .mkr-pin-n{fill:var(--c-primary)}' +
    '.mkr .is-novaya .mkr-pin-o{fill:var(--c-text)}' +
    '.mkr .is-novaya .mkr-pin-k{fill:var(--c-wait);stroke:var(--c-text);stroke-dasharray:3 2}' +
    '.mkr .is-novaya .mkr-pin-n{fill:var(--c-on-wait)}';

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function r1(n) { return Math.round(n * 10) / 10; }
  function ogranichit(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /* Слова по строкам не длиннее maks знаков; слово длиннее остаётся одно на строке. */
  function stroki(s, maks) {
    var out = [], cur = '';
    String(s === null || s === undefined ? '' : s).trim().split(/\s+/).filter(Boolean).forEach(function (wd) {
      if (cur && (cur + ' ' + wd).length > maks) { out.push(cur); cur = wd; } else { cur = cur ? cur + ' ' + wd : wd; }
    });
    if (cur) { out.push(cur); }
    return out;
  }

  /* Название продукта: короткое набирается крупно в две строки, длинное — мельче. Крупное
     название (risunok.krupnoeNazvanie, правка по замечанию) — на ступень крупнее: длинное
     как короткое, короткое кеглем ключевых чисел. Строка шире поля названия (между фальцем
     и рядом знаков) сжимается до его ширины. znakov — сколько знаков ступени входит в поле. */
  var NAZV_SHIR = 248;
  var NAZV = {
    m: { cls: 'mkr-nazv-m', step: 31, znakov: 18 },
    b: { cls: 'mkr-nazv-b', step: 45, znakov: 11 },
    k: { cls: 'mkr-nazv-k', step: 58, znakov: 8 }
  };
  function nazvanie(s, krupnee) {
    var b = stroki(s, 10), korotkoe = b.length <= 2 && b.every(function (l) { return l.length <= 10; });
    if (korotkoe) { return { lines: b, st: NAZV[krupnee ? 'k' : 'b'] }; }
    if (krupnee) { return { lines: b.length > 3 ? b.slice(0, 2).concat([b.slice(2).join(' ')]) : b, st: NAZV.b }; }
    var m = stroki(s, 16);
    if (m.length > 3) { m = m.slice(0, 2).concat([m.slice(2).join(' ')]); }
    return { lines: m, st: NAZV.m };
  }

  function text(cls, x, y, s, extra) {
    return '<text class="' + cls + '" x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + ((extra && extra.anchor) || 'start') +
      '" dominant-baseline="central"' + ((extra && extra.attr) || '') + '>' + esc(s) + '</text>';
  }

  function znak(key, y) {
    var z = ZNAKI[key];
    return '<g data-znak="' + key + '" transform="translate(' + STOLB_ZNAKOV + ' ' + y + ')"><title>' + esc(z.title) + '</title>' +
      '<circle class="mkr-znak" r="20"/>' + z.glif + '</g>';
  }

  /* Метка — кружок с номером над точкой замечания и остриём в самой точке: надпись под меткой
     остаётся читаемой. У верхнего края кружок уходит под точку. */
  function pin(m) {
    var px = ogranichit(Number(m.x) / 100 * RW, PIN_R, RW - PIN_R), py = ogranichit(Number(m.y) / 100 * RH, 0, RH);
    if (isNaN(px) || isNaN(py)) { return ''; }
    var vverh = py >= 2 * PIN_R + 8, cy = vverh ? -(PIN_R + 8) : PIN_R + 8;
    return '<g class="mkr-pin' + (m.otvet ? ' is-otvecheno' : '') + (m.novaya ? ' is-novaya' : '') + '" data-metka="' + esc(m.nomer) +
      '" transform="translate(' + r1(px) + ' ' + r1(py) + ')"><path class="mkr-pin-o" d="M-5 ' + (vverh ? -9 : 9) + 'L0 0L5 ' + (vverh ? -9 : 9) + 'Z"/>' +
      '<circle class="mkr-pin-k" cy="' + cy + '" r="' + PIN_R + '"/>' +
      '<text class="mkr-pin-n" x="0" y="' + cy + '" text-anchor="middle" dominant-baseline="central">' + esc(m.nomer) + '</text></g>';
  }

  function risunok(versiya, o) {
    var r = versiya && versiya.risunok;
    if (!r || typeof r !== 'object') { return ''; }
    var metki = (o && o.metki) || [];
    var nz = nazvanie(r.produkt, !!r.krupnoeNazvanie), massa = r.krupnayaMassa ? 'b' : 'm';
    var zn = Object.keys(SLOTY).filter(function (k) { return (r.znaki || []).indexOf(k) > -1; });
    var nadpis = stroki(r.nadpis, 22).slice(0, 2).map(function (l) { return pad(l, 24); });
    var podpisano = 'Макет печати' + (versiya.n ? ', версия ' + versiya.n : '') + ': мешок «' + String(r.produkt || '') + '»' +
      (r.massa ? ', ' + r.massa : '') + (r.nadpis ? ', ' + r.nadpis : '') +
      (zn.length ? '. Знаки: ' + zn.map(function (k) { return ZNAKI[k].title; }).join(', ') : '');
    var s = '<svg class="mkr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + RW + ' ' + RH + '" role="img" aria-label="' + esc(podpisano) +
      '" data-versiya="' + esc(versiya.n) + '"><title>' + esc(podpisano) + '</title><style>' + STILI + '</style>';
    s += '<rect class="mkr-fon" x="0.5" y="0.5" width="' + (RW - 1) + '" height="' + (RH - 1) + '" rx="11.5"/>';
    s += text('mkr-lab', 24, 20, 'Макет печати' + (versiya.n ? ' · версия ' + versiya.n : ''));
    /* мешок: корпус, боковые фальцы, верхний и нижний швы */
    s += '<path class="mkr-plenka" d="M24 44L32 36H368L376 44V548L368 556H32L24 548Z"/>';
    s += '<rect class="mkr-falts" x="24.5" y="68" width="19.5" height="456"/><rect class="mkr-falts" x="356" y="68" width="19.5" height="456"/>';
    s += '<path class="mkr-shov" d="M24 44L32 36H368L376 44V68H24Z"/><path class="mkr-shov" d="M24 524H376V548L368 556H32L24 548Z"/>';
    [46, 54, 62, 530, 538, 546].forEach(function (y) { s += '<line class="mkr-shtrih" x1="40" y1="' + y + '" x2="360" y2="' + y + '"/>'; });
    /* лицевая сторона: полоса завода, логотип, название */
    s += '<rect class="mkr-polosa" x="44" y="76" width="312" height="72"/>';
    s += '<g data-el="logo"><rect class="mkr-plashka" x="82" y="92" width="40" height="40" rx="8"/>' +
      '<circle class="mkr-gran" cx="95" cy="106" r="5"/><circle class="mkr-gran" cx="109" cy="106" r="5"/><circle class="mkr-gran" cx="102" cy="119" r="5"/></g>';
    nadpis.forEach(function (l, i) { s += text('mkr-zavod', 142, 112 + (i - (nadpis.length - 1) / 2) * 19, l, { attr: ' data-el="zavod"' }); });
    s += '<g data-el="nazvanie">';
    nz.lines.forEach(function (l, i) {
      l = pad(l, 18);
      s += text(nz.st.cls, CENTR_NAZV[0], CENTR_NAZV[1] + (i - (nz.lines.length - 1) / 2) * nz.st.step, l, { anchor: 'middle',
        attr: l.length > nz.st.znakov ? ' textLength="' + NAZV_SHIR + '" lengthAdjust="spacingAndGlyphs"' : '' });
    });
    s += '</g>';
    zn.forEach(function (k) { s += znak(k, SLOTY[k]); });
    if (r.massa) {
      s += text('mkr-massa-' + massa, CENTR_MASSA[0], CENTR_MASSA[1], r.massa, { anchor: 'middle', attr: ' data-el="massa"' });
    }
    s += '<rect class="mkr-plashka" x="44" y="470" width="312" height="36"/>' + text('mkr-podpis', 200, 488, PODPIS, { anchor: 'middle' });
    metki.forEach(function (m) { s += pin(m); });
    return s + '</svg>';
  }


  /* --- раздел «Макет печати» карточки продукта -----------------------------------------------
     Maket.mount(узел, produktId) рисует версии, рисунок с метками, замечания с ответами КЗПМ и
     ходы; после хода перерисовывает себя и зовёт Shell.refresh(). Читает DATA.produkt(id).maket
     и признаки mozhno, пишет ACT.zagruzitMaket, zamechanieKMaketu, otvetitNaZamechanie и
     soglasovatMaket. Своих правил доступности нет: кнопку или поле показывает признак DATA.
     Состояние экрана (открытая версия, поставленная метка, набранный текст) живёт здесь. */
  var STATES = [];
  var OSHIBKA_HODA = 'Действие не выполнено. Состояние макета уже изменилось. Обновите страницу, чтобы увидеть текущий шаг.';
  var KAKIE_ZNAKI = function (r) {
    return ((r && r.znaki) || []).filter(function (k) { return ZNAKI[k]; }).map(function (k) { return ZNAKI[k].title; });
  };

  function R() { return w.Render; }
  /* Правила полей замечания и ответа КЗПМ, тексты ошибок — в слое данных (formy). */
  function formy() { return w.DATA.spravochnik().formy; }
  function trim(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function nomera(list, odin, mnogo) {
    var a = list.slice();
    if (a.length === 1) { return odin + ' ' + a[0]; }
    return mnogo + ' ' + a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1];
  }
  function dataVremya(iso) { return R().data(iso) + ', ' + R().data(iso, { format: 'time' }); }
  function byN(list, n) { for (var i = 0; i < list.length; i++) { if (list[i].n === n) { return list[i]; } } return null; }

  function stateOf(uzel) {
    for (var i = 0; i < STATES.length; i++) { if (STATES[i].uzel === uzel) { return STATES[i]; } }
    return null;
  }
  function stateOfNode(node) {
    for (var i = 0; i < STATES.length; i++) { if (STATES[i].uzel.contains(node)) { return STATES[i]; } }
    return null;
  }
  function pusto(text) { return '<section class="card mk" data-mk><h2 class="h2 mk__h">Макет печати</h2><p class="muted mk__pusto">' + esc(text) + '</p></section>'; }

  function pinHtml(z, hl) {
    return '<button class="mk-pin' + (z.otvet ? ' is-otvecheno' : '') + (hl ? ' is-hl' : '') + (z.y < 9 ? ' is-niz' : '') + '" type="button" data-mk-ui="metka" data-nomer="' + esc(z.nomer) +
      '" style="left:' + esc(z.x) + '%;top:' + esc(z.y) + '%" aria-pressed="' + (hl ? 'true' : 'false') + '" aria-label="Замечание ' + esc(z.nomer) + ' на рисунке">' + esc(z.nomer) + '</button>';
  }

  function figura(s, p, ver, zms, jeTek) {
    var m = p.maket, mz = p.mozhno || {}, moj = !!mz.maketZamechanie && jeTek;
    var pins = zms.map(function (z) { return pinHtml(z, s.hl === z.nomer); }).join('');
    if (moj && s.nov) {
      pins += '<span class="mk-pin mk-pin--novaya' + (s.nov.y < 9 ? ' is-niz' : '') + '" style="left:' + esc(s.nov.x) + '%;top:' + esc(s.nov.y) + '%" aria-hidden="true">' + (zms.length + 1) + '</span>';
    }
    var tap = moj ? '<button class="mk-tap" type="button" data-act="mk-risunok" aria-label="Поставить метку на рисунке: нажмите на место, к которому относится замечание"></button>' : '';
    var prev = byN(m.versii, ver.n - 1), caption = [];
    caption.push('<p>Версия ' + esc(ver.n) + ' загружена ' + esc(dataVremya(ver.data)) + '. ' + esc(R().kto(ver.kto)) + '.</p>');
    if (ver.ispravleno && ver.ispravleno.length) {
      caption.push('<p>Исправлено по ' + esc(nomera(ver.ispravleno, 'замечанию', 'замечаниям')) + ' к версии ' + esc(ver.n - 1) + '.</p>');
    }
    if (prev) {
      var bez = m.zamechaniya.filter(function (z) { return z.versiya === prev.n && z.otvet && !z.otvet.prinyato; }).map(function (z) { return z.nomer; });
      if (bez.length) {
        caption.push('<p>' + (bez.length === 1 ? 'Замечание ' + esc(bez[0]) + ' в макет не внесено, в ответе КЗПМ дано пояснение.' :
          esc(nomera(bez, 'Замечание', 'Замечания')) + ' в макет не внесены, в ответах КЗПМ даны пояснения.') + '</p>');
      }
    }
    var zn = KAKIE_ZNAKI(ver.risunok);
    if (zn.length) { caption.push('<p>Манипуляционные знаки: ' + esc(zn.join(', ')) + '.</p>'); }
    if (ver.dokumentId) { caption.push('<p><a class="link-more" href="#doc=' + esc(encodeURIComponent(ver.dokumentId)) + '">Открыть как документ</a></p>'); }
    return '<figure class="mk-ris" data-risunok data-versiya="' + esc(ver.n) + '"><div class="mk-ris__sheet">' + risunok(ver, { metki: [] }) + tap + pins + '</div>' +
      (moj ? '<p class="mk-hint">Нажмите на рисунок, чтобы поставить метку. Нажмите ещё раз, чтобы передвинуть её.</p>' : '') +
      '<figcaption class="mk-ris__cap">' + caption.join('') + '</figcaption></figure>';
  }

  function otvetHtml(s, z) {
    if (z.otvet) {
      var prin = z.otvet.prinyato;
      return '<div class="mk-otvet" data-otvet-blok><p class="mk-otvet__head"><span class="badge ' + (prin ? 'badge--done' : 'badge--work') + '">' +
        (prin ? 'Принято в следующую версию' : 'Пояснение') + '</span><span class="mk-zm__kto">' + esc(R().kto(z.otvet.kto)) + ' · ' + esc(R().data(z.otvet.data)) + '</span></p>' +
        '<p class="mk-otvet__text">' + esc(z.otvet.text) + '</p></div>';
    }
    var s1 = '<p class="mk-otvet mk-otvet--zhdet"><span class="badge badge--wait">Ждёт ответа КЗПМ</span></p>';
    if (!z.mozhnoOtvetit) { return s1; }
    var err = s.err['otvet:' + z.id];
    return s1 + '<div class="mk-otvet-forma" data-id="' + esc(z.id) + '">' +
      '<label class="field__label label" for="mk-o-' + esc(z.id) + '">Ответ КЗПМ</label>' +
      '<textarea class="textarea' + (err ? ' input--error' : '') + '" id="mk-o-' + esc(z.id) + '" rows="2" data-pole="otvet" data-id="' + esc(z.id) + '"' + (err ? ' aria-invalid="true"' : '') + '></textarea>' +
      '<span class="field__err" data-err="otvet" data-id="' + esc(z.id) + '"' + (err ? ' role="alert"' : ' hidden') + '>' + esc(err || '') + '</span>' +
      (s.demoOtvet[z.id] ? '<span class="field__hint">Подставлен пример ответа.</span>' : '') +
      '<div class="mk-knopki"><button class="btn btn--primary btn--sm" type="button" data-act="mk-otvet" data-id="' + esc(z.id) + '" data-prinyato="1">Принято в следующую версию</button>' +
      '<button class="btn btn--secondary btn--sm" type="button" data-act="mk-otvet" data-id="' + esc(z.id) + '" data-prinyato="0">Ответить пояснением</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-act="mk-demo-otvet" data-id="' + esc(z.id) + '">Заполнить демо-данными</button></div></div>';
  }

  function spisok(s, p, ver, zms, jeTek) {
    var m = p.maket, mz = p.mozhno || {}, tek = m.tekushchaya;
    var h = '<div class="mk__zm"><div class="mk__zm-head"><h3 class="h3">Замечания к версии ' + esc(ver.n) + '</h3><span class="mk__count" aria-label="Число замечаний">' + zms.length + '</span></div>';
    if (zms.length) {
      h += '<ol class="mk-zm">' + zms.map(function (z) {
        var on = s.hl === z.nomer;
        return '<li class="mk-zm__item' + (on ? ' is-hl' : '') + '" data-zm="' + esc(z.id) + '" data-nomer="' + esc(z.nomer) + '" data-otvet="' +
          (z.otvet ? (z.otvet.prinyato ? 'prinyato' : 'poyasnenie') : 'net') + '">' +
          '<div class="mk-zm__top"><button class="mk-zm__n' + (z.otvet ? ' is-otvecheno' : '') + '" type="button" data-mk-ui="metka" data-nomer="' + esc(z.nomer) +
          '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="Показать метку ' + esc(z.nomer) + ' на рисунке">' + esc(z.nomer) + '</button>' +
          '<span class="mk-zm__kto">' + esc(R().kto(z.kto)) + '</span><span class="mk-zm__data">' + esc(R().data(z.data)) + '</span></div>' +
          '<p class="mk-zm__text">' + esc(z.text) + '</p>' + otvetHtml(s, z) + '</li>';
      }).join('') + '</ol>';
    } else if (m.soglasovano) {
      h += '<p class="muted">Замечаний к версии ' + esc(ver.n) + ' не было.</p>';
    } else if (mz.maketZamechanie && jeTek) {
      h += '<p class="muted">Замечаний к версии ' + esc(ver.n) + ' пока нет. Если макет вас устраивает, нажмите «Согласовать версию ' + esc(ver.n) + '». Чтобы внести правки, поставьте метку на рисунке и опишите замечание.</p>';
    } else {
      h += '<p class="muted">Замечаний к версии ' + esc(ver.n) + ' пока нет.</p>';
    }
    if (!jeTek && tek) {
      h += '<p class="mk__proshlaya muted">Это прошлая версия макета. Текущая версия ' + esc(tek) + '.' +
        (mz.maketZamechanie ? ' Новые замечания принимаются только к текущей версии.' : '') + '</p>';
    }
    return h + '</div>';
  }

  function forma(s, zms) {
    var et = s.err.text, em = s.err.metka;
    return '<div class="mk-forma" data-forma><h3 class="h3">Новое замечание</h3>' +
      '<p class="mk-forma__metka">' + (s.nov ? 'Метка ' + (zms.length + 1) + ' поставлена на рисунке. <button class="link-btn" type="button" data-act="mk-metka-ubrat">Убрать метку</button>' :
        'Метка не поставлена. Нажмите на то место рисунка, к которому относится замечание.') + '</p>' +
      '<span class="field__err" data-err="metka"' + (em ? ' role="alert"' : ' hidden') + '>' + esc(em || '') + '</span>' +
      '<label class="field__label label" for="mk-text">Текст замечания</label>' +
      '<textarea class="textarea' + (et ? ' input--error' : '') + '" id="mk-text" rows="3" data-pole="text"' + (et ? ' aria-invalid="true"' : '') + '></textarea>' +
      '<span class="field__err" data-err="text"' + (et ? ' role="alert"' : ' hidden') + '>' + esc(et || '') + '</span>' +
      '<div class="mk-knopki"><button class="btn btn--primary btn--sm" type="button" data-act="mk-otpravit">Отправить замечание</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-act="mk-demo">Заполнить демо-данными</button></div></div>';
  }

  /* Решение по текущей версии: у заказчика «Согласовать», у менеджера — загрузка следующей версии. */
  function reshenie(p, ver) {
    var m = p.maket, mz = p.mozhno || {}, me = w.DATA.me() || {}, tek = m.tekushchaya, h = '';
    var otkr = m.zamechaniya.filter(function (z) { return z.versiya === tek && !z.otvet; }).length;
    if (me.rol === 'zakazchik' && !m.soglasovano && tek) {
      h += '<div class="mk__reshenie"><button class="btn btn--primary" type="button" data-act="mk-soglasovat"' + (mz.maketSoglasovat ? '' : ' disabled') +
        ' aria-describedby="mk-soglasovat-hint">Согласовать версию ' + esc(tek) + '</button>' +
        '<p class="mk__hint muted" id="mk-soglasovat-hint">' + (mz.maketSoglasovat ?
          'После согласования замечания к макету больше не принимаются, а заказ с этим продуктом можно оформить.' :
          (otkr ? 'Согласовать можно после ответа КЗПМ на все замечания к версии ' + esc(tek) + '.' : '')) + '</p></div>';
    }
    if (mz.maketVersiya) {
      h += '<div class="mk__reshenie"><button class="btn ' + (m.versii.length ? 'btn--secondary' : 'btn--primary') + '" type="button" data-act="mk-zagruzit">' +
        (m.versii.length ? 'Загрузить следующую версию' : 'Загрузить макет') + '</button>' +
        '<p class="mk__hint muted">' + (m.versii.length ? 'Заказчик получит новую версию на согласование. Замечания, принятые в следующую версию, будут отмечены в ней как исправленные.' :
          'Заказчик получит макет на согласование.') + '</p></div>';
    }
    return h;
  }

  function razdel(s) {
    var p = w.DATA.produkt(s.id);
    if (!p) { return pusto('Продукта нет в кабинете или он относится к другому предприятию.'); }
    if (!p.maket) { return pusto('У этого продукта печати нет, согласовывать макет не нужно.'); }
    var m = p.maket, mz = p.mozhno || {}, sogl = m.soglasovano;
    var status;
    if (sogl) {
      status = '<div class="mk__soglasovano"><span class="badge badge--done">Согласовано</span><p>Версия ' + esc(sogl.versiya) + ' согласована ' + esc(R().data(sogl.data)) + '. ' + esc(R().kto(sogl.kto)) + '.</p></div>';
    } else if (m.naKom) {
      status = R().naKom({ naKom: m.naKom, srokOtveta: m.srokOtveta }) + (m.shag ? '<p class="mk__shag">' + esc(m.shag) + '</p>' : '');
    } else { status = ''; }
    var head = '<div class="mk__head"><h2 class="h2 mk__h" id="mk-h">Макет печати</h2><div class="mk__status">' + status + '</div></div>' +
      (s.oshibka ? '<p class="mk__oshibka field__err" role="alert">' + esc(s.oshibka) + '</p>' : '');
    var attrs = ' data-mk data-produkt="' + esc(p.id) + '" aria-labelledby="mk-h"';
    if (!m.versii.length) {
      var kogda = p.etap === 'odobren' ? 'Макет печати ещё не загружен.' : 'Макет печати согласуется после того, как образец будет одобрен.';
      return '<section class="card mk"' + attrs + '>' + head + '<p class="muted mk__pusto">' + esc(kogda) + '</p>' + reshenie(p, null) + '</section>';
    }
    var tek = m.tekushchaya, n = s.n && byN(m.versii, s.n) ? s.n : tek, ver = byN(m.versii, n), jeTek = n === tek;
    var zms = m.zamechaniya.filter(function (z) { return z.versiya === n; });
    var tabs = '<div class="tabs mk__versii" role="group" aria-label="Версии макета">' + m.versii.map(function (v) {
      var on = v.n === n;
      return '<button class="tab' + (on ? ' is-active' : '') + '" type="button" data-mk-ui="versiya" data-versiya="' + esc(v.n) + '" aria-pressed="' + (on ? 'true' : 'false') + '">Версия ' +
        esc(v.n) + (v.n === tek ? ' <span class="tab__count">текущая</span>' : '') + '</button>';
    }).join('') + '</div>';
    var mozhetMetku = !!mz.maketZamechanie && jeTek;
    return '<section class="card mk"' + attrs + ' data-versiya="' + esc(n) + '" data-tekushchaya="' + esc(tek) + '">' + head + tabs +
      '<div class="mk__grid"><div class="mk__left">' + figura(s, p, ver, zms, jeTek) + '</div>' +
      '<div class="mk__right">' + spisok(s, p, ver, zms, jeTek) + (mozhetMetku ? forma(s, zms) : '') + reshenie(p, ver) + '</div></div></section>';
  }

  /* --- перерисовка с сохранением набранного и фокуса ------------------------------------------ */
  function snimok(s) {
    if (s.bezSnimka) { s.bezSnimka = false; return; }
    var t = s.uzel.querySelector('textarea[data-pole="text"]');
    if (t) { s.draft.text = t.value; }
    Array.prototype.forEach.call(s.uzel.querySelectorAll('textarea[data-pole="otvet"]'), function (o) { s.draft.otvet[o.getAttribute('data-id')] = o.value; });
  }
  function fokusKey(s) {
    var a = document.activeElement;
    if (!a || !s.uzel.contains(a) || a === s.uzel) { return null; }
    var key = a.getAttribute('data-act') ? '[data-act="' + a.getAttribute('data-act') + '"]' : a.getAttribute('data-mk-ui') ? '[data-mk-ui="' + a.getAttribute('data-mk-ui') + '"]' :
      a.getAttribute('data-pole') ? '[data-pole="' + a.getAttribute('data-pole') + '"]' : null;
    if (!key) { return null; }
    ['data-nomer', 'data-id', 'data-versiya', 'data-prinyato'].forEach(function (k) { if (a.getAttribute(k) !== null) { key += '[' + k + '="' + a.getAttribute(k) + '"]'; } });
    return key;
  }
  function render(s, fokus) {
    snimok(s);
    var key = fokus || fokusKey(s);
    s.uzel.innerHTML = razdel(s);
    var t = s.uzel.querySelector('textarea[data-pole="text"]');
    if (t) { t.value = s.draft.text; }
    Array.prototype.forEach.call(s.uzel.querySelectorAll('textarea[data-pole="otvet"]'), function (o) { o.value = s.draft.otvet[o.getAttribute('data-id')] || ''; });
    var el = key ? s.uzel.querySelector(key) : null;
    if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }
  function posleHoda(s) {
    s.err = {}; s.oshibka = '';
    render(s);
    if (w.Shell && typeof w.Shell.refresh === 'function') { w.Shell.refresh(); }
  }
  function neVyshlo(s) { s.oshibka = OSHIBKA_HODA; render(s); }

  /* --- действия: Shell.on('mk-…') ------------------------------------------------------------- */
  function pozitsiya(btn, e) {
    /* без указателя (Enter на кнопке, программный щелчок) метка встаёт в центр рисунка */
    var r = btn.getBoundingClientRect();
    if (!e || !(e.clientX || e.clientY) || !r.width || !r.height) { return { x: 50, y: 50 }; }
    return { x: r1(ogranichit((e.clientX - r.left) / r.width * 100, 0, 100)), y: r1(ogranichit((e.clientY - r.top) / r.height * 100, 0, 100)) };
  }
  /* Просмотр (версия, подсветка метки) ничего не меняет в данных и есть у каждой роли, поэтому
     data-act у него нет: у директора и службы сервиса в разделе нет ни одного действия.
     Щелчок ловит слушатель на узле раздела. */
  var PROSMOTR = {
    versiya: function (s, b) { s.n = parseInt(b.getAttribute('data-versiya'), 10); s.hl = null; render(s); },
    metka: function (s, b) {
      var n = parseInt(b.getAttribute('data-nomer'), 10);
      s.hl = s.hl === n ? null : n;
      render(s);
    }
  };
  var HODY = {
    'mk-risunok': function (s, b, e) { s.nov = pozitsiya(b, e); s.err.metka = ''; render(s, '[data-pole="text"]'); },
    'mk-metka-ubrat': function (s) { s.nov = null; render(s); },
    'mk-demo': function (s) {
      var d = w.DATA.demo('maketZamechanie');
      if (!d) { return; }
      snimok(s);
      s.nov = { x: d.x, y: d.y }; s.draft.text = d.text; s.err = {}; s.bezSnimka = true;
      render(s, '[data-pole="text"]');
    },
    'mk-otpravit': function (s) {
      snimok(s);
      var text = trim(s.draft.text), e = w.Shell.proverit(formy().maketZamechanie, { text: text, metka: s.nov ? s.nov.x + ' ' + s.nov.y : '' });
      s.err = { text: e.text || '', metka: e.metka || '' };
      if (s.err.text || s.err.metka) { render(s, s.err.text ? '[data-pole="text"]' : '[data-act="mk-risunok"]'); return; }
      var id = w.ACT.zamechanieKMaketu(s.id, { x: s.nov.x, y: s.nov.y, text: text });
      if (id === null || id === undefined) { neVyshlo(s); return; }
      s.nov = null; s.draft.text = ''; s.hl = null; s.n = null; s.bezSnimka = true;
      posleHoda(s);
    },
    'mk-demo-otvet': function (s, b) {
      var id = b.getAttribute('data-id'), d = w.DATA.demo('maketOtvet');
      if (!d) { return; }
      snimok(s);
      s.draft.otvet[id] = d.text; s.demoOtvet[id] = true; delete s.err['otvet:' + id]; s.bezSnimka = true;
      render(s, '[data-pole="otvet"][data-id="' + id + '"]');
    },
    'mk-otvet': function (s, b) {
      snimok(s);
      var id = b.getAttribute('data-id'), prinyato = b.getAttribute('data-prinyato') === '1', text = trim(s.draft.otvet[id]);
      var e = w.Shell.proverit(formy().maketOtvet[prinyato ? 'prinyato' : 'poyasnenie'], { text: text });
      if (e.text) {
        s.err['otvet:' + id] = e.text;
        render(s, '[data-pole="otvet"][data-id="' + id + '"]');
        return;
      }
      var r = w.ACT.otvetitNaZamechanie(id, { text: text, prinyato: prinyato });
      if (r === null || r === undefined) { neVyshlo(s); return; }
      delete s.draft.otvet[id]; delete s.demoOtvet[id]; s.bezSnimka = true;
      posleHoda(s);
    },
    'mk-soglasovat': function (s) {
      var r = w.ACT.soglasovatMaket(s.id);
      if (r === null || r === undefined) { neVyshlo(s); return; }
      s.nov = null; s.hl = null; s.n = null;
      posleHoda(s);
    },
    'mk-zagruzit': function (s) {
      var r = w.ACT.zagruzitMaket(s.id);
      if (r === null || r === undefined) { neVyshlo(s); return; }
      s.n = null; s.hl = null;
      posleHoda(s);
    }
  };
  function slushat(uzel) {
    if (uzel.getAttribute('data-mk-slushatel')) { return; }
    uzel.setAttribute('data-mk-slushatel', '1');
    uzel.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-mk-ui]') : null;
      var s = b ? stateOf(uzel) : null;
      if (!b || !s || !uzel.contains(b) || !PROSMOTR[b.getAttribute('data-mk-ui')]) { return; }
      e.preventDefault();
      PROSMOTR[b.getAttribute('data-mk-ui')](s, b);
    });
  }
  var AKTY = false;
  function zaregistrirovat() {
    if (AKTY || !w.Shell || typeof w.Shell.on !== 'function') { return; }
    AKTY = true;
    Object.keys(HODY).forEach(function (name) {
      w.Shell.on(name, function (btn, e) {
        var s = stateOfNode(btn);
        if (s) { HODY[name](s, btn, e); }
      });
    });
  }

  function mount(uzel, produktId) {
    if (!uzel || !w.DATA || !w.Render) { return; }
    STATES = STATES.filter(function (x) { return x.uzel === uzel || document.documentElement.contains(x.uzel); });
    var s = stateOf(uzel);
    if (!s || s.id !== produktId) {
      if (s) { STATES.splice(STATES.indexOf(s), 1); }
      s = { uzel: uzel, id: produktId, n: null, nov: null, hl: null, draft: { text: '', otvet: {} }, demoOtvet: {}, err: {}, oshibka: '' };
      STATES.push(s);
    }
    zaregistrirovat();
    slushat(uzel);
    render(s);
  }

  w.Maket = {
    mount: mount,
    risunok: risunok
  };
})(window);

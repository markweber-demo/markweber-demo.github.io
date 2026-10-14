/* Запрос расчёта и образца — zapros-novyy.html. Владелец — таск 04 (сценарий А, G01, R30).

   zapros-novyy.html[?tip=<продукт каталога>]. Страница заказчика. Продукт приходит
   адресом (кнопка на странице товара сайта или в «Продуктах и образцах») и уже выбран
   в форме; весь каталог — группами, как на сайте. Не больше десяти полей: продукт КЗПМ,
   продукт фасовки, вес, размеры, толщина, печать (с числом цветов и макетом),
   ламинирование, объём в год, комментарий. Для компаундов поля мешка заменяются
   маркой, назначением и объёмом в год. Услуги завода — печать, ламинирование и
   лаборатория — видны в самой форме.

   Ошибка словами у поля, введённое остаётся; черновик (Store, ключ 'zapros:novyy')
   переживает уход со страницы. «Отправить» — ACT.otpravitZapros(draftId, форма),
   повтор с тем же draftId не создаёт второй запрос; после отправки черновик
   забывается, экран показывает [data-sent=<id продукта>].
   Обязательные поля, форматы и тексты ошибок — из справочника (formy.zapros), правила ходов — в ACT. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, ACT = w.ACT, Shell = w.Shell, Store = w.Store;

  if (!Shell.mount({ active: 'produkty', role: 'zakazchik' })) { return; }

  var page = document.getElementById('page');
  var KEY = 'zapros:novyy';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';
  var SP = DATA.spravochnik();
  var KAT = SP.katalog || [];
  var oshibki = {};

  function trim(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function tipOf(tip) {
    for (var i = 0; i < KAT.length; i++) { if (KAT[i].tip === tip) { return KAT[i]; } }
    return null;
  }

  /* --- черновик: продукт из адреса, иначе ранее выбранный, иначе первый каталога -- */
  function chernovik() {
    var d = Store.draft(KEY);
    var param = R.param('tip');
    var kat = param ? tipOf(param) : null;
    if (kat && d.tipAdres !== param) { d.tip = kat.tip; d.tipAdres = param; d = Store.setDraft(KEY, d); }
    if (!d.tip || !tipOf(d.tip)) { d.tip = KAT[0] ? KAT[0].tip : 'ffs-meshki'; d = Store.setDraft(KEY, d); }
    return d;
  }
  /* Поля формы → черновик: введённое переживает ошибку, смену продукта и уход со страницы. */
  function sobrat() {
    var d = Store.draft(KEY), f = document.getElementById('zp-forma');
    if (f) {
      Array.prototype.forEach.call(f.querySelectorAll('[name]'), function (el) {
        if (el.type === 'file') { return; }
        if (el.type === 'radio') { if (el.checked) { d[el.name] = el.value; } return; }
        d[el.name] = el.value;
      });
    }
    return Store.setDraft(KEY, d);
  }

  /* --- разметка формы -------------------------------------------------------- */
  function val(d, k) { return d[k] === undefined || d[k] === null ? '' : d[k]; }
  function inp(d, name, extra) {
    return '<input class="input' + (oshibki[name] ? ' input--error' : '') + '" type="text" name="' + name + '" value="' + esc(val(d, name)) + '"' +
      (oshibki[name] ? ' aria-invalid="true"' : '') + ' autocomplete="off"' + (extra || '') + '>';
  }
  function err(name) {
    return '<span class="field__err" data-err="' + name + '" aria-live="polite"' + (oshibki[name] ? '' : ' hidden') + '>' + esc(oshibki[name] || '') + '</span>';
  }
  /* Поле формы — одна подпись и один ввод; число цветов и макет живут внутри поля «Печать». */
  function pole(name, label, input, hint, cls) {
    return '<label class="field zp-pole' + (cls ? ' ' + cls : '') + '" data-pole="' + name + '"><span class="field__label">' + esc(label) + '</span>' + input +
      (hint ? '<span class="field__hint">' + esc(hint) + '</span>' : '') + err(name) + '</label>';
  }
  function vybory(name, opts, tek) {
    return '<span class="zp-vybory">' + opts.map(function (o) {
      return '<label class="zp-vybor"><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (String(tek) === o[0] ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>';
    }).join('') + '</span>';
  }
  function gruppa(name, legend, opts, tek, vnutri, cls) {
    return '<fieldset class="field zp-pole' + (cls ? ' ' + cls : '') + '" data-pole="' + name + '"><legend class="field__label">' + esc(legend) + '</legend>' +
      vybory(name, opts, tek) + (vnutri || '') + '</fieldset>';
  }

  /* Каталог группами, как на сайте: «Полимерные пленки» и «Компаунды». */
  function katalog(d) {
    var gruppy = [];
    KAT.forEach(function (k) { if (gruppy.indexOf(k.gruppa) < 0) { gruppy.push(k.gruppa); } });
    return '<fieldset class="field zp-pole zp-pole--vse zp-katalog" data-pole="tip"><legend class="field__label">Продукт КЗПМ</legend>' +
      gruppy.map(function (g) {
        return '<div class="zp-katalog__gruppa"><p class="zp-katalog__nazvanie">' + esc(g) + '</p>' +
          vybory('tip', KAT.filter(function (k) { return k.gruppa === g; }).map(function (k) { return [k.tip, k.title]; }), d.tip) + '</div>';
      }).join('') + '</fieldset>';
  }

  function pechat(d) {
    var tsvet = d.pechat === 'tsvetnaya';
    var dop = '';
    if (tsvet) {
      dop = '<span class="zp-pechat-dop">' +
        '<label class="zp-pod" data-pole="tsvetov"><span class="field__label">Число цветов</span>' + inp(d, 'tsvetov', ' inputmode="numeric"') +
          '<span class="field__hint">Если число цветов неизвестно, оставьте поле пустым.</span>' + err('tsvetov') + '</label>' +
        '<span class="zp-pod zp-pod--maket"><span class="field__label">Макет печати</span>' +
          '<span class="zp-fayl"><label class="btn btn--secondary btn--sm zp-fayl__vybor">Приложить макет<input type="file" name="maketFayl"></label>' +
          '<span class="zp-fayl__imya" data-fayl-imya>' + esc(d.maketName || 'Файл не выбран') + '</span></span>' +
          '<span class="field__hint">Макет можно приложить сейчас или позже.</span></span>' +
        '</span>';
    }
    return gruppa('pechat', 'Печать', [['net', 'Без печати'], ['tsvetnaya', 'Цветная печать']], tsvet ? 'tsvetnaya' : 'net', dop, 'zp-pole--vse');
  }

  function forma(d) {
    var kat = tipOf(d.tip) || {}, komp = !!kat.kompaund, meshok = kat.tip === 'ffs-meshki';
    var polya = [katalog(d)];
    if (komp) {
      polya.push(
        pole('marka', 'Марка', inp(d, 'marka'), 'Если марка неизвестна, оставьте поле пустым. Марку подберёт лаборатория КЗПМ.'),
        pole('naznachenie', 'Назначение', inp(d, 'naznachenie'), 'Для чего нужен компаунд.'),
        pole('obemGod', 'Объём в год, т', inp(d, 'obemGod', ' inputmode="decimal"'))
      );
    } else {
      polya.push(
        pole('produktFasovki', 'Продукт фасовки', inp(d, 'produktFasovki'), 'Что вы фасуете или упаковываете.'),
        pole('vesFasovki', 'Вес фасовки, кг', inp(d, 'vesFasovki', ' inputmode="decimal"')),
        pole('razmery', meshok ? 'Размеры мешка' : 'Размеры', inp(d, 'razmery'),
          meshok ? 'Ширина и длина мешка в миллиметрах, глубина фальца.' : 'Ширина плёнки или рукава в миллиметрах, глубина фальца.'),
        pole('tolshchina', 'Толщина плёнки, мкм', inp(d, 'tolshchina', ' inputmode="decimal"'),
          'Если толщина неизвестна, оставьте поле пустым. Толщину подберёт лаборатория КЗПМ.'),
        pechat(d),
        gruppa('laminirovanie', 'Ламинирование', [['false', 'Не нужно'], ['true', 'Нужно']], d.laminirovanie === 'true' ? 'true' : 'false'),
        pole('obemGod', 'Объём в год, т', inp(d, 'obemGod', ' inputmode="decimal"'))
      );
    }
    polya.push('<label class="field zp-pole zp-pole--vse" data-pole="kommentariy"><span class="field__label">Комментарий</span>' +
      '<textarea class="textarea' + '" name="kommentariy" rows="3">' + esc(val(d, 'kommentariy')) + '</textarea></label>');
    return '<form class="zp-forma" id="zp-forma" novalidate aria-label="Запрос расчёта и образца">' +
      '<div class="zp-polya">' + polya.join('') + '</div>' +
      (oshibki.obshchaya ? '<p class="field__err zp-forma__oshibka" role="alert">' + esc(oshibki.obshchaya) + '</p>' : '') +
      '<div class="zp-knopki"><button class="btn btn--primary btn--lg" type="submit" data-act="zp-send">Отправить запрос</button>' +
        '<button class="btn btn--secondary btn--lg" type="button" data-act="zp-demo">Заполнить демо-данными</button></div>' +
      '</form>';
  }

  /* --- справа: что будет дальше и услуги завода -------------------------------- */
  var OPISANIE = {
    zapros: 'Вы отправляете параметры продукта.',
    raschet: 'Менеджер по продажам отправляет расчёт.',
    retseptura: 'Лаборатория КЗПМ подбирает рецептуру.',
    obraztsy: 'Лаборатория КЗПМ отправляет образцы.',
    ispytaniya: 'Вы испытываете образцы на своей линии и прикладываете протокол.',
    odobren: 'Вы отмечаете, что образец подходит, и оформляете заявку.'
  };
  function bokovaya() {
    var shagi = SP.etapyOtrabotki.map(function (e, i) {
      return '<li class="zp-shagi__item"><span class="zp-shagi__n" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span><span class="zp-shagi__title">' + esc(e.title) + '</span><span class="zp-shagi__text">' + esc(OPISANIE[e.id] || '') + '</span></span></li>';
    }).join('');
    var uslugi = (DATA.zavod().uslugi || []).map(function (u) { return '<li>' + esc(u.title) + '</li>'; }).join('');
    return '<aside class="zp-bok" aria-label="Что будет дальше">' +
      '<section class="card zp-dalshe"><h2 class="h3">Что будет дальше</h2><ol class="zp-shagi">' + shagi + '</ol></section>' +
      '<section class="card zp-uslugi"><h2 class="h3">Услуги КЗПМ в запросе</h2><ul>' + uslugi + '</ul>' +
        '<p class="zp-uslugi__hint">Печать и ламинирование выбираются в форме. Толщину и рецептуру подбирает лаборатория.</p></section>' +
      '</aside>';
  }

  /* --- экран ------------------------------------------------------------------- */
  function shapka(title, lead) {
    return '<nav class="crumbs" aria-label="Путь"><a href="produkty.html">Продукты и образцы</a><span>Запрос расчёта и образца</span></nav>' +
      '<div class="page-head"><div class="page-head__main"><h1 class="h1">' + esc(title) + '</h1>' + (lead ? '<p class="page-lead">' + esc(lead) + '</p>' : '') + '</div></div>';
  }
  function risovat() {
    document.title = 'Запрос расчёта и образца — ' + NAZVANIE;
    var d = chernovik();
    page.innerHTML = shapka('Запрос расчёта и образца',
      'Заполните параметры продукта. Менеджер по продажам отправит расчёт, лаборатория подберёт рецептуру и отправит образцы на испытания.') +
      '<div class="grid grid--side zp-ryad"><div class="zp-osnova" id="zp-slot">' + forma(d) + '</div>' + bokovaya() + '</div>';
  }
  function perersovat(fokus) {
    var slot = document.getElementById('zp-slot'), d = Store.draft(KEY);
    if (!slot) { risovat(); return; }
    slot.innerHTML = forma(d);
    var el = fokus ? slot.querySelector('[name="' + fokus.name + '"][value="' + fokus.value + '"]') : slot.querySelector('[aria-invalid="true"]');
    if (el) { try { el.focus(); } catch (e) { /* фокус не обязателен */ } }
  }
  function snyatOshibku(name) {
    if (!oshibki[name]) { return; }
    delete oshibki[name];
    var f = document.getElementById('zp-forma');
    if (!f) { return; }
    var e = f.querySelector('[data-err="' + name + '"]'), el = f.querySelector('[name="' + name + '"]');
    if (e) { e.textContent = ''; e.hidden = true; }
    if (el) { el.classList.remove('input--error'); el.removeAttribute('aria-invalid'); }
  }

  /* --- проверка и отправка -------------------------------------------------------- */
  /* Варианты формы — как поля на экране: компаунд, FFS-мешок, остальные плёнки. Правила и тексты
     ошибок — в слое данных (formy.zapros); проверяется очищенная форма, та же, что уходит в ACT. */
  function proverit(d) {
    var kat = tipOf(d.tip) || {};
    var pravila = SP.formy.zapros[kat.kompaund ? 'kompaund' : kat.tip === 'ffs-meshki' ? 'meshok' : 'plenka'];
    return Shell.proverit(pravila, formaZaprosa(d));
  }
  function chistoe(v) { return trim(v).replace(/\s/g, '').replace(',', '.'); }
  function formaZaprosa(d) {
    var kat = tipOf(d.tip) || {}, f = { tip: d.tip };
    if (kat.kompaund) {
      f.marka = trim(d.marka); f.naznachenie = trim(d.naznachenie); f.obemGod = chistoe(d.obemGod); f.kommentariy = trim(d.kommentariy);
      return f;
    }
    f.produktFasovki = trim(d.produktFasovki); f.vesFasovki = chistoe(d.vesFasovki); f.razmery = trim(d.razmery);
    f.tolshchina = chistoe(d.tolshchina) || null;
    f.pechat = d.pechat === 'tsvetnaya' ? 'tsvetnaya' : 'net';
    f.tsvetov = f.pechat === 'tsvetnaya' ? (chistoe(d.tsvetov) || null) : null;
    f.laminirovanie = d.laminirovanie === 'true';
    f.obemGod = chistoe(d.obemGod); f.kommentariy = trim(d.kommentariy);
    if (f.pechat === 'tsvetnaya' && d.maketName) { f.maketFayl = { name: d.maketName }; }
    return f;
  }

  function otpravleno(pid) {
    var p = DATA.produkt(pid);
    document.title = 'Запрос отправлен — ' + NAZVANIE;
    page.innerHTML = shapka('Запрос отправлен', '') +
      '<section class="card zp-otpravleno" data-sent="' + esc(pid) + '" aria-live="polite">' +
        '<h2 class="h2">Запрос отправлен в КЗПМ</h2>' +
        (p ? '<p class="zp-otpravleno__produkt">' + esc(p.nazvanie) + '</p>' + R.shag(p, { dni: false, gotovo: 'Запрос принят.' }) : '') +
        '<p>Менеджер по продажам отправит расчёт, лаборатория подберёт рецептуру и отправит образцы. Ход запроса виден в карточке продукта.</p>' +
        '<div class="zp-knopki"><a class="btn btn--primary" href="produkt.html?id=' + esc(encodeURIComponent(pid)) + '">Открыть карточку продукта</a>' +
          '<a class="btn btn--secondary" href="produkty.html">Все продукты и образцы</a>' +
          '<button class="btn btn--ghost" type="button" data-act="zp-novyi">Отправить ещё один запрос</button></div>' +
      '</section>';
    window.scrollTo(0, 0);
  }

  Shell.on('zp-send', function () {
    var d = sobrat();
    oshibki = proverit(d);
    if (Object.keys(oshibki).length) { perersovat(); return; }
    var pid = ACT.otpravitZapros(d.draftId, formaZaprosa(d));
    if (!pid) {
      oshibki = { obshchaya: 'Запрос не удалось отправить. Проверьте поля и попробуйте ещё раз.' };
      perersovat();
      return;
    }
    Store.setDraft(KEY, null);
    oshibki = {};
    otpravleno(pid);
    Shell.refresh();
  });
  Shell.on('zp-demo', function () {
    var d = sobrat(), kat = tipOf(d.tip) || {}, komp = !!kat.kompaund;
    var x = DATA.demo(komp ? 'zaprosKompaund' : 'zapros') || {};
    function s(v) { return v === null || v === undefined ? '' : String(v); }
    if (komp) {
      if (x.tip === d.tip) { d.marka = s(x.marka); }
      d.naznachenie = s(x.naznachenie); d.obemGod = s(x.obemGod); d.kommentariy = s(x.kommentariy);
    } else {
      d.produktFasovki = s(x.produktFasovki); d.vesFasovki = s(x.vesFasovki); d.razmery = s(x.razmery); d.tolshchina = s(x.tolshchina);
      d.pechat = x.pechat === 'tsvetnaya' ? 'tsvetnaya' : 'net'; d.tsvetov = s(x.tsvetov);
      d.laminirovanie = x.laminirovanie ? 'true' : 'false'; d.obemGod = s(x.obemGod); d.kommentariy = s(x.kommentariy);
    }
    Store.setDraft(KEY, d);
    oshibki = {};
    perersovat();
  });
  Shell.on('zp-novyi', function () {
    Store.setDraft(KEY, null);
    oshibki = {};
    risovat();
  });

  function vvod(e) {
    var el = e.target;
    if (!el || !el.name || !el.closest || !el.closest('#zp-forma')) { return; }
    if (el.type === 'file') {
      var d = Store.draft(KEY);
      d.maketName = el.files && el.files[0] ? el.files[0].name : '';
      Store.setDraft(KEY, d);
      var imya = document.querySelector('[data-fayl-imya]');
      if (imya) { imya.textContent = d.maketName || 'Файл не выбран'; }
      return;
    }
    if (e.type === 'input' && el.type === 'radio') { return; }
    sobrat();
    snyatOshibku(el.name);
    if (e.type === 'change' && (el.name === 'tip' || el.name === 'pechat')) {
      oshibki = {};
      perersovat({ name: el.name, value: el.value });
    }
  }
  page.addEventListener('input', vvod);
  page.addEventListener('change', vvod);
  /* Enter в поле нажимает «Отправить запрос» через data-act; сама форма никуда не отправляется. */
  page.addEventListener('submit', function (e) { e.preventDefault(); });

  risovat();
})(window);

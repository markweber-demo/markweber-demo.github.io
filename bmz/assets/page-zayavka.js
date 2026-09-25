/* Новая заявка — zayavka-novaya.html. Экран заказчика, таск 05.

   Опросный лист АВО «для заказа» по шагам: разделы и формулировки завода,
   сокращённые до демо (Адель 25.09). Черновик — Store.draft(KEY): поля,
   шаг, схема и id отправленной заявки. Отправка — ACT.otpravitZayavku(draftId,
   forma): тот же draftId вернёт тот же id, поэтому повторное нажатие дубля
   не создаёт.

   Короткий лист (Адель 25.09, «ужать»): 10 полей ввода — позиция, обозначение,
   среда, расход, нагрузка, давление, две температуры, гарантия, ЗИП; плюс
   выбор статуса и шеф-монтажа и файл схемы. Количества, режима листа
   и документации нет. Демо-данные — только из DATA.oprosnyShablon('avo').

   Ключи формы совпадают со словарём OPROS карточки аппарата (page-apparat.js):
   status, techPoz, sreda, rashod, davlenieRaschetnoe, tempVhod, tempVyhod,
   nagruzka, garantiyaMes, zip, shefMontazh, skhema; плюс tip и oboznachenie —
   поля самого аппарата. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA, ACT = w.ACT, Store = w.Store;

  if (!w.Shell.mount({ active: 'zayavka', role: 'zakazchik' })) { return; }
  var page = document.getElementById('page');
  var Sh = w.Shell;

  var KEY = 'zayavka-novaya';
  var ZAMENA = 'Замена изношенного';
  var STEPS = [
    { title: 'Общие сведения', fields: [
      { key: 'status', label: 'Статус аппарата', type: 'radio', req: true, options: [ZAMENA, 'Модернизация', 'Вновь вводимое'] },
      { key: 'predpriyatie', type: 'fixed' },
      { key: 'techPoz', label: 'Технологическая позиция', type: 'text', req: true, ph: 'например, ВХ-115' },
      { key: 'oboznachenie', label: 'Условное обозначение', type: 'text', reqIf: function (f) { return f.status === ZAMENA; },
        ph: 'как на табличке заменяемого аппарата',
        hint: function (f) { return f.status === ZAMENA ? 'Обязательно для замены, по нему завод найдёт исходный расчёт и чертёж.'
          : 'Для нового аппарата обозначение назначит завод после расчёта, поле можно оставить пустым.'; } }
    ] },
    { title: 'Условия работы', fields: [
      { key: 'sreda', label: 'Рабочая среда', type: 'text', req: true, wide: true, ph: 'например, дизельная фракция' },
      { key: 'rashod', label: 'Расход', type: 'num', unit: 'т/ч', req: true },
      { key: 'nagruzka', label: 'Тепловая нагрузка', type: 'num', unit: 'МВт', req: true },
      { key: 'davlenieRaschetnoe', label: 'Давление расчётное', type: 'num', unit: 'МПа', req: true },
      { key: 'tempVhod', label: 'Температура на входе', type: 'num', unit: '°C', req: true, sign: true },
      { key: 'tempVyhod', label: 'Температура на выходе', type: 'num', unit: '°C', req: true, sign: true }
    ] },
    { title: 'Объём поставки и документация', cols: 3, fields: [
      { key: 'garantiyaMes', label: 'Гарантия', type: 'int', unit: 'мес.', req: true, min: 1, max: 120 },
      { key: 'zip', label: 'ЗИП с указанием периода', type: 'text', ph: 'на два года' },
      { key: 'shefMontazh', label: 'Шеф-монтаж', type: 'radio', req: true, options: ['Да', 'Нет'] },
      { key: 'skhema', label: 'Схема аппарата с привязочными размерами штуцеров', type: 'file', wide: true }
    ] }
  ];
  var DRUGIE = ['Теплообменный аппарат', 'Ёмкостный аппарат', 'Цепной привод'];
  /* Минус — и дефис «-», и типографский «−» (U+2212). */
  var NUM = /^[-\u2212]?\d+(?:[.,]\d+)?$/;
  function chisloIz(v) { return parseFloat(String(v).trim().replace(',', '.').replace('\u2212', '-')); }

  var d = Store.draft(KEY);        // { draftId, tip, step, f, skhema, sent }
  var errs = {};
  var preview = null;              // превью выбранного изображения живёт в памяти страницы

  function f() { d.f = d.f || {}; return d.f; }
  function save() { d = Store.setDraft(KEY, d); }
  function step() { return Math.min(3, Math.max(1, +d.step || 1)); }
  function spr() { return DATA.spravochnik() || {}; }
  function me() { return DATA.me() || {}; }
  function zakName() { var m = me(), z = m.zakazchikId ? DATA.zakazchik(m.zakazchikId) : null; return z ? z.name : ''; }
  function val(k) { var v = f()[k]; return v === undefined || v === null ? '' : String(v); }

  /* --- проверка ------------------------------------------------------------ */
  function required(fd) { return fd.req || (fd.reqIf && fd.reqIf(f())); }
  function check(fd) {
    var v = val(fd.key).trim();
    if (fd.type === 'fixed' || fd.type === 'file') { return null; }
    if (!v) {
      if (!required(fd)) { return null; }
      if (fd.type === 'radio') { return 'Выберите вариант'; }
      if (fd.key === 'oboznachenie') { return 'Для замены изношенного укажите обозначение с таблички аппарата'; }
      return 'Заполните поле';
    }
    if (fd.type === 'num' && !NUM.test(v)) { return 'Введите число, например ' + (fd.sign ? '140 или −40' : '42 или 1,6'); }
    if (fd.type === 'num' && !fd.sign && chisloIz(v) <= 0) { return 'Значение должно быть больше нуля'; }
    if (fd.type === 'int') {
      if (!/^\d+$/.test(v)) { return 'Введите целое число'; }
      if (+v < fd.min || +v > fd.max) { return 'От ' + fd.min + ' до ' + fd.max; }
    }
    if (fd.key === 'tempVyhod' && NUM.test(val('tempVhod').trim()) &&
        chisloIz(v) >= chisloIz(val('tempVhod'))) {
      return 'АВО охлаждает продукт, поэтому на выходе температура ниже, чем на входе';
    }
    return null;
  }
  function validate(n) {
    var e = {};
    STEPS[n - 1].fields.forEach(function (fd) { var m = check(fd); if (m) { e[fd.key] = m; } });
    return e;
  }
  function empty(o) { return !Object.keys(o).length; }

  /* --- что уходит заводу: ключи словаря OPROS карточки аппарата ------------- */
  function forma() {
    var x = f(), n = function (k, unit) { return String(x[k]).trim().replace('-', '\u2212') + ' ' + unit; };
    var o = {
      tip: 'avo', status: x.status, techPoz: String(x.techPoz).trim(),
      sreda: String(x.sreda).trim(), rashod: n('rashod', 'т/ч'), nagruzka: n('nagruzka', 'МВт'),
      davlenieRaschetnoe: n('davlenieRaschetnoe', 'МПа'), tempVhod: n('tempVhod', '°C'), tempVyhod: n('tempVyhod', '°C'),
      garantiyaMes: parseInt(x.garantiyaMes, 10), shefMontazh: x.shefMontazh === 'Да',
      zip: String(x.zip || '').trim() || null,
      skhema: d.skhema ? { name: d.skhema.name, size: d.skhema.size, type: d.skhema.type } : null
    };
    var ob = String(x.oboznachenie || '').trim();
    if (ob) { o.oboznachenie = ob; }
    return o;
  }

  /* --- демо-данные: всё из шаблона завода в DATA, своих значений нет ----------- */
  function chislo(v) { var m = /[-\u2212]?\d+(?:[.,]\d+)?/.exec(String(v === undefined || v === null ? '' : v)); return m ? m[0] : ''; }
  function tekst(v) { return v === undefined || v === null ? '' : String(v); }
  function demo() {
    var s = DATA.oprosnyShablon('avo') || {};
    d.f = {
      status: tekst(s.status), techPoz: tekst(s.techPoz),
      oboznachenie: s.status === ZAMENA ? tekst(s.oboznachenie) : '',
      sreda: tekst(s.sreda), rashod: chislo(s.rashod), nagruzka: chislo(s.nagruzka),
      davlenieRaschetnoe: chislo(s.davlenieRaschetnoe), tempVhod: chislo(s.tempVhod), tempVyhod: chislo(s.tempVyhod),
      garantiyaMes: chislo(s.garantiyaMes), shefMontazh: s.shefMontazh === true ? 'Да' : s.shefMontazh === false ? 'Нет' : '',
      zip: tekst(s.zip)
    };
    d.skhema = s.skhema ? { name: s.skhema.name, size: s.skhema.size, type: s.skhema.type, demo: !!s.skhema.demo } : null;
    preview = null; errs = {};
    save();
  }

  /* --- разметка ------------------------------------------------------------- */
  function input(fd) {
    var v = val(fd.key), bad = !!errs[fd.key], id = 'zv-' + fd.key;
    var attrs = ' id="' + id + '" name="' + fd.key + '" data-field="' + fd.key + '"' + (bad ? ' aria-invalid="true" aria-describedby="' + id + '-err"' : '');
    if (fd.type === 'radio') {
      return '<div class="zv-radios" role="radiogroup" aria-labelledby="' + id + '-l"' + (bad ? ' aria-invalid="true"' : '') + '>' + fd.options.map(function (o, i) {
        return '<label class="choice zv-radio' + (v === o ? ' is-on' : '') + '"><input type="radio" name="' + fd.key + '" value="' + esc(o) + '" data-field="' + fd.key + '"' +
          (i === 0 ? ' id="' + id + '"' : '') + (v === o ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
      }).join('') + '</div>';
    }
    var mode = fd.type === 'num' || fd.type === 'int' ? ' inputmode="decimal"' : '';
    var box = '<input class="input' + (bad ? ' input--error' : '') + '" type="text" autocomplete="off"' + mode + attrs +
      ' value="' + esc(v) + '"' + (fd.ph ? ' placeholder="' + esc(fd.ph) + '"' : '') + '>';
    return fd.unit ? '<span class="zv-unit">' + box + '<span class="zv-unit__u">' + esc(fd.unit) + '</span></span>' : box;
  }

  function fileField(fd) {
    var s = d.skhema;
    var pv = '';
    if (s) {
      var img = preview || s.preview;
      var ext = (String(s.name).split('.').pop() || '').toUpperCase();
      pv = '<div class="zv-file__card" data-skhema>' +
        (img ? '<img class="zv-file__img" src="' + esc(img) + '" alt="Превью схемы">'
          : s.demo ? '<span class="zv-file__img zv-file__img--demo" aria-hidden="true">' + chertezh() + '</span>'
          : '<span class="zv-file__img zv-file__img--ext" aria-hidden="true">' + esc(ext.slice(0, 4)) + '</span>') +
        '<span class="zv-file__meta"><span class="zv-file__name" data-skhema-name>' + esc(s.name) + '</span>' +
          '<span class="zv-file__size">' + esc(razmer(s.size)) + (s.demo ? ' · демо-файл' : '') + '</span>' +
          '<button class="link-btn zv-file__del" type="button" data-act="zv-file-del">Убрать</button></span></div>';
    }
    return '<div class="zv-file">' + pv +
      '<label class="btn btn--secondary zv-file__pick">' + (s ? 'Заменить файл' : 'Выбрать файл') +
        '<input class="zv-file__input" type="file" id="zv-skhema" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" data-file></label>' +
      '<span class="field__hint">PDF, изображение или DWG. В прототипе файл остаётся на вашем компьютере и никуда не отправляется.</span></div>';
  }
  function razmer(b) {
    b = +b || 0;
    return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ';
  }
  /* Эскиз для демо-файла: секции шатром и два штуцера — не картинка, а знак. */
  function chertezh() {
    return '<svg viewBox="0 0 120 80" width="120" height="80"><g fill="none" stroke="currentColor" stroke-width="1.5">' +
      '<rect x="4" y="4" width="112" height="72"/><path d="M14 64 L34 22 L54 64 L74 22 L94 64"/><path d="M10 64 H110"/>' +
      '<path d="M34 22 V12 M74 22 V12"/><path d="M29 12 H39 M69 12 H79"/></g></svg>';
  }

  function field(fd) {
    if (fd.type === 'fixed') {
      return '<div class="zv-field zv-field--wide zv-fixed"><span class="field__label label">Предприятие и установка</span>' +
        '<p class="zv-fixed__v">' + esc([zakName(), me().ustanovka].filter(Boolean).join(' · ')) + '</p>' +
        '<span class="field__hint">Подставлено из вашего профиля.</span></div>';
    }
    var req = required(fd), hint = typeof fd.hint === 'function' ? fd.hint(f()) : fd.hint;
    var id = 'zv-' + fd.key;
    return '<div class="zv-field' + (fd.wide ? ' zv-field--wide' : '') + (errs[fd.key] ? ' is-error' : '') + '" data-key="' + fd.key + '">' +
      '<label class="field__label label" id="' + id + '-l" for="' + id + '">' + esc(fd.label) + (req ? ' <span class="zv-req" aria-label="обязательно">*</span>' : '') + '</label>' +
      (fd.type === 'file' ? fileField(fd) : input(fd)) +
      (errs[fd.key] ? '<span class="zv-err" id="' + id + '-err" role="alert" data-err="' + fd.key + '">' + esc(errs[fd.key]) + '</span>' : '') +
      (hint ? '<span class="field__hint" data-hint="' + fd.key + '">' + esc(hint) + '</span>' : '') +
    '</div>';
  }

  function tipy() {
    var avo = (spr().tipy || {}).avo || { title: 'Аппарат воздушного охлаждения' };
    var on = d.tip === 'avo';
    return '<section class="zv-tipy" aria-label="Тип аппарата"><p class="label zv-tipy__l">Тип аппарата</p><div class="zv-tipy__grid">' +
      '<button class="zv-tip' + (on ? ' is-on' : '') + '" type="button" data-act="zv-tip" data-tip="avo" aria-pressed="' + on + '">' +
        '<span class="zv-tip__t">' + esc(avo.title) + '</span><span class="zv-tip__s">Опросный лист для заказа · 3 шага</span></button>' +
      DRUGIE.map(function (t) {
        return '<div class="zv-tip is-off" aria-disabled="true" data-tip-off><span class="zv-tip__t">' + esc(t) + '</span>' +
          '<span class="zv-tip__s">опросный лист в рабочей версии</span></div>';
      }).join('') + '</div></section>';
  }

  function shagi() {
    var n = step();
    return '<ol class="zv-steps" aria-label="Шаги">' + STEPS.map(function (s, i) {
      var k = i + 1, st = k < n ? 'done' : k === n ? 'current' : 'plan';
      return '<li class="zv-steps__i is-' + st + '"><button type="button" class="zv-steps__b is-' + st + '" data-act="zv-go" data-step="' + k + '"' +
        (k === n ? ' aria-current="step" disabled' : '') + '><span class="zv-steps__n">' + k + '</span><span class="zv-steps__t">' + esc(s.title) + '</span></button></li>';
    }).join('') + '</ol>';
  }

  function forma1() {
    var n = step(), s = STEPS[n - 1];
    return '<section class="card zv-form" data-step="' + n + '" aria-label="' + esc(s.title) + '">' +
      '<div class="card__head"><div><p class="label zv-form__k">Шаг ' + n + ' из 3</p><h2 class="zv-title">' + esc(s.title) + '</h2></div>' +
        '<span class="small muted">* — обязательно</span></div>' +
      '<div class="card__body"><div class="zv-grid' + (s.cols === 3 ? ' zv-grid--3' : '') + '">' + s.fields.map(field).join('') + '</div>' +
        (!empty(errs) ? '<p class="zv-errsum" role="alert">Проверьте отмеченные поля. Введённое сохранено.</p>' : '') + '</div>' +
      '<div class="card__foot zv-form__foot">' +
        '<p class="zv-full">Полная форма завода появится в рабочей версии</p>' +
        '<div class="zv-form__btns">' +
          (n > 1 ? '<button class="btn btn--secondary" type="button" data-act="zv-back">Назад</button>' : '') +
          (n < 3 ? '<button class="btn btn--primary" type="button" data-act="zv-next">Далее</button>'
            : '<button class="btn btn--primary" type="button" data-act="zv-send">Отправить заводу</button>') +
        '</div></div></section>';
  }

  function aside() {
    return '<aside class="zv-aside">' +
      '<section class="card"><div class="card__head"><h2 class="zv-title">Следующие шаги</h2></div><div class="card__body">' +
        '<ol class="zv-next">' +
          '<li>Специалист отдела маркетинга и продаж ответит в течение 2 рабочих дней.</li>' +
          '<li>Завод выполняет расчёт аппарата и направляет ТКП. Условное обозначение нового аппарата назначит завод.</li>' +
          '<li>Гарантия, ЗИП и шеф-монтаж из шага 3 перейдут в паспорт поставленного аппарата.</li>' +
        '</ol></div></section>' +
      '<p class="small muted zv-aside__note">Черновик сохраняется в этом браузере. Если уйти со страницы и вернуться, поля останутся.</p>' +
    '</aside>';
  }

  function sent() {
    var a = DATA.apparat(d.sent);
    var nomer = String(d.sent).replace(/^n-/, '');
    var x = f();
    var kv = [['Аппарат', a ? a.nazvanie : 'Аппарат воздушного охлаждения'], ['Позиция', x.techPoz],
      ['Статус', x.status], ['Схема', d.skhema ? d.skhema.name : 'не приложена']];
    return '<section class="card zv-ok" data-sent="' + esc(d.sent) + '" aria-live="polite">' +
      '<div class="card__body"><p class="label">Опросный лист принят</p>' +
        '<h2 class="h2 zv-ok__t">Заявка № ' + esc(nomer) + ' отправлена</h2>' +
        '<p class="zv-ok__text">Специалист завода ответит в течение 2 рабочих дней' +
          (a && a.srokOtveta ? ', до ' + esc(R.data(a.srokOtveta, { format: 'text' })) : '') + '. Заявка уже видна заводу.</p>' +
        '<dl class="kv zv-ok__kv">' + kv.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1] || '—') + '</dd>'; }).join('') + '</dl>' +
        '<div class="row zv-ok__btns">' +
          '<a class="btn btn--primary" href="apparat.html?id=' + encodeURIComponent(d.sent) + '" data-k-kartochke>К карточке заявки</a>' +
          '<a class="btn btn--secondary" href="apparaty.html">Мои аппараты</a>' +
          '<button class="btn btn--ghost" type="button" data-act="zv-new">Заполнить ещё одну заявку</button>' +
        '</div></div></section>';
  }

  function render() {
    var head = '<nav class="crumbs" aria-label="Путь"><a href="apparaty.html">Мои аппараты</a><span>Новая заявка</span></nav>' +
      '<div class="page-head zv-head"><div><h1 class="h1">Новая заявка</h1>' +
        '<p class="zv-head__sub">Опросный лист завода по шагам. ' + esc([zakName(), me().ustanovka].filter(Boolean).join(' · ')) + '</p></div>' +
      (d.tip && !d.sent ? '<div class="page-head__actions"><button class="btn btn--secondary" type="button" data-act="zv-demo">Заполнить демо-данными</button></div>' : '') +
      '</div>';
    if (d.sent) { page.setAttribute('data-state', 'sent'); page.innerHTML = head + sent(); return; }
    page.setAttribute('data-state', d.tip ? 'step-' + step() : 'tip');
    page.innerHTML = head + tipy() +
      (d.tip ? '<div class="zv-layout">' + '<div class="zv-main">' + shagi() + forma1() + '</div>' + aside() + '</div>'
        : '<p class="zv-hint">Выберите тип аппарата, и откроется опросный лист.</p>');
  }
  function focusErr() {
    var el = page.querySelector('.zv-field.is-error input');
    if (el) { try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); } }
  }
  function top() { var h = page.querySelector('.zv-steps'); if (h && h.scrollIntoView) { try { h.scrollIntoView({ block: 'nearest' }); } catch (e) { /* старый браузер */ } } }

  /* --- действия --------------------------------------------------------------- */
  Sh.on('zv-tip', function (t) { d.tip = t.getAttribute('data-tip'); d.step = d.step || 1; save(); render(); });
  Sh.on('zv-demo', function () { demo(); render(); });
  Sh.on('zv-next', function () {
    errs = validate(step());
    if (empty(errs)) { d.step = step() + 1; save(); render(); top(); } else { render(); focusErr(); }
  });
  Sh.on('zv-back', function () { errs = {}; d.step = step() - 1; save(); render(); top(); });
  Sh.on('zv-go', function (t) {
    var k = +t.getAttribute('data-step');
    if (k <= step()) { errs = {}; d.step = k; save(); render(); return; }
    for (var i = step(); i < k; i++) {
      errs = validate(i);
      if (!empty(errs)) { d.step = i; save(); render(); focusErr(); return; }
    }
    errs = {}; d.step = k; save(); render();
  });
  Sh.on('zv-send', function () {
    if (d.sent) { render(); return; }
    for (var i = 1; i <= 3; i++) {
      errs = validate(i);
      if (!empty(errs)) { d.step = i; save(); render(); focusErr(); return; }
    }
    var id = ACT.otpravitZayavku(d.draftId, forma());
    if (!id) { R.modal({ title: 'Не получилось', text: 'Заявка не отправилась. Проверьте поля и попробуйте ещё раз.' }); return; }
    d.sent = id; save(); render(); w.Shell.refresh();
    if (w.scrollTo) { w.scrollTo(0, 0); }
  });
  Sh.on('zv-new', function () { Store.setDraft(KEY, null); d = Store.draft(KEY); d.tip = 'avo'; d.step = 1; errs = {}; preview = null; save(); render(); });
  Sh.on('zv-file-del', function () { d.skhema = null; preview = null; save(); render(); });

  /* Ввод пишется в черновик сразу, без перерисовки — курсор остаётся на месте. */
  function onInput(e) {
    var t = e.target, k = t && t.getAttribute && t.getAttribute('data-field');
    if (!k) { return; }
    if (t.type === 'radio' && !t.checked) { return; }
    f()[k] = t.value; save();
    if (errs[k]) {
      delete errs[k];
      var box = t.closest('.zv-field');
      if (box) { box.classList.remove('is-error'); var m = box.querySelector('.zv-err'); if (m) { m.remove(); } }
      t.classList.remove('input--error'); t.removeAttribute('aria-invalid');
    }
    if (t.type === 'radio') { render(); }
  }
  page.addEventListener('input', onInput);
  page.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.hasAttribute && t.hasAttribute('data-file')) { pickFile(t); }
  });
  function pickFile(inp) {
    var file = inp.files && inp.files[0];
    if (!file) { return; }
    d.skhema = { name: file.name, size: file.size, type: file.type || '' };
    preview = null;
    if (/^image\//.test(file.type) && w.FileReader) {
      var rd = new FileReader();
      rd.onload = function () {
        preview = rd.result;
        if (preview.length < 400000) { d.skhema.preview = preview; }
        save(); render();
      };
      rd.readAsDataURL(file);
    }
    save(); render();
  }

  render();
})(window);

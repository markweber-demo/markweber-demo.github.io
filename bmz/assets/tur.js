/* Tur — три сценария показа: шаги, подсказки, «Перейти». Владелец — таск 08.

   Шаг засчитывается по данным, а не по клику в панели: если человек сделал
   ход сам, подсказка идёт дальше. Шаги двух видов:
     * ход — условие по DATA (заявка отправлена, код ответа поставлен, …);
     * просмотр — нужная страница открыта в нужной роли, пока шаг текущий.
       Отметку «видел» ставит этот же файл при загрузке страницы. Просмотр
       считается пройденным и тогда, когда пройден любой ход после него.

   Своих правил доступности здесь нет — только признаки из DATA. Состояние
   (выбранный сценарий и отметки «видел») — черновик Store 'tur': «Сбросить
   демо» чистит его вместе с журналом.

   Tur.list() → [{id, title}]
   Tur.current() → {scenario, step, total, text, role, person, href, gotovo}
   Tur.sostoyanie(id) → то же для любого сценария
   Tur.go(id) — выбрать сценарий, сменить роль и человека, открыть страницу шага */
(function (w) {
  'use strict';

  var KEY = 'tur';
  var SPISOK = [
    { id: 'A', title: 'А. Новый аппарат: от опросного листа до согласованного чертежа' },
    { id: 'B', title: 'Б. Где мой аппарат' },
    { id: 'V', title: 'В. Аппарат в эксплуатации' }
  ];
  /* Опорные аппараты демо (interfaces, таск 01). */
  var T203 = 't-203', S305 = 's-305';
  var ZAPAS = { inzhener: 'k-zaycev', snab: 'k-mironov', zavod: 'z-garipova' };

  function safe(fn, dflt) { try { var v = fn(); return v === undefined || v === null ? dflt : v; } catch (e) { return dflt; } }
  function apparat(id) { return id ? safe(function () { return w.DATA.apparat(id); }, null) : null; }
  function kto(key) {
    var x = null;
    safe(function () { return w.Shell.lyudi(); }, []).forEach(function (y) { if (y.key === key && y.p) { x = y.p.id; } });
    return x || ZAPAS[key];
  }
  function roleOf(key) { return key === 'zavod' ? 'zavod' : 'zakazchik'; }
  function etapIdx(a) {
    var ids = safe(function () { return w.DATA.spravochnik().etapy; }, []).map(function (e) { return e.id; });
    return a ? ids.indexOf(a.etap) : -1;
  }
  function etapPoId(id) {
    return safe(function () { return w.DATA.spravochnik().etapy; }, []).map(function (e) { return e.id; }).indexOf(id);
  }
  function doc(a, vid) {
    var d = null;
    (a ? a.dokumenty : []).forEach(function (x) { if (x.vid === vid && !d) { d = x; } });
    return d;
  }
  function rev(d, n) { return d && d.revizii[n] ? d.revizii[n] : null; }

  /* --- состояние: черновик Store ------------------------------------------- */
  function state() { return safe(function () { return w.Store.draft(KEY); }, {}) || {}; }
  function save(st) { safe(function () { return w.Store.setDraft(KEY, st); }, null); }

  /* --- где мы: страница, её параметры и роль ------------------------------- */
  function zdes() {
    var file = String(w.location.pathname).split('/').pop() || 'index.html';
    var par = function (n) { return safe(function () { return w.Render.param(n); }, ''); };
    return {
      file: file, id: par('id'), n: par('n'), hash: String(w.location.hash || ''),
      role: safe(function () { return w.Store.role(); }, null),
      person: safe(function () { return w.DATA.me().id; }, null)
    };
  }

  /* --- сценарий А: какой аппарат его --------------------------------------
     Аппарат сценария — заявка на АВО, отправленная в этом браузере. Их может
     быть несколько: берём ту, что продвинулась дальше, при равенстве — позднюю. */
  function zayavkiAvo() {
    var out = [];
    safe(function () { return w.Store.journal(); }, []).forEach(function (e) {
      if (e.t !== 'otpravitZayavku') { return; }
      var a = apparat('n-' + e.seq);
      if (a && a.tip === 'avo') { out.push(a); }
    });
    return out;
  }

  function hrefA(a, hash, panel) {
    return 'apparat.html?id=' + encodeURIComponent(a.id) + (panel ? '&panel=1' : '') + (hash ? '#' + hash : '');
  }

  /* Шаг: {text, kto, href, hod(ctx) → bool} — ход; {…, vid(z) → bool} — просмотр. */
  function shagiA(a) {
    var sb = doc(a, 'sborochnyy'), rA = rev(sb, 0), rB = rev(sb, 1);
    var docHash = sb ? 'doc=' + sb.id : 'soglasovanie';
    var zmA = a ? a.zamechaniya.filter(function (z) { return sb && z.dokumentId === sb.id && z.rev === (rA && rA.rev); }) : [];
    var chertezh = etapPoId('chertezh');
    var h = function (hash, panel) { return a ? hrefA(a, hash, panel) : 'crm.html'; };
    return [
      { kto: 'inzhener', href: 'zayavka-novaya.html', hod: function () { return !!a; },
        text: 'Заказчик → «Новая заявка» → «Аппарат воздушного охлаждения» → «Заполнить демо-данными». Схема прикрепится вместе с данными, дальше «Отправить заводу».' },
      { kto: 'zavod', href: 'crm.html', vid: function (z) { return z.file === 'crm.html' && z.role === 'zavod'; },
        text: 'Завод → «Воронка». Новая карточка появилась в колонке «Новые заявки».' },
      { kto: 'zavod', href: h('soglasovanie'), hod: function () { return etapIdx(a) >= etapPoId('raschet'); },
        text: 'Завод → карточка заявки → «ТКП направлено», и заказчик получает ТКП.' },
      { kto: 'zavod', href: h('', true), hod: function () { return etapIdx(a) >= chertezh; },
        text: 'Ход вне системы: панель прототипа → «Ходы вне системы» → «ТКП принято, договор подписан». Этап «Договор» пройден.' },
      { kto: 'zavod', href: h('soglasovanie'), hod: function () { return !!(a && a.zadanie); },
        text: 'Завод → карточка → «Назначить конструктору». Конструктор получает задание на сборочный чертёж и 3D-модель по опросному листу.' },
      { kto: 'zavod', href: h('', true), hod: function () { return !!rA; },
        text: 'Ход конструктора: панель прототипа → «Конструктор выложил ревизию». Заказчик получает сборочный чертёж рев. A и 3D-модель, на ответ у него 5 рабочих дней.' },
      { kto: 'inzhener', href: h(docHash), hod: function () { return !!(rA && rA.kod); },
        text: 'Заказчик → сборочный чертёж рев. A. Кликните по штуцеру А в модели и напишите замечание «перенести штуцер», вторым замечанием «добавить площадку обслуживания». Затем код 2 «Одобрено с замечаниями» → «Отправить ответ».' },
      { kto: 'zavod', href: h(docHash), hod: function () { return !!(rA && rA.kod) && zmA.every(function (z) { return !!z.otvet; }); },
        text: 'Завод → сборочный чертёж. На каждое замечание нажмите «Принять», ответ «будет в рев. B» подставится сам.' },
      { kto: 'zavod', href: h(docHash, true), hod: function () { return !!rB || etapIdx(a) > chertezh; },
        text: 'Ход конструктора: «Выпустить рев. B» на карточке или «Конструктор выложил ревизию» в панели. В рев. B штуцер А на новом месте, появилась площадка обслуживания.' },
      { kto: 'inzhener', href: h(docHash), hod: function () { return etapIdx(a) > chertezh; },
        text: 'Заказчик → рев. B → код 1 «Одобрено» → «Отправить ответ». Чертёж согласован, во вкладке «История» виден весь путь.' }
    ];
  }

  function shagiB() {
    var a = apparat(T203), w0 = -1, pmi = a ? a.pmi : [];
    pmi.forEach(function (p, i) { if (w0 < 0 && p.tip === 'W') { w0 = i; } });
    var W = w0 > -1 ? pmi[w0] : null;
    var hBefore = pmi.filter(function (p, i) { return p.tip === 'H' && (w0 < 0 || i < w0); });
    var h = function (hash) { return 'apparat.html?id=' + T203 + (hash ? '#' + hash : ''); };
    return [
      { kto: 'snab', href: 'apparaty.html',
        vid: function (z) { return z.person === kto('snab') && (z.file === 'apparaty.html' || (z.file === 'apparat.html' && z.id === T203)); },
        text: 'Снабженец → «Мои аппараты» → теплообменник Т-203. Снабженец видит текущий этап «Сварка», плановую дату отгрузки и комплект документов к поставке. Звонить на завод не нужно.' },
      { kto: 'inzhener', href: h('proizvodstvo'),
        hod: function () { return !!a && hBefore.every(function (p) { return p.status === 'done'; }); },
        text: 'Инженер → Т-203 → вкладка «Производство и испытания». У пройденных точек приложены протоколы. Без вашего подтверждения точку H «контроль сварных швов» завод не пройдёт → «Подтвердить, продолжайте».' },
      { kto: 'inzhener', href: h('proizvodstvo'), hod: function () { return !!(W && W.otvetZakazchika); },
        text: 'Инженер → точка W «Гидравлические испытания» через две недели → «Приеду на инспекцию», 2 человека.' },
      { kto: 'zavod', href: 'crm.html',
        vid: function (z) { return z.role === 'zavod' && (z.file === 'crm.html' || (z.file === 'apparat.html' && z.id === T203)); },
        text: 'Завод → «Воронка». На карточке Т-203 плашка «ТАНЕКО приедет на гидроиспытания, 2 человека», в истории аппарата появилось это событие.' }
    ];
  }

  function shagiV() {
    var a = apparat(S305), obr = a ? a.obrashcheniya.filter(function (o) { return !o.poQr; }) : [];
    var remont = obr.filter(function (o) { return o.vid === 'remont'; });
    var zak = a ? a.zakazchikId : 'taneko', nomer = a ? a.zavNomer : '';
    var pasp = 'pasport.html?id=' + S305;
    return [
      { kto: 'inzhener', href: pasp,
        vid: function (z) { return z.role === 'zakazchik' && z.file === 'pasport.html' && z.id === S305; },
        text: 'Инженер → сепаратор С-305 → паспорт. Здесь гарантия, ближайшее освидетельствование и кнопки «Скачать паспорт» и «Скачать руководство по эксплуатации».' },
      { kto: 'inzhener', href: pasp, hod: function () { return obr.some(function (o) { return o.vid === 'zip'; }); },
        text: 'Инженер → паспорт С-305. Отметьте позиции ЗИП и нажмите «Запросить ЗИП».' },
      { kto: 'inzhener', href: pasp, hod: function () { return remont.length > 0; },
        text: 'Инженер → паспорт С-305 → заявка на ремонт. Опишите, что случилось, приложите фото и нажмите «Отправить заявку на ремонт».' },
      { kto: 'zavod', href: 'crm.html#servis', hod: function () { return remont.some(function (o) { return o.status !== 'novoe'; }); },
        text: 'Завод → «Сервис». Заявка на ремонт С-305 в очереди → «Взять в работу».' },
      { kto: 'zavod', href: 'zakazchik.html?id=' + encodeURIComponent(zak),
        vid: function (z) { return z.role === 'zavod' && z.file === 'zakazchik.html' && z.id === zak; },
        text: 'Завод → «Заказчики» → ТАНЕКО. В парке подсвечены аппараты, у которых скоро освидетельствование.' },
      { kto: 'inzhener', href: pasp,
        vid: function (z) { return z.file === 'proverka.html' && !!nomer && z.n === nomer; },
        text: 'Паспорт С-305 → клик по QR на табличке → страница проверки аппарата. Она открывается без входа.' }
    ];
  }

  var FINAL = {
    A: function (a) { return { kto: 'inzhener', href: a ? hrefA(a, 'istoriya') : 'apparaty.html',
      text: 'Сценарий пройден, чертёж согласован. Во вкладке «История» весь путь от заявки до кода 1.' }; },
    B: function () { return { kto: 'zavod', href: 'apparat.html?id=' + T203 + '#istoriya',
      text: 'Сценарий пройден. Заказчик знает, где аппарат, а завод знает, кто приедет на испытания.' }; },
    V: function () { return { kto: 'zavod', href: 'crm.html#servis',
      text: 'Сценарий пройден. Обращения по С-305 видны заводу в «Сервисе», аппарат проверяется по QR без входа.' }; }
  };

  /* Аппарат сценария А и его шаги: из нескольких заявок — самая продвинутая. */
  function sborkaA() {
    var best = null, bestN = -1;
    zayavkiAvo().forEach(function (a) {
      var n = sdelano(shagiA(a), 'A', a.id, {});
      if (n >= bestN) { best = a; bestN = n; }
    });
    return { a: best, shagi: shagiA(best), klyuch: best ? best.id : '' };
  }
  function sborka(id) {
    if (id === 'A') { return sborkaA(); }
    if (id === 'B') { return { a: apparat(T203), shagi: shagiB(), klyuch: T203 }; }
    return { a: apparat(S305), shagi: shagiV(), klyuch: S305 };
  }

  /* Сколько шагов подряд пройдено. Ход — по данным. Просмотр — по отметке
     «видел» или если пройден любой ход после него. */
  function sdelano(shagi, sc, klyuch, seen) {
    for (var i = 0; i < shagi.length; i++) {
      var s = shagi[i];
      if (s.hod) { if (!safe(s.hod, false)) { return i; } continue; }
      if (seen[sc + (i + 1) + ':' + klyuch]) { continue; }
      var dalshe = shagi.slice(i + 1).some(function (x) { return x.hod && safe(x.hod, false); });
      if (!dalshe) { return i; }
    }
    return shagi.length;
  }

  function vybran() {
    var sc = state().scenario;
    return SPISOK.some(function (s) { return s.id === sc; }) ? sc : 'A';
  }

  function sostoyanie(id) {
    id = SPISOK.some(function (s) { return s.id === id; }) ? id : 'A';
    var b = sborka(id), seen = state().seen || {};
    var n = sdelano(b.shagi, id, b.klyuch, seen), total = b.shagi.length;
    var gotovo = n >= total;
    var s = gotovo ? FINAL[id](b.a) : b.shagi[n];
    var person = kto(s.kto), role = roleOf(s.kto);
    var href = s.href;
    var q = 'role=' + role + '&person=' + encodeURIComponent(person);
    var hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
    var base = hash ? href.slice(0, href.indexOf('#')) : href;
    return {
      scenario: id, step: gotovo ? total : n + 1, total: total, text: s.text,
      role: role, person: person, href: base + (base.indexOf('?') > -1 ? '&' : '?') + q + hash,
      gotovo: gotovo
    };
  }

  /* Отметка «видел»: текущий шаг-просмотр каждого сценария, если страница его. */
  function zametit() {
    var z = zdes(), st = state(), seen = st.seen || {}, changed = false;
    SPISOK.forEach(function (sc) {
      for (var guard = 0; guard < 10; guard++) {
        var b = sborka(sc.id), n = sdelano(b.shagi, sc.id, b.klyuch, seen), s = b.shagi[n];
        if (!s || !s.vid || !safe(function () { return s.vid(z); }, false)) { return; }
        seen[sc.id + (n + 1) + ':' + b.klyuch] = true;
        changed = true;
      }
    });
    if (changed) { st.seen = seen; save(st); }
  }

  var Tur = {
    list: function () { return SPISOK.map(function (s) { return { id: s.id, title: s.title }; }); },
    current: function () { return sostoyanie(vybran()); },
    sostoyanie: sostoyanie,
    /** Выбрать сценарий и открыть его текущий шаг: роль и человек меняются здесь же. */
    go: function (id) {
      var st = state();
      st.scenario = SPISOK.some(function (s) { return s.id === id; }) ? id : vybran();
      save(st);
      var cur = sostoyanie(st.scenario);
      w.Store.setRole(cur.role);
      w.Store.setPerson(cur.person);
      w.Shell.navigate(cur.href);
      return cur;
    }
  };

  safe(function () { zametit(); return true; }, false);
  /* «Перейти» на ход из панели открывает страницу с раскрытой панелью. */
  function panelPoAdresu() {
    if (safe(function () { return w.Render.param('panel'); }, '') === '1' && w.Shell && document.querySelector('.proto-dock')) {
      w.Shell.panel(true);
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', panelPoAdresu); } else { setTimeout(panelPoAdresu, 0); }

  w.Tur = Tur;
})(window);

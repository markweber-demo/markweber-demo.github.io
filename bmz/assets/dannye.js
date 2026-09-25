/* Один шов к данным: DATA на чтение, ACT на запись.
   Данные для экрана = демо-данные MOCK + журнал действий из Store,
   проигранный поверх. Отсюда история «кто, что, когда», видимость между
   ролями и сброс одной кнопкой. В рабочей версии заменяется этот файл,
   экраны остаются. Контракт — spec.md, раздел «Контракт DATA и ACT». */
(function (w) {
  'use strict';

  var M = w.MOCK;
  var DAY = 86400000;
  var ETAPY = M.etapy.map(function (e) { return e.id; });

  /* ---------- даты ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dayOf(iso) {
    var p = String(iso).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) {
    var x = new Date(d), day = x.getDate();
    x.setDate(1); x.setMonth(x.getMonth() + n);
    var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
    x.setDate(Math.min(day, last));
    return x;
  }
  function addWorkDays(d, n) {
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    while (n > 0) { x.setDate(x.getDate() + 1); if (x.getDay() !== 0 && x.getDay() !== 6) { n--; } }
    return x;
  }
  function diffDays(a, b) { return Math.round((dayOf(a) - dayOf(b)) / DAY); }

  /* «@-30», «@+14», «@-21m» → ISO-дата относительно дня показа. */
  var OFFSET = /^@([+-]?\d+)(m?)$/;
  function resolve(v, base) {
    if (typeof v === 'string') {
      var m = OFFSET.exec(v);
      if (!m) { return v; }
      return isoDay(m[2] === 'm' ? addMonths(base, +m[1]) : addDays(base, +m[1]));
    }
    if (Array.isArray(v)) { return v.map(function (x) { return resolve(x, base); }); }
    if (v && typeof v === 'object') {
      var o = {};
      for (var k in v) { o[k] = resolve(v[k], base); }
      return o;
    }
    return v;
  }

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function find(list, f) { for (var i = 0; i < list.length; i++) { if (f(list[i])) { return list[i]; } } return null; }
  function byId(list, id) { return find(list, function (x) { return x.id === id; }); }

  /* ---------- люди ---------- */

  function person(id) { return byId(M.lyudi, id); }
  function predpriyatie(p) {
    if (!p) { return ''; }
    if (p.side === 'zavod') { return M.zavod.short; }
    var z = byId(M.zakazchiki, p.zakazchikId);
    return z ? z.name : '';
  }
  /* Кто — объект для истории, замечаний, ответов и обращений. */
  function kto(id) {
    var p = person(id);
    if (!p) { return { id: id || null, name: '', position: '', side: null, predpriyatie: '' }; }
    return { id: p.id, name: p.name, position: p.position, side: p.side, predpriyatie: predpriyatie(p) };
  }
  function contact(p) {
    return { id: p.id, name: p.name, position: p.position, phone: p.phone, email: p.email, otdel: p.otdel || null, ustanovka: p.ustanovka || null, home: p.home || null };
  }

  function mePerson() {
    var role = w.Store.role();
    var p = person(w.Store.person());
    if (!p || p.side !== role) { p = person(M.poUmolchaniyu[role]); }
    return p;
  }

  /* ---------- состояние: MOCK + журнал ---------- */

  var cache = { key: null, st: null };

  function build() {
    var base = today();
    var journal = w.Store.journal();
    var key = isoDay(base) + '|' + journal.length + '|' + (journal.length ? journal[journal.length - 1].seq : 0);
    if (cache.key === key) { return cache.st; }
    var st = { apparaty: resolve(clone(M.apparaty), base), zayavki: {} };
    journal.forEach(function (e) {
      var h = APPLY[e.t];
      if (h) { h(st, e); }
    });
    cache = { key: key, st: st };
    return st;
  }

  function nextRev(revizii) {
    if (!revizii.length) { return 'A'; }
    var last = revizii[revizii.length - 1].rev;
    return /^[A-Z]$/.test(last) ? String.fromCharCode(last.charCodeAt(0) + 1) : String(+last + 1 || 1);
  }
  function lastRev(d) { return d && d.revizii.length ? d.revizii[d.revizii.length - 1] : null; }
  function docByVid(a, vid) { return find(a.dokumenty, function (d) { return d.vid === vid; }); }
  function ensureDoc(a, vid, title, id) {
    var d = id ? byId(a.dokumenty, id) : docByVid(a, vid);
    if (!d) {
      d = { id: id || a.id + '-' + vid, vid: vid, title: title || M.vidy[vid], revizii: [] };
      a.dokumenty.push(d);
    }
    return d;
  }
  function sobytie(a, e, kto, chto) { a.istoriya.push({ date: e.at, kto: kto, chto: chto }); }

  /* Этап `id` становится текущим: всё до него — пройдено датой события. */
  function perejti(a, id, at) {
    var to = ETAPY.indexOf(id);
    for (var i = 0; i < to; i++) {
      if (ETAPY.indexOf(a.etap) <= i) { a.etapDaty[ETAPY[i]] = at; }
    }
    a.etap = id;
    a.nachaloEtapa = at;
  }

  function wd(at, n) { return isoDay(addWorkDays(dayOf(at), n)); }

  /* ---------- правила ходов: единственное место ----------
     Каждое правило «когда можно сделать ход» живёт только здесь. DATA отдаёт
     его признаком (mozhno.*, dokumenty[].mozhno, zamechaniya[].mozhnoOtvetit,
     pmi[].mozhno*), ACT при нарушении возвращает null и журнал не пишет.
     Экраны и панель прототипа только читают признак. Правило отвечает, пускает
     ли ход состояние аппарата; чья сторона ходит — решает экран по роли. */
  function doEtapa(a, id) { return ETAPY.indexOf(a.etap) <= ETAPY.indexOf(id); }
  function zamechaniyaRev(a, d, rev) {
    return a.zamechaniya.filter(function (z) { return z.dokumentId === d.id && z.rev === rev; });
  }
  /* Последняя ревизия выпущена и ждёт кода от заказчика. */
  function zhdyotZakazchika(d) { var r = lastRev(d); return !!r && r.naKom === 'zakazchik' && !r.kod; }
  function pmiIdx(a, pmiId) { return a.pmi.map(function (p) { return p.id; }).indexOf(pmiId); }
  /* Документы точки ПМИ: протокол из демо-данных (`<точка>-protokol`) и всё,
     что выпущено с пометкой точки (протокол и акт испытания). */
  function docsOfPmi(a, p) {
    return a.dokumenty.filter(function (d) { return d.pmiId === p.id || d.id === p.id + '-protokol'; });
  }
  /* ТКП ушло заказчику: у документа ТКП есть выпущенная ревизия. */
  function tkpNapravleno(a) { return !!lastRev(docByVid(a, 'tkp')); }
  function srokZadaniya() { return wd(isoDay(today()), 5); }

  var PRAVILO = {
    /* «ТКП направлено» — у новой заявки или на расчёте, пока ТКП ещё не ушло заказчику. */
    tkp: function (a) { return a.etap === 'zayavka' || (a.etap === 'raschet' && !tkpNapravleno(a)); },
    /* «ТКП принято» — на расчёте и только по направленному ТКП; этап дальше — «договор». */
    tkpPrinyato: function (a) { return a.etap === 'raschet' && tkpNapravleno(a); },
    /* «Договор подписан» — на этапе «договор»; этап дальше — «согласование чертежа». */
    dogovorPodpisan: function (a) { return a.etap === 'dogovor'; },
    /* «ТКП принято, договор подписан» — оба хода подряд, значит, можно, когда можно первый. */
    dogovor: function (a) { return PRAVILO.tkpPrinyato(a); },
    /* Конструктора назначают, пока задания нет и чертёж не согласован. */
    naznachit: function (a) { return !a.zadanie && doEtapa(a, 'chertezh'); },
    /* Ревизию выпускает конструктор: задание назначено, чертёж не согласован;
       первая — если ревизий нет; следующая — если последняя получила код 2 или 3
       и на все её замечания завод ответил. */
    reviziyu: function (a, vid) {
      if (!M.vidy[vid] || !a.zadanie || !doEtapa(a, 'chertezh')) { return false; }
      var d = docByVid(a, vid), r = lastRev(d);
      if (!r) { return true; }
      if (r.kod !== 2 && r.kod !== 3) { return false; }
      return zamechaniyaRev(a, d, r.rev).every(function (z) { return !!z.otvet; });
    },
    /* Замечание — к последней ревизии, пока заказчик не дал код. */
    zamechanie: function (a, d) { return zhdyotZakazchika(d); },
    /* Код ответа — пока ревизия ждёт заказчика; 2 и 3 — только при замечании к этой ревизии. */
    kody: function (a, d) {
      if (!zhdyotZakazchika(d)) { return []; }
      return zamechaniyaRev(a, d, lastRev(d).rev).length ? [1, 2, 3, 4] : [1, 4];
    },
    /* Завод отвечает на замечание к последней ревизии один раз. */
    otvetNaZamechanie: function (a, z) {
      var r = lastRev(byId(a.dokumenty, z.dokumentId));
      return !z.otvet && !!r && r.rev === z.rev;
    },
    /* На приглашение в точку W отвечают, пока испытание не проведено; ответ можно сменить. */
    priglashenie: function (a, i) { var p = a.pmi[i]; return !!p && p.tip === 'W' && p.status !== 'done'; },
    /* Точку H подтверждают по порядку: все точки перед ней пройдены, включая R. */
    hold: function (a, i) {
      var p = a.pmi[i];
      if (!p || p.tip !== 'H' || p.status === 'done') { return false; }
      for (var j = 0; j < i; j++) { if (a.pmi[j].status !== 'done') { return false; } }
      return true;
    },
    /* Точка стоит за неподтверждённой точкой H: дальше не идём. */
    zhdyotH: function (a, i) {
      var p = a.pmi[i], prev = a.pmi[i - 1];
      return !!p && !!prev && p.status !== 'done' && prev.tip === 'H' && prev.status !== 'done';
    },
    /* Испытание проводится только на точке W и только если все точки H
       перед ней подтверждены заказчиком. */
    ispytanie: function (a, i) {
      var p = a.pmi[i];
      if (!p || p.tip !== 'W' || p.status === 'done') { return false; }
      for (var j = 0; j < i; j++) { if (a.pmi[j].tip === 'H' && a.pmi[j].status !== 'done') { return false; } }
      return true;
    },
    /* Рекламация — гарантийный случай: только у поставленного и пока идёт гарантия. */
    reklamaciya: function (a) { var g = garantiyaOf(a.postavka); return !!g && g.status === 'active'; },
    /* Взять в работу можно только новое обращение. */
    vzyat: function (o) { return !!o && o.status === 'novoe'; }
  };

  /* Этап как процесс, пока он идёт: пройденный «Чертёж согласован»,
     текущий — «Согласование чертежа»; пройденный «Металл получен», текущий —
     «Поставка металла» (04b). Остальные называются одинаково. */
  var TITLE_CURRENT = { chertezh: 'Согласование чертежа', metall: 'Поставка металла' };

  var PLAN = [0, 5, 20, 40, 60, 80, 100, 110, 120];

  /* ---------- производные: единственное место (06a) ----------
     Гарантия, ближайшее освидетельствование, просрочка, «новая», «поставлен»,
     текущая W, статусы обращений считаются здесь один раз. Экраны читают
     готовые признаки и своих дат не сравнивают. */
  var NAPOMNIT_DNEY = 30;   /* плашка «напоминание» — за месяц до освидетельствования */
  var POVOD_MES = 6;        /* «повод связаться» — освидетельствование в ближайшие полгода */
  var BEZ_VHODA = 'без входа, по QR';

  var VIDY_OBR = {
    remont: { title: 'Заявка на ремонт', short: 'Ремонт' },
    reklamaciya: { title: 'Рекламация', short: 'Рекламация' },
    zip: { title: 'Запрос ЗИП', short: 'Запрос ЗИП' }
  };
  /* Виды освидетельствования по ФНП 536 — одна карта подписей для всех экранов.
     title — заголовок, strochno — внутри фразы, kratko — прилагательное перед «осмотр». */
  var VIDY_OSVID = {
    naruzhnyy: { title: 'Наружный осмотр', strochno: 'наружный осмотр', kratko: 'наружный', period: 'раз в 2 года' },
    vnutrenniy: { title: 'Внутренний осмотр', strochno: 'внутренний осмотр', kratko: 'внутренний', period: 'раз в 2 года' },
    gidro: { title: 'Гидравлическое испытание', strochno: 'гидроиспытание', kratko: 'гидроиспытание', period: 'раз в 8 лет' }
  };
  var STATUSY_OBR = {
    novoe: { title: 'Новое', cls: 'badge--warn' },
    'v-rabote': { title: 'В работе', cls: 'badge--info' },
    zakryto: { title: 'Закрыто', cls: 'badge--neutral' }
  };
  /* Неизвестный статус не выдаётся за «Новое»: показываем как есть, нейтрально. */
  function statusObr(s) { return clone(STATUSY_OBR[s]) || { title: String(s || '—'), cls: 'badge--neutral' }; }
  function vidObr(v) { return clone(VIDY_OBR[v]) || { title: String(v || '—'), short: String(v || '—') }; }

  function segodnya() { return isoDay(today()); }
  function dneyDo(iso) { return diffDays(iso, segodnya()); }
  /* Срок ответа: сколько дней осталось и просрочен ли он. Одна формула
     для DATA и для Render.naKom (через DATA.srok). */
  function srok(naKom, iso) {
    if (!iso) { return { dney: null, prosrocheno: false }; }
    var n = dneyDo(iso);
    return { dney: n, prosrocheno: !!naKom && n < 0 };
  }
  function garantiyaOf(p) {
    if (!p) { return null; }
    var d = garantiyaDo(p), n = dneyDo(d);
    return { status: n >= 0 ? 'active' : 'expired', do: d, ostalosDney: Math.max(0, n) };
  }
  /* Ближайшее освидетельствование: самая ранняя дата не раньше сегодня. */
  function osvidBlizh(osvid) {
    var t0 = segodnya(), min = null;
    (osvid || []).forEach(function (o) { if (o.date >= t0 && (!min || o.date < min)) { min = o.date; } });
    if (!min) { return null; }
    var vidy = osvid.filter(function (o) { return o.date === min; }).map(function (o) { return o.vid; });
    return { vid: vidy[0], vidy: vidy, title: osvidTitle(vidy), date: min, dney: dneyDo(min) };
  }
  /* Подпись видов одной даты — одна склейка на все экраны (11a): осмотры сливаются
     в «Наружный и внутренний осмотр», прочие виды идут своей подписью:
     «Наружный осмотр и гидроиспытание». С прописной, экран сам решает о регистре. */
  function osvidTitle(vidy) {
    var osm = [], prochee = [];
    vidy.forEach(function (v) {
      var o = VIDY_OSVID[v];
      if (o && o.strochno === o.kratko + ' осмотр') { osm.push(o.kratko); } else { prochee.push(o ? o.strochno : v); }
    });
    var chasti = (osm.length ? [osm.join(' и ') + ' осмотр'] : []).concat(prochee);
    var t = chasti.length > 1 ? chasti.slice(0, -1).join(', ') + ' и ' + chasti[chasti.length - 1] : (chasti[0] || '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function napominanie(b) { return !!b && b.dney <= NAPOMNIT_DNEY; }
  function povod(b) { return !!b && b.date <= isoDay(addMonths(today(), POVOD_MES)); }
  function postavlen(a) { return a.etap === 'otgruzhen' && !!a.postavka; }
  /* Вид 3D-модели и чертежа АВО (таск 08b): горизонтальный — по обозначению «АВГ…»,
     остальные АВО — зигзагообразные; не АВО — null. */
  function vidModeli(a) {
    if (a.tip !== 'avo') { return null; }
    return /^\s*АВГ/i.test(a.oboznachenie || '') ? 'avg' : 'avz';
  }
  /* Пробное давление гидроиспытания — одно на протокол и паспорт (таск 08b):
     есть в паспорте — оттуда, иначе 1,25 × расчётное из опросного листа
     (нет его — из паспорта). Строка «2,3 МПа» или null. */
  var PROBNOE_K = 1.25;
  function davlenieProbnoe(a) {
    var p = (a.postavka && a.postavka.pasport) || {}, h = p.harakteristiki || {}, g = p.gidro || {};
    if (h.davlenieProbnoe) { return String(h.davlenieProbnoe); }
    if (g.davlenie) { return String(g.davlenie); }
    var raschet = (a.oprosnyList && a.oprosnyList.davlenieRaschetnoe) || h.davlenieRaschetnoe || '';
    var m = /([\d]+(?:[,.]\d+)?)/.exec(String(raschet));
    var v = m ? parseFloat(m[1].replace(',', '.')) * PROBNOE_K : 0;
    return v ? v.toFixed(v >= 1 ? 1 : 2).replace('.', ',') + ' МПа' : null;
  }
  /* «Новая» заявка — завод по ней ещё ничего не сделал: в истории нет хода
     завода. Отдаёт время подачи или null. */
  function novaya(a) {
    if (a.etap !== 'zayavka' || !a.istoriya.length) { return null; }
    var zavod = a.istoriya.some(function (h) { var p = person(h.kto); return !!p && p.side === 'zavod'; });
    return zavod ? null : a.istoriya[0].date;
  }
  /* Текущая W (таск 04): первая непройденная W, перед которой подтверждены все H. */
  function tekushchayaW(a) {
    for (var i = 0; i < a.pmi.length; i++) {
      if (a.pmi[i].tip === 'W' && a.pmi[i].status !== 'done') { return PRAVILO.ispytanie(a, i) ? a.pmi[i].id : null; }
    }
    return null;
  }
  /* Ближайшая W для карточки «Мои аппараты»: первая непройденная W с датой
     не раньше сегодня — даже если перед ней ещё ждёт точка H. */
  function blizhW(a) {
    var t0 = segodnya();
    for (var i = 0; i < a.pmi.length; i++) {
      var p = a.pmi[i];
      if (p.tip === 'W' && p.status !== 'done' && p.date && p.date >= t0) { return p.id; }
    }
    return null;
  }
  /* Раскладка «Мои аппараты»: карточкой — всё, что в работе, и последний
     поставленный на той же установке; остальной парк — строкой. */
  function raskladka(a) {
    if (!postavlen(a)) { return 'kartochka'; }
    var last = null;
    build().apparaty.forEach(function (b) {
      if (postavlen(b) && b.zakazchikId === a.zakazchikId && b.ustanovka === a.ustanovka &&
        (!last || b.postavka.vvod > last.postavka.vvod)) { last = b; }
    });
    return last && last.id === a.id ? 'kartochka' : 'stroka';
  }
  /* Место в раскладке, меньше — выше: в работе ранний этап выше, на одном
     этапе свежая заявка первой; поставленные после, свежий ввод первым. */
  function poryadok(a) {
    var t0 = segodnya();
    if (postavlen(a)) { return 1e7 + Math.max(0, diffDays(t0, a.postavka.vvod)); }
    return ETAPY.indexOf(a.etap) * 1e5 + Math.max(0, diffDays(t0, a.etapDaty[ETAPY[0]] || t0));
  }

  /* Как каждое действие журнала меняет данные. Обработчик терпит повтор
     и отсутствие цели: журнал проигрывается на каждом чтении. */
  var APPLY = {
    otpravitZayavku: function (st, e) {
      if (st.zayavki[e.draftId]) { return; }
      var f = e.forma || {}, id = 'n-' + e.seq, tip = M.tipy[f.tip] ? f.tip : 'avo';
      var etapDaty = {};
      ETAPY.forEach(function (et, i) { etapDaty[et] = i === 0 ? e.at : isoDay(addDays(dayOf(e.at), PLAN[i])); });
      var a = {
        id: id, tip: tip, nazvanie: f.nazvanie || M.tipy[tip].title, oboznachenie: f.oboznachenie || '[обозначение уточняется]',
        tu: f.tu || '', zakazchikId: e.zakazchikId, ustanovka: e.ustanovka, techPoz: f.techPoz || '',
        zavNomer: null, kolichestvo: +f.kolichestvo || 1, etap: 'zayavka', etapDaty: etapDaty, nachaloEtapa: e.at,
        naKom: 'zavod', srokOtveta: wd(e.at, 3), managerId: e.zakazchikId === 'taneko' ? 'z-garipova' : 'z-safin',
        zadanie: null, oprosnyList: clone(f), pmi: [],
        dokumenty: [{ id: id + '-sborochnyy', vid: 'sborochnyy', title: M.vidy.sborochnyy, revizii: [] }],
        zamechaniya: [], istoriya: [], postavka: null, obrashcheniya: []
      };
      sobytie(a, e, e.kto, 'Заявка с опросным листом отправлена заводу');
      st.apparaty.push(a);
      st.zayavki[e.draftId] = id;
    },
    napravitTkp: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      if (ETAPY.indexOf(a.etap) < ETAPY.indexOf('raschet')) { perejti(a, 'raschet', e.at); }
      var d = ensureDoc(a, 'tkp');
      d.revizii.forEach(function (r) { r.naKom = null; r.srok = null; });
      var srok = wd(e.at, 10);
      d.revizii.push({ rev: nextRev(d.revizii), date: e.at, kod: null, naKom: 'zakazchik', srok: srok });
      a.naKom = 'zakazchik'; a.srokOtveta = srok;
      sobytie(a, e, e.kto, 'ТКП направлено заказчику');
    },
    tkpPrinyato: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var r = lastRev(docByVid(a, 'tkp'));
      if (r) { r.kod = 1; r.naKom = null; r.srok = null; }
      if (ETAPY.indexOf(a.etap) < ETAPY.indexOf('dogovor')) { perejti(a, 'dogovor', e.at); }
      a.naKom = 'zavod'; a.srokOtveta = wd(e.at, 5);
      sobytie(a, e, e.kto, 'ТКП принято заказчиком');
    },
    dogovorPodpisan: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      if (ETAPY.indexOf(a.etap) < ETAPY.indexOf('chertezh')) { perejti(a, 'chertezh', e.at); }
      a.naKom = 'zavod'; a.srokOtveta = wd(e.at, 3);
      sobytie(a, e, e.kto, 'Договор подписан');
    },
    /* Прежняя склейка двух ходов: журналы, записанные до разделения, проигрываются как были. */
    tkpPrinyatoDogovor: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var d = docByVid(a, 'tkp'), r = lastRev(d);
      if (r) { r.kod = 1; r.naKom = null; r.srok = null; }
      if (ETAPY.indexOf(a.etap) < ETAPY.indexOf('chertezh')) { perejti(a, 'chertezh', e.at); }
      a.naKom = 'zavod'; a.srokOtveta = wd(e.at, 3);
      sobytie(a, e, e.kto, 'ТКП принято, договор подписан');
    },
    naznachitKonstruktora: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      a.zadanie = { konstruktorId: e.konstruktorId, srok: e.srok, status: 'naznacheno', komment: e.komment || '' };
      a.naKom = 'zavod'; a.srokOtveta = e.srok;
      var k = person(e.konstruktorId);
      sobytie(a, e, e.kto, 'Задание конструктору: ' + (k ? k.name : '') + (e.komment ? ' — ' + e.komment : ''));
    },
    vypustitReviziyu: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var d = ensureDoc(a, e.vid);
      d.revizii.forEach(function (r) { r.naKom = null; r.srok = null; });
      var rv = nextRev(d.revizii), srok = wd(e.at, 5);
      d.revizii.push({ rev: rv, date: e.at, kod: null, naKom: 'zakazchik', srok: srok });
      a.naKom = 'zakazchik'; a.srokOtveta = srok;
      sobytie(a, e, e.kto, d.title + ', рев. ' + rv + ', выложен на согласование' + (e.vid === 'sborochnyy' && a.tip === 'avo' ? ' вместе с 3D-моделью' : ''));
    },
    dobavitZamechanie: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var d = byId(a.dokumenty, e.dokumentId), r = lastRev(d); if (!r) { return; }
      a.zamechaniya.push({ id: 'zm-' + e.seq, dokumentId: d.id, rev: r.rev, poziciya: e.poziciya || null,
        text: e.text || '', avtor: e.kto, date: e.at, otvet: null });
      sobytie(a, e, e.kto, 'Замечание к документу «' + d.title + '», рев. ' + r.rev + (e.poziciya ? ', позиция «' + e.poziciya + '»' : ''));
    },
    otvetitNaDokument: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var d = byId(a.dokumenty, e.dokumentId), r = lastRev(d); if (!r) { return; }
      r.kod = e.kod;
      if (e.kod === 2 || e.kod === 3) {
        r.naKom = 'zavod'; r.srok = wd(e.at, 5);
        a.naKom = 'zavod'; a.srokOtveta = r.srok;
      } else {
        r.naKom = null; r.srok = null;
      }
      sobytie(a, e, e.kto, 'Ответ на «' + d.title + '», рев. ' + r.rev + ': код ' + e.kod + ' «' + M.kody[e.kod] + '»');
      if (e.kod === 1 && d.vid === 'sborochnyy' && a.etap === 'chertezh') {
        perejti(a, 'metall', e.at);
        if (a.zadanie) { a.zadanie.status = 'vypolneno'; }
        a.naKom = 'zavod'; a.srokOtveta = null;
      }
    },
    otvetitNaZamechanie: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var z = byId(a.zamechaniya, e.zamechanieId); if (!z) { return; }
      z.otvet = { text: e.text || '', prinyato: !!e.prinyato, avtor: e.kto, date: e.at };
      sobytie(a, e, e.kto, 'Ответ на замечание' + (z.poziciya ? ' «' + z.poziciya + '»' : '') + ': ' + (e.prinyato ? 'принято' : 'отклонено'));
    },
    otvetNaPriglashenie: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var p = byId(a.pmi, e.pmiId); if (!p) { return; }
      p.otvetZakazchika = e.otvet;
      p.priedut = e.otvet === 'priedu' ? (+e.priedut || 1) : null;
      if (e.fio) { p.fio = e.fio; }
      sobytie(a, e, e.kto, 'Приглашение на «' + p.title + '»: ' +
        (e.otvet === 'priedu' ? 'приедем на инспекцию, ' + p.priedut + ' чел.' : 'проводите без нас'));
    },
    podtverditHold: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var i = pmiIdx(a, e.pmiId); if (i < 0) { return; }
      var p = a.pmi[i];
      p.status = 'done';
      var next = a.pmi[i + 1];
      if (next && next.status === 'plan') { next.status = 'current'; }
      docsOfPmi(a, p).forEach(function (d) { var r = lastRev(d); if (r) { r.naKom = null; r.srok = null; } });
      a.naKom = 'zavod'; a.srokOtveta = null;
      sobytie(a, e, e.kto, 'Точка остановки «' + p.title + '» подтверждена: продолжайте');
    },
    provestiIspytanie: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      var i = pmiIdx(a, e.pmiId);
      if (!PRAVILO.ispytanie(a, i)) { return; }
      /* Точки R до испытания считаются пройденными, но протокола им не
         придумываем; точка H сюда не доходит — её закрывает только заказчик. */
      for (var j = 0; j < i; j++) {
        if (a.pmi[j].status !== 'done') { a.pmi[j].status = 'done'; a.pmi[j].date = e.at; }
      }
      var p = a.pmi[i];
      p.status = 'done'; p.date = e.at; p.protokol = true;
      if (a.pmi[i + 1] && a.pmi[i + 1].status === 'plan') { a.pmi[i + 1].status = 'current'; }
      [['Протокол гидравлических испытаний', '-gidro-protokol'], ['Акт о проведении гидравлических испытаний', '-gidro-akt']]
        .forEach(function (x) {
          var d = ensureDoc(a, 'protokol', x[0], a.id + x[1]);
          d.pmiId = p.id;
          d.revizii = [{ rev: '1', date: e.at, kod: null, naKom: null, srok: null }];
        });
      if (ETAPY.indexOf(a.etap) < ETAPY.indexOf('gotov')) { perejti(a, 'gotov', e.at); }
      a.naKom = 'zavod'; a.srokOtveta = null;
      sobytie(a, e, e.kto, '«' + p.title + '» проведены: протокол и акт выложены');
    },
    obrashchenie: function (st, e) {
      var a = byId(st.apparaty, e.apparatId); if (!a) { return; }
      a.obrashcheniya.push({ id: 'ob-' + e.seq, apparatId: a.id, vid: e.vid, text: e.text || '', foto: e.foto || null,
        zip: e.zip || [], date: e.at, status: 'novoe', ot: e.kto });
      sobytie(a, e, e.kto, vidObr(e.vid).title + ' отправлен' + (e.vid === 'zip' ? '' : 'а') + ' в сервис завода');
    },
    zayavkaPoQr: function (st, e) {
      var a = find(st.apparaty, function (x) { return x.postavka && x.zavNomer === e.zavNomer; }); if (!a) { return; }
      a.obrashcheniya.push({ id: 'ob-' + e.seq, apparatId: a.id, vid: 'remont', text: e.text || '', foto: null, zip: [],
        date: e.at, status: 'novoe', ot: null, poQr: true, gost: { predpriyatie: e.predpriyatie, kontakt: e.kontakt } });
      sobytie(a, e, null, 'Заявка на ремонт ' + BEZ_VHODA + ': ' + e.predpriyatie + ', ' + e.kontakt);
    },
    vzyatVRabotu: function (st, e) {
      st.apparaty.forEach(function (a) {
        var o = byId(a.obrashcheniya, e.obrashchenieId);
        if (o) { o.status = 'v-rabote'; sobytie(a, e, e.kto, 'Обращение взято в работу'); }
      });
    }
  };

  /* ---------- выдача в форме контракта ---------- */

  function garantiyaDo(p) { return p ? isoDay(addMonths(dayOf(p.vvod), p.garantiyaMes)) : null; }

  function obrOut(o) {
    var c = clone(o);
    c.ot = o.gost
      ? { id: null, name: o.gost.kontakt, position: BEZ_VHODA, side: null, predpriyatie: o.gost.predpriyatie }
      : kto(o.ot);
    c.poQr = !!o.poQr;
    c.pometka = o.poQr ? BEZ_VHODA : null;
    c.kontakt = o.gost ? { predpriyatie: o.gost.predpriyatie, kontakt: o.gost.kontakt } : null;
    delete c.gost;
    c.vidInfo = vidObr(o.vid);
    c.statusInfo = statusObr(o.status);
    c.mozhnoVzyat = PRAVILO.vzyat(o);
    return c;
  }

  function out(a) {
    var cur = ETAPY.indexOf(a.etap);
    var sr = srok(a.naKom, a.srokOtveta), b = a.postavka ? osvidBlizh(a.postavka.osvid) : null;
    var x = {
      id: a.id, tip: a.tip, nazvanie: a.nazvanie, oboznachenie: a.oboznachenie, tu: a.tu,
      zakazchikId: a.zakazchikId, ustanovka: a.ustanovka, techPoz: a.techPoz, zavNomer: a.zavNomer || null,
      kolichestvo: a.kolichestvo, etap: a.etap,
      etapy: M.etapy.map(function (e, i) {
        var status = i < cur ? 'done' : (i === cur ? 'current' : 'plan'), tc = TITLE_CURRENT[e.id] || e.title;
        return { id: e.id, title: status === 'current' ? tc : e.title, titleCurrent: tc, status: status, date: a.etapDaty[e.id] || null };
      }),
      naKom: a.naKom || null, srokOtveta: a.srokOtveta || null,
      dneyNaEtape: Math.max(0, diffDays(isoDay(today()), a.nachaloEtapa)),
      managerId: a.managerId, zadanie: clone(a.zadanie) || null, oprosnyList: clone(a.oprosnyList) || null,
      mozhno: {
        tkp: PRAVILO.tkp(a),
        tkpPrinyato: PRAVILO.tkpPrinyato(a),
        dogovorPodpisan: PRAVILO.dogovorPodpisan(a),
        dogovor: PRAVILO.dogovor(a),
        naznachit: PRAVILO.naznachit(a) ? { srok: srokZadaniya() } : null,
        reviziyu: PRAVILO.reviziyu(a, 'sborochnyy') ? 'sborochnyy' : null,
        reklamaciyu: PRAVILO.reklamaciya(a)
      },
      postavlen: postavlen(a),
      novaya: novaya(a),
      prosrocheno: sr.prosrocheno,
      dneyDoSroka: sr.dney,
      tekushchayaW: tekushchayaW(a),
      blizhW: blizhW(a),
      raskladka: raskladka(a),
      poryadok: poryadok(a),
      vidModeli: vidModeli(a),
      davlenieProbnoe: davlenieProbnoe(a),
      garantiya: garantiyaOf(a.postavka),
      osvidBlizh: b,
      napominanie: napominanie(b),
      povodSvyazatsya: povod(b),
      pmi: a.pmi.map(function (p, i) {
        var c = clone(p);
        c.kratko = p.kratko || '«' + p.title + '»';
        c.mozhnoPodtverdit = PRAVILO.hold(a, i);
        c.zhdyotH = PRAVILO.zhdyotH(a, i);
        c.mozhnoOtvetit = PRAVILO.priglashenie(a, i);
        c.mozhnoIspytat = PRAVILO.ispytanie(a, i);
        c.dokumenty = docsOfPmi(a, p).filter(lastRev).map(function (d) {
          return { id: d.id, title: d.title, date: lastRev(d).date };
        });
        return c;
      }),
      dokumenty: a.dokumenty.map(function (d) {
        var c = clone(d);
        c.sledRev = nextRev(d.revizii);
        c.mozhno = { reviziyu: PRAVILO.reviziyu(a, d.vid), zamechanie: PRAVILO.zamechanie(a, d), kody: PRAVILO.kody(a, d) };
        return c;
      }),
      zamechaniya: a.zamechaniya.map(function (z) {
        var c = clone(z);
        c.avtor = kto(z.avtor);
        if (z.otvet) { c.otvet.avtor = kto(z.otvet.avtor); }
        c.mozhnoOtvetit = PRAVILO.otvetNaZamechanie(a, z);
        return c;
      }),
      istoriya: a.istoriya.map(function (h) { return { date: h.date, kto: kto(h.kto), chto: h.chto }; })
        .sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; }),
      postavka: null,
      obrashcheniya: a.obrashcheniya.map(obrOut)
    };
    if (a.postavka) {
      var p = clone(a.postavka);
      x.postavka = {
        vvod: p.vvod, garantiyaDo: garantiyaDo(p), garantiyaMes: p.garantiyaMes, osvid: p.osvid, zip: p.zip,
        pasport: p.pasport, shefMontazh: !!p.shefMontazh
      };
      var o = x.postavka.pasport.obshchie;
      o.izgotovitel = M.zavod.short; o.naimenovanie = a.nazvanie; o.oboznachenie = a.oboznachenie;
      o.zavNomer = a.zavNomer; o.dataIzgotovleniya = a.etapDaty.gotov; o.tu = a.tu;
      /* Паспорт показывает то же пробное давление, что протокол. */
      var pp = x.postavka.pasport;
      if (x.davlenieProbnoe) {
        pp.harakteristiki = pp.harakteristiki || {}; pp.harakteristiki.davlenieProbnoe = x.davlenieProbnoe;
        pp.gidro = pp.gidro || {}; pp.gidro.davlenie = x.davlenieProbnoe;
      }
    }
    return x;
  }

  function visible(a, me) {
    if (me.side === 'zavod') { return true; }
    return a.zakazchikId === me.zakazchikId && (!me.ustanovka || a.ustanovka === me.ustanovka);
  }

  function spisok(opts) {
    opts = opts || {};
    var me = mePerson();
    var etapy = opts.etap ? [].concat(opts.etap) : null;
    return build().apparaty.filter(function (a) {
      if (!visible(a, me)) { return false; }
      if (opts.zakazchikId && a.zakazchikId !== opts.zakazchikId) { return false; }
      if (opts.tip && a.tip !== opts.tip) { return false; }
      if (etapy && etapy.indexOf(a.etap) < 0) { return false; }
      if (opts.naMne && a.naKom !== me.side) { return false; }
      return true;
    });
  }

  function zakazchikOut(z) {
    var all = build().apparaty.filter(function (a) { return a.zakazchikId === z.id; });
    var blizh = null, obr = 0, povodov = 0;
    all.forEach(function (a) {
      obr += a.obrashcheniya.length;
      var b = a.postavka ? osvidBlizh(a.postavka.osvid) : null;
      if (!b) { return; }
      if (povod(b)) { povodov++; }
      if (!blizh || b.date < blizh.date) { blizh = b; blizh.apparatId = a.id; }
    });
    return {
      id: z.id, name: z.name, group: z.group, city: z.city, ustanovki: z.ustanovki.slice(),
      contacts: M.lyudi.filter(function (p) { return p.zakazchikId === z.id; }).map(contact),
      park: {
        vEkspluatacii: all.filter(function (a) { return postavlen(a); }).length,
        otkrytyhZayavok: all.filter(function (a) { return !postavlen(a); }).length,
        blizhOsvid: blizh ? blizh.date : null, obrashcheniy: obr,
        osvidBlizh: blizh, napominanie: napominanie(blizh), povodSvyazatsya: povod(blizh), povodov: povodov
      }
    };
  }

  var KOLONKI = [
    { kolonka: 'zayavka', title: 'Новые заявки', etapy: ['zayavka'] },
    { kolonka: 'raschet', title: 'Расчёт и ТКП', etapy: ['raschet'] },
    { kolonka: 'dogovor', title: 'Договор', etapy: ['dogovor'] },
    { kolonka: 'chertezh', title: 'Согласование чертежа', etapy: ['chertezh'] },
    { kolonka: 'proizvodstvo', title: 'Производство', etapy: ['metall', 'svarka'] },
    { kolonka: 'ispytaniya', title: 'Испытания и отгрузка', etapy: ['ispytaniya', 'gotov'] }
  ];

  /* ---------- сводка для руководства (таск 11) ----------
     Только сборка из готовых признаков Apparat (out): prosrocheno, dneyNaEtape,
     naKom, etapy, osvidBlizh, povodSvyazatsya, garantiya, postavlen. Своих копий
     этих правил здесь нет; новое одно — «риск срока» по датам этапов. */
  var PROIZVODSTVO = ['metall', 'svarka', 'ispytaniya', 'gotov'];

  function kratkoZak(id) { var z = byId(M.zakazchiki, id); return z ? { id: z.id, name: z.name } : null; }
  /* Короткая строка аппарата для списков сводки. */
  function strokaSv(x) {
    return { id: x.id, nazvanie: x.nazvanie, techPoz: x.techPoz, zavNomer: x.zavNomer, zakazchik: kratkoZak(x.zakazchikId),
      etap: x.etap, naKom: x.naKom, srokOtveta: x.srokOtveta, prosrocheno: x.prosrocheno, dneyNaEtape: x.dneyNaEtape };
  }
  function etapOf(x, id) { return find(x.etapy, function (e) { return e.id === id; }); }
  /* Риск срока: плановая дата текущего этапа уже прошла, а этап не закрыт. */
  function riskSroka(x) {
    var cur = find(x.etapy, function (e) { return e.status === 'current'; });
    return !!cur && !!cur.date && cur.date < segodnya();
  }
  var POKAZAT_POVODOV = 6;  /* повторные продажи: столько ближайших строк на сводке */

  function svodka() {
    var me = mePerson();
    if (me.side !== 'zavod') { return null; }

    /* 1. Воронка: распределение по колонкам — ровно DATA.voronka, как на crm.html. */
    var vor = DATA.voronka({});
    var vVoronke = [];
    vor.forEach(function (k) { vVoronke = vVoronke.concat(k.apparaty); });
    var kolonki = vor.map(function (k) {
      var sum = k.apparaty.reduce(function (s, x) { return s + x.dneyNaEtape; }, 0);
      return { kolonka: k.kolonka, title: k.title, n: k.apparaty.length,
        dneySredn: k.apparaty.length ? Math.round(sum / k.apparaty.length) : null, dolgiy: false };
    });
    var dolgiy = null;
    kolonki.forEach(function (k) { if (k.dneySredn !== null && (!dolgiy || k.dneySredn > dolgiy.dneySredn)) { dolgiy = k; } });
    if (dolgiy) { dolgiy.dolgiy = true; }
    var doshli = vVoronke.filter(function (x) { return ETAPY.indexOf(x.etap) >= ETAPY.indexOf('dogovor'); }).length;

    /* 2. На ком шаг: по аппаратам в воронке, как счётчики crm.html. */
    function schet(kto) {
      var l = vVoronke.filter(function (x) { return x.naKom === kto; });
      return { n: l.length, prosrocheno: l.filter(function (x) { return x.prosrocheno; }).length };
    }
    var dolgie = vVoronke.filter(function (x) { return !!x.naKom; }).sort(function (p, q) {
      return (q.dneyNaEtape - p.dneyNaEtape) || ((q.prosrocheno ? 1 : 0) - (p.prosrocheno ? 1 : 0));
    }).slice(0, 3).map(strokaSv);

    /* 3. Производство: после согласования чертежа до отгрузки. */
    var vProizv = vVoronke.filter(function (x) { return PROIZVODSTVO.indexOf(x.etap) > -1; }).map(function (x) {
      var s = strokaSv(x), cur = etapOf(x, x.etap), otg = etapOf(x, 'otgruzhen');
      s.etapTitle = cur ? cur.title : '';
      s.srokEtapa = cur ? cur.date : null;
      s.otgruzka = otg ? otg.date : null;
      s.riskSroka = riskSroka(x);
      return s;
    }).sort(function (p, q) { return p.otgruzka < q.otgruzka ? -1 : p.otgruzka > q.otgruzka ? 1 : 0; });

    /* 4. Повторные продажи: освидетельствование (povodSvyazatsya) и конец гарантии
       в том же горизонте (povod) — одна строка на аппарат, поводы вместе. */
    var nOsvid = 0, nGar = 0, stroki = [];
    spisok({}).map(out).filter(function (x) { return x.postavlen; }).forEach(function (x) {
      var povody = [];
      if (x.povodSvyazatsya) { nOsvid++; povody.push({ vid: 'osvid', title: x.osvidBlizh.title, date: x.osvidBlizh.date }); }
      var g = x.garantiya;
      if (g && g.status === 'active' && povod({ date: g.do })) { nGar++; povody.push({ vid: 'garantiya', title: 'Окончание гарантии', date: g.do }); }
      if (!povody.length) { return; }
      povody.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });
      stroki.push({ apparat: strokaSv(x), date: povody[0].date, dney: dneyDo(povody[0].date), povody: povody });
    });
    stroki.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });

    return {
      na: segodnya(),
      voronka: {
        vsego: vVoronke.length,
        kolonki: kolonki,
        dogovor: { doshli: doshli, iz: vVoronke.length, dolya: vVoronke.length ? Math.round(doshli * 100 / vVoronke.length) : null }
      },
      shagi: { zavod: schet('zavod'), zakazchik: schet('zakazchik'), dolgie: dolgie },
      proizvodstvo: {
        etapy: PROIZVODSTVO.map(function (id) {
          var e = byId(M.etapy, id);
          return { id: id, title: TITLE_CURRENT[id] || (e ? e.title : id), n: vProizv.filter(function (x) { return x.etap === id; }).length };
        }),
        apparaty: vProizv,
        riskov: vProizv.filter(function (x) { return x.riskSroka; }).length
      },
      povtornye: {
        mesyacev: POVOD_MES,
        osvid: nOsvid,
        garantii: nGar,
        apparatov: stroki.length,
        blizhayshie: stroki.slice(0, POKAZAT_POVODOV),
        eshchyo: Math.max(0, stroki.length - POKAZAT_POVODOV)
      }
    };
  }

  var DATA = {
    me: function () {
      var p = mePerson();
      return { id: p.id, name: p.name, position: p.position, side: p.side, zakazchikId: p.zakazchikId || null,
        ustanovka: p.ustanovka || null, phone: p.phone, email: p.email, home: p.home || null, demo: true };
    },
    zakazchiki: function () {
      var me = mePerson();
      return M.zakazchiki.filter(function (z) { return me.side === 'zavod' || z.id === me.zakazchikId; }).map(zakazchikOut);
    },
    zakazchik: function (id) {
      var me = mePerson(), z = byId(M.zakazchiki, id);
      if (!z || (me.side !== 'zavod' && z.id !== me.zakazchikId)) { return null; }
      return zakazchikOut(z);
    },
    apparaty: function (opts) { return spisok(opts).map(out); },
    apparat: function (id) {
      var a = byId(build().apparaty, id);
      return a && visible(a, mePerson()) ? out(a) : null;
    },
    poNomeru: function (zavNomer) {
      var a = find(build().apparaty, function (x) { return x.zavNomer && x.zavNomer === String(zavNomer) && x.postavka; });
      if (!a) { return null; }
      var g = garantiyaOf(a.postavka), re = docByVid(a, 're');
      return {
        nazvanie: a.nazvanie, oboznachenie: a.oboznachenie, zavNomer: a.zavNomer, tu: a.tu,
        dataIzgotovleniya: a.etapDaty.gotov, izgotovitel: M.zavod.short,
        garantiya: g,
        re: { title: re ? re.title : M.vidy.re }
      };
    },
    voronka: function (opts) {
      var list = spisok(opts);
      return KOLONKI.map(function (k) {
        return { kolonka: k.kolonka, title: k.title, apparaty: list.filter(function (a) { return k.etapy.indexOf(a.etap) > -1; }).map(out) };
      });
    },
    servis: function () {
      var out1 = [];
      spisok({}).forEach(function (a) {
        var z = byId(M.zakazchiki, a.zakazchikId);
        var ao = out(a);
        ao.obrashcheniya.forEach(function (o) {
          o.apparat = ao; o.zakazchik = z ? { id: z.id, name: z.name } : null;
          out1.push(o);
        });
      });
      return out1.sort(function (p, q) { return p.date < q.date ? 1 : p.date > q.date ? -1 : 0; });
    },
    lyudi: function (opts) {
      var side = (opts && opts.side) || 'zavod', me = mePerson();
      return M.lyudi.filter(function (p) {
        if (p.side !== side) { return false; }
        return side === 'zavod' || me.side === 'zavod' || p.zakazchikId === me.zakazchikId;
      }).map(contact);
    },
    /* Сверх контракта, только чтение: подписи и справочники для экранов. */
    spravochnik: function () {
      var zavod = clone(M.zavod);
      /* Имя без организационно-правовой формы: «Бугульминский механический завод». */
      zavod.imya = String(zavod.name || '').replace(/^ООО\s*«(.*)»$/, '$1');
      return clone({ zavod: zavod, etapy: M.etapy, tipy: M.tipy, vidy: M.vidy, kody: M.kody,
        vidyObr: VIDY_OBR, statusyObr: STATUSY_OBR, vidyOsvid: VIDY_OSVID });
    },
    /** Срок ответа → {dney, prosrocheno}: та же формула, что у Apparat.prosrocheno. */
    srok: function (naKom, iso) { return srok(naKom, iso); },
    /** Демо-значения опросного листа по типу аппарата — для формы новой заявки. */
    oprosnyShablon: function (tip) { return M.oprosnye[tip] ? clone(M.oprosnye[tip]) : null; },
    /** Подпись набора видов освидетельствования — та же склейка, что osvidBlizh.title (11a). */
    osvidTitle: function (vidy) { return osvidTitle([].concat(vidy || [])); },
    /** Сводка для руководства завода (таск 11); у заказчика — null. Форма — в svodka() выше. */
    svodka: function () { return svodka(); }
  };

  /* ---------- запись ---------- */

  function apparatFor(id) { return byId(build().apparaty, id); }
  function push(t, fields, ktoId) {
    var e = { t: t, kto: ktoId || mePerson().id };
    for (var k in fields) { e[k] = fields[k]; }
    return w.Store.push(e);
  }
  function manager(a) { return a.managerId; }
  function konstruktor(a) { return (a.zadanie && a.zadanie.konstruktorId) || 'z-hasanov'; }

  var ACT = {
    /** Повторный вызов с тем же draftId вернёт тот же id, дубля нет. */
    otpravitZayavku: function (draftId, forma) {
      if (!draftId) { return null; }
      var st = build();
      if (st.zayavki[draftId]) { return st.zayavki[draftId]; }
      var me = mePerson(), f = forma || {};
      var zakId = me.side === 'zakazchik' ? me.zakazchikId : (f.zakazchikId || 'taneko');
      var z = byId(M.zakazchiki, zakId);
      var ust = f.ustanovka || (me.side === 'zakazchik' ? me.ustanovka : null) || (z ? z.ustanovki[0] : '');
      var e = push('otpravitZayavku', { draftId: draftId, forma: clone(f), zakazchikId: zakId, ustanovka: ust });
      return 'n-' + e.seq;
    },
    napravitTkp: function (apparatId) {
      var a = apparatFor(apparatId); if (!a || !PRAVILO.tkp(a)) { return null; }
      push('napravitTkp', { apparatId: apparatId });
      return apparatId;
    },
    /** Ход вне системы: записывается от имени менеджера аппарата. */
    /** Ход вне системы: заказчик принял ТКП. От имени менеджера аппарата. */
    tkpPrinyato: function (apparatId) {
      var a = apparatFor(apparatId); if (!a || !PRAVILO.tkpPrinyato(a)) { return null; }
      push('tkpPrinyato', { apparatId: apparatId }, manager(a));
      return apparatId;
    },
    /** Ход вне системы: договор подписан. От имени менеджера аппарата. */
    dogovorPodpisan: function (apparatId) {
      var a = apparatFor(apparatId); if (!a || !PRAVILO.dogovorPodpisan(a)) { return null; }
      push('dogovorPodpisan', { apparatId: apparatId }, manager(a));
      return apparatId;
    },
    /** Обёртка: «ТКП принято» и «договор подписан» подряд — для панели и сценария А. */
    tkpPrinyatoDogovor: function (apparatId) {
      var a = apparatFor(apparatId); if (!a || !PRAVILO.dogovor(a)) { return null; }
      if (!ACT.tkpPrinyato(apparatId)) { return null; }
      return ACT.dogovorPodpisan(apparatId);
    },
    naznachitKonstruktora: function (apparatId, o) {
      var a = apparatFor(apparatId); o = o || {};
      if (!a || !person(o.konstruktorId) || !PRAVILO.naznachit(a)) { return null; }
      push('naznachitKonstruktora', { apparatId: apparatId, konstruktorId: o.konstruktorId,
        srok: o.srok || srokZadaniya(), komment: o.komment || '' });
      return apparatId;
    },
    /** Ход конструктора: записывается от имени конструктора из задания. */
    vypustitReviziyu: function (apparatId, vid) {
      var a = apparatFor(apparatId); if (!a || !PRAVILO.reviziyu(a, vid)) { return null; }
      push('vypustitReviziyu', { apparatId: apparatId, vid: vid }, konstruktor(a));
      return lastRev(docByVid(apparatFor(apparatId), vid)).rev;
    },
    dobavitZamechanie: function (apparatId, o) {
      var a = apparatFor(apparatId); o = o || {};
      var d = a && byId(a.dokumenty, o.dokumentId);
      if (!d || !PRAVILO.zamechanie(a, d) || !String(o.text || '').trim()) { return null; }
      var e = push('dobavitZamechanie', { apparatId: apparatId, dokumentId: o.dokumentId, poziciya: o.poziciya || null, text: String(o.text).trim() });
      return 'zm-' + e.seq;
    },
    otvetitNaDokument: function (apparatId, dokumentId, kod) {
      var a = apparatFor(apparatId), d = a && byId(a.dokumenty, dokumentId);
      kod = +kod;
      if (!d || PRAVILO.kody(a, d).indexOf(kod) < 0) { return null; }
      push('otvetitNaDokument', { apparatId: apparatId, dokumentId: dokumentId, kod: kod });
      return kod;
    },
    otvetitNaZamechanie: function (apparatId, zamechanieId, o) {
      var a = apparatFor(apparatId), z = a && byId(a.zamechaniya, zamechanieId); o = o || {};
      if (!z || !PRAVILO.otvetNaZamechanie(a, z)) { return null; }
      push('otvetitNaZamechanie', { apparatId: apparatId, zamechanieId: zamechanieId, text: o.text || '', prinyato: !!o.prinyato });
      return zamechanieId;
    },
    otvetNaPriglashenie: function (apparatId, pmiId, o) {
      var a = apparatFor(apparatId); o = o || {};
      if (!a || !PRAVILO.priglashenie(a, pmiIdx(a, pmiId)) || ['priedu', 'bez-nas'].indexOf(o.otvet) < 0) { return null; }
      push('otvetNaPriglashenie', { apparatId: apparatId, pmiId: pmiId, otvet: o.otvet, priedut: o.priedut || null, fio: o.fio || null });
      return pmiId;
    },
    podtverditHold: function (apparatId, pmiId) {
      var a = apparatFor(apparatId);
      if (!a || !PRAVILO.hold(a, pmiIdx(a, pmiId))) { return null; }
      push('podtverditHold', { apparatId: apparatId, pmiId: pmiId });
      return pmiId;
    },
    provestiIspytanie: function (apparatId, pmiId) {
      var a = apparatFor(apparatId);
      if (!a || !PRAVILO.ispytanie(a, pmiIdx(a, pmiId))) { return null; }
      push('provestiIspytanie', { apparatId: apparatId, pmiId: pmiId });
      return pmiId;
    },
    /** Рекламация — только пока идёт гарантия; иначе null и ничего не пишется. */
    obrashchenie: function (apparatId, o) {
      var a = apparatFor(apparatId); o = o || {};
      if (!a || !a.postavka || ['remont', 'reklamaciya', 'zip'].indexOf(o.vid) < 0) { return null; }
      if (o.vid === 'reklamaciya' && !PRAVILO.reklamaciya(a)) { return null; }
      var e = push('obrashchenie', { apparatId: apparatId, vid: o.vid, text: o.text || '', foto: o.foto || null, zip: o.zip || [] });
      return 'ob-' + e.seq;
    },
    vzyatVRabotu: function (obrashchenieId) {
      var found = find(build().apparaty, function (a) { return !!byId(a.obrashcheniya, obrashchenieId); });
      if (!found || !PRAVILO.vzyat(byId(found.obrashcheniya, obrashchenieId))) { return null; }
      push('vzyatVRabotu', { obrashchenieId: obrashchenieId });
      return obrashchenieId;
    },
    /** Заявка на ремонт по QR без входа (G09): по заводскому номеру поставленного
        аппарата; предприятие, контакт и описание обязательны. → 'ob-N' | null. */
    zayavkaPoQr: function (zavNomer, o) {
      o = o || {};
      var n = String(zavNomer || '').trim(), f = {};
      var ok = ['predpriyatie', 'kontakt', 'text'].every(function (k) { f[k] = String(o[k] || '').trim(); return !!f[k]; });
      var a = n && find(build().apparaty, function (x) { return x.postavka && x.zavNomer === n; });
      if (!ok || !a) { return null; }
      var e = w.Store.push({ t: 'zayavkaPoQr', kto: null, zavNomer: n, predpriyatie: f.predpriyatie, kontakt: f.kontakt, text: f.text });
      return 'ob-' + e.seq;
    }
  };

  w.DATA = DATA;
  w.ACT = ACT;
})(window);

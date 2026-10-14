/* Один шов к данным: DATA на чтение, ACT на запись.
   Данные для экрана = демо-данные MOCK + журнал действий из Store,
   проигранный поверх. Отсюда история «кто, что, когда», видимость между
   ролями и сброс одной кнопкой. В рабочей версии заменяется этот файл,
   экраны остаются. Контракт — interfaces.md, раздел «assets/dannye.js».

   Правила ходов (PRAVILO) и производные («на ком шаг», сроки, риск срока,
   этапы) считаются только здесь и выходят наружу признаками: mozhno{},
   naKom, shag, riskSroka. Страницы, панель и сценарии своих условий
   не пишут. */
(function (w) {
  'use strict';

  var M = w.MOCK;
  var SP = M.spravochnik;
  var DAY = 86400000;

  /* ---------- даты ---------- */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDay(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
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
  /* Понедельник недели, в которой лежит день. */
  function monday(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return addDays(x, -((x.getDay() + 6) % 7)); }
  /* День события по местному времени: «2026-10-09» как есть, ISO-время —
     местный календарный день (UTC-строку нельзя резать по первым 10 знакам). */
  function localDay(iso) {
    if (!iso) { return null; }
    var s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { return s; }
    var d = new Date(s);
    return isNaN(d.getTime()) ? s.slice(0, 10) : isoDay(d);
  }
  function dayOf(iso) { var p = String(localDay(iso)).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function diffDays(a, b) { return Math.round((dayOf(a) - dayOf(b)) / DAY); }
  function segodnya() { return isoDay(today()); }
  function dneyDo(iso) { return diffDays(iso, segodnya()); }
  function wd(at, n) { return isoDay(addWorkDays(dayOf(at), n)); }
  function vremya(iso) { var t = new Date(String(iso)).getTime(); return isNaN(t) ? 0 : t; }
  /* Время события — местное «YYYY-MM-DDTHH:MM:SS» без пояса: первые 10 знаков
     и есть местный день. Журнал Store пишет время в UTC — переводим здесь. */
  function isoVremya(d) { return isoDay(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function mestnoe(iso) { var d = new Date(String(iso)); return isNaN(d.getTime()) ? String(iso) : isoVremya(d); }
  function validDay(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(dayOf(v).getTime()); }

  /* «@-30», «@+14», «@-8m», «@w-6+1», и с временем «@-3 10:40» →
     ISO-день или ISO-время относительно дня показа. */
  var OFFSET = /^@(w?)([+-]?\d+)(m?)(?:\+(\d))?(?: (\d{1,2}):(\d{2}))?$/;
  function resolve(v, base) {
    if (typeof v === 'string') {
      var m = OFFSET.exec(v);
      if (!m) { return v; }
      var d;
      if (m[1]) { d = addDays(monday(base), 7 * (+m[2]) + (+(m[4] || 0))); }
      else if (m[3]) { d = addMonths(base, +m[2]); }
      else { d = addDays(base, +m[2]); }
      if (m[5] !== undefined) { d.setHours(+m[5], +m[6], 0, 0); return isoVremya(d); }
      return isoDay(d);
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
  function sum(list, f) { return list.reduce(function (a, x) { return a + (+f(x) || 0); }, 0); }
  function trim(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function chislo(v) { var n = typeof v === 'number' ? v : parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; }
  /* Склейка текста из ввода: пробелы схлопнуты, одна точка в конце, без «..».
     sMaloy — кусок посреди фразы или в конце строки истории: со строчной и без
     знака в конце, чтобы не вышло «компанией.,» и «ворота 3.». */
  function odinProbel(s) { return trim(s).replace(/\s+/g, ' '); }
  function sTochkoy(s) { s = odinProbel(s); return /[.!?…]$/.test(s) ? s : s + '.'; }
  function sMaloy(s) { s = odinProbel(s).replace(/\s*[.,;:]+$/, ''); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
  function poVremeni(a, b) { return vremya(a) - vremya(b); }

  /* ---------- люди ---------- */

  function person(id) { return byId(M.lyudi, id); }
  function personByKey(key) { return find(M.lyudi, function (p) { return p.key === key; }); }
  function zakazchikM(id) { return byId(M.zakazchiki, id); }
  function predpriyatie(p) {
    if (!p) { return ''; }
    if (p.side === 'zavod') { return M.zavod.name; }
    var z = zakazchikM(p.zakazchikId);
    return z ? z.name : '';
  }
  /* «Кто» — для шапки, истории, ответов и замечаний. У сотрудников КЗПМ
     name — должность: имён в прототипе нет. */
  function kto(id) {
    var p = person(id);
    if (!p) { return { id: id || null, key: null, name: '', position: '', side: null, predpriyatie: '' }; }
    return { id: p.id, key: p.key, name: p.name, position: p.position, side: p.side, predpriyatie: predpriyatie(p) };
  }
  function rolOf(p) { return !p ? null : p.side === 'zakazchik' ? 'zakazchik' : p.key; }

  /* Кто смотрит. Персона чужой стороны или без главной (лаборатория не
     входит) — значит, человек не выбран: берём персону роли по умолчанию. */
  var PO_UMOLCHANIYU = { zakazchik: 'zakupshchik', zavod: 'menedzher' };
  function mePerson() {
    var role = w.Store.role();
    var p = person(w.Store.person());
    if (!p || p.side !== role || !p.home) {
      p = find(M.lyudi, function (x) { return x.side === role && x.key === PO_UMOLCHANIYU[role]; });
    }
    return p;
  }
  function visible(zakazchikId, me) { return me.side === 'zavod' || zakazchikId === me.zakazchikId; }
  function zakazchikKratko(id) { var z = zakazchikM(id); return z ? { id: z.id, name: z.name, kratko: z.kratko } : null; }

  /* ---------- справочники ---------- */

  function katalog(tip) { return find(M.zavod.katalog, function (k) { return k.tip === tip; }); }
  function lentaOf(tip) { var k = katalog(tip); return k ? k.lenta : 'ffs'; }
  function etapyLenty(lenta) { return SP.etapyZakaza[lenta] || SP.etapyZakaza.ffs; }
  function idsLenty(lenta) { return etapyLenty(lenta).map(function (e) { return e.id; }); }
  function titleEtapa(lenta, id) { var e = find(etapyLenty(lenta), function (x) { return x.id === id; }); return e ? e.title : id; }
  function ploshchadka(id) { return byId(M.zavod.ploshchadki, id); }
  var ID_OTRABOTKI = SP.etapyOtrabotki.map(function (e) { return e.id; });

  /* ---------- состояние: MOCK + журнал ---------- */

  var cache = { key: null, st: null };

  function build() {
    var base = today();
    var journal = w.Store.journal();
    var key = isoDay(base) + '|' + journal.length + '|' + (journal.length ? journal[journal.length - 1].seq : 0);
    if (cache.key === key) { return cache.st; }
    var st = resolve(clone({
      produkty: M.produkty, zakazy: M.zakazy, partii: M.partii, otgruzki: M.otgruzki,
      dogovory: M.dogovory, pretenzii: M.pretenzii, dokumenty: M.dokumenty
    }), base);
    st.drafts = { zapros: {}, zakaz: {}, pretenziya: {} };
    journal.forEach(function (e) {
      var h = APPLY[e.t];
      if (h) { h(st, e); }
    });
    cache = { key: key, st: st };
    return st;
  }

  /* ---------- продукт: этап из событий ----------
     zapros → raschet → retseptura → obraztsy → ispytaniya → odobren.
     «Не подходит» возвращает продукт к подбору рецептуры: текущим снова
     становится «расчёт отправлен», следующий ход — «Рецептура подобрана». */
  function sostProdukta(p) {
    var s = { etap: 'zapros', dostignut: {}, since: null, sozdan: null, protokol: null, reshenie: null, obraztsy: null, soglasovano: null };
    p.sobytiya.forEach(function (e) {
      if (ID_OTRABOTKI.indexOf(e.t) > -1 && e.t !== 'odobren') {
        s.etap = e.t; s.dostignut[e.t] = e.data; s.since = e.data;
        if (e.t === 'zapros' && !s.sozdan) { s.sozdan = e.data; }
        if (e.t === 'obraztsy') { s.obraztsy = { kolvo: e.kolvo, sposob: e.sposob, data: e.data }; }
        if (e.t === 'ispytaniya') { s.protokol = null; }
      } else if (e.t === 'protokol') {
        s.protokol = { dokumentId: e.dokumentId, data: e.data };
      } else if (e.t === 'reshenie') {
        s.reshenie = { podhodit: !!e.podhodit, prichina: e.prichina || null, data: e.data, kto: e.kto };
        s.since = e.data;
        if (e.podhodit) { s.etap = 'odobren'; s.dostignut.odobren = e.data; } else {
          s.etap = 'raschet';
          delete s.dostignut.retseptura; delete s.dostignut.obraztsy; delete s.dostignut.ispytaniya;
          s.protokol = null;
        }
      } else if (e.t === 'maketSoglasovan') {
        s.soglasovano = { data: e.data, kto: e.kto, versiya: e.versiya };
      }
    });
    return s;
  }

  /* Макет печати: что ждёт и от кого. Шаг по макету есть только у
     одобренного продукта с печатью, пока макет не согласован. */
  function sostMaketa(p, ps) {
    var m = p.maket;
    if (!m) { return null; }
    var tek = m.versii.length ? m.versii[m.versii.length - 1] : null;
    var zTek = tek ? m.zamechaniya.filter(function (z) { return z.versiya === tek.n; }) : [];
    var otkrytye = m.zamechaniya.filter(function (z) { return !z.otvet; });
    var otkrytyeTek = zTek.filter(function (z) { return !z.otvet; });
    var aktiven = ps.etap === 'odobren' && !ps.soglasovano;
    var naKom = null, shag = null, since = null;
    var posled = function (list, f) { return list.map(f).sort(poVremeni).pop() || null; };
    if (aktiven) {
      if (!tek) { naKom = 'zavod'; shag = 'Загрузить макет печати'; since = ps.dostignut.odobren; }
      else if (otkrytye.length) { naKom = 'zavod'; shag = 'Ответить на замечания к макету'; since = posled(otkrytye, function (z) { return z.data; }); }
      else if (zTek.length && zTek.some(function (z) { return z.otvet.prinyato; })) {
        naKom = 'zavod'; shag = 'Загрузить новую версию макета'; since = posled(zTek, function (z) { return z.otvet.data; });
      } else {
        naKom = 'zakazchik'; shag = 'Согласовать макет печати';
        since = posled([tek.data].concat(zTek.map(function (z) { return z.otvet.data; })), function (x) { return x; });
      }
    }
    return { tek: tek, zTek: zTek, otkrytye: otkrytye, otkrytyeTek: otkrytyeTek, aktiven: aktiven, naKom: naKom, shag: shag, since: since,
      srok: naKom ? wd(since, naKom === 'zavod' ? 3 : 5) : null };
  }

  /* ---------- заказ: этап из событий ----------
     Дата этапа — по каркасу БМЗ: у пройденного — когда он окончен,
     у текущего и будущих — плановое окончание (plan[i]). */
  function produktOfZakaza(st, z) { return byId(st.produkty, z.produktId); }
  function sostZakaza(st, z) {
    var p = produktOfZakaza(st, z), lenta = lentaOf(p ? p.tip : null), ids = idsLenty(lenta);
    var s = { lenta: lenta, ids: ids, etap: ids[0], okonchen: {}, since: null, sozdan: null };
    function okonchit(doIdx, data) { for (var j = 0; j < doIdx; j++) { if (!s.okonchen[ids[j]]) { s.okonchen[ids[j]] = data; } } }
    z.sobytiya.forEach(function (e) {
      if (e.t === 'zayavka') { s.sozdan = e.data; s.since = e.data; s.etap = ids[0]; }
      else if (e.t === 'etap') {
        var i = ids.indexOf(e.etap);
        if (i < 0) { return; }
        okonchit(i, e.data); s.etap = e.etap; s.since = e.data;
      } else if (e.t === 'polucheno') {
        okonchit(ids.length, e.data); s.etap = 'polucheno'; s.since = e.data;
      }
    });
    return s;
  }

  /* ---------- отгрузки и партии ---------- */

  function partiiZakaza(st, zakazId) { return st.partii.filter(function (p) { return p.zakazId === zakazId; }); }
  function otgruzkiZakaza(st, zakazId) {
    return st.otgruzki.filter(function (o) { return o.zakazId === zakazId; }).sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  }
  /* Отгрузка партии: ушедшая важнее запланированной. */
  function otgruzkaPartii(st, partiyaId) {
    var s = st.otgruzki.filter(function (o) { return o.partii.indexOf(partiyaId) > -1; });
    return find(s, function (o) { return o.status !== 'plan'; }) || s[0] || null;
  }
  function obemOtgruzki(st, o) {
    if (o.partii.length) { return sum(o.partii, function (id) { var p = byId(st.partii, id); return p ? p.obem : 0; }); }
    return o.obemPlan || 0;
  }
  /* Запланированная отгрузка готова уйти: у вагона есть номер и станция,
     у самовывоза — окно и площадка. */
  function gotovaPlan(o) {
    if (!o || o.status !== 'plan') { return false; }
    if (o.sposob === 'vagon') { return !!o.vagon && /^\d{8}$/.test(String(o.vagon.nomer || '')) && !!trim(o.vagon.stantsiya); }
    return !!o.samovyvoz && !!o.samovyvoz.okno && validDay(o.samovyvoz.okno.data) && !!ploshchadka(o.samovyvoz.ploshchadkaId);
  }
  function planOtgruzka(st, zakazId) {
    return find(otgruzkiZakaza(st, zakazId), function (o) { return o.status === 'plan'; });
  }

  /* ---------- правила ходов: единственное место ----------
     Правило отвечает и за состояние карточки, и за роль: директор ходов
     не делает, служба сервиса ходит только по претензиям, лаборатория
     не входит — её ходы пишет менеджер от её имени. ACT при нарушении
     возвращает null и журнал не пишет; DATA отдаёт те же правила признаками. */
  var PRAVILO = {
    raschet: function (ps, rol) { return rol === 'menedzher' && ps.etap === 'zapros'; },
    retseptura: function (ps, rol) { return rol === 'menedzher' && ps.etap === 'raschet'; },
    obraztsy: function (ps, rol) { return rol === 'menedzher' && ps.etap === 'retseptura'; },
    ispytaniya: function (ps, rol) { return rol === 'zakazchik' && ps.etap === 'obraztsy'; },
    protokol: function (ps, rol) { return rol === 'zakazchik' && ps.etap === 'ispytaniya'; },
    /* Решение по образцу — после протокола испытаний. */
    reshenie: function (ps, rol) { return rol === 'zakazchik' && ps.etap === 'ispytaniya' && !!ps.protokol; },
    /* Новую версию менеджер загружает, пока макет не согласован: замечаний
       к текущей версии спецификация для этого не требует. */
    maketVersiya: function (ms, rol) { return rol === 'menedzher' && !!ms && ms.aktiven; },
    maketZamechanie: function (ms, rol) { return rol === 'zakazchik' && !!ms && ms.aktiven && !!ms.tek; },
    /* Согласовать можно текущую версию без открытых замечаний. */
    maketSoglasovat: function (ms, rol) { return rol === 'zakazchik' && !!ms && ms.aktiven && !!ms.tek && ms.otkrytyeTek.length === 0; },
    /* КЗПМ отвечает на каждое замечание один раз, пока макет не согласован. */
    otvetNaZamechanie: function (ms, z, rol) { return rol === 'menedzher' && !!ms && ms.aktiven && !z.otvet; },
    /* Заказ — из одобренного продукта; с печатью — после согласования макета. */
    zakaz: function (p, ps, rol) { return rol === 'zakazchik' && ps.etap === 'odobren' && (!p.maket || !!ps.soglasovano); },
    /* Этапы двигает менеджер до «в пути»; «в пути» закрывает заказчик. */
    sleduyushchiy: function (zs, rol) { return rol === 'menedzher' && zs.ids.indexOf(zs.etap) > -1 && zs.ids.indexOf(zs.etap) < zs.ids.indexOf('v-puti'); },
    polucheno: function (zs, rol) { return rol === 'zakazchik' && zs.etap === 'v-puti'; },
    vzyat: function (rs, rol) { return rol === 'servis' && rs.status === 'novaya'; },
    otvetit: function (rs, rol) { return rol === 'servis' && rs.status === 'v-rabote'; },
    zaprositObraztsy: function (rs, rol) { return rol === 'servis' && rs.status === 'v-rabote' && !rs.obraztsy; },
    zakryt: function (rs, rol) { return rol === 'servis' && rs.status === 'v-rabote'; }
  };

  /* Сроки шага в рабочих днях от начала шага. */
  var SROK_PRODUKT = { zapros: 3, raschet: 5, retseptura: 5, obraztsy: 10, ispytaniya: 20 };
  var NAKOM_PRODUKT = { zapros: 'zavod', raschet: 'zavod', retseptura: 'zavod', obraztsy: 'zakazchik', ispytaniya: 'zakazchik' };
  var SHAG_PRODUKT = { zapros: 'Отправить расчёт', raschet: 'Подобрать рецептуру', retseptura: 'Отправить образцы', obraztsy: 'Начать испытания образцов' };
  var SHAG_ZAKAZ = {
    prinyata: 'Поставить заявку в план производства', ekstruziya: 'Закончить экструзию плёнки', pechat: 'Закончить печать',
    izgotovlenie: 'Изготовить мешки', laminirovanie: 'Закончить ламинирование', rezka: 'Закончить резку и намотку',
    kompaundirovanie: 'Закончить компаундирование', kontrol: 'Проверить партию и выпустить паспорт качества',
    'v-puti': 'Подтвердить получение груза'
  };
  /* Шаг КЗПМ глазами заказчика: что сейчас происходит у КЗПМ, а не задача сотруднику.
     Ключ — текст шага у КЗПМ. */
  var SHAG_KZPM_DLYA_ZAKAZCHIKA = {
    'Отправить расчёт': 'Менеджер готовит расчёт',
    'Подобрать рецептуру': 'Лаборатория подбирает рецептуру',
    'Отправить образцы': 'Лаборатория готовит образцы к отправке',
    'Загрузить макет печати': 'Менеджер готовит макет печати',
    'Ответить на замечания к макету': 'Менеджер отвечает на замечания к макету',
    'Загрузить новую версию макета': 'Менеджер готовит новую версию макета',
    'Поставить заявку в план производства': 'Менеджер ставит заявку в план производства',
    'Закончить экструзию плёнки': 'КЗПМ ведёт экструзию плёнки',
    'Закончить печать': 'КЗПМ наносит печать',
    'Изготовить мешки': 'КЗПМ изготавливает мешки',
    'Закончить ламинирование': 'КЗПМ ламинирует плёнку',
    'Закончить резку и намотку': 'КЗПМ режет и наматывает плёнку',
    'Закончить компаундирование': 'КЗПМ ведёт компаундирование',
    'Проверить партию и выпустить паспорт качества': 'Лаборатория проверяет партию и готовит паспорт качества',
    'Указать вагон или окно самовывоза': 'Менеджер назначает вагон или окно самовывоза',
    'Отгрузить вагон': 'КЗПМ готовит вагон к отгрузке',
    'Выдать груз по окну самовывоза': 'КЗПМ готовит груз к выдаче по окну самовывоза',
    'Взять претензию в работу': 'Служба сервиса принимает претензию в работу',
    'Ответить заказчику': 'Служба сервиса разбирает претензию',
    'Получить образцы и принять решение': 'Служба сервиса ждёт образцы из партии',
    'Принять решение и закрыть претензию': 'Служба сервиса готовит решение по претензии'
  };
  function shagDlya(me, naKom, shag) {
    if (!shag || naKom !== 'zavod' || !me || me.side !== 'zakazchik') { return shag; }
    return SHAG_KZPM_DLYA_ZAKAZCHIKA[shag] || shag;
  }
  /* Плановая длительность заказа: окончание каждого этапа, дней от заявки. */
  var PLAN_ZAKAZA = { ffs: [1, 6, 10, 14, 16, 18, 21, 21], plenka: [1, 5, 8, 10, 12, 15, 15], laminat: [1, 5, 9, 12, 15, 17, 19, 22, 22], kompaund: [1, 6, 8, 10, 12, 12] };
  var SROK_PRETENZII = 3;    /* ответ службы сервиса */
  var SROK_OBRAZTSOV = 10;  /* образцы доходят до лаборатории и проверяются */
  var DNEY_ODOBRENO = 30;   /* «одобрено за месяц» в сводке */
  var NEDEL_DO = 6;         /* квартал графика: шесть недель до текущей и шесть после */

  function srok(naKom, iso) {
    if (!iso) { return { dney: null, prosrocheno: false }; }
    var n = dneyDo(iso);
    return { dney: n, prosrocheno: !!naKom && n < 0 };
  }

  /* ---------- история: тексты событий ---------- */

  function partiiNomera(st, ids) { return ids.map(function (id) { var p = byId(st.partii, id); return p ? p.nomer : ''; }).filter(Boolean); }
  var TEXT_PRODUKT = {
    zapros: function () { return 'Запрос расчёта и образца отправлен в КЗПМ'; },
    raschet: function () { return 'Расчёт отправлен заказчику'; },
    retseptura: function () { return 'Рецептура подобрана'; },
    obraztsy: function (e) { return 'Образцы отправлены: ' + e.kolvo + ' шт., ' + sMaloy(e.sposob); },
    ispytaniya: function () { return 'Испытания образцов начаты'; },
    protokol: function () { return 'Протокол испытаний приложен'; },
    reshenie: function (e) { return e.podhodit ? 'Образец подходит, продукт одобрен' : 'Образец не подходит. Причина: ' + sTochkoy(e.prichina); },
    maketSoglasovan: function (e) { return 'Макет печати, версия ' + e.versiya + ', согласован'; },
    zakaz: function (e, st) { var z = byId(st.zakazy, e.zakazId); return z ? 'Оформлен заказ № ' + z.nomer + ' на ' + z.obem + ' т' : 'Оформлен заказ'; }
  };
  var TEXT_ZAKAZ = {
    zayavka: function (e, st, z) { return 'Заявка на ' + z.obem + ' т оформлена'; },
    etap: function (e, st, z, zs) { return 'Начат этап «' + titleEtapa(zs.lenta, e.etap) + '»'; },
    partiya: function (e, st) {
      var p = byId(st.partii, e.partiyaId);
      return p ? 'Партия № ' + p.nomer + ' на ' + p.obem + ' т выпущена, паспорт качества готов' : 'Партия выпущена';
    },
    okno: function (e, st) {
      var o = byId(st.otgruzki, e.otgruzkaId), sv = o && o.samovyvoz, pl = sv && ploshchadka(sv.ploshchadkaId);
      return 'Назначено окно самовывоза' + (pl ? ': площадка ' + pl.gorod : '') + (sv && sv.vorota ? ', ' + sMaloy(sv.vorota) : '');
    },
    otgruzka: function (e, st) {
      var o = byId(st.otgruzki, e.otgruzkaId);
      if (!o) { return 'Груз отгружен'; }
      var n = partiiNomera(st, o.partii);
      var kto = n.length > 1 ? 'Партии № ' + n.join(', ') + ' отгружены' : n.length ? 'Партия № ' + n[0] + ' отгружена' : 'Груз отгружен';
      if (o.sposob === 'vagon' && o.vagon) { return kto + ' в вагоне № ' + o.vagon.nomer + ' до станции ' + o.vagon.stantsiya; }
      return (n.length > 1 ? 'Партии № ' + n.join(', ') + ' выданы' : n.length ? 'Партия № ' + n[0] + ' выдана' : 'Груз выдан') + ' по окну самовывоза';
    },
    polucheno: function () { return 'Получение груза подтверждено'; }
  };
  var TEXT_PRETENZIYA = {
    pretenziya: function (e, st, r) { var p = byId(st.partii, r.partiyaId); return 'Претензия по партии № ' + (p ? p.nomer : '') + ' отправлена'; },
    vzyata: function () { return 'Претензия взята в работу'; },
    otvet: function () { return 'Служба сервиса ответила заказчику'; },
    obraztsy: function () { return 'Запрошены образцы из партии'; },
    zakryta: function () { return 'Претензия закрыта с решением'; }
  };
  /* Новые сверху. Ходы из журнала (j) — всегда выше демо-событий: они
     сделаны сейчас, а демо-событие текущей недели может стоять на часе,
     который ещё не наступил. При равном времени — то, что записано позже. */
  function istoriya(list) {
    return list.map(function (h, i) { h.i = i; return h; }).sort(function (a, b) {
      return ((b.j ? 1 : 0) - (a.j ? 1 : 0)) || (vremya(b.at) - vremya(a.at)) || (b.i - a.i);
    }).map(function (h) { return { at: h.at, kto: kto(h.kto), text: h.text }; });
  }

  /* ---------- документы ----------
     В данных — расчёты, протоколы, спецификации, договор. Паспорт каждой
     партии, УПД и накладная каждой ушедшей отгрузки, лист каждой версии
     макета выводятся здесь. */
  function zakazchikDok(st, k) {
    var x;
    if (k.tip === 'produkt') { x = byId(st.produkty, k.id); return x ? x.zakazchikId : null; }
    if (k.tip === 'zakaz') { x = byId(st.zakazy, k.id); return x ? x.zakazchikId : null; }
    if (k.tip === 'otgruzka') { x = byId(st.otgruzki, k.id); x = x && byId(st.zakazy, x.zakazId); return x ? x.zakazchikId : null; }
    if (k.tip === 'pretenziya') { x = byId(st.pretenzii, k.id); return x ? x.zakazchikId : null; }
    if (k.tip === 'dogovor') { x = byId(st.dogovory, k.id); return x ? x.zakazchikId : null; }
    return null;
  }
  function vseDokumenty(st) {
    var list = st.dokumenty.map(function (d) {
      var c = clone(d); c.zakazchikId = zakazchikDok(st, d.k); return c;
    });
    st.partii.forEach(function (p) {
      list.push({ id: 'ps-' + p.id, tip: 'pasport', nomer: p.nomer, data: p.data, k: { tip: 'zakaz', id: p.zakazId }, partiyaId: p.id,
        zakazchikId: zakazchikDok(st, { tip: 'zakaz', id: p.zakazId }) });
    });
    st.otgruzki.forEach(function (o) {
      if (o.status === 'plan') { return; }
      var zid = zakazchikDok(st, { tip: 'otgruzka', id: o.id });
      list.push({ id: 'upd-' + o.id, tip: 'upd', nomer: o.nomer, data: localDay(o.data), k: { tip: 'otgruzka', id: o.id }, otgruzkaId: o.id, zakazchikId: zid });
      list.push({ id: 'tn-' + o.id, tip: 'nakladnaya', nomer: o.nomer, data: localDay(o.data), k: { tip: 'otgruzka', id: o.id }, otgruzkaId: o.id,
        vid: o.sposob === 'vagon' ? 'zhd' : 'avto', zakazchikId: zid });
    });
    st.produkty.forEach(function (p) {
      (p.maket ? p.maket.versii : []).forEach(function (v) {
        list.push({ id: 'mk-' + p.id + '-' + v.n, tip: 'maket', nomer: 'v' + v.n, data: localDay(v.data), k: { tip: 'produkt', id: p.id }, versiya: v.n,
          zakazchikId: p.zakazchikId });
      });
    });
    return list;
  }
  function titleDok(d) {
    switch (d.tip) {
      case 'raschet': return 'Расчёт № ' + d.nomer;
      case 'protokol': return 'Протокол испытаний' + (d.nomer ? ' № ' + d.nomer : '');
      case 'specifikaciya': return 'Спецификация № ' + d.nomer;
      case 'dogovor': return 'Договор поставки № ' + d.nomer;
      case 'maket': return 'Макет печати, версия ' + d.versiya;
      case 'pasport': return 'Паспорт качества партии № ' + d.nomer;
      case 'upd': return 'УПД № ' + d.nomer;
      case 'nakladnaya': return (d.vid === 'zhd' ? 'Железнодорожная транспортная накладная № ' : 'Транспортная накладная № ') + d.nomer;
      default: return (SP.tipyDokumentov[d.tip] || 'Документ') + (d.nomer ? ' № ' + d.nomer : '');
    }
  }
  function kDok(st, k) {
    var x, t = '', href = '';
    if (k.tip === 'produkt') { x = byId(st.produkty, k.id); t = x ? x.nazvanie : ''; href = 'produkt.html?id=' + k.id; }
    else if (k.tip === 'zakaz') { x = byId(st.zakazy, k.id); t = x ? 'Заказ № ' + x.nomer : ''; href = 'zakaz.html?id=' + k.id; }
    else if (k.tip === 'otgruzka') { x = byId(st.otgruzki, k.id); t = x ? 'Отгрузка № ' + x.nomer : ''; href = x ? 'zakaz.html?id=' + x.zakazId : ''; }
    else if (k.tip === 'pretenziya') { x = byId(st.pretenzii, k.id); t = x ? 'Претензия № ' + x.nomer : ''; href = 'pretenziya.html?id=' + k.id; }
    else if (k.tip === 'dogovor') { x = byId(st.dogovory, k.id); t = x ? 'Договор № ' + x.nomer : ''; href = 'otgruzki.html?dogovor=' + k.id; }
    return { tip: k.tip, id: k.id, title: t, href: href };
  }
  function dokOut(st, d) {
    var k = kDok(st, d.k);
    var x = {
      id: d.id, tip: d.tip, tipTitle: SP.tipyDokumentov[d.tip] || '', nomer: d.nomer || null, data: localDay(d.data), title: titleDok(d),
      k: k, zakazchik: zakazchikKratko(d.zakazchikId), href: k.href ? k.href + '#doc=' + d.id : ''
    };
    if (d.partiyaId) { x.partiyaId = d.partiyaId; }
    if (d.otgruzkaId) { x.otgruzkaId = d.otgruzkaId; }
    if (d.tip === 'maket') { x.versiya = d.versiya; }
    return x;
  }
  function dokumentySvyazannye(st, filtr) {
    return vseDokumenty(st).filter(filtr).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; })
      .map(function (d) { return dokOut(st, d); });
  }

  /* Параметры продукта списком «подпись — значение» в порядке формы. */
  function chisloText(n) { return String(n).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function parametrySpisok(p) {
    var par = p.parametry || {}, kat = katalog(p.tip) || {}, out = [];
    SP.parametry.forEach(function (f) {
      if (!(f.key in par)) { return; }
      var v = par[f.key];
      if (f.key === 'tsvetov' && par.pechat !== 'tsvetnaya') { return; }
      if (kat.kompaund && ['tolshchina', 'pechat', 'laminirovanie'].indexOf(f.key) > -1) { return; }
      var z;
      if (f.znacheniya) { z = f.znacheniya[String(v)]; }
      else if (v === null || v === undefined || v === '') { z = f.pusto || null; }
      else { z = (typeof v === 'number' ? chisloText(v) : String(v)) + (f.unit ? ' ' + f.unit : ''); }
      if (z) { out.push({ key: f.key, title: f.title, znachenie: z }); }
    });
    return out;
  }

  /* Паспорт качества партии. Строки — только те параметры продукта, что
     есть на сайте и в запросе: толщина, размеры, печать; у компаунда —
     марка, основа, концентрация. Норма — значение из параметров продукта,
     факт — из показателей партии в MOCK (у партии, выпущенной на показе, —
     из MOCK.demo.pasport). Других показателей на сайте нет — и здесь их нет. */
  function cveta(n) { var a = n % 100, b = n % 10; return a > 10 && a < 20 ? 'цветов' : b === 1 ? 'цвет' : b > 1 && b < 5 ? 'цвета' : 'цветов'; }
  function pokazateli(p, partiya) {
    var par = (p && p.parametry) || {}, f = (partiya && partiya.pasport) || {}, lenta = lentaOf(p ? p.tip : null), rows = [];
    function r(key, title, norma) {
      if (norma === null || norma === undefined || norma === '') { return; }
      rows.push({ key: key, title: title, norma: String(norma), fakt: f[key] !== undefined && f[key] !== null ? String(f[key]) : M.demo.pasport[key] });
    }
    if (lenta === 'kompaund') {
      r('marka', 'Марка', par.marka);
      r('osnova', 'Основа', par.osnova);
      r('koncentraciya', 'Концентрация технического углерода, %',
        par.koncentraciya !== undefined && par.koncentraciya !== null ? chisloText(par.koncentraciya) : null);
      return rows;
    }
    r('tolshchina', 'Толщина плёнки, мкм', typeof par.tolshchina === 'number' ? chisloText(par.tolshchina) : 'по рецептуре лаборатории КЗПМ');
    r('razmery', lenta === 'ffs' ? 'Размеры мешка' : 'Размеры', par.razmery);
    if (par.pechat === 'tsvetnaya') {
      var sg = p ? sostProdukta(p).soglasovano : null;
      r('pechat', 'Печать', 'Цветная печать' + (par.tsvetov ? ', ' + par.tsvetov + ' ' + cveta(par.tsvetov) : '') +
        (sg ? '; макет печати, версия ' + sg.versiya : ''));
    }
    return rows;
  }
  function specifikaciyaProdukta(st, p) {
    return p ? find(st.dokumenty, function (d) { return d.tip === 'specifikaciya' && d.k.tip === 'produkt' && d.k.id === p.id; }) : null;
  }

  /* ---------- выдача в форме контракта ---------- */

  function produktKratko(p) { return p ? { id: p.id, nazvanie: p.nazvanie, tip: p.tip, tipTitle: (katalog(p.tip) || {}).kratko || '' } : null; }

  function partiyaOut(st, p) {
    var z = byId(st.zakazy, p.zakazId), o = otgruzkaPartii(st, p.id), pr = z ? produktOfZakaza(st, z) : null;
    var poluchena = !!o && o.status === 'poluchena';
    return {
      id: p.id, nomer: p.nomer, obem: p.obem, data: localDay(p.data), zakazId: p.zakazId, zakazNomer: z ? z.nomer : null,
      produkt: produktKratko(pr), zakazchik: z ? zakazchikKratko(z.zakazchikId) : null,
      pasportId: 'ps-' + p.id, poluchena: poluchena, dataPolucheniya: poluchena ? localDay(o.polucheno) : null,
      otgruzkaId: o && o.status !== 'plan' ? o.id : null
    };
  }

  function otgruzkaOut(st, o) {
    var z = byId(st.zakazy, o.zakazId), pr = z ? produktOfZakaza(st, z) : null, sv = o.samovyvoz, pl = sv ? ploshchadka(sv.ploshchadkaId) : null;
    return {
      id: o.id, nomer: o.nomer, zakazId: o.zakazId, zakazNomer: z ? z.nomer : null, zakazchik: z ? zakazchikKratko(z.zakazchikId) : null,
      produkt: produktKratko(pr), dogovorId: o.dogovorId || null,
      partii: o.partii.map(function (id) { var p = byId(st.partii, id); return p ? { id: p.id, nomer: p.nomer, obem: p.obem, pasportId: 'ps-' + p.id } : null; }).filter(Boolean),
      sposob: o.sposob, sposobTitle: SP.sposoby[o.sposob] || '', data: localDay(o.data), obem: obemOtgruzki(st, o),
      status: o.status, statusTitle: SP.statusyOtgruzki[o.status] || '',
      vagon: o.vagon ? { nomer: o.vagon.nomer || null, stantsiya: o.vagon.stantsiya || null, eta: localDay(o.vagon.eta) } : null,
      samovyvoz: sv ? { okno: { data: localDay(sv.okno && sv.okno.data), s: (sv.okno && sv.okno.s) || null, po: (sv.okno && sv.okno.po) || null },
        ploshchadka: pl ? clone(pl) : null, vorota: sv.vorota || null } : null,
      otpravitel: clone(ploshchadka(o.ploshchadkaId) || M.zavod.ploshchadki[0]),
      dataPolucheniya: o.status === 'poluchena' ? localDay(o.polucheno) : null,
      dokumenty: o.status === 'plan' ? [] : dokumentySvyazannye(st, function (d) {
        return (d.k.tip === 'otgruzka' && d.k.id === o.id) || (d.tip === 'pasport' && o.partii.indexOf(d.partiyaId) > -1);
      })
    };
  }

  function produktOut(st, p, me) {
    var rol = rolOf(me), ps = sostProdukta(p), ms = sostMaketa(p, ps), kat = katalog(p.tip) || {};
    var idx = ID_OTRABOTKI.indexOf(ps.etap), konets = ps.etap === 'odobren';
    var naKom, shag, since, srokOtveta;
    if (!konets) {
      naKom = NAKOM_PRODUKT[ps.etap];
      shag = ps.etap === 'ispytaniya' ? (ps.protokol ? 'Принять решение по образцу' : 'Приложить протокол испытаний') : SHAG_PRODUKT[ps.etap];
      since = ps.since; srokOtveta = wd(since, SROK_PRODUKT[ps.etap]);
    } else if (ms && ms.naKom) {
      naKom = ms.naKom; shag = ms.shag; since = ms.since; srokOtveta = ms.srok;
    } else { naKom = null; shag = null; since = ps.since; srokOtveta = null; }
    var sr = srok(naKom, srokOtveta);
    var zakazy = st.zakazy.filter(function (z) { return z.produktId === p.id; });
    var maket = null;
    if (ms) {
      maket = {
        versii: p.maket.versii.map(function (v) {
          return { n: v.n, data: v.data, kto: kto(v.kto), risunok: clone(v.risunok), ispravleno: clone(v.ispravleno || []), dokumentId: 'mk-' + p.id + '-' + v.n };
        }),
        tekushchaya: ms.tek ? ms.tek.n : null,
        zamechaniya: p.maket.zamechaniya.map(function (z) {
          return { id: z.id, versiya: z.versiya, nomer: z.nomer, x: z.x, y: z.y, text: z.text, kto: kto(z.kto), data: z.data,
            otvet: z.otvet ? { text: z.otvet.text, prinyato: !!z.otvet.prinyato, kto: kto(z.otvet.kto), data: z.otvet.data } : null,
            mozhnoOtvetit: PRAVILO.otvetNaZamechanie(ms, z, rol) };
        }),
        soglasovano: ps.soglasovano ? { data: ps.soglasovano.data, kto: kto(ps.soglasovano.kto), versiya: ps.soglasovano.versiya } : null,
        naKom: ms.naKom, shag: shagDlya(me, ms.naKom, ms.shag), srokOtveta: ms.srok, prosrocheno: srok(ms.naKom, ms.srok).prosrocheno
      };
    }
    var ist = [];
    p.sobytiya.forEach(function (e) { var f = TEXT_PRODUKT[e.t]; if (f) { ist.push({ at: e.data, kto: e.kto, text: f(e, st), j: e.j }); } });
    if (p.maket) {
      p.maket.versii.forEach(function (v) { ist.push({ at: v.data, kto: v.kto, text: 'Макет печати, версия ' + v.n + ', загружен на согласование', j: v.j }); });
      p.maket.zamechaniya.forEach(function (z) {
        ist.push({ at: z.data, kto: z.kto, text: 'Замечание ' + z.nomer + ' к версии ' + z.versiya + ' макета', j: z.j });
        if (z.otvet) {
          ist.push({ at: z.otvet.data, kto: z.otvet.kto, text: 'Ответ на замечание ' + z.nomer + ' к версии ' + z.versiya + ': ' +
            (z.otvet.prinyato ? 'принято в следующую версию' : 'пояснение'), j: z.otvet.j });
        }
      });
    }
    return {
      id: p.id, zakazchik: zakazchikKratko(p.zakazchikId), tip: p.tip, tipTitle: kat.kratko || '', tipPolnoe: kat.title || '',
      gruppaKataloga: kat.gruppa || '', lenta: kat.lenta || null, nazvanie: p.nazvanie,
      parametry: clone(p.parametry), parametrySpisok: parametrySpisok(p), pechat: !!p.maket,
      etap: ps.etap, etapTitle: SP.etapyOtrabotki[idx] ? SP.etapyOtrabotki[idx].title : '',
      etapy: SP.etapyOtrabotki.map(function (e, i) {
        var status = i < idx || (i === idx && konets) ? 'done' : i === idx ? 'current' : 'plan';
        return { id: e.id, title: e.title, status: status, date: status === 'plan' ? null : localDay(ps.dostignut[e.id]), vid: status === 'plan' ? 'plan' : 'fakt' };
      }),
      gruppa: konets && (!p.maket || !!ps.soglasovano || zakazy.length > 0) ? 'postavka' : 'otrabotka',
      naKom: naKom, shag: shagDlya(me, naKom, shag), srokOtveta: srokOtveta, prosrocheno: sr.prosrocheno,
      dneyNaEtape: since ? Math.max(0, diffDays(segodnya(), since)) : 0,
      data: ps.sozdan,
      obraztsy: ps.obraztsy ? { kolvo: ps.obraztsy.kolvo, sposob: ps.obraztsy.sposob, data: ps.obraztsy.data } : null,
      protokolId: ps.protokol ? ps.protokol.dokumentId : null,
      reshenie: ps.reshenie ? { podhodit: ps.reshenie.podhodit, prichina: ps.reshenie.prichina, data: ps.reshenie.data, kto: kto(ps.reshenie.kto) } : null,
      maket: maket,
      zakazy: zakazy.map(function (z) {
        var zs = sostZakaza(st, z);
        return { id: z.id, nomer: z.nomer, obem: z.obem, etap: zs.etap, etapTitle: titleEtapa(zs.lenta, zs.etap), data: localDay(zs.sozdan) };
      }),
      dokumenty: dokumentySvyazannye(st, function (d) { return d.k.tip === 'produkt' && d.k.id === p.id; }),
      istoriya: istoriya(ist),
      mozhno: {
        raschet: PRAVILO.raschet(ps, rol), retseptura: PRAVILO.retseptura(ps, rol), obraztsy: PRAVILO.obraztsy(ps, rol),
        ispytaniya: PRAVILO.ispytaniya(ps, rol), protokol: PRAVILO.protokol(ps, rol), reshenie: PRAVILO.reshenie(ps, rol),
        maketVersiya: PRAVILO.maketVersiya(ms, rol), maketZamechanie: PRAVILO.maketZamechanie(ms, rol),
        maketSoglasovat: PRAVILO.maketSoglasovat(ms, rol), zakaz: PRAVILO.zakaz(p, ps, rol)
      }
    };
  }

  function zakazOut(st, z, me) {
    var rol = rolOf(me), zs = sostZakaza(st, z), p = produktOfZakaza(st, z), ids = zs.ids;
    var cur = ids.indexOf(zs.etap), konets = zs.etap === 'polucheno';
    var planEtapa = konets ? null : (z.plan[cur] || null);
    var naKom = konets ? null : zs.etap === 'v-puti' ? 'zakazchik' : 'zavod';
    var plan = planOtgruzka(st, z.id), gotov = gotovaPlan(plan);
    var shag = konets ? null : zs.etap === 'otgruzka'
      ? (gotov ? (plan.sposob === 'samovyvoz' ? 'Выдать груз по окну самовывоза' : 'Отгрузить вагон') : 'Указать вагон или окно самовывоза')
      : SHAG_ZAKAZ[zs.etap];
    var otgruzki = otgruzkiZakaza(st, z.id).map(function (o) { return otgruzkaOut(st, o); });
    /* Срок шага: на «в пути» — прибытие последнего вагона (без вагонов — план этапа), до него — план
       этапа. Одна дата для карточки, списка заказов и «Ждёт вас»; подпись срока — к ней же. */
    var vPuti = zs.etap === 'v-puti', pribytie = vPuti ? otgruzki.filter(function (o) { return o.status === 'v-puti' && o.vagon && o.vagon.eta; })
      .map(function (o) { return o.vagon.eta; }).sort().pop() || null : null;
    var srokOtveta = konets ? null : pribytie || planEtapa;
    var sr = srok(naKom, srokOtveta);
    var ist = z.sobytiya.map(function (e) { var f = TEXT_ZAKAZ[e.t]; return f ? { at: e.data, kto: e.kto, text: f(e, st, z, zs), j: e.j } : null; }).filter(Boolean);
    var dg = z.dogovorId ? byId(st.dogovory, z.dogovorId) : null;
    return {
      id: z.id, nomer: z.nomer, title: 'Заказ № ' + z.nomer, zakazchik: zakazchikKratko(z.zakazchikId),
      produkt: produktKratko(p), obem: z.obem, sposob: z.sposob, sposobTitle: SP.sposoby[z.sposob] || '',
      zhelaemayaData: localDay(z.zhelaemayaData), data: localDay(zs.sozdan),
      dogovor: dg ? { id: dg.id, nomer: dg.nomer } : null, lenta: zs.lenta,
      etap: zs.etap, etapTitle: titleEtapa(zs.lenta, zs.etap),
      etapy: ids.map(function (id, i) {
        var status = i < cur || konets ? 'done' : i === cur ? 'current' : 'plan';
        var date = status === 'done' ? (localDay(zs.okonchen[id]) || localDay(z.plan[i])) : localDay(z.plan[i]);
        return { id: id, title: titleEtapa(zs.lenta, id), status: status, date: date || null, vid: status === 'done' ? 'fakt' : 'plan' };
      }),
      naKom: naKom, shag: shagDlya(me, naKom, shag), srokOtveta: srokOtveta, prosrocheno: sr.prosrocheno,
      srokShaga: konets ? null : vPuti ? { data: localDay(srokOtveta), podpis: 'груз прибудет до', bylo: 'груз ожидался' }
        : { data: localDay(srokOtveta), podpis: 'по плану до', bylo: null },
      dneyNaEtape: zs.since ? Math.max(0, diffDays(segodnya(), zs.since)) : 0,
      planEtapa: localDay(planEtapa), riskSroka: !konets && !!planEtapa && localDay(planEtapa) < segodnya(),
      dalee: cur > -1 && cur < ids.length - 1 ? { id: ids[cur + 1], title: titleEtapa(zs.lenta, ids[cur + 1]) } : null,
      nuzhnaOtgruzka: zs.etap === 'otgruzka' && !gotov,
      partii: partiiZakaza(st, z.id).map(function (x) { return partiyaOut(st, x); }),
      otgruzki: otgruzki,
      dokumenty: dokumentySvyazannye(st, function (d) {
        if (d.k.tip === 'zakaz' && d.k.id === z.id) { return true; }
        var o = d.k.tip === 'otgruzka' ? byId(st.otgruzki, d.k.id) : null;
        return !!o && o.zakazId === z.id;
      }),
      istoriya: istoriya(ist),
      mozhno: { sleduyushchiy: PRAVILO.sleduyushchiy(zs, rol), polucheno: PRAVILO.polucheno(zs, rol) }
    };
  }

  function sostPretenzii(r) {
    var s = { status: 'novaya', since: null, sozdana: null, otvety: [], reshenie: null, obraztsy: false };
    r.sobytiya.forEach(function (e) {
      if (e.t === 'pretenziya') { s.sozdana = e.data; s.since = e.data; }
      else if (e.t === 'vzyata') { s.status = 'v-rabote'; s.since = e.data; }
      else if (e.t === 'otvet') { s.otvety.push({ vid: 'otvet', text: e.text, kto: e.kto, data: e.data }); s.since = e.data; }
      else if (e.t === 'obraztsy') { s.otvety.push({ vid: 'obraztsy', text: e.text, kto: e.kto, data: e.data }); s.obraztsy = true; s.since = e.data; }
      else if (e.t === 'zakryta') { s.status = 'zakryta'; s.reshenie = { text: e.reshenie, kto: e.kto, data: e.data }; s.since = e.data; }
    });
    return s;
  }
  function fotoOut(f) {
    if (typeof f === 'string') {
      var d = find(M.demo.foto, function (x) { return x.key === f; });
      return { name: d ? d.name : f, title: d ? d.title : '', dataUrl: null, demo: f };
    }
    return { name: (f && f.name) || '', title: (f && f.title) || '', dataUrl: (f && f.dataUrl) || null, demo: (f && f.demo) || null };
  }

  function pretenziyaOut(st, r, me) {
    var rol = rolOf(me), rs = sostPretenzii(r), p = byId(st.partii, r.partiyaId), z = p ? byId(st.zakazy, p.zakazId) : null;
    /* Пока служба сервиса может закрыть претензию, шаг за КЗПМ: заказчик
       отправляет образцы, но решение и закрытие — у сервиса. */
    var naKom = rs.status === 'zakryta' ? null : 'zavod';
    var shag = rs.status === 'zakryta' ? null : rs.status === 'novaya' ? 'Взять претензию в работу'
      : rs.obraztsy ? 'Получить образцы и принять решение' : rs.otvety.length ? 'Принять решение и закрыть претензию' : 'Ответить заказчику';
    var srokOtveta = naKom ? wd(rs.since, rs.obraztsy ? SROK_OBRAZTSOV : SROK_PRETENZII) : null;
    var bezOtveta = rs.status !== 'zakryta' && !rs.otvety.some(function (o) { return o.vid === 'otvet'; });
    var st0 = SP.statusyPretenzii[rs.status] || { title: rs.status, cls: 'badge--neutral' };
    return {
      id: r.id, nomer: r.nomer, title: 'Претензия № ' + r.nomer, zakazchik: zakazchikKratko(r.zakazchikId),
      partiya: p ? partiyaOut(st, p) : null, zakaz: z ? { id: z.id, nomer: z.nomer } : null, produkt: produktKratko(z ? produktOfZakaza(st, z) : null),
      vid: r.vid, vidTitle: SP.vidyPretenziy[r.vid] || '', opisanie: r.opisanie, foto: (r.foto || []).map(fotoOut),
      status: rs.status, statusTitle: st0.title, statusCls: st0.cls, data: rs.sozdana,
      naKom: naKom, shag: shagDlya(me, naKom, shag), srokOtveta: srokOtveta, prosrocheno: srok(naKom, srokOtveta).prosrocheno,
      dneyNaEtape: rs.since ? Math.max(0, diffDays(segodnya(), rs.since)) : 0,
      dneyBezOtveta: bezOtveta && rs.sozdana ? Math.max(0, diffDays(segodnya(), rs.sozdana)) : null,
      obraztsyZaprosheny: rs.obraztsy,
      otvety: rs.otvety.map(function (o) { return { vid: o.vid, text: o.text, kto: kto(o.kto), data: o.data }; }),
      reshenie: rs.reshenie ? { text: rs.reshenie.text, kto: kto(rs.reshenie.kto), data: rs.reshenie.data } : null,
      dokumenty: dokumentySvyazannye(st, function (d) { return d.k.tip === 'pretenziya' && d.k.id === r.id; }),
      istoriya: istoriya(r.sobytiya.map(function (e) { var f = TEXT_PRETENZIYA[e.t]; return f ? { at: e.data, kto: e.kto, text: f(e, st, r), j: e.j } : null; }).filter(Boolean)),
      mozhno: { vzyat: PRAVILO.vzyat(rs, rol), otvetit: PRAVILO.otvetit(rs, rol), zaprositObraztsy: PRAVILO.zaprositObraztsy(rs, rol), zakryt: PRAVILO.zakryt(rs, rol) }
    };
  }

  /* График рамочного договора: 13 недель вокруг текущей. План — из
     договора, отгружено (получено), в пути и запланировано — из отгрузок
     договора по неделе даты отгрузки. */
  function grafik(st, dg) {
    var t0 = monday(today()), nedeli = [];
    var otg = st.otgruzki.filter(function (o) { return o.dogovorId === dg.id; });
    for (var k = -NEDEL_DO; k <= NEDEL_DO; k++) {
      var s = isoDay(addDays(t0, 7 * k)), po = isoDay(addDays(t0, 7 * k + 6));
      var pl = find(dg.plan, function (x) { return x.nedelya === s; });
      var eti = otg.filter(function (o) { var d = localDay(o.data); return d >= s && d <= po; })
        .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
      var po_ = function (status) { return sum(eti.filter(function (o) { return o.status === status; }), function (o) { return obemOtgruzki(st, o); }); };
      nedeli.push({
        nedelya: s, do: po, status: k < 0 ? 'proshla' : k === 0 ? 'tekushchaya' : 'budushchaya',
        plan: pl ? pl.tonn : 0, otgruzheno: po_('poluchena'), vPuti: po_('v-puti'), zaplanirovano: po_('plan'),
        otgruzki: eti.map(function (o) { return otgruzkaOut(st, o); })
      });
    }
    var itog = {
      plan: sum(nedeli, function (n) { return n.plan; }), otgruzheno: sum(nedeli, function (n) { return n.otgruzheno; }),
      vPuti: sum(nedeli, function (n) { return n.vPuti; }), zaplanirovano: sum(nedeli, function (n) { return n.zaplanirovano; })
    };
    itog.fakt = itog.otgruzheno + itog.vPuti;
    return { s: nedeli[0].nedelya, po: nedeli[nedeli.length - 1].do, nedeli: nedeli, itog: itog };
  }
  function dogovorOut(st, dg) {
    return {
      id: dg.id, nomer: dg.nomer, title: 'Договор поставки № ' + dg.nomer, zakazchik: zakazchikKratko(dg.zakazchikId),
      s: localDay(dg.s), po: localDay(dg.po),
      dokumenty: dokumentySvyazannye(st, function (d) { return d.k.tip === 'dogovor' && d.k.id === dg.id; }),
      grafik: grafik(st, dg)
    };
  }

  /* Данные для превью листа документа. */
  function dannyeDok(st, d) {
    var zak = zakazchikM(d.zakazchikId), pokupatel = zak ? { name: zak.name } : null;
    var postavshchik = { name: M.zavod.name, polnoe: M.zavod.polnoe, adres: M.zavod.ploshchadki[0].adres, kontakty: clone(M.zavod.kontakty) };
    var p, z, o, x;
    if (d.tip === 'raschet' || d.tip === 'specifikaciya' || d.tip === 'protokol') {
      p = byId(st.produkty, d.k.id);
      x = { produkt: produktKratko(p), zakazchik: pokupatel, postavshchik: postavshchik, parametry: p ? parametrySpisok(p) : [] };
      if (d.tip === 'raschet') { x.primechanie = 'стоимость — в коммерческом предложении менеджера'; }
      if (d.tip === 'protokol') { x.fayl = d.fayl ? { name: d.fayl.name || '', dataUrl: d.fayl.dataUrl || null } : null; }
      if (d.tip === 'specifikaciya') { x.dogovor = zak && zak.dogovorId ? { id: zak.dogovorId, nomer: (byId(st.dogovory, zak.dogovorId) || {}).nomer || null } : null; }
      return x;
    }
    if (d.tip === 'dogovor') {
      x = byId(st.dogovory, d.k.id);
      return { nomer: d.nomer, s: x ? localDay(x.s) : null, po: x ? localDay(x.po) : null, zakazchik: pokupatel, postavshchik: postavshchik,
        predmet: 'Поставка продукции КЗПМ по спецификациям к договору' };
    }
    if (d.tip === 'maket') {
      p = byId(st.produkty, d.k.id);
      var v = p && p.maket ? find(p.maket.versii, function (y) { return y.n === d.versiya; }) : null;
      return { produkt: produktKratko(p), zakazchik: pokupatel,
        versiya: v ? { n: v.n, data: v.data, kto: kto(v.kto), risunok: clone(v.risunok), ispravleno: clone(v.ispravleno || []) } : null,
        zamechaniya: p && p.maket ? p.maket.zamechaniya.filter(function (y) { return y.versiya === d.versiya; })
          .map(function (y) { return { nomer: y.nomer, x: y.x, y: y.y, text: y.text }; }) : [] };
    }
    if (d.tip === 'pasport') {
      var pt = byId(st.partii, d.partiyaId);
      z = pt ? byId(st.zakazy, pt.zakazId) : null;
      p = z ? produktOfZakaza(st, z) : null;
      var sp = specifikaciyaProdukta(st, p), dg = z && z.dogovorId ? byId(st.dogovory, z.dogovorId) : null;
      return { partiya: pt ? { id: pt.id, nomer: pt.nomer, obem: pt.obem, data: localDay(pt.data) } : null,
        zakaz: z ? { id: z.id, nomer: z.nomer, obem: z.obem } : null,
        produkt: produktKratko(p), zakazchik: pokupatel, izgotovitel: postavshchik,
        parametry: p ? parametrySpisok(p) : [], specifikaciya: sp ? { nomer: sp.nomer } : null, dogovor: dg ? { nomer: dg.nomer } : null,
        pokazateli: pokazateli(p, pt),
        zaklyuchenie: 'Партия соответствует спецификации' + (sp ? ' № ' + sp.nomer : '') + (dg ? ' к договору № ' + dg.nomer : '') + '.' };
    }
    if (d.tip === 'upd' || d.tip === 'nakladnaya') {
      o = byId(st.otgruzki, d.otgruzkaId);
      z = o ? byId(st.zakazy, o.zakazId) : null;
      p = z ? produktOfZakaza(st, z) : null;
      var pts = o ? o.partii.map(function (id) { return byId(st.partii, id); }).filter(Boolean) : [];
      var otpr = o ? (ploshchadka(o.ploshchadkaId) || M.zavod.ploshchadki[0]) : M.zavod.ploshchadki[0];
      if (d.tip === 'upd') {
        return { otgruzka: o ? { nomer: o.nomer, data: localDay(o.data) } : null, zakaz: z ? { nomer: z.nomer } : null,
          postavshchik: postavshchik, pokupatel: pokupatel,
          stroki: pts.map(function (pt) { return { naimenovanie: (p ? p.nazvanie : '') + ', партия № ' + pt.nomer, edinitsa: 'т', kolichestvo: pt.obem }; }),
          vsegoTonn: sum(pts, function (pt) { return pt.obem; }) };
      }
      return { vid: d.vid, otgruzka: o ? { nomer: o.nomer, data: localDay(o.data) } : null,
        gruzootpravitel: { name: M.zavod.name, adres: otpr.adres }, gruzopoluchatel: pokupatel,
        vagon: o && o.vagon ? { nomer: o.vagon.nomer, stantsiya: o.vagon.stantsiya } : null,
        samovyvoz: o && o.samovyvoz ? { okno: clone(o.samovyvoz.okno), vorota: o.samovyvoz.vorota || null } : null,
        gruz: p ? p.nazvanie : '', partii: pts.map(function (pt) { return pt.nomer; }), massaTonn: sum(pts, function (pt) { return pt.obem; }) };
    }
    return {};
  }

  /* ---------- списки ---------- */

  function spisokProduktov(st, me, opts) {
    opts = opts || {};
    return st.produkty.filter(function (p) {
      return visible(p.zakazchikId, me) && (!opts.zakazchikId || p.zakazchikId === opts.zakazchikId);
    }).map(function (p) { return produktOut(st, p, me); })
      .filter(function (x) { return !opts.gruppa || x.gruppa === opts.gruppa; })
      .sort(function (a, b) {
        return (a.gruppa === b.gruppa ? 0 : a.gruppa === 'otrabotka' ? -1 : 1) || poVremeni(b.istoriya[0] ? b.istoriya[0].at : 0, a.istoriya[0] ? a.istoriya[0].at : 0);
      });
  }
  function spisokZakazov(st, me, opts) {
    opts = opts || {};
    var etapy = opts.etap ? [].concat(opts.etap) : null;
    return st.zakazy.filter(function (z) {
      return visible(z.zakazchikId, me) && (!opts.zakazchikId || z.zakazchikId === opts.zakazchikId);
    }).map(function (z) { return zakazOut(st, z, me); }).filter(function (x) {
      if (etapy && etapy.indexOf(x.etap) < 0) { return false; }
      if (opts.naMne && x.naKom !== me.side) { return false; }
      return true;
    }).sort(function (a, b) {
      var ka = a.etap === 'polucheno' ? 1 : 0, kb = b.etap === 'polucheno' ? 1 : 0;
      return (ka - kb) || ((a.planEtapa || a.data || '') < (b.planEtapa || b.data || '') ? -1 : 1);
    });
  }
  function spisokPretenziy(st, me, opts) {
    opts = opts || {};
    return st.pretenzii.filter(function (r) {
      return visible(r.zakazchikId, me) && (!opts.zakazchikId || r.zakazchikId === opts.zakazchikId);
    }).map(function (r) { return pretenziyaOut(st, r, me); }).filter(function (x) {
      if (!opts.status) { return true; }
      if (opts.status === 'otkrytye') { return x.status !== 'zakryta'; }
      return x.status === opts.status;
    }).sort(function (a, b) { return poVremeni(b.data, a.data); });
  }

  /* Строка очереди: всё, где шаг за тем, кто смотрит. Сотрудник и
     директор видят шаги КЗПМ, заказчик — свои («Ждёт вас»). */
  /* kto — тот, на ком шаг: заказчик, служба сервиса (претензии) или менеджер. */
  function stroka(tip, id, title, zakazchik, x, href) {
    var kto_ = x.naKom === 'zakazchik' ? 'zakazchik' : x.naKom === 'zavod' ? (tip === 'pretenziya' ? 'servis' : 'menedzher') : null;
    return { tip: tip, id: id, title: title, zakazchik: zakazchik, shag: x.shag, naKom: x.naKom, dney: x.dneyNaEtape,
      srok: x.srokOtveta ? localDay(x.srokOtveta) : null, prosrocheno: !!x.prosrocheno, href: href, kto: kto_ };
  }
  function ochered(st, me) {
    var side = me.side, rows = [];
    spisokProduktov(st, me).forEach(function (p) {
      if (p.naKom !== side) { return; }
      if (p.etap === 'odobren' && p.maket) {
        rows.push(stroka('maket', p.id, 'Макет печати: ' + p.nazvanie, p.zakazchik, p, 'produkt.html?id=' + p.id + '#maket'));
      } else {
        rows.push(stroka('produkt', p.id, p.nazvanie, p.zakazchik, p, 'produkt.html?id=' + p.id));
      }
    });
    spisokZakazov(st, me).forEach(function (z) {
      if (z.naKom !== side) { return; }
      rows.push(stroka('zakaz', z.id, 'Заказ № ' + z.nomer + ', ' + (z.produkt ? z.produkt.nazvanie : ''), z.zakazchik, z, 'zakaz.html?id=' + z.id));
    });
    spisokPretenziy(st, me).forEach(function (r) {
      if (r.naKom !== side) { return; }
      rows.push(stroka('pretenziya', r.id, 'Претензия № ' + r.nomer + (r.partiya ? ', партия № ' + r.partiya.nomer : ''), r.zakazchik, r,
        'pretenziya.html?id=' + r.id));
    });
    return rows.sort(function (a, b) {
      var sa = a.srok || '9999-99-99', sb = b.srok || '9999-99-99';
      return sa < sb ? -1 : sa > sb ? 1 : (b.dney - a.dney);
    });
  }

  /* ---------- сводка руководителя ----------
     Только сборка из готовых признаков: etap, naKom, shag, prosrocheno,
     riskSroka, графиков договоров. Своих правил здесь нет. */
  var PORYADOK_ETAPOV = ['prinyata', 'ekstruziya', 'pechat', 'izgotovlenie', 'laminirovanie', 'rezka', 'kompaundirovanie', 'kontrol', 'otgruzka', 'v-puti'];
  function svodka(st, me) {
    if (me.side !== 'zavod') { return null; }
    var produkty = spisokProduktov(st, me), zakazy = spisokZakazov(st, me), pretenzii = spisokPretenziy(st, me);
    var otr = produkty.filter(function (p) { return p.etap !== 'odobren'; });
    function n(list, etapy) { return list.filter(function (x) { return etapy.indexOf(x.etap) > -1; }).length; }
    var vRabote = zakazy.filter(function (z) { return z.etap !== 'polucheno'; });
    var dogovory = st.dogovory.filter(function (d) { return visible(d.zakazchikId, me); }).map(function (d) {
      var g = grafik(st, d); return { dogovor: { id: d.id, nomer: d.nomer }, zakazchik: zakazchikKratko(d.zakazchikId), plan: g.itog.plan, fakt: g.itog.fakt };
    });
    var otgr = st.otgruzki.filter(function (o) { var z = byId(st.zakazy, o.zakazId); return z && visible(z.zakazchikId, me); })
      .map(function (o) { return otgruzkaOut(st, o); });
    var vPuti = otgr.filter(function (o) { return o.status === 'v-puti'; });
    var otkr = pretenzii.filter(function (r) { return r.status !== 'zakryta'; });
    var vidy = {};
    otkr.forEach(function (r) { vidy[r.vid] = (vidy[r.vid] || 0) + 1; });
    function title(lid) {
      for (var k in SP.etapyZakaza) { var e = find(SP.etapyZakaza[k], function (x) { return x.id === lid; }); if (e) { return e.title; } }
      return lid;
    }
    return {
      na: segodnya(),
      /* Сколько заказчиков подключено к кабинету: масштаб сводки — эта часть завода, не весь завод. */
      zakazchikov: M.zakazchiki.filter(function (z) { return visible(z.id, me); }).length,
      zaprosy: {
        vsego: otr.length,
        novyh: n(otr, ['zapros']),
        vLaboratorii: n(otr, ['raschet', 'retseptura']),
        naIspytaniyah: n(otr, ['obraztsy', 'ispytaniya']),
        odobrenoZaMesyats: produkty.filter(function (p) { return p.reshenie && p.reshenie.podhodit && dneyDo(p.reshenie.data) >= -DNEY_ODOBRENO; }).length,
        prosrocheny: produkty.filter(function (p) { return p.prosrocheno; }).map(function (p) {
          return stroka(p.etap === 'odobren' ? 'maket' : 'produkt', p.id, p.nazvanie, p.zakazchik, p,
            'produkt.html?id=' + p.id + (p.etap === 'odobren' ? '#maket' : ''));
        })
      },
      zakazy: {
        vRabote: vRabote.length,
        poEtapam: PORYADOK_ETAPOV.map(function (id) { return { id: id, title: title(id), n: n(vRabote, [id]) }; }),
        riskSroka: vRabote.filter(function (z) { return z.riskSroka; }).map(function (z) {
          var r = stroka('zakaz', z.id, 'Заказ № ' + z.nomer + ', ' + (z.produkt ? z.produkt.nazvanie : ''), z.zakazchik, z, 'zakaz.html?id=' + z.id);
          r.etapTitle = z.etapTitle; r.planEtapa = z.planEtapa; r.nomer = z.nomer;
          return r;
        })
      },
      otgruzki: {
        dogovory: dogovory,
        plan: sum(dogovory, function (d) { return d.plan; }),
        fakt: sum(dogovory, function (d) { return d.fakt; }),
        vPuti: vPuti,
        vPutiTonn: sum(vPuti, function (o) { return o.obem; }),
        samovyvoz: otgr.filter(function (o) { return o.status === 'plan' && o.sposob === 'samovyvoz' && o.samovyvoz && o.samovyvoz.okno.data >= segodnya(); })
          .sort(function (a, b) { return a.samovyvoz.okno.data < b.samovyvoz.okno.data ? -1 : 1; })
      },
      pretenzii: {
        otkrytyh: otkr.length,
        maxDneyBezOtveta: otkr.reduce(function (m, r) { return Math.max(m, r.dneyBezOtveta || 0); }, 0),
        poVidam: Object.keys(vidy).map(function (v) { return { vid: v, title: SP.vidyPretenziy[v] || v, n: vidy[v] }; })
          .sort(function (a, b) { return b.n - a.n; }),
        otkrytye: otkr.map(function (r) {
          var x = stroka('pretenziya', r.id, 'Претензия № ' + r.nomer + (r.partiya ? ', партия № ' + r.partiya.nomer : ''), r.zakazchik, r, 'pretenziya.html?id=' + r.id);
          x.vidTitle = r.vidTitle; x.dneyBezOtveta = r.dneyBezOtveta; x.statusTitle = r.statusTitle;
          return x;
        })
      }
    };
  }

  /* ---------- чтение ---------- */

  var DATA = {
    me: function () {
      var p = mePerson(), k = kto(p.id);
      k.home = p.home; k.rol = rolOf(p); k.zakazchikId = p.zakazchikId || null;
      return k;
    },
    /** Для входа и панели: заказчики сценариев по предприятиям, затем директор, менеджер, сервис.
        Фоновых заказчиков (fon) здесь нет: их люди в данных есть, но показ ведётся сценарными. */
    lyudi: function () {
      var out = [];
      function dobavit(p) { if (p && p.home) { var k = kto(p.id); k.home = p.home; k.rol = rolOf(p); k.zakazchikId = p.zakazchikId || null; out.push(k); } }
      M.zakazchiki.filter(function (z) { return !z.fon; }).forEach(function (z) {
        ['zakupshchik', 'tehnolog'].forEach(function (key) {
          dobavit(find(M.lyudi, function (p) { return p.zakazchikId === z.id && p.key === key; }));
        });
      });
      ['direktor', 'menedzher', 'servis'].forEach(function (key) { dobavit(personByKey(key)); });
      return out;
    },
    zavod: function () { return clone(M.zavod); },
    zakazchiki: function () {
      var me = mePerson();
      return M.zakazchiki.filter(function (z) { return visible(z.id, me); }).map(function (z) { return DATA.zakazchik(z.id); });
    },
    zakazchik: function (id) {
      var me = mePerson(), z = zakazchikM(id), st = build();
      if (!z || !visible(z.id, me)) { return null; }
      var dg = z.dogovorId ? byId(st.dogovory, z.dogovorId) : null;
      return {
        id: z.id, name: z.name, kratko: z.kratko, otrasl: z.otrasl, gorod: z.gorod, stantsiya: z.stantsiya,
        dogovorId: z.dogovorId || null, dogovor: dg ? { id: dg.id, nomer: dg.nomer } : null,
        lyudi: M.lyudi.filter(function (p) { return p.zakazchikId === z.id; }).map(function (p) { return kto(p.id); })
      };
    },
    spravochnik: function () {
      var s = clone(SP);
      s.formy = resolve(s.formy, today());   /* граница даты в правилах — от дня показа */
      s.katalog = clone(M.zavod.katalog);
      s.ploshchadki = clone(M.zavod.ploshchadki);
      return s;
    },
    produkty: function (opts) { return spisokProduktov(build(), mePerson(), opts); },
    produkt: function (id) {
      var st = build(), me = mePerson(), p = byId(st.produkty, id);
      return p && visible(p.zakazchikId, me) ? produktOut(st, p, me) : null;
    },
    zakazy: function (opts) { return spisokZakazov(build(), mePerson(), opts); },
    zakaz: function (id) {
      var st = build(), me = mePerson(), z = byId(st.zakazy, id);
      return z && visible(z.zakazchikId, me) ? zakazOut(st, z, me) : null;
    },
    partii: function (opts) {
      opts = opts || {};
      var st = build(), me = mePerson();
      return st.partii.map(function (p) { return partiyaOut(st, p); }).filter(function (p) {
        if (!p.zakazchik || !visible(p.zakazchik.id, me)) { return false; }
        if (opts.zakazchikId && p.zakazchik.id !== opts.zakazchikId) { return false; }
        if (opts.poluchennye && !p.poluchena) { return false; }
        return true;
      }).sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; });
    },
    otgruzki: function (opts) {
      opts = opts || {};
      var st = build(), me = mePerson();
      return st.otgruzki.map(function (o) { return otgruzkaOut(st, o); }).filter(function (o) {
        if (!o.zakazchik || !visible(o.zakazchik.id, me)) { return false; }
        if (opts.zakazchikId && o.zakazchik.id !== opts.zakazchikId) { return false; }
        if (opts.dogovorId && o.dogovorId !== opts.dogovorId) { return false; }
        if (opts.status && o.status !== opts.status) { return false; }
        return true;
      }).sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    },
    /** Договор и график по неделям текущего квартала (13 недель вокруг текущей). */
    dogovor: function (id) {
      var st = build(), me = mePerson(), dg = byId(st.dogovory, id);
      return dg && visible(dg.zakazchikId, me) ? dogovorOut(st, dg) : null;
    },
    /** k — { tip, id }: документы карточки; у заказа — и документы его отгрузок. */
    dokumenty: function (opts) {
      opts = opts || {};
      var st = build(), me = mePerson();
      return dokumentySvyazannye(st, function (d) {
        if (!visible(d.zakazchikId, me)) { return false; }
        if (opts.zakazchikId && d.zakazchikId !== opts.zakazchikId) { return false; }
        if (opts.tip && d.tip !== opts.tip) { return false; }
        if (opts.k) {
          if (d.k.tip === opts.k.tip && d.k.id === opts.k.id) { return true; }
          if (opts.k.tip === 'zakaz' && d.k.tip === 'otgruzka') { var o = byId(st.otgruzki, d.k.id); return !!o && o.zakazId === opts.k.id; }
          return false;
        }
        return true;
      });
    },
    dokument: function (id) {
      var st = build(), me = mePerson(), d = find(vseDokumenty(st), function (x) { return x.id === id; });
      if (!d || !visible(d.zakazchikId, me)) { return null; }
      var x = dokOut(st, d);
      x.dannye = dannyeDok(st, d);
      return x;
    },
    pretenzii: function (opts) { return spisokPretenziy(build(), mePerson(), opts); },
    pretenziya: function (id) {
      var st = build(), me = mePerson(), r = byId(st.pretenzii, id);
      return r && visible(r.zakazchikId, me) ? pretenziyaOut(st, r, me) : null;
    },
    /** Всё, где шаг за КЗПМ (у сотрудника и директора) или за заказчиком (у заказчика: «Ждёт вас»), по сроку. */
    ochered: function () { return ochered(build(), mePerson()); },
    svodka: function () { return svodka(build(), mePerson()); },
    /** Заготовка для «Заполнить демо-данными»: zapros, zaprosKompaund, obraztsy, protokol,
        maketZamechanie, maketOtvet, zakaz, otgruzka, pretenziya, otvet, reshenie, foto. */
    demo: function (key, id) {
      if (!Object.prototype.hasOwnProperty.call(M.demo, key)) { return null; }
      var v = resolve(clone(M.demo[key]), today());
      var st = build(), me = mePerson();
      if (key === 'pretenziya') {
        var pt = find(st.partii, function (p) { var x = partiyaOut(st, p); return x.poluchena && x.zakazchik && visible(x.zakazchik.id, me) && me.side === 'zakazchik'; });
        v.partiyaId = pt ? pt.id : null;
      }
      if (key === 'otgruzka' && id) {
        var z = byId(st.zakazy, id), zk = z ? zakazchikM(z.zakazchikId) : null;
        if (zk && v.vagon) { v.vagon.stantsiya = zk.stantsiya; }
      }
      return v;
    },
    /** Срок ответа → { dney, prosrocheno }: та же формула, что у карточек. */
    srok: function (naKom, iso) { return srok(naKom, iso ? localDay(iso) : iso); }
  };

  /* ---------- запись ---------- */

  function push(t, fields, ktoId) {
    var e = { t: t, kto: ktoId || mePerson().id };
    for (var k in fields) { e[k] = fields[k]; }
    return w.Store.push(e);
  }
  function laboratoriya() { var p = personByKey('laboratoriya'); return p ? p.id : null; }
  function produktFor(id) { var p = byId(build().produkty, id); return p && visible(p.zakazchikId, mePerson()) ? p : null; }
  function zakazFor(id) { var z = byId(build().zakazy, id); return z && visible(z.zakazchikId, mePerson()) ? z : null; }
  function pretenziyaFor(id) { var r = byId(build().pretenzii, id); return r && visible(r.zakazchikId, mePerson()) ? r : null; }
  function rol() { return rolOf(mePerson()); }

  /* Форма запроса: обязательные поля — из правил полей справочника (formy.zapros, поле
     с текстом pusto), числа — положительные. Отдаёт очищенную форму или null. */
  var CHISLA = ['vesFasovki', 'obemGod', 'tolshchina', 'tsvetov', 'ptr', 'koncentraciya'];
  function formaZaprosa(forma) {
    forma = forma || {};
    var kat = katalog(forma.tip);
    if (!kat) { return null; }
    var pravila = kat.kompaund ? SP.formy.zapros.kompaund : SP.formy.zapros.plenka;
    var nado = Object.keys(pravila).filter(function (k) { return !!pravila[k].pusto; });
    var polya = kat.kompaund ? ['marka', 'naznachenie', 'obemGod', 'kommentariy'] :
      ['produktFasovki', 'vesFasovki', 'razmery', 'tolshchina', 'pechat', 'tsvetov', 'laminirovanie', 'obemGod', 'kommentariy'];
    var f = { tip: kat.tip };
    var ok = true;
    polya.forEach(function (k) {
      var v = forma[k];
      if (k === 'laminirovanie') { f[k] = v === true || v === 'true' || v === 'nuzhno'; return; }
      if (k === 'pechat') { f[k] = v === 'tsvetnaya' ? 'tsvetnaya' : 'net'; return; }
      if (CHISLA.indexOf(k) > -1) {
        var n = chislo(v);
        f[k] = n !== null && n > 0 ? n : null;
        if (nado.indexOf(k) > -1 && f[k] === null) { ok = false; }
        return;
      }
      f[k] = trim(v);
      if (nado.indexOf(k) > -1 && !f[k]) { ok = false; }
    });
    if (!kat.kompaund && f.pechat !== 'tsvetnaya') { f.tsvetov = null; }
    if (forma.maketFayl && forma.maketFayl.name) { f.maketFayl = { name: trim(forma.maketFayl.name), dataUrl: forma.maketFayl.dataUrl || null }; }
    return ok ? f : null;
  }
  function nazvanieProdukta(kat, par) {
    if (kat.kompaund) { return par.marka || kat.edinichnoe; }
    return kat.edinichnoe + (par.vesFasovki ? ' ' + chisloText(par.vesFasovki) + ' кг' : '') +
      (par.produktFasovki ? ' под продукт «' + par.produktFasovki + '»' : '');
  }
  /* Следующая версия макета исправлена по сути принятых замечаний. Часть рисунка находится по
     точке замечания (x и y в процентах рисунка; Maket.risunok держит части на этих местах),
     правка — по части: название и масса набираются крупнее. Замечание к другим частям или
     мимо них рисунок не меняет: КЗПМ отвечает на него словами. */
  var PRAVKI_MAKETA = [
    { chast: 'nazvanie', x: [12, 74], y: [30, 50], pravka: { krupnoeNazvanie: true } },
    { chast: 'massa', x: [44, 84], y: [64, 80], pravka: { krupnayaMassa: true } }
  ];
  function ispravlennyyRisunok(risunok, zamechaniya) {
    var r = clone(risunok);
    zamechaniya.forEach(function (z) {
      var pr = find(PRAVKI_MAKETA, function (x) { return z.x >= x.x[0] && z.x <= x.x[1] && z.y >= x.y[0] && z.y <= x.y[1]; });
      if (pr) { Object.keys(pr.pravka).forEach(function (k) { r[k] = pr.pravka[k]; }); }
    });
    return r;
  }
  function osnovaRisunka(st, p) {
    var z = zakazchikM(p.zakazchikId), par = p.parametry || {};
    return { nadpis: z ? z.kratko : '', produkt: par.produktFasovki || p.nazvanie, massa: par.vesFasovki ? chisloText(par.vesFasovki) + ' кг' : '',
      krupnoeNazvanie: false, krupnayaMassa: false, znaki: ['verh'] };
  }
  /* Отгрузка на этапе «отгрузка»: вагон с восьмизначным номером и станцией,
     или окно самовывоза на площадке КЗПМ, или уже назначенная отгрузка. */
  function formaOtgruzki(st, z, dannye) {
    dannye = dannye || {};
    if (dannye.vagon) {
      var nomer = trim(dannye.vagon.nomer), stantsiya = trim(dannye.vagon.stantsiya);
      if (!new RegExp(SP.formy.otgruzka.vagon.nomer.format).test(nomer) || !stantsiya) { return null; }
      return { sposob: 'vagon', vagon: { nomer: nomer, stantsiya: stantsiya, eta: validDay(dannye.vagon.eta) ? dannye.vagon.eta : null } };
    }
    if (dannye.samovyvoz) {
      var sv = dannye.samovyvoz, okno = typeof sv.okno === 'string' ? { data: sv.okno } : (sv.okno || {});
      if (!validDay(okno.data) || !ploshchadka(sv.ploshchadkaId)) { return null; }
      return { sposob: 'samovyvoz', samovyvoz: { okno: { data: okno.data, s: trim(okno.s) || null, po: trim(okno.po) || null },
        ploshchadkaId: sv.ploshchadkaId, vorota: trim(sv.vorota) || null } };
    }
    return gotovaPlan(planOtgruzka(st, z.id)) ? { izPlana: true } : null;
  }

  /* Как каждое действие журнала меняет данные. Обработчик терпит повтор
     и пропавшую цель: журнал проигрывается на каждом чтении. */
  function sobytie(list, e, t, extra) {
    var s = { t: t, data: mestnoe(e.at), kto: e.kto, j: true };
    for (var k in extra || {}) { s[k] = extra[k]; }
    list.push(s);
  }
  var APPLY = {
    otpravitZapros: function (st, e) {
      if (st.drafts.zapros[e.draftId]) { return; }
      var f = e.forma || {}, kat = katalog(f.tip) || katalog('ffs-meshki'), id = 'pd-' + e.seq;
      var par = clone(f); delete par.tip;
      var p = { id: id, zakazchikId: e.zakazchikId, tip: kat.tip, nazvanie: nazvanieProdukta(kat, par), parametry: par, sobytiya: [],
        maket: !kat.kompaund && par.pechat === 'tsvetnaya' ? { versii: [], zamechaniya: [] } : null };
      sobytie(p.sobytiya, e, 'zapros');
      st.produkty.push(p);
      st.drafts.zapros[e.draftId] = id;
    },
    otpravitRaschet: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (!p) { return; }
      var dk = 'dk-' + e.seq;
      /* Номер выше последнего расчёта в демо-данных (Р-305), чтобы номера росли с датой. */
      st.dokumenty.push({ id: dk, tip: 'raschet', nomer: 'Р-' + (310 + e.seq), data: localDay(e.at), k: { tip: 'produkt', id: p.id } });
      sobytie(p.sobytiya, e, 'raschet', { dokumentId: dk });
    },
    retsepturaPodobrana: function (st, e) { var p = byId(st.produkty, e.produktId); if (p) { sobytie(p.sobytiya, e, 'retseptura'); } },
    obraztsyOtpravleny: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (p) { sobytie(p.sobytiya, e, 'obraztsy', { kolvo: e.kolvo, sposob: e.sposob }); }
    },
    nachatIspytaniya: function (st, e) { var p = byId(st.produkty, e.produktId); if (p) { sobytie(p.sobytiya, e, 'ispytaniya'); } },
    prilozhitProtokol: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (!p) { return; }
      var dk = 'dk-' + e.seq;
      st.dokumenty.push({ id: dk, tip: 'protokol', nomer: null, data: localDay(e.at), k: { tip: 'produkt', id: p.id }, fayl: clone(e.fayl) });
      sobytie(p.sobytiya, e, 'protokol', { dokumentId: dk });
    },
    reshenieObrazets: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (p) { sobytie(p.sobytiya, e, 'reshenie', { podhodit: !!e.podhodit, prichina: e.prichina || null }); }
    },
    zagruzitMaket: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (!p || !p.maket) { return; }
      var v = p.maket.versii, last = v.length ? v[v.length - 1] : null;
      var prinyatye = last ? p.maket.zamechaniya.filter(function (z) { return z.versiya === last.n && z.otvet && z.otvet.prinyato; }) : [];
      v.push({ n: v.length + 1, data: mestnoe(e.at), kto: e.kto, risunok: last ? ispravlennyyRisunok(last.risunok, prinyatye) : osnovaRisunka(st, p),
        ispravleno: prinyatye.map(function (z) { return z.nomer; }), j: true });
    },
    zamechanieKMaketu: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (!p || !p.maket || !p.maket.versii.length) { return; }
      var tek = p.maket.versii[p.maket.versii.length - 1];
      var nomer = p.maket.zamechaniya.filter(function (z) { return z.versiya === tek.n; }).length + 1;
      p.maket.zamechaniya.push({ id: 'mz-' + e.seq, versiya: tek.n, nomer: nomer, x: e.x, y: e.y, text: e.text, kto: e.kto, data: mestnoe(e.at), otvet: null, j: true });
    },
    otvetitNaZamechanie: function (st, e) {
      st.produkty.forEach(function (p) {
        var z = p.maket ? byId(p.maket.zamechaniya, e.zamechanieId) : null;
        if (z && !z.otvet) { z.otvet = { text: e.text, prinyato: !!e.prinyato, kto: e.kto, data: mestnoe(e.at), j: true }; }
      });
    },
    soglasovatMaket: function (st, e) {
      var p = byId(st.produkty, e.produktId); if (!p || !p.maket || !p.maket.versii.length) { return; }
      sobytie(p.sobytiya, e, 'maketSoglasovan', { versiya: p.maket.versii[p.maket.versii.length - 1].n });
    },
    oformitZakaz: function (st, e) {
      if (st.drafts.zakaz[e.draftId]) { return; }
      var p = byId(st.produkty, e.produktId); if (!p) { return; }
      var id = 'zk-' + e.seq, lenta = lentaOf(p.tip), zk = zakazchikM(p.zakazchikId), d0 = dayOf(e.at);
      var z = {
        id: id, nomer: String(1430 + e.seq), zakazchikId: p.zakazchikId, produktId: p.id, obem: e.obem, sposob: e.sposob,
        zhelaemayaData: e.data, dogovorId: zk && zk.dogovorId ? zk.dogovorId : null,
        plan: (PLAN_ZAKAZA[lenta] || PLAN_ZAKAZA.ffs).map(function (n) { return isoDay(addDays(d0, n)); }),
        sobytiya: []
      };
      sobytie(z.sobytiya, e, 'zayavka');
      st.zakazy.push(z);
      sobytie(p.sobytiya, e, 'zakaz', { zakazId: id });
      st.drafts.zakaz[e.draftId] = id;
    },
    sleduyushchiyEtap: function (st, e) {
      var z = byId(st.zakazy, e.zakazId); if (!z) { return; }
      var zs = sostZakaza(st, z), i = zs.ids.indexOf(zs.etap);
      if (i < 0 || i >= zs.ids.indexOf('v-puti')) { return; }
      if (zs.etap === 'kontrol') {
        var uzhe = partiiZakaza(st, z.id), ostatok = z.obem - sum(uzhe, function (p) { return p.obem; });
        if (ostatok > 0) {
          var pid = 'pt-' + e.seq;
          st.partii.push({ id: pid, nomer: z.nomer + '-' + (uzhe.length + 1), zakazId: z.id, obem: ostatok, data: localDay(e.at), pasport: {} });
          sobytie(z.sobytiya, e, 'partiya', { partiyaId: pid });
        }
      }
      if (zs.etap === 'otgruzka') {
        var d = e.otgruzka || {}, vse = otgruzkiZakaza(st, z.id);
        var ushli = [];
        vse.forEach(function (o) { if (o.status !== 'plan') { ushli = ushli.concat(o.partii); } });
        var neotgr = partiiZakaza(st, z.id).map(function (p) { return p.id; }).filter(function (id) { return ushli.indexOf(id) < 0; });
        var o = find(vse, function (x) { return x.status === 'plan'; });
        if (!o) {
          o = { id: 'og-' + e.seq, nomer: z.nomer + '-' + (vse.length + 1), zakazId: z.id, dogovorId: z.dogovorId || null, partii: [],
            sposob: d.sposob || z.sposob, data: localDay(e.at), ploshchadkaId: M.zavod.ploshchadki[0].id, vagon: null, samovyvoz: null, status: 'plan', polucheno: null };
          st.otgruzki.push(o);
        }
        if (d.vagon) {
          o.sposob = 'vagon'; o.samovyvoz = null;
          o.vagon = { nomer: d.vagon.nomer, stantsiya: d.vagon.stantsiya, eta: d.vagon.eta || isoDay(addDays(dayOf(e.at), 3)) };
        } else if (d.samovyvoz) {
          o.sposob = 'samovyvoz'; o.vagon = null; o.samovyvoz = clone(d.samovyvoz); o.ploshchadkaId = d.samovyvoz.ploshchadkaId;
        } else if (o.vagon && !o.vagon.eta) { o.vagon.eta = isoDay(addDays(dayOf(e.at), 3)); }
        if (neotgr.length) { o.partii = neotgr; }
        o.status = 'v-puti'; o.data = localDay(e.at); delete o.obemPlan;
        /* Остальные запланированные отгрузки заказа уходят вместе с этой. */
        st.otgruzki = st.otgruzki.filter(function (x) { return x === o || !(x.zakazId === z.id && x.status === 'plan'); });
        sobytie(z.sobytiya, e, 'otgruzka', { otgruzkaId: o.id });
      }
      sobytie(z.sobytiya, e, 'etap', { etap: zs.ids[i + 1] });
    },
    polucheno: function (st, e) {
      var z = byId(st.zakazy, e.zakazId); if (!z) { return; }
      st.otgruzki.forEach(function (o) { if (o.zakazId === z.id && o.status === 'v-puti') { o.status = 'poluchena'; o.polucheno = localDay(e.at); } });
      sobytie(z.sobytiya, e, 'polucheno');
    },
    otpravitPretenziyu: function (st, e) {
      if (st.drafts.pretenziya[e.draftId]) { return; }
      var f = e.forma || {}, id = 'pr-' + e.seq;
      st.pretenzii.push({ id: id, nomer: String(31 + e.seq), zakazchikId: e.zakazchikId, partiyaId: f.partiyaId, vid: f.vid,
        opisanie: f.opisanie, foto: clone(f.foto || []), sobytiya: [{ t: 'pretenziya', data: mestnoe(e.at), kto: e.kto, j: true }] });
      st.drafts.pretenziya[e.draftId] = id;
    },
    vzyatPretenziyu: function (st, e) { var r = byId(st.pretenzii, e.pretenziyaId); if (r) { sobytie(r.sobytiya, e, 'vzyata'); } },
    otvetitNaPretenziyu: function (st, e) { var r = byId(st.pretenzii, e.pretenziyaId); if (r) { sobytie(r.sobytiya, e, 'otvet', { text: e.text }); } },
    zaprositObraztsy: function (st, e) { var r = byId(st.pretenzii, e.pretenziyaId); if (r) { sobytie(r.sobytiya, e, 'obraztsy', { text: e.text }); } },
    zakrytPretenziyu: function (st, e) { var r = byId(st.pretenzii, e.pretenziyaId); if (r) { sobytie(r.sobytiya, e, 'zakryta', { reshenie: e.reshenie }); } }
  };

  /* Ход продукта: правило по состоянию и роли, затем запись. */
  function hodProdukta(id, pravilo, t, fields, ktoId) {
    var p = produktFor(id); if (!p) { return null; }
    var ps = sostProdukta(p);
    if (!pravilo(p, ps)) { return null; }
    var f = { produktId: id };
    for (var k in fields || {}) { f[k] = fields[k]; }
    push(t, f, ktoId);
    return id;
  }
  function hodPretenzii(id, pravilo, t, fields) {
    var r = pretenziyaFor(id); if (!r) { return null; }
    if (!pravilo(sostPretenzii(r), rol())) { return null; }
    var f = { pretenziyaId: id };
    for (var k in fields || {}) { f[k] = fields[k]; }
    push(t, f);
    return id;
  }

  var ACT = {
    /** Заказчик. Повтор с тем же draftId вернёт тот же продукт. */
    otpravitZapros: function (draftId, forma) {
      if (!draftId) { return null; }
      var st = build();
      if (st.drafts.zapros[draftId]) { return st.drafts.zapros[draftId]; }
      var me = mePerson();
      if (rolOf(me) !== 'zakazchik') { return null; }
      var f = formaZaprosa(forma);
      if (!f) { return null; }
      var e = push('otpravitZapros', { draftId: draftId, forma: f, zakazchikId: me.zakazchikId });
      return 'pd-' + e.seq;
    },
    /** Менеджер: этап «расчёт отправлен» и документ «Расчёт» без цены. */
    otpravitRaschet: function (produktId) {
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.raschet(ps, rol()); }, 'otpravitRaschet');
    },
    /** Менеджер отмечает, в журнал пишется от лаборатории. */
    retsepturaPodobrana: function (produktId) {
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.retseptura(ps, rol()); }, 'retsepturaPodobrana', {}, laboratoriya());
    },
    /** Менеджер отмечает, в журнал пишется от лаборатории. kolvo — штук, sposob — как отправлены. */
    obraztsyOtpravleny: function (produktId, o) {
      o = o || {};
      var kolvo = chislo(o.kolvo), sposob = trim(o.sposob);
      if (!kolvo || kolvo < 1 || !sposob) { return null; }
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.obraztsy(ps, rol()); }, 'obraztsyOtpravleny',
        { kolvo: Math.round(kolvo), sposob: sposob }, laboratoriya());
    },
    nachatIspytaniya: function (produktId) {
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.ispytaniya(ps, rol()); }, 'nachatIspytaniya');
    },
    /** fayl — { name, dataUrl? }: свой файл или демо-протокол. */
    prilozhitProtokol: function (produktId, fayl) {
      var name = trim(fayl && fayl.name);
      if (!name) { return null; }
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.protokol(ps, rol()); }, 'prilozhitProtokol',
        { fayl: { name: name, dataUrl: (fayl && fayl.dataUrl) || null } });
    },
    /** «Подходит» → одобрен; «Не подходит» — только с причиной. */
    reshenieObrazets: function (produktId, podhodit, prichina) {
      var pr = trim(prichina);
      if (podhodit !== true && !pr) { return null; }
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.reshenie(ps, rol()); }, 'reshenieObrazets',
        { podhodit: podhodit === true, prichina: podhodit === true ? null : pr });
    },
    /** Менеджер: следующая версия макета. */
    zagruzitMaket: function (produktId) {
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.maketVersiya(sostMaketa(p, ps), rol()); }, 'zagruzitMaket');
    },
    /** Заказчик: замечание к текущей версии; x, y — проценты рисунка. → id замечания. */
    zamechanieKMaketu: function (produktId, o) {
      o = o || {};
      var text = trim(o.text), x = chislo(o.x), y = chislo(o.y);
      if (!text || x === null || y === null) { return null; }
      var p = produktFor(produktId); if (!p) { return null; }
      if (!PRAVILO.maketZamechanie(sostMaketa(p, sostProdukta(p)), rol())) { return null; }
      var e = push('zamechanieKMaketu', { produktId: produktId, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)), text: text });
      return 'mz-' + e.seq;
    },
    /** Менеджер: «принято» (текст по умолчанию) или пояснение (текст обязателен). */
    otvetitNaZamechanie: function (zamechanieId, o) {
      o = o || {};
      var prinyato = o.prinyato === true, text = trim(o.text);
      if (!prinyato && !text) { return null; }
      if (!text) { text = 'Принято, исправим в следующей версии.'; }
      var me = mePerson(), p = find(build().produkty, function (x) { return !!x.maket && !!byId(x.maket.zamechaniya, zamechanieId); });
      if (!p || !visible(p.zakazchikId, me)) { return null; }
      var z = byId(p.maket.zamechaniya, zamechanieId);
      if (!PRAVILO.otvetNaZamechanie(sostMaketa(p, sostProdukta(p)), z, rolOf(me))) { return null; }
      push('otvetitNaZamechanie', { produktId: p.id, zamechanieId: zamechanieId, text: text, prinyato: prinyato });
      return zamechanieId;
    },
    soglasovatMaket: function (produktId) {
      return hodProdukta(produktId, function (p, ps) { return PRAVILO.maketSoglasovat(sostMaketa(p, ps), rol()); }, 'soglasovatMaket');
    },
    /** Заказчик: заявка из одобренного продукта. Повтор с тем же draftId — тот же заказ. */
    oformitZakaz: function (draftId, produktId, o) {
      if (!draftId) { return null; }
      var st = build();
      if (st.drafts.zakaz[draftId]) { return st.drafts.zakaz[draftId]; }
      o = o || {};
      var obem = chislo(o.obem), data = trim(o.data), sposob = o.sposob;
      if (!obem || obem <= 0 || !validDay(data) || data < segodnya() || !SP.sposoby[sposob]) { return null; }
      var p = produktFor(produktId); if (!p) { return null; }
      if (!PRAVILO.zakaz(p, sostProdukta(p), rol())) { return null; }
      var e = push('oformitZakaz', { draftId: draftId, produktId: produktId, obem: obem, data: data, sposob: sposob });
      return 'zk-' + e.seq;
    },
    /** Менеджер. На «отгрузке» — vagon{nomer, stantsiya, eta?} или samovyvoz{okno{data, s, po}, ploshchadkaId, vorota?},
        если отгрузка заказа ещё не назначена; на «контроле качества» выпускает партию с паспортом. */
    sleduyushchiyEtap: function (zakazId, dannye) {
      var z = zakazFor(zakazId); if (!z) { return null; }
      var st = build(), zs = sostZakaza(st, z);
      if (!PRAVILO.sleduyushchiy(zs, rol())) { return null; }
      var f = { zakazId: zakazId };
      if (zs.etap === 'otgruzka') {
        var d = formaOtgruzki(st, z, dannye);
        if (!d) { return null; }
        f.otgruzka = d;
      }
      push('sleduyushchiyEtap', f);
      return zakazId;
    },
    /** Заказчик на «в пути». */
    polucheno: function (zakazId) {
      var z = zakazFor(zakazId); if (!z) { return null; }
      if (!PRAVILO.polucheno(sostZakaza(build(), z), rol())) { return null; }
      push('polucheno', { zakazId: zakazId });
      return zakazId;
    },
    /** Заказчик: только по полученной партии своего предприятия; вид из справочника,
        описание обязательно; foto — [{ name, dataUrl? , demo? }]. Повтор с тем же draftId — та же претензия. */
    otpravitPretenziyu: function (draftId, forma) {
      if (!draftId) { return null; }
      var st = build();
      if (st.drafts.pretenziya[draftId]) { return st.drafts.pretenziya[draftId]; }
      var me = mePerson();
      if (rolOf(me) !== 'zakazchik') { return null; }
      forma = forma || {};
      var pt = byId(st.partii, forma.partiyaId), po = pt ? partiyaOut(st, pt) : null;
      var opisanie = trim(forma.opisanie);
      if (!po || !po.poluchena || !po.zakazchik || po.zakazchik.id !== me.zakazchikId) { return null; }
      if (!SP.vidyPretenziy[forma.vid] || !opisanie) { return null; }
      var foto = (forma.foto || []).map(function (f) {
        return typeof f === 'string' ? f : { name: trim(f && f.name), dataUrl: (f && f.dataUrl) || null, demo: (f && f.demo) || null };
      });
      var e = push('otpravitPretenziyu', { draftId: draftId, zakazchikId: me.zakazchikId,
        forma: { partiyaId: pt.id, vid: forma.vid, opisanie: opisanie, foto: foto } });
      return 'pr-' + e.seq;
    },
    vzyatPretenziyu: function (id) { return hodPretenzii(id, PRAVILO.vzyat, 'vzyatPretenziyu'); },
    otvetitNaPretenziyu: function (id, text) {
      text = trim(text);
      if (!text) { return null; }
      return hodPretenzii(id, PRAVILO.otvetit, 'otvetitNaPretenziyu', { text: text });
    },
    zaprositObraztsy: function (id) {
      var st = build(), r = byId(st.pretenzii, id), pt = r ? byId(st.partii, r.partiyaId) : null;
      var z = pt ? byId(st.zakazy, pt.zakazId) : null, p = z ? produktOfZakaza(st, z) : null;
      var chto = p && lentaOf(p.tip) === 'kompaund' ? 'образцы гранул' : 'образцы мешков';
      return hodPretenzii(id, PRAVILO.zaprositObraztsy, 'zaprositObraztsy',
        { text: 'Просим отправить ' + chto + ' из партии № ' + (pt ? pt.nomer : '') + ' для проверки в лаборатории КЗПМ.' });
    },
    zakrytPretenziyu: function (id, reshenie) {
      reshenie = trim(reshenie);
      if (!reshenie) { return null; }
      return hodPretenzii(id, PRAVILO.zakryt, 'zakrytPretenziyu', { reshenie: reshenie });
    }
  };

  w.DATA = DATA;
  w.ACT = ACT;
})(window);

/* Tur — панель ведущего: пять сценариев показа А–Д по шагам, вопросы к клиенту
   и строка «после обследования». Движок перенесён из каркаса БМЗ (таск 02),
   сценарии и тексты панели — таск 09.

   Шаг засчитывается по данным, а не по клику в панели: если человек сделал
   ход сам, подсказка идёт дальше. Шаги двух видов:
     * ход — { kto, href, text, hod(ctx) → bool }: ход записан в журнал
       (ctx.journal — записи Store.journal(), ctx.DATA — слой данных). Ход с
       признаком mozhnoPropustit засчитывается и тогда, когда сделан любой ход
       после него: необязательный шаг сценария можно пропустить;
     * просмотр — { kto, href, text, vid(z) → bool }: нужная страница открыта
       в нужной роли, пока шаг текущий. Отметку «видел» ставит этот же файл при
       загрузке страницы, по щелчку и по смене адреса (окно документа живёт в
       хэше). Просмотр считается пройденным и тогда, когда пройден любой ход
       после него.
   kto — id персоны или её key из данных; key берётся у первой такой персоны
   в DATA.lyudi(). Заказчик сценария — предприятие технолога и закупщика
   завода удобрений, сотрудники КЗПМ одни на всех.

   Ход читается по журналу, а не по DATA: DATA показывает заказчику только его
   предприятие, и подсказка сценария менялась бы от того, под кем открыта
   панель. Журнал пишет только допустимые ходы (отказ журнал не трогает), поэтому
   правил доступности здесь нет: только «этот ход был». Идентификатор продукта и
   претензии, созданных ходом, отдаёт сам слой данных (ACT с тем же draftId
   возвращает уже созданное и ничего не пишет).

   Состояние (выбранный сценарий и отметки «видел») — черновик Store 'tur':
   «Сбросить демо» чистит его вместе с журналом.

   Tur.list()          → [{ id, title, voprosy[] }]
   Tur.current()       → { scenario, title, step, total, text, kto, role, person, href, gotovo } | null
   Tur.go(id)          — выбрать сценарий, сменить роль и человека, открыть страницу шага
   Tur.panel()         → HTML блоков панели ведущего (каркас вставляет его в панель) */
(function (w) {
  'use strict';

  var KEY = 'tur';

  /* Люди сценариев: заказчик — по id (у каждого предприятия свои), КЗПМ — по key. */
  var U_ZAK = 'u-zakupshchik', U_TEH = 'u-tehnolog', C_ZAK = 'c-zakupshchik';
  var MEN = 'menedzher', SER = 'servis', DIR = 'direktor';
  /* Опорные объекты демо (interfaces.md, таск 01). */
  var P_NPK = 'p-u-npk', Z_U4 = 'zk-u4', Z_C2 = 'zk-c2', DG_U = 'dg-u';

  function safe(fn, dflt) { try { var v = fn(); return v === undefined || v === null ? dflt : v; } catch (e) { return dflt; } }
  function esc(s) { return w.Render ? w.Render.esc(s) : String(s == null ? '' : s); }
  function enc(s) { return encodeURIComponent(s); }

  /* --- люди: id или key персоны → человек и его сторона --------------------- */
  function lyudi() { return safe(function () { return w.DATA.lyudi(); }, []); }
  function chelovek(kto) {
    var list = lyudi(), x = null;
    list.forEach(function (p) { if (!x && p.id === kto) { x = p; } });
    list.forEach(function (p) { if (!x && p.key === kto) { x = p; } });
    return x;
  }
  /* «Менеджер по продажам», «Технолог фасовки, АО «Синеборский завод удобрений»». */
  function kogo(p) {
    if (!p) { return ''; }
    return p.side === 'zavod' ? p.name : p.position + (p.predpriyatie ? ', ' + p.predpriyatie : '');
  }
  /* Коротко, для пройденных шагов: предприятие уже названо выше по сценарию. */
  function kogoKratko(p) { return p ? (p.side === 'zavod' ? p.name : p.position) : ''; }

  /* --- состояние: черновик Store ------------------------------------------- */
  function state() { return safe(function () { return w.Store.draft(KEY); }, {}) || {}; }
  function save(st) { safe(function () { return w.Store.setDraft(KEY, st); }, null); }

  /* --- где мы: страница, её параметры, сторона и человек --------------------- */
  function zdes() {
    var file = String(w.location.pathname).split('/').pop() || 'index.html';
    var par = function (n) { return safe(function () { return w.Render.param(n); }, ''); };
    return {
      file: file, id: par('id'), dogovor: par('dogovor'), hash: String(w.location.hash || ''),
      role: safe(function () { return w.Store.role(); }, null),
      person: safe(function () { return w.DATA.me().id; }, null)
    };
  }
  /* Страницу смотрит именно этот человек. */
  function tot(z, kto) { var p = chelovek(kto); return !!p && z.person === p.id; }
  /* В адресе открыт документ (окно листа живёт в хэше #doc=<id>). */
  function dokumentIzHasha(z) {
    var m = /(?:^#|&)doc=([^&]+)/.exec(z.hash);
    return m ? safe(function () { return decodeURIComponent(m[1]); }, '') : '';
  }
  function ctx() { return { DATA: w.DATA, journal: zhurnal() }; }

  /* --- журнал: был ли такой ход --------------------------------------------- */
  function zhurnal() { return safe(function () { return w.Store.journal(); }, []); }
  /* Есть запись типа t (после записи с номером posle), удовлетворяющая условию. */
  function est(j, t, kak, posle) {
    return j.some(function (e) { return e.t === t && e.seq > (posle || 0) && (!kak || kak(e)); });
  }
  /* Номер последней записи типа t с условием, 0 — записей нет. */
  function posledniy(j, t, kak) {
    var n = 0;
    j.forEach(function (e) { if (e.t === t && (!kak || kak(e)) && e.seq > n) { n = e.seq; } });
    return n;
  }
  function poObektu(pole, id) { return function (e) { return e[pole] === id; }; }

  /* ======================================================================
     Сценарии. Сценарий: { id, title, voprosy, shagi() → [шаг],
     klyuch?() → строка (что за объект ведёт сценарий: отметки «видел»
     привязаны к нему), final?() → шаг-итог { kto, href, text } }.
     ====================================================================== */

  /* --- А. Новый продукт: запрос ведёт технолог завода удобрений. Продукт
     сценария — запрос, отправленный предприятием технолога; запросов может
     быть несколько: берём тот, что продвинулся дальше, при равенстве — поздний. */
  function zaprosyA(j) {
    var ent = (chelovek(U_TEH) || {}).zakazchikId;
    return j.filter(function (e) { return e.t === 'otpravitZapros' && !!ent && e.zakazchikId === ent; });
  }
  function produktA() {
    var best = null, bestN = -1;
    zaprosyA(zhurnal()).forEach(function (e) {
      var id = safe(function () { return w.ACT.otpravitZapros(e.draftId); }, null);
      if (!id) { return; }
      var n = sdelano(shagiA(id), 'A', id, {});
      if (n >= bestN) { best = id; bestN = n; }
    });
    return best;
  }
  /* «Не подходит» возвращает рецептуру в работу: ходы после неё считаются заново. */
  function otkazA(j, id) { return posledniy(j, 'reshenieObrazets', function (e) { return e.produktId === id && !e.podhodit; }); }
  function hodA(t, id, ostalnye) {
    if (!id) { return function () { return false; }; }
    return function (c) {
      return est(c.journal, t, poObektu('produktId', id), ostalnye ? otkazA(c.journal, id) : 0);
    };
  }

  function shagiA(id) {
    var prod = function (hash) { return id ? 'produkt.html?id=' + enc(id) + (hash || '') : 'ochered.html'; };
    return [
      { kto: U_TEH, href: 'sayt-ffs.html', vid: function (z) { return z.file === 'sayt-ffs.html'; },
        text: 'Откройте страницу товара на сайте и нажмите «Запросить расчёт и образец». После входа в кабинет откроется форма запроса.' },
      { kto: U_TEH, href: 'zapros-novyy.html?tip=ffs-meshki', hod: function (c) { return zaprosyA(c.journal).length > 0; },
        text: 'В форме уже выбран продукт FFS-мешки. Нажмите «Заполнить демо-данными», затем «Отправить запрос».' },
      { kto: MEN, href: 'ochered.html', vid: function (z) { return z.file === 'ochered.html' && tot(z, MEN); },
        text: 'Откройте раздел «Очередь». Новый запрос технолога появился в списке.' },
      { kto: MEN, href: prod(), hod: hodA('otpravitRaschet', id),
        text: 'Откройте запрос и нажмите «Отправить расчёт». Заказчик получит документ «Расчёт» с параметрами запроса, цены в нём нет.' },
      { kto: MEN, href: prod(), hod: hodA('retsepturaPodobrana', id, true),
        text: 'Нажмите «Рецептура подобрана». В истории шаг подписан «Лаборатория».' },
      { kto: MEN, href: prod(), hod: hodA('obraztsyOtpravleny', id, true),
        text: 'Нажмите «Заполнить демо-данными», затем «Образцы отправлены». В истории шаг подписан «Лаборатория», в нём количество образцов и способ отправки.' },
      { kto: U_TEH, href: prod(), hod: hodA('nachatIspytaniya', id, true),
        text: 'Нажмите «Начать испытания», когда образцы будут на линии.' },
      { kto: U_TEH, href: prod(), hod: hodA('prilozhitProtokol', id, true),
        text: 'Нажмите «Приложить демо-протокол». Протокол испытаний появится в документах продукта.' },
      { kto: U_TEH, href: prod(), hod: hodA('reshenieObrazets', id, true),
        text: 'Нажмите «Подходит», и продукт перейдёт на этап «Одобрен». Для ответа «Не подходит» нужно указать причину, тогда рецептура вернётся в работу.' }
    ];
  }
  function finalA() {
    var id = produktA();
    return { kto: U_TEH, href: id ? 'produkt.html?id=' + enc(id) + '#istoriya' : 'produkty.html',
      text: 'Образец одобрен. В истории продукта записано, кто, что и когда сделал, начиная с запроса.' };
  }

  /* --- Б. Где мой заказ: заказ 120 т FFS-мешков у завода удобрений и окно
     самовывоза у цементного завода. */
  function shagiB() {
    var zak = 'zakaz.html?id=';
    return [
      { kto: U_ZAK, href: zak + Z_U4, vid: function (z) { return z.file === 'zakaz.html' && z.id === Z_U4 && tot(z, U_ZAK); },
        text: 'Откройте заказ на 120 т FFS-мешков. На ленте восемь этапов, заказ на этапе «В пути». В блоке «Отгрузки» указаны два вагона с номерами, станцией назначения и ожидаемой датой прибытия.' },
      { kto: U_ZAK, href: zak + Z_U4 + '#partii',
        vid: function (z) {
          var d = dokumentIzHasha(z);
          var dok = d ? safe(function () { return w.DATA.dokument(d); }, null) : null;
          return z.file === 'zakaz.html' && z.id === Z_U4 && tot(z, U_ZAK) && !!dok && dok.tip === 'pasport';
        },
        text: 'В блоке «Партии и паспорта качества» откройте паспорт партии кнопкой «Паспорт качества». В паспорте указан номер партии. Кнопка «Скачать» открывает печатную форму листа.' },
      { kto: U_ZAK, href: zak + Z_U4, hod: function (c) { return est(c.journal, 'polucheno', poObektu('zakazId', Z_U4)); },
        text: 'Нажмите «Получено». Заказ перейдёт на этап «Получено», обе партии и оба вагона будут отмечены как полученные.' },
      { kto: C_ZAK, href: zak + Z_C2, vid: function (z) { return z.file === 'zakaz.html' && z.id === Z_C2 && tot(z, C_ZAK); },
        text: 'Откройте заказ цементного завода. В блоке «Отгрузки» вместо вагона указано окно самовывоза с датой, временем, площадкой КЗПМ и воротами.' }
    ];
  }
  function finalB() {
    return { kto: C_ZAK, href: 'zakaz.html?id=' + Z_C2,
      text: 'Каждый заказчик видит этап своего заказа и способ получения груза, вагоном или самовывозом. Паспорт качества партии открывается в карточке заказа.' };
  }

  /* --- В. Макет печати: продукт завода удобрений с печатью, образец одобрен,
     версия 1 с тремя замечаниями и ответами, версия 2 ждёт заказчика. */
  function shagiV() {
    var h = 'produkt.html?id=' + P_NPK + '#maket';
    var svoe = poObektu('produktId', P_NPK);
    function soglasovano(c) { return est(c.journal, 'soglasovatMaket', svoe); }
    /* Номер версии на кнопке «Согласовать версию N»: текущая версия макета. Заказчика,
       которому продукт не виден, подсказка считает от двух версий в исходных данных. */
    var c0 = ctx();
    var p0 = safe(function () { return c0.DATA.produkt(P_NPK); }, null);
    var nomer = p0 && p0.maket && p0.maket.tekushchaya ? p0.maket.tekushchaya :
      2 + c0.journal.filter(function (e) { return e.t === 'zagruzitMaket' && svoe(e); }).length;
    return [
      { kto: U_ZAK, href: h, vid: function (z) { return z.file === 'produkt.html' && z.id === P_NPK && tot(z, U_ZAK); },
        text: 'Откройте карточку продукта, раздел «Макет печати». У версии 1 три замечания и ответы КЗПМ, версия 2 ждёт согласования.' },
      { kto: U_ZAK, href: h, mozhnoPropustit: true, hod: function (c) { return est(c.journal, 'zamechanieKMaketu', svoe); },
        text: 'Нажмите «Заполнить демо-данными», и на рисунке появится метка, а в форме текст замечания. Затем нажмите «Отправить замечание».' },
      { kto: MEN, href: h, mozhnoPropustit: true, hod: function (c) { return est(c.journal, 'otvetitNaZamechanie', svoe); },
        text: 'Нажмите «Принято в следующую версию» под новым замечанием.' },
      { kto: MEN, href: h, mozhnoPropustit: true, hod: function (c) { return est(c.journal, 'zagruzitMaket', svoe); },
        text: 'Нажмите «Загрузить следующую версию». Заказчик получит её на согласование, а принятое замечание будет отмечено в ней как исправленное.' },
      { kto: U_ZAK, href: h, hod: soglasovano,
        text: 'Нажмите «Согласовать версию ' + nomer + '». Макет получит отметку «Согласовано» с датой и автором.' }
    ];
  }
  function finalV() {
    return { kto: U_ZAK, href: 'produkt.html?id=' + P_NPK,
      text: 'Макет согласован. В карточке продукта появилась кнопка «Оформить заявку».' };
  }

  /* --- Г. Отгрузки по договору: договор завода удобрений. Ходов нет, сценарий
     показывает график, документы отгрузки и то же в сводке директора. */
  function shagiG() {
    var h = 'otgruzki.html?dogovor=' + DG_U;
    function stranica(z) { return z.file === 'otgruzki.html' && (!z.dogovor || z.dogovor === DG_U) && tot(z, U_ZAK); }
    return [
      { kto: U_ZAK, href: h, vid: stranica,
        text: 'Откройте раздел «Отгрузки». График охватывает 13 недель вокруг текущей. По каждой неделе видны план, отгружено, в пути и запланировано, внизу итог квартала в тоннах.' },
      { kto: U_ZAK, href: h + '#grafik', vid: function (z) { return stranica(z) && !!dokumentIzHasha(z); },
        text: 'Ниже у каждой отправленной отгрузки есть УПД, транспортная накладная и паспорт качества. Откройте любой из этих документов по ссылке. Цен в документах нет.' },
      { kto: DIR, href: 'svodka.html', vid: function (z) { return z.file === 'svodka.html' && tot(z, DIR); },
        text: 'Откройте раздел «Сводка». В блоке «Отгрузки» указаны план и факт квартала в тоннах по тому же договору.' }
    ];
  }
  function finalG() {
    return { kto: U_ZAK, href: 'otgruzki.html?dogovor=' + DG_U,
      text: 'График и документы каждой отгрузки собраны на одном экране, руководитель видит те же тонны в сводке.' };
  }

  /* --- Д. Претензия по партии: подаёт технолог завода удобрений, разбирает
     служба сервиса. Претензия сценария — подана предприятием технолога; из
     нескольких берём ту, что продвинулась дальше. */
  function podachiD(j) {
    var ent = (chelovek(U_TEH) || {}).zakazchikId;
    return j.filter(function (e) { return e.t === 'otpravitPretenziyu' && !!ent && e.zakazchikId === ent; });
  }
  function pretenziyaD() {
    var best = null, bestN = -1;
    podachiD(zhurnal()).forEach(function (e) {
      var id = safe(function () { return w.ACT.otpravitPretenziyu(e.draftId); }, null);
      if (!id) { return; }
      var n = sdelano(shagiD(id), 'D', id, {});
      if (n >= bestN) { best = id; bestN = n; }
    });
    return best;
  }
  function hodD(t, id) {
    if (!id) { return function () { return false; }; }
    return function (c) { return est(c.journal, t, poObektu('pretenziyaId', id)); };
  }
  function shagiD(id) {
    var karta = id ? 'pretenziya.html?id=' + enc(id) : 'pretenzii.html';
    return [
      { kto: U_TEH, href: 'pretenzii.html', hod: function (c) { return podachiD(c.journal).length > 0; },
        text: 'Откройте раздел «Претензии» и нажмите «Новая претензия». В форме нажмите «Заполнить демо-данными», и подставятся полученная партия, вид проблемы, описание и демо-фото. Затем нажмите «Отправить претензию».' },
      { kto: SER, href: 'pretenzii.html', vid: function (z) { return z.file === 'pretenzii.html' && tot(z, SER); },
        text: 'Откройте раздел «Претензии». Новая претензия первая в списке, у неё указан номер партии.' },
      { kto: SER, href: karta, hod: hodD('vzyatPretenziyu', id),
        text: 'Откройте претензию и нажмите «Взять в работу». Заказчик увидит, что претензию разбирают.' },
      { kto: SER, href: karta, mozhnoPropustit: true, hod: hodD('otvetitNaPretenziyu', id),
        text: 'В блоке «Ответ заказчику» нажмите «Заполнить демо-данными», затем «Ответить». Заказчик увидит ответ в карточке претензии.' },
      { kto: SER, href: karta, mozhnoPropustit: true, hod: hodD('zaprositObraztsy', id),
        text: 'При необходимости нажмите «Запросить образцы», и заказчик увидит запрос образцов из партии.' },
      { kto: SER, href: karta, hod: hodD('zakrytPretenziyu', id),
        text: 'В блоке «Решение по претензии» нажмите «Заполнить демо-данными», затем «Закрыть претензию».' },
      { kto: U_TEH, href: karta, vid: function (z) { return z.file === 'pretenziya.html' && !!id && z.id === id && tot(z, U_TEH); },
        text: 'Откройте претензию. В ней видны ответы службы сервиса и решение, а все шаги записаны в историю карточки.' }
    ];
  }
  function finalD() {
    var id = pretenziyaD();
    return { kto: U_TEH, href: id ? 'pretenziya.html?id=' + enc(id) + '#istoriya' : 'pretenzii.html',
      text: 'Заказчик подал претензию по номеру партии, служба сервиса ответила и записала решение.' };
  }

  var SPISOK = [
    { id: 'A', title: 'А. Новый продукт от запроса до одобренного образца', voprosy: [],
      shagi: function () { return shagiA(produktA()); }, klyuch: function () { return produktA() || ''; }, final: finalA },
    { id: 'B', title: 'Б. Где мой заказ', voprosy: ['На партию выдаётся паспорт качества с номером партии?'],
      shagi: shagiB, klyuch: function () { return Z_U4; }, final: finalB },
    { id: 'V', title: 'В. Макет печати', voprosy: ['Макет печати вы согласуете с заказчиком отдельным кругом?'],
      shagi: shagiV, klyuch: function () { return P_NPK; }, final: finalV },
    { id: 'G', title: 'Г. Отгрузки по договору', voprosy: ['Крупные заказчики работают по рамочному договору с графиком отгрузок?'],
      shagi: shagiG, klyuch: function () { return DG_U; }, final: finalG },
    { id: 'D', title: 'Д. Претензия по партии', voprosy: ['Претензии разбираете по номеру партии?'],
      shagi: function () { return shagiD(pretenziyaD()); }, klyuch: function () { return pretenziyaD() || ''; }, final: finalD }
  ];

  /* Вопрос ко всем сценариям: он про то, где сейчас лежат данные клиента. */
  var OBSHCHIE = ['Что из этого сейчас лежит в 1С: заказы, отгрузки, паспорта?'];
  /* Для ведущего: что в кабинет не вошло. На любой вопрос об этом отвечает одна фраза. */
  var POSLE = {
    title: 'После обследования',
    spisok: [
      'В кабинет не вошли интеграции, цены, оплата, чат, уведомления, английский язык, мобильная версия, переход на ERP и вопросы заказчиков вне претензий.',
      'На вопрос о любом из них ведущий отвечает одной фразой: «после обследования».'
    ]
  };

  function scenarij(id) {
    for (var i = 0; i < SPISOK.length; i++) { if (SPISOK[i].id === id) { return SPISOK[i]; } }
    return null;
  }

  function sborka(s) {
    return { shagi: safe(function () { return s.shagi(); }, []), klyuch: s.klyuch ? safe(function () { return s.klyuch(); }, '') : '' };
  }

  /* Сколько шагов подряд пройдено. Ход — по журналу. Просмотр — по отметке
     «видел» или если пройден любой ход после него. */
  function sdelano(shagi, sc, klyuch, seen) {
    var c = ctx();
    function hod(x) { return !!safe(function () { return x.hod(c); }, false); }
    for (var i = 0; i < shagi.length; i++) {
      var s = shagi[i];
      if (s.hod && !s.mozhnoPropustit) { if (!hod(s)) { return i; } continue; }
      if (s.hod ? hod(s) : seen[sc + (i + 1) + ':' + klyuch]) { continue; }
      var dalshe = shagi.slice(i + 1).some(function (x) { return x.hod && hod(x); });
      if (!dalshe) { return i; }
    }
    return shagi.length;
  }

  function vybran() {
    var sc = state().scenario;
    return scenarij(sc) ? sc : SPISOK[0].id;
  }

  /* Разбор сценария: шаги с признаком «пройден / сейчас / впереди». */
  function razbor(id) {
    var s = scenarij(id) || SPISOK[0];
    var b = sborka(s), seen = state().seen || {};
    var n = sdelano(b.shagi, s.id, b.klyuch, seen), total = b.shagi.length;
    var gotovo = n >= total;
    var shag = gotovo ? (s.final ? safe(function () { return s.final(); }, null) : null) || b.shagi[total - 1] : b.shagi[n];
    return { s: s, shagi: b.shagi, n: n, total: total, gotovo: gotovo, shag: shag || null };
  }

  function sostoyanie(id) {
    var r = razbor(id);
    if (!r.shag) { return null; }
    var shag = r.shag, p = chelovek(shag.kto);
    var href = shag.href || 'index.html';
    var q = p ? 'role=' + p.side + '&person=' + enc(p.id) : '';
    var i = href.indexOf('#'), hash = i > -1 ? href.slice(i) : '', base = i > -1 ? href.slice(0, i) : href;
    return {
      scenario: r.s.id, title: r.s.title, step: r.gotovo ? r.total : r.n + 1, total: r.total, text: shag.text || '',
      kto: kogo(p), role: p ? p.side : null, person: p ? p.id : null,
      href: q ? base + (base.indexOf('?') > -1 ? '&' : '?') + q + hash : href,
      gotovo: r.gotovo
    };
  }

  /* Отметка «видел»: текущий шаг-просмотр каждого сценария, если страница его.
     Возвращает, поставила ли новую отметку. */
  function zametit() {
    var z = zdes(), st = state(), seen = st.seen || {}, changed = false;
    SPISOK.forEach(function (sc) {
      for (var guard = 0; guard < 20; guard++) {
        var b = sborka(sc), n = sdelano(b.shagi, sc.id, b.klyuch, seen), s = b.shagi[n];
        if (!s || !s.vid || !safe(function () { return s.vid(z); }, false)) { return; }
        seen[sc.id + (n + 1) + ':' + b.klyuch] = true;
        changed = true;
      }
    });
    if (changed) { st.seen = seen; save(st); }
    return changed;
  }
  /* После щелчка или смены адреса: отметка и, если панель открыта, свежая подсказка. */
  function zametitIObnovit() {
    if (safe(function () { return zametit(); }, false) && w.Shell && w.Shell.refresh) { w.Shell.refresh(); }
  }

  /* --- блоки панели ---------------------------------------------------------- */
  function spisokHtml(list, attr) {
    return '<ul class="proto-voprosy"' + (attr || '') + '>' + list.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>';
  }
  /* Подпись под названием сценария: у начатого — на каком он шаге, у законченного — «Пройден». */
  function podpisProgress(r) {
    return r.gotovo ? 'Пройден' : r.n === 0 ? '' : 'Шаг ' + (r.n + 1) + ' из ' + r.total;
  }
  function knopkaGo(r) {
    var tekst = r.gotovo ? 'Открыть итог' : r.n === 0 ? 'Начать сценарий' : 'Перейти к шагу ' + (r.n + 1);
    return '<button class="btn btn--primary btn--sm" type="button" data-act="tur-go" data-id="' + esc(r.s.id) + '">' + esc(tekst) + '</button>';
  }
  function shagiHtml(r) {
    return '<ol class="proto-voprosy" data-shagi>' + r.shagi.map(function (s, i) {
      var p = chelovek(s.kto), sost = i < r.n ? 'done' : (i === r.n && !r.gotovo ? 'current' : 'plan');
      var kto = '<span class="strong">' + esc(kogo(p)) + '.</span> ';
      /* Пройденный шаг — одна строка: кто, без текста. */
      if (sost === 'done') {
        return '<li class="muted" data-step="' + (i + 1) + '" data-state="done"><span class="badge badge--done">Пройден</span> ' + esc(kogoKratko(p)) + '</li>';
      }
      if (sost === 'current') {
        return '<li data-step="' + (i + 1) + '" data-state="current" aria-current="step"><div class="proto-step">' +
          '<p class="label">Шаг ' + (i + 1) + ' из ' + r.total + '</p><p>' + kto + esc(s.text) + '</p>' + knopkaGo(r) + '</div></li>';
      }
      return '<li data-step="' + (i + 1) + '" data-state="plan">' + kto + esc(s.text) + '</li>';
    }).join('') + '</ol>';
  }
  function itogHtml(r) {
    if (!r.gotovo || !r.shag) { return ''; }
    return '<div class="proto-step" data-itog aria-current="step"><p class="label">Сценарий пройден</p><p>' + esc(r.shag.text) + '</p>' +
      '<p class="muted">Чтобы показать сценарий снова, нажмите «Сбросить демо».</p>' + knopkaGo(r) + '</div>';
  }
  function panel() {
    var cur = vybran(), r = razbor(cur), html;
    html = '<div class="proto-panel__group" data-block="tur"><p class="label">Сценарии</p>' +
      '<div class="proto-scen">' + SPISOK.map(function (x) {
        var on = x.id === cur, rr = on ? r : razbor(x.id);
        return '<button class="proto-opt' + (on ? ' is-active' : '') + '" type="button" data-act="tur-pick" data-id="' + esc(x.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="proto-opt__title">' + esc(x.title) + '</span>' +
          (podpisProgress(rr) ? '<span class="proto-opt__sub">' + esc(podpisProgress(rr)) + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      '<p class="label proto-sub">Шаги</p>' + shagiHtml(r) + itogHtml(r) +
      (r.s.voprosy.length ? '<p class="label proto-sub">Вопросы к клиенту</p>' + spisokHtml(r.s.voprosy, ' data-voprosy') : '') +
      '</div>';
    html += '<div class="proto-panel__group" data-block="obshchiy"><p class="label">Вопрос ко всем сценариям</p>' + spisokHtml(OBSHCHIE, ' data-voprosy') + '</div>';
    html += '<div class="proto-panel__group" data-block="posle"><p class="label">' + esc(POSLE.title) + '</p>' + spisokHtml(POSLE.spisok) + '</div>';
    return html;
  }

  var Tur = {
    list: function () { return SPISOK.map(function (s) { return { id: s.id, title: s.title, voprosy: s.voprosy.slice() }; }); },
    current: function () { return sostoyanie(vybran()); },
    /** Выбрать сценарий и открыть его текущий шаг: роль и человек меняются здесь же. */
    go: function (id) {
      if (!scenarij(id)) { return null; }
      var st = state();
      st.scenario = id;
      save(st);
      var cur = sostoyanie(id);
      if (!cur) { return null; }
      if (cur.role) { w.Store.setRole(cur.role); w.Store.setPerson(cur.person); }
      w.Shell.navigate(cur.href);
      return cur;
    },
    panel: panel
  };

  if (w.Shell && w.Shell.on) {
    w.Shell.on('tur-go', function (t) { Tur.go(t.getAttribute('data-id')); });
    /* Выбор сценария показывает его шаги и вопросы, страницу не меняет. */
    w.Shell.on('tur-pick', function (t) {
      var id = t.getAttribute('data-id');
      if (!scenarij(id)) { return; }
      var st = state();
      st.scenario = id;
      save(st);
      /* панель рисуется заново: прокрутку держим там, где была, чтобы список сценариев не уехал */
      var p = document.getElementById('proto-panel'), top = p ? p.scrollTop : 0;
      w.Shell.refresh();
      p = document.getElementById('proto-panel');
      if (p) { p.scrollTop = top; }
    });
  }
  safe(function () { zametit(); return true; }, false);
  /* Окно документа открывается без перезагрузки и без события адреса: смотрим после щелчка.
     Панель, открытая кнопкой или перерисованная после хода, сама показывает текущий шаг (Shell). */
  document.addEventListener('click', function () { setTimeout(zametitIObnovit, 80); });
  w.addEventListener('hashchange', zametitIObnovit);
  /* «Перейти» на ход из панели может открыть страницу с раскрытой панелью: &panel=1. */
  function panelPoAdresu() {
    if (safe(function () { return w.Render.param('panel'); }, '') === '1' && w.Shell && document.querySelector('.proto-dock')) {
      w.Shell.panel(true);
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', panelPoAdresu); } else { setTimeout(panelPoAdresu, 0); }

  w.Tur = Tur;
})(window);

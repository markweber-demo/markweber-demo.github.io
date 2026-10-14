/* Исходные демо-данные кабинета. Неизменны: всё, что меняется на показе,
   пишется в журнал действий (store.js) и проигрывается поверх в dannye.js.
   Читает этот файл только dannye.js.

   Даты — смещения от дня показа, строкой:
     «@-30» — 30 дней назад, «@+14» — через 14 дней, «@-8m» — 8 месяцев назад;
     «@w-6+1» — вторник недели, что на шесть недель раньше текущей
       (понедельник текущей недели плюс 7 × N дней плюс D дней);
     через пробел можно дописать время: «@-3 10:40», «@w0 06:00».
   Даты без времени dannye.js превращает в ISO «YYYY-MM-DD», со временем —
   в ISO-время события.

   Завод, его продукция, отрасли, площадки и услуги — дословно с сайта
   (заметки «notes-sayt.md», §5). Сотрудники завода без имён: имя персоны и
   есть её должность. Заказчики, их люди, номера заказов, партий, вагонов,
   договоров и документов выдуманы. Цен и сумм нет. Названия заказчиков и
   их людей можно заменить здесь же, в одном месте. */
(function (w) {
  'use strict';

  /* ---------- помощники сборки (данные на выходе, не логика) ---------- */

  function sgn(n) { return (n < 0 ? '' : '+') + n; }
  /** День: off(-30) → «@-30». */
  function off(n) { return '@' + sgn(n); }
  /** День и время события: t(-30, '10:15') → «@-30 10:15». */
  function t(n, hm) { return off(n) + ' ' + hm; }
  /** Неделя: wk(-6, 1) → вторник недели −6; с временем — для событий. */
  function wk(n, d, hm) { return '@w' + sgn(n) + '+' + (d || 0) + (hm ? ' ' + hm : ''); }
  /** Событие карточки: { t, data, kto, …поля }. */
  function s(tip, data, kto, extra) {
    var e = { t: tip, data: data, kto: kto };
    for (var k in extra || {}) { e[k] = extra[k]; }
    return e;
  }

  /* ---------- завод: дословно с сайта ---------- */

  var zavod = {
    name: 'ООО «КЗПМ»',
    polnoe: 'Камский завод полимерных материалов',
    sayt: 'kzpm.com',
    /* Контакты головного офиса с сайта — для листов документов. */
    kontakty: { priemnaya: '+7 (8555) 244-111', pochta: 'mail@kzpm.com', adres: 'г. Нижнекамск, ул. Заводская, д. 48Б' },
    ploshchadki: [
      { id: 'nizhnekamsk', title: 'Головной офис', gorod: 'Нижнекамск', adres: 'г. Нижнекамск, ул. Заводская, д. 48Б' },
      { id: 'kazan', title: 'Производственная площадка', gorod: 'Казань', adres: 'г. Казань, ул. Химическая, д. 16, а/я 64' },
      { id: 'tobolsk', title: 'Производственная площадка', gorod: 'Тобольск', adres: 'г. Тобольск, Восточный промышленный район, 8-й квартал, участок № 2А' }
    ],
    /* Услуги: на сайте три карточки без описаний. text — дословная фраза
       сайта к той же услуге: опция товара, «О компании», описание товара. */
    uslugi: [
      { id: 'pechat', title: 'Цветная печать', text: 'Нанесение многоцветной широкоформатной печати' },
      { id: 'laboratoriya', title: 'Лабораторные исследования и разработки', text: 'Предприятие оснащено самым современным технологическим и лабораторным оборудованием' },
      { id: 'laminirovanie', title: 'Ламинирование', text: 'Ламинированная пленка – пленки со средним или высоким барьером для защиты от повреждений и продления срока службы продукта.' }
    ],
    /* Отрасли раздела «Полимерные пленки» — пилюли каталога, дословно,
       включая написание сайта «Металообработка». */
    otrasli: [
      'Химия и нефтехимия', 'Строительство', 'Цемент и сухие строительные смеси', 'Удобрения и торфогрунт',
      'Агросектор', 'Пищевая промышленность', 'Бытовая техника', 'Металообработка', 'Деревообработка',
      'Шинная промышленность'
    ],
    /* Каталог формы запроса: группы и названия сайта (title, gruppa) и наши
       подписи для экранов (kratko, edinichnoe). lenta — набор этапов заказа
       из спецификации, pechat — бывает ли у продукта печать. */
    katalog: [
      { tip: 'ffs-meshki', title: 'ФФС (FFS) мешки (мешки полиэтиленовые)', gruppa: 'Полимерные пленки', kratko: 'FFS-мешки', edinichnoe: 'FFS-мешок', lenta: 'ffs', kompaund: false },
      { tip: 'ffs-plenka', title: 'ФФС (FFS) пленка (полотно, рукав)', gruppa: 'Полимерные пленки', kratko: 'FFS-плёнка', edinichnoe: 'FFS-плёнка', lenta: 'ffs', kompaund: false },
      { tip: 'stretch-hood', title: 'Стрейч-худ (Stretch hood) пленка', gruppa: 'Полимерные пленки', kratko: 'Стрейч-худ', edinichnoe: 'Стрейч-худ', lenta: 'plenka', kompaund: false },
      { tip: 'termousadka', title: 'Термоусадочная пленка', gruppa: 'Полимерные пленки', kratko: 'Термоусадочная плёнка', edinichnoe: 'Термоусадочная плёнка', lenta: 'plenka', kompaund: false },
      { tip: 'kolpaki', title: 'Укрывные колпаки (чехлы)', gruppa: 'Полимерные пленки', kratko: 'Укрывные колпаки', edinichnoe: 'Укрывной колпак', lenta: 'plenka', kompaund: false },
      { tip: 'laminirovannye', title: 'Ламинированные пленки', gruppa: 'Полимерные пленки', kratko: 'Ламинированные плёнки', edinichnoe: 'Ламинированная плёнка', lenta: 'laminat', kompaund: false },
      { tip: 'carbolen', title: 'CARBOLEN', gruppa: 'Компаунды', kratko: 'CARBOLEN', edinichnoe: 'Компаунд CARBOLEN', lenta: 'kompaund', kompaund: true },
      { tip: 'kamlen', title: 'KAMLEN®', gruppa: 'Компаунды', kratko: 'KAMLEN', edinichnoe: 'Компаунд KAMLEN', lenta: 'kompaund', kompaund: true }
    ]
  };

  /* ---------- люди ----------
     key — то, по чему вход, панель и стенды находят персону. У каждого
     заказчика свои закупщик и технолог; сотрудники КЗПМ — одни на всех,
     без имён: name — должность. home — главная после входа; у лаборатории
     её нет: она не входит, а только подписывает свои ходы. */

  var U_Z = 'u-zakupshchik', U_T = 'u-tehnolog';
  var C_Z = 'c-zakupshchik', C_T = 'c-tehnolog';
  var P_Z = 'p-zakupshchik', P_T = 'p-tehnolog';
  var MEN = 'kzpm-menedzher', SER = 'kzpm-servis', DIR = 'kzpm-direktor', LAB = 'kzpm-laboratoriya';

  var lyudi = [
    { id: U_Z, key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'udobreniya', name: 'Ирина Котова', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: U_T, key: 'tehnolog', side: 'zakazchik', zakazchikId: 'udobreniya', name: 'Артём Белов', position: 'Технолог фасовки', home: 'kabinet.html' },
    { id: C_Z, key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'tsement', name: 'Сергей Лапин', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: C_T, key: 'tehnolog', side: 'zakazchik', zakazchikId: 'tsement', name: 'Наталья Гордеева', position: 'Технолог фасовки', home: 'kabinet.html' },
    { id: P_Z, key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'polimery', name: 'Олег Тарасов', position: 'Специалист по закупкам', home: 'kabinet.html' },
    /* У переработчика полимеров фасовки нет: технолог отвечает за экструзию. */
    { id: P_T, key: 'tehnolog', side: 'zakazchik', zakazchikId: 'polimery', name: 'Марина Сорокина', position: 'Технолог экструзии', home: 'kabinet.html' },
    { id: DIR, key: 'direktor', side: 'zavod', name: 'Генеральный директор', position: 'КЗПМ', home: 'svodka.html' },
    { id: MEN, key: 'menedzher', side: 'zavod', name: 'Менеджер по продажам', position: 'КЗПМ', home: 'ochered.html' },
    { id: SER, key: 'servis', side: 'zavod', name: 'Служба сервиса', position: 'КЗПМ', home: 'pretenzii.html' },
    { id: LAB, key: 'laboratoriya', side: 'zavod', name: 'Лаборатория', position: 'КЗПМ', home: null },
    /* Люди фоновых заказчиков (раздел «Фон» ниже): в панели ведущего и на входе их нет. */
    { id: 'h-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'svetlodol', name: 'Андрей Мельников', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'h-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'svetlodol', name: 'Елена Сафронова', position: 'Технолог фасовки', home: 'kabinet.html' },
    { id: 'a-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'kremnegorsk', name: 'Виктор Гусев', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'a-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'kremnegorsk', name: 'Светлана Жукова', position: 'Технолог фасовки', home: 'kabinet.html' },
    { id: 'k-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'kamenorechye', name: 'Павел Зуев', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'k-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'kamenorechye', name: 'Ольга Дьячкова', position: 'Технолог фасовки', home: 'kabinet.html' },
    { id: 'm-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'yasnobor', name: 'Юлия Лебедева', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'm-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'yasnobor', name: 'Денис Карпов', position: 'Технолог упаковки', home: 'kabinet.html' },
    { id: 'r-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'rzhanye', name: 'Николай Фомин', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'r-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'rzhanye', name: 'Анна Белякова', position: 'Технолог хранения', home: 'kabinet.html' },
    { id: 's-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'starobor', name: 'Игорь Савин', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 's-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'starobor', name: 'Ксения Ефимова', position: 'Технолог упаковки', home: 'kabinet.html' },
    { id: 'v-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'vetrogorsk', name: 'Роман Ильин', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'v-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'vetrogorsk', name: 'Дарья Комарова', position: 'Технолог упаковки', home: 'kabinet.html' },
    { id: 'd-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'kedrobor', name: 'Михаил Широков', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'd-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'kedrobor', name: 'Людмила Голубева', position: 'Технолог склада', home: 'kabinet.html' },
    { id: 'l-zakupshchik', key: 'zakupshchik', side: 'zakazchik', zakazchikId: 'listvensk', name: 'Константин Рябов', position: 'Специалист по закупкам', home: 'kabinet.html' },
    { id: 'l-tehnolog', key: 'tehnolog', side: 'zakazchik', zakazchikId: 'listvensk', name: 'Вера Миронова', position: 'Технолог экструзии', home: 'kabinet.html' }
  ];

  /* ---------- заказчики: выдуманные, отрасли — с сайта ---------- */

  var zakazchiki = [
    { id: 'udobreniya', name: 'АО «Синеборский завод удобрений»', kratko: 'Синеборский завод удобрений', otrasl: 'Удобрения и торфогрунт', gorod: 'Синебор', stantsiya: 'Синебор', dogovorId: 'dg-u' },
    { id: 'tsement', name: 'АО «Тихореченский цемент»', kratko: 'Тихореченский цемент', otrasl: 'Цемент и сухие строительные смеси', gorod: 'Тихореченск', stantsiya: 'Тихореченск', dogovorId: null },
    { id: 'polimery', name: 'ООО «Новолесский завод полимерных изделий»', kratko: 'Новолесский завод полимерных изделий', otrasl: 'Химия и нефтехимия', gorod: 'Новолесск', stantsiya: 'Новолесск', dogovorId: null },
    /* Фон: остальные заказчики первой волны подключения (раздел «Фон» ниже).
       fon — заказчик не из сценариев: в панели ведущего и на входе его людей нет. */
    { id: 'svetlodol', fon: true, name: 'АО «Светлодольский химический комбинат»', kratko: 'Светлодольский химический комбинат', otrasl: 'Химия и нефтехимия', gorod: 'Светлодольск', stantsiya: 'Светлодольск', dogovorId: 'dg-h' },
    { id: 'kremnegorsk', fon: true, name: 'АО «Кремнегорский завод азотных удобрений»', kratko: 'Кремнегорский завод азотных удобрений', otrasl: 'Удобрения и торфогрунт', gorod: 'Кремнегорск', stantsiya: 'Кремнегорск', dogovorId: 'dg-a' },
    { id: 'kamenorechye', fon: true, name: 'ООО «Каменореченский завод сухих смесей»', kratko: 'Каменореченский завод сухих смесей', otrasl: 'Цемент и сухие строительные смеси', gorod: 'Каменоречье', stantsiya: 'Каменоречье', dogovorId: 'dg-k' },
    { id: 'yasnobor', fon: true, name: 'АО «Ясноборский молочный комбинат»', kratko: 'Ясноборский молочный комбинат', otrasl: 'Пищевая промышленность', gorod: 'Ясноборск', stantsiya: 'Ясноборск', dogovorId: null },
    { id: 'rzhanye', fon: true, name: 'ООО «Ржаные Ключи»', kratko: 'Агрофирма «Ржаные Ключи»', otrasl: 'Агросектор', gorod: 'Ржаные Ключи', stantsiya: 'Ржаные Ключи', dogovorId: null },
    { id: 'starobor', fon: true, name: 'ООО «Староборский завод теплоизоляции»', kratko: 'Староборский завод теплоизоляции', otrasl: 'Строительство', gorod: 'Старобор', stantsiya: 'Старобор', dogovorId: null },
    { id: 'vetrogorsk', fon: true, name: 'АО «Ветрогорский завод бытовой техники»', kratko: 'Ветрогорский завод бытовой техники', otrasl: 'Бытовая техника', gorod: 'Ветрогорск', stantsiya: 'Ветрогорск', dogovorId: null },
    { id: 'kedrobor', fon: true, name: 'АО «Кедроборский лесокомбинат»', kratko: 'Кедроборский лесокомбинат', otrasl: 'Деревообработка', gorod: 'Кедробор', stantsiya: 'Кедробор', dogovorId: null },
    { id: 'listvensk', fon: true, name: 'ООО «Лиственский завод упаковочных плёнок»', kratko: 'Лиственский завод упаковочных плёнок', otrasl: 'Химия и нефтехимия', gorod: 'Лиственск', stantsiya: 'Лиственск', dogovorId: null }
  ];

  /* ---------- продукты ----------
     Этап отработки не хранится: его выводит dannye.js из событий.
     maket — только у продуктов с печатью. risunok — описание рисунка для
     Maket.risunok: надпись завода, продукт, масса, крупное ли название,
     крупная ли масса, манипуляционные знаки (verh — «Верх», vlaga — «Беречь от влаги»,
     ne-brosat — «Не бросать»). ispravleno — номера замечаний прошлой
     версии, исправленных в этой. x, y замечания — в процентах рисунка. */

  var RIS_U1 = { nadpis: 'Синеборский завод удобрений', produkt: 'Аммиачная селитра', massa: '50 кг', krupnoeNazvanie: false, krupnayaMassa: true, znaki: ['verh', 'vlaga'] };
  var RIS_N1 = { nadpis: 'Синеборский завод удобрений', produkt: 'Нитроаммофоска', massa: '50 кг', krupnoeNazvanie: false, krupnayaMassa: false, znaki: ['verh', 'ne-brosat'] };
  var RIS_N2 = { nadpis: 'Синеборский завод удобрений', produkt: 'Нитроаммофоска', massa: '50 кг', krupnoeNazvanie: false, krupnayaMassa: true, znaki: ['verh', 'ne-brosat', 'vlaga'] };
  var RIS_C1 = { nadpis: 'Тихореченский цемент', produkt: 'Портландцемент', massa: '50 кг', krupnoeNazvanie: false, krupnayaMassa: true, znaki: ['vlaga'] };

  var produkty = [
    {
      /* В поставке: макет согласован раньше первого заказа, паспорта партий
         ссылаются на согласованную версию. */
      id: 'p-u-ffs', zakazchikId: 'udobreniya', tip: 'ffs-meshki', nazvanie: 'FFS-мешок 50 кг под аммиачную селитру',
      parametry: { produktFasovki: 'Аммиачная селитра', vesFasovki: 50, razmery: '550 × 1000 мм, фальц 90 мм', tolshchina: 180,
        pechat: 'tsvetnaya', tsvetov: 2, laminirovanie: false, obemGod: 1500, kommentariy: '' },
      sobytiya: [
        s('zapros', t(-212, '10:15'), U_T),
        s('raschet', t(-210, '15:40'), MEN, { dokumentId: 'dk-r-u-ffs' }),
        s('retseptura', t(-203, '11:00'), LAB),
        s('obraztsy', t(-199, '16:20'), LAB, { kolvo: 30, sposob: 'Транспортной компанией' }),
        s('ispytaniya', t(-193, '09:10'), U_T),
        s('protokol', t(-180, '14:30'), U_T, { dokumentId: 'dk-pi-u-ffs' }),
        s('reshenie', t(-180, '14:35'), U_T, { podhodit: true }),
        s('maketSoglasovan', t(-177, '15:20'), U_Z, { versiya: 1 })
      ],
      maket: {
        versii: [{ n: 1, data: t(-179, '11:00'), kto: MEN, risunok: RIS_U1, ispravleno: [] }],
        zamechaniya: []
      }
    },
    {
      /* Сценарий В: новый продукт с печатью, образец одобрен, заказов нет.
         Макет в согласовании: v1 с тремя замечаниями и ответами, v2 ждёт заказчика. */
      id: 'p-u-npk', zakazchikId: 'udobreniya', tip: 'ffs-meshki', nazvanie: 'FFS-мешок 50 кг под нитроаммофоску',
      parametry: { produktFasovki: 'Нитроаммофоска', vesFasovki: 50, razmery: '550 × 1000 мм, фальц 90 мм', tolshchina: 180,
        pechat: 'tsvetnaya', tsvetov: 3, laminirovanie: false, obemGod: 900, kommentariy: '' },
      sobytiya: [
        s('zapros', t(-48, '10:20'), U_T),
        s('raschet', t(-46, '15:10'), MEN, { dokumentId: 'dk-r-u-npk' }),
        s('retseptura', t(-40, '11:30'), LAB),
        s('obraztsy', t(-36, '16:00'), LAB, { kolvo: 30, sposob: 'Транспортной компанией' }),
        s('ispytaniya', t(-30, '09:15'), U_T),
        s('protokol', t(-16, '14:40'), U_T, { dokumentId: 'dk-pi-u-npk' }),
        s('reshenie', t(-16, '14:45'), U_T, { podhodit: true })
      ],
      maket: {
        versii: [
          { n: 1, data: t(-12, '14:20'), kto: MEN, risunok: RIS_N1, ispravleno: [] },
          { n: 2, data: t(-3, '16:05'), kto: MEN, risunok: RIS_N2, ispravleno: [1, 2] }
        ],
        zamechaniya: [
          { id: 'mz-n-1', versiya: 1, nomer: 1, x: 64, y: 72, text: 'Надпись «50 кг» мелкая, со стороны погрузчика её не видно. Прошу набрать крупнее.', kto: U_Z, data: t(-10, '09:40'),
            otvet: { text: 'Принято, в версии 2 масса набрана крупнее.', prinyato: true, kto: MEN, data: t(-8, '11:05') } },
          { id: 'mz-n-2', versiya: 1, nomer: 2, x: 82, y: 30, text: 'Нужен знак «Беречь от влаги», потому что удобрение гигроскопично.', kto: U_T, data: t(-10, '10:15'),
            otvet: { text: 'Принято, знак добавлен в версии 2.', prinyato: true, kto: MEN, data: t(-8, '11:10') } },
          { id: 'mz-n-3', versiya: 1, nomer: 3, x: 30, y: 18, text: 'Можно ли перенести логотип на боковой фальц?', kto: U_Z, data: t(-10, '10:30'),
            otvet: { text: 'Фальц складывается при формовке мешка, и логотип на нём не читается. Оставляем логотип на лицевой стороне.', prinyato: false, kto: MEN, data: t(-8, '11:20') } }
        ]
      }
    },
    {
      id: 'p-u-hud', zakazchikId: 'udobreniya', tip: 'stretch-hood', nazvanie: 'Стрейч-худ для паллет с мешками',
      parametry: { produktFasovki: 'Паллеты с мешками удобрений', vesFasovki: 1500, razmery: 'рукав 1300 мм, фальц 350 мм', tolshchina: 100,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 400, kommentariy: '' },
      sobytiya: [
        s('zapros', t(-160, '11:30'), U_Z),
        s('raschet', t(-158, '16:00'), MEN, { dokumentId: 'dk-r-u-hud' }),
        s('retseptura', t(-151, '10:20'), LAB),
        s('obraztsy', t(-148, '15:45'), LAB, { kolvo: 10, sposob: 'Транспортной компанией' }),
        s('ispytaniya', t(-141, '09:00'), U_T),
        s('protokol', t(-129, '13:10'), U_T, { dokumentId: 'dk-pi-u-hud' }),
        s('reshenie', t(-129, '13:15'), U_T, { podhodit: true })
      ],
      maket: null
    },
    {
      id: 'p-c-ffs', zakazchikId: 'tsement', tip: 'ffs-meshki', nazvanie: 'FFS-мешок 50 кг под цемент',
      parametry: { produktFasovki: 'Портландцемент', vesFasovki: 50, razmery: '500 × 900 мм, фальц 80 мм', tolshchina: 180,
        pechat: 'tsvetnaya', tsvetov: 1, laminirovanie: false, obemGod: 600, kommentariy: '' },
      sobytiya: [
        s('zapros', t(-131, '10:00'), C_T),
        s('raschet', t(-129, '14:20'), MEN, { dokumentId: 'dk-r-c-ffs' }),
        s('retseptura', t(-122, '11:40'), LAB),
        s('obraztsy', t(-119, '16:10'), LAB, { kolvo: 50, sposob: 'Транспортной компанией' }),
        s('ispytaniya', t(-113, '08:50'), C_T),
        s('protokol', t(-102, '15:00'), C_T, { dokumentId: 'dk-pi-c-ffs' }),
        s('reshenie', t(-102, '15:05'), C_T, { podhodit: true }),
        s('maketSoglasovan', t(-97, '12:30'), C_Z, { versiya: 1 })
      ],
      maket: {
        versii: [{ n: 1, data: t(-99, '10:40'), kto: MEN, risunok: RIS_C1, ispravleno: [] }],
        zamechaniya: []
      }
    },
    {
      /* Запрос в отработке: рецептура подобрана, образцы КЗПМ не отправил в срок. */
      id: 'p-c-smesi', zakazchikId: 'tsement', tip: 'ffs-meshki', nazvanie: 'FFS-мешок 25 кг под сухие смеси',
      parametry: { produktFasovki: 'Сухие строительные смеси', vesFasovki: 25, razmery: '500 × 700 мм, фальц 70 мм', tolshchina: null,
        pechat: 'tsvetnaya', tsvetov: 1, laminirovanie: false, obemGod: 300, kommentariy: 'Нужен аэрационный шов, потому что смесь пылит при фасовке.' },
      sobytiya: [
        s('zapros', t(-20, '09:30'), C_T),
        s('raschet', t(-17, '14:00'), MEN, { dokumentId: 'dk-r-c-smesi' }),
        s('retseptura', t(-12, '16:30'), LAB)
      ],
      maket: { versii: [], zamechaniya: [] }
    },
    {
      id: 'p-p-0140', zakazchikId: 'polimery', tip: 'carbolen', nazvanie: 'CARBOLEN 0140 арт. 7',
      parametry: { marka: 'CARBOLEN 0140 арт. 7', naznachenie: 'Окрашивание изделий из полиэтилена в чёрный цвет при литье и экструзии',
        obemGod: 240, kommentariy: '', osnova: 'LLDPE/LDPE', ptr: 1, koncentraciya: 40 },
      sobytiya: [
        s('zapros', t(-170, '10:45'), P_T),
        s('raschet', t(-168, '15:30'), MEN, { dokumentId: 'dk-r-p-0140' }),
        s('retseptura', t(-161, '12:00'), LAB),
        s('obraztsy', t(-157, '16:40'), LAB, { kolvo: 3, sposob: 'Курьерской службой, пакеты по 5 кг' }),
        s('ispytaniya', t(-151, '09:20'), P_T),
        s('protokol', t(-139, '14:10'), P_T, { dokumentId: 'dk-pi-p-0140' }),
        s('reshenie', t(-139, '14:15'), P_T, { podhodit: true })
      ],
      maket: null
    },
    {
      /* Образцы на испытаниях у заказчика: шаг за технологом. */
      id: 'p-p-0130', zakazchikId: 'polimery', tip: 'carbolen', nazvanie: 'CARBOLEN 0130 арт. 7',
      parametry: { marka: 'CARBOLEN 0130 арт. 7', naznachenie: 'Экструзия чёрной плёнки', obemGod: 120, kommentariy: '',
        osnova: 'LDPE', ptr: 1, koncentraciya: 30 },
      sobytiya: [
        s('zapros', t(-24, '11:10'), P_T),
        s('raschet', t(-22, '16:20'), MEN, { dokumentId: 'dk-r-p-0130' }),
        s('retseptura', t(-16, '10:30'), LAB),
        s('obraztsy', t(-12, '15:50'), LAB, { kolvo: 2, sposob: 'Курьерской службой, пакеты по 5 кг' }),
        s('ispytaniya', t(-6, '09:40'), P_T)
      ],
      maket: null
    }
  ];

  /* ---------- рамочный договор: план по неделям «квартала» ----------
     Квартал — 13 недель вокруг текущей (шесть прошедших, текущая, шесть
     будущих): так график выглядит одинаково в любой день показа. */

  var PLAN_U = [60, 60, 60, 60, 60, 60, 120, 60, 40, 40, 60, 60, 60];
  var dogovory = [
    { id: 'dg-u', nomer: '47-П', zakazchikId: 'udobreniya', s: '@-8m', po: '@+4m',
      plan: PLAN_U.map(function (tonn, i) { return { nedelya: wk(i - 6, 0), tonn: tonn }; }) }
  ];

  /* ---------- заказы ----------
     plan — плановая дата окончания каждого этапа ленты по порядку.
     Этап и даты пройденных этапов выводит dannye.js из событий:
     zayavka — заказ оформлен, etap — начат этап (предыдущий окончен),
     partiya — партия выпущена, okno — назначено окно самовывоза,
     otgruzka — отгрузка ушла, polucheno — заказчик подтвердил получение. */

  var zakazy = [
    {
      id: 'zk-u1', nomer: '1371', zakazchikId: 'udobreniya', produktId: 'p-u-ffs', obem: 180, sposob: 'vagon', zhelaemayaData: off(-42), dogovorId: 'dg-u',
      plan: [off(-74), off(-66), off(-60), off(-54), off(-49), wk(-6, 1), wk(-4, 4), wk(-4, 4)],
      sobytiya: [
        s('zayavka', t(-76, '10:00'), U_Z),
        s('etap', t(-74, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-66, '09:00'), MEN, { etap: 'pechat' }),
        s('etap', t(-60, '09:00'), MEN, { etap: 'izgotovlenie' }),
        s('etap', t(-54, '09:00'), MEN, { etap: 'kontrol' }),
        s('partiya', t(-52, '15:00'), MEN, { partiyaId: 'pt-u1a' }),
        s('partiya', t(-50, '15:00'), MEN, { partiyaId: 'pt-u1b' }),
        s('partiya', t(-49, '15:00'), MEN, { partiyaId: 'pt-u1c' }),
        s('etap', t(-49, '17:00'), MEN, { etap: 'otgruzka' }),
        s('otgruzka', wk(-6, 1, '08:00'), MEN, { otgruzkaId: 'og-u1a' }),
        s('etap', wk(-6, 1, '08:05'), MEN, { etap: 'v-puti' }),
        s('otgruzka', wk(-5, 1, '08:00'), MEN, { otgruzkaId: 'og-u1b' }),
        s('otgruzka', wk(-4, 1, '08:00'), MEN, { otgruzkaId: 'og-u1c' }),
        s('polucheno', wk(-4, 4, '15:00'), U_Z)
      ]
    },
    {
      id: 'zk-u2', nomer: '1385', zakazchikId: 'udobreniya', produktId: 'p-u-ffs', obem: 120, sposob: 'vagon', zhelaemayaData: off(-20), dogovorId: 'dg-u',
      plan: [off(-50), off(-44), off(-38), off(-32), off(-28), wk(-3, 1), wk(-2, 4), wk(-2, 4)],
      sobytiya: [
        s('zayavka', t(-52, '11:00'), U_Z),
        s('etap', t(-50, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-44, '09:00'), MEN, { etap: 'pechat' }),
        s('etap', t(-38, '09:00'), MEN, { etap: 'izgotovlenie' }),
        s('etap', t(-32, '09:00'), MEN, { etap: 'kontrol' }),
        s('partiya', t(-29, '14:00'), MEN, { partiyaId: 'pt-u2a' }),
        s('partiya', t(-28, '14:00'), MEN, { partiyaId: 'pt-u2b' }),
        s('etap', t(-28, '17:00'), MEN, { etap: 'otgruzka' }),
        s('otgruzka', wk(-3, 1, '08:00'), MEN, { otgruzkaId: 'og-u2a' }),
        s('etap', wk(-3, 1, '08:05'), MEN, { etap: 'v-puti' }),
        s('otgruzka', wk(-2, 1, '08:00'), MEN, { otgruzkaId: 'og-u2b' }),
        s('polucheno', wk(-2, 4, '15:00'), U_Z)
      ]
    },
    {
      id: 'zk-u3', nomer: '1404', zakazchikId: 'udobreniya', produktId: 'p-u-hud', obem: 40, sposob: 'vagon', zhelaemayaData: off(-8), dogovorId: 'dg-u',
      plan: [off(-30), off(-24), off(-19), off(-16), wk(-1, 1), wk(-1, 4), wk(-1, 4)],
      sobytiya: [
        s('zayavka', t(-31, '10:30'), U_Z),
        s('etap', t(-30, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-24, '09:00'), MEN, { etap: 'rezka' }),
        s('etap', t(-19, '09:00'), MEN, { etap: 'kontrol' }),
        s('partiya', t(-16, '14:00'), MEN, { partiyaId: 'pt-u3a' }),
        s('etap', t(-16, '17:00'), MEN, { etap: 'otgruzka' }),
        s('otgruzka', wk(-1, 1, '08:00'), MEN, { otgruzkaId: 'og-u3a' }),
        s('etap', wk(-1, 1, '08:05'), MEN, { etap: 'v-puti' }),
        s('polucheno', wk(-1, 4, '15:00'), U_Z)
      ]
    },
    {
      /* Опорный заказ сценария Б: 120 т FFS-мешков в пути, два вагона. */
      id: 'zk-u4', nomer: '1398', zakazchikId: 'udobreniya', produktId: 'p-u-ffs', obem: 120, sposob: 'vagon', zhelaemayaData: off(5), dogovorId: 'dg-u',
      plan: [off(-32), off(-26), off(-20), off(-13), off(-6), wk(0, 0), off(4), off(4)],
      sobytiya: [
        s('zayavka', t(-33, '11:20'), U_Z),
        s('etap', t(-32, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-26, '09:00'), MEN, { etap: 'pechat' }),
        s('etap', t(-20, '09:00'), MEN, { etap: 'izgotovlenie' }),
        s('etap', t(-13, '09:00'), MEN, { etap: 'kontrol' }),
        s('partiya', t(-10, '14:00'), MEN, { partiyaId: 'pt-u4a' }),
        s('partiya', t(-9, '14:00'), MEN, { partiyaId: 'pt-u4b' }),
        s('etap', t(-8, '17:00'), MEN, { etap: 'otgruzka' }),
        s('otgruzka', wk(0, 0, '08:05'), MEN, { otgruzkaId: 'og-u4a' }),
        s('otgruzka', wk(0, 0, '08:20'), MEN, { otgruzkaId: 'og-u4b' }),
        s('etap', wk(0, 0, '08:30'), MEN, { etap: 'v-puti' })
      ]
    },
    {
      id: 'zk-u5', nomer: '1426', zakazchikId: 'udobreniya', produktId: 'p-u-hud', obem: 80, sposob: 'vagon', zhelaemayaData: wk(2, 2), dogovorId: 'dg-u',
      plan: [off(-4), off(2), off(4), off(6), wk(2, 2), wk(3, 5), wk(3, 5)],
      sobytiya: [
        s('zayavka', t(-6, '10:10'), U_Z),
        s('etap', t(-4, '09:00'), MEN, { etap: 'ekstruziya' })
      ]
    },
    {
      /* FFS-мешки на изготовлении: отгрузка по договору на следующей неделе. */
      id: 'zk-u6', nomer: '1420', zakazchikId: 'udobreniya', produktId: 'p-u-ffs', obem: 60, sposob: 'vagon', zhelaemayaData: wk(1, 3), dogovorId: 'dg-u',
      plan: [off(-13), off(-8), off(-4), off(1), off(2), wk(1, 3), wk(1, 6), wk(1, 6)],
      sobytiya: [
        s('zayavka', t(-14, '10:30'), U_Z),
        s('etap', t(-13, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-8, '09:00'), MEN, { etap: 'pechat' }),
        s('etap', t(-4, '09:00'), MEN, { etap: 'izgotovlenie' })
      ]
    },
    {
      /* Новая заявка: три отгрузки по договору в конце квартала. */
      id: 'zk-u7', nomer: '1429', zakazchikId: 'udobreniya', produktId: 'p-u-ffs', obem: 180, sposob: 'vagon', zhelaemayaData: wk(4, 1), dogovorId: 'dg-u',
      plan: [off(1), wk(1, 2), wk(2, 1), wk(2, 4), wk(3, 2), wk(4, 1), wk(6, 4), wk(6, 4)],
      sobytiya: [s('zayavka', t(-2, '11:40'), U_Z)]
    },
    {
      id: 'zk-c1', nomer: '1392', zakazchikId: 'tsement', produktId: 'p-c-ffs', obem: 40, sposob: 'samovyvoz', zhelaemayaData: wk(-3, 2), dogovorId: null,
      plan: [off(-45), off(-40), off(-36), off(-33), off(-30), wk(-3, 2), wk(-3, 3), wk(-3, 3)],
      sobytiya: [
        s('zayavka', t(-46, '09:50'), C_Z),
        s('etap', t(-45, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-40, '09:00'), MEN, { etap: 'pechat' }),
        s('etap', t(-36, '09:00'), MEN, { etap: 'izgotovlenie' }),
        s('etap', t(-33, '09:00'), MEN, { etap: 'kontrol' }),
        s('partiya', t(-31, '14:00'), MEN, { partiyaId: 'pt-c1a' }),
        s('etap', t(-30, '17:00'), MEN, { etap: 'otgruzka' }),
        s('okno', t(-29, '10:00'), MEN, { otgruzkaId: 'og-c1a' }),
        s('otgruzka', wk(-3, 2, '10:00'), MEN, { otgruzkaId: 'og-c1a' }),
        s('etap', wk(-3, 2, '10:05'), MEN, { etap: 'v-puti' }),
        s('polucheno', wk(-3, 3, '12:00'), C_Z)
      ]
    },
    {
      /* Заказ цементного завода на отгрузке: окно самовывоза назначено. */
      id: 'zk-c2', nomer: '1411', zakazchikId: 'tsement', produktId: 'p-c-ffs', obem: 60, sposob: 'samovyvoz', zhelaemayaData: off(2), dogovorId: null,
      plan: [off(-24), off(-18), off(-13), off(-7), off(-4), off(2), off(3), off(3)],
      sobytiya: [
        s('zayavka', t(-25, '10:40'), C_Z),
        s('etap', t(-24, '09:00'), MEN, { etap: 'ekstruziya' }),
        s('etap', t(-18, '09:00'), MEN, { etap: 'pechat' }),
        s('etap', t(-13, '09:00'), MEN, { etap: 'izgotovlenie' }),
        s('etap', t(-7, '09:00'), MEN, { etap: 'kontrol' }),
        s('partiya', t(-5, '14:00'), MEN, { partiyaId: 'pt-c2a' }),
        s('etap', t(-4, '17:00'), MEN, { etap: 'otgruzka' }),
        s('okno', t(-2, '15:00'), MEN, { otgruzkaId: 'og-c2a' })
      ]
    },
    {
      /* CARBOLEN на компаундировании: плановое окончание этапа прошло — риск срока. */
      id: 'zk-p1', nomer: '1418', zakazchikId: 'polimery', produktId: 'p-p-0140', obem: 20, sposob: 'samovyvoz', zhelaemayaData: off(5), dogovorId: null,
      plan: [off(-14), off(-3), off(1), off(3), off(4), off(4)],
      sobytiya: [
        s('zayavka', t(-16, '15:30'), P_Z),
        s('etap', t(-14, '09:00'), MEN, { etap: 'kompaundirovanie' })
      ]
    }
  ];

  /* ---------- партии ----------
     pasport — фактические показатели партии; нормы строк паспорта берёт
     dannye.js из параметров продукта. */

  /* Факт паспорта по строкам из параметров продукта: толщина, размеры,
     печать. Других показателей на сайте нет — и в паспорте их нет. */
  function pf(tolshchina) { return { tolshchina: String(tolshchina), razmery: 'соответствуют', pechat: 'соответствует' }; }
  var partii = [
    { id: 'pt-u1a', nomer: '1371-1', zakazId: 'zk-u1', obem: 60, data: off(-52), pasport: pf(180) },
    { id: 'pt-u1b', nomer: '1371-2', zakazId: 'zk-u1', obem: 60, data: off(-50), pasport: pf(180) },
    { id: 'pt-u1c', nomer: '1371-3', zakazId: 'zk-u1', obem: 60, data: off(-49), pasport: pf(180) },
    { id: 'pt-u2a', nomer: '1385-1', zakazId: 'zk-u2', obem: 60, data: off(-29), pasport: pf(180) },
    { id: 'pt-u2b', nomer: '1385-2', zakazId: 'zk-u2', obem: 60, data: off(-28), pasport: pf(180) },
    { id: 'pt-u3a', nomer: '1404-1', zakazId: 'zk-u3', obem: 40, data: off(-16), pasport: { tolshchina: '100', razmery: 'соответствуют' } },
    { id: 'pt-u4a', nomer: '1398-1', zakazId: 'zk-u4', obem: 60, data: off(-10), pasport: pf(180) },
    { id: 'pt-u4b', nomer: '1398-2', zakazId: 'zk-u4', obem: 60, data: off(-9), pasport: pf(180) },
    { id: 'pt-c1a', nomer: '1392-1', zakazId: 'zk-c1', obem: 40, data: off(-31), pasport: pf(180) },
    { id: 'pt-c2a', nomer: '1411-1', zakazId: 'zk-c2', obem: 60, data: off(-5), pasport: pf(180) }
  ];

  /* ---------- отгрузки ----------
     data — когда отгрузка ушла (у запланированной — плановая дата).
     Вагоны — восемь цифр. obemPlan — тоннаж запланированной отгрузки,
     у которой ещё нет партий. */

  var otgruzki = [
    { id: 'og-u1a', nomer: '1371-1', zakazId: 'zk-u1', dogovorId: 'dg-u', partii: ['pt-u1a'], sposob: 'vagon', data: wk(-6, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24518306', stantsiya: 'Синебор', eta: wk(-6, 4) }, status: 'poluchena', polucheno: wk(-6, 4) },
    { id: 'og-u1b', nomer: '1371-2', zakazId: 'zk-u1', dogovorId: 'dg-u', partii: ['pt-u1b'], sposob: 'vagon', data: wk(-5, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24518314', stantsiya: 'Синебор', eta: wk(-5, 4) }, status: 'poluchena', polucheno: wk(-5, 4) },
    { id: 'og-u1c', nomer: '1371-3', zakazId: 'zk-u1', dogovorId: 'dg-u', partii: ['pt-u1c'], sposob: 'vagon', data: wk(-4, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24537720', stantsiya: 'Синебор', eta: wk(-4, 4) }, status: 'poluchena', polucheno: wk(-4, 4) },
    { id: 'og-u2a', nomer: '1385-1', zakazId: 'zk-u2', dogovorId: 'dg-u', partii: ['pt-u2a'], sposob: 'vagon', data: wk(-3, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24561052', stantsiya: 'Синебор', eta: wk(-3, 4) }, status: 'poluchena', polucheno: wk(-3, 4) },
    { id: 'og-u2b', nomer: '1385-2', zakazId: 'zk-u2', dogovorId: 'dg-u', partii: ['pt-u2b'], sposob: 'vagon', data: wk(-2, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24561060', stantsiya: 'Синебор', eta: wk(-2, 4) }, status: 'poluchena', polucheno: wk(-2, 4) },
    { id: 'og-u3a', nomer: '1404-1', zakazId: 'zk-u3', dogovorId: 'dg-u', partii: ['pt-u3a'], sposob: 'vagon', data: wk(-1, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24519874', stantsiya: 'Синебор', eta: wk(-1, 4) }, status: 'poluchena', polucheno: wk(-1, 4) },
    { id: 'og-u4a', nomer: '1398-1', zakazId: 'zk-u4', dogovorId: 'dg-u', partii: ['pt-u4a'], sposob: 'vagon', data: wk(0, 0), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24588317', stantsiya: 'Синебор', eta: off(3) }, status: 'v-puti', polucheno: null },
    { id: 'og-u4b', nomer: '1398-2', zakazId: 'zk-u4', dogovorId: 'dg-u', partii: ['pt-u4b'], sposob: 'vagon', data: wk(0, 0), ploshchadkaId: 'nizhnekamsk',
      vagon: { nomer: '24588325', stantsiya: 'Синебор', eta: off(4) }, status: 'v-puti', polucheno: null },
    { id: 'og-u5a', nomer: '1426-1', zakazId: 'zk-u5', dogovorId: 'dg-u', partii: [], obemPlan: 40, sposob: 'vagon', data: wk(2, 2), ploshchadkaId: 'nizhnekamsk',
      vagon: null, status: 'plan', polucheno: null },
    { id: 'og-u5b', nomer: '1426-2', zakazId: 'zk-u5', dogovorId: 'dg-u', partii: [], obemPlan: 40, sposob: 'vagon', data: wk(3, 2), ploshchadkaId: 'nizhnekamsk',
      vagon: null, status: 'plan', polucheno: null },
    { id: 'og-u6a', nomer: '1420-1', zakazId: 'zk-u6', dogovorId: 'dg-u', partii: [], obemPlan: 60, sposob: 'vagon', data: wk(1, 3), ploshchadkaId: 'nizhnekamsk',
      vagon: null, status: 'plan', polucheno: null },
    { id: 'og-u7a', nomer: '1429-1', zakazId: 'zk-u7', dogovorId: 'dg-u', partii: [], obemPlan: 60, sposob: 'vagon', data: wk(4, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: null, status: 'plan', polucheno: null },
    { id: 'og-u7b', nomer: '1429-2', zakazId: 'zk-u7', dogovorId: 'dg-u', partii: [], obemPlan: 60, sposob: 'vagon', data: wk(5, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: null, status: 'plan', polucheno: null },
    { id: 'og-u7c', nomer: '1429-3', zakazId: 'zk-u7', dogovorId: 'dg-u', partii: [], obemPlan: 60, sposob: 'vagon', data: wk(6, 1), ploshchadkaId: 'nizhnekamsk',
      vagon: null, status: 'plan', polucheno: null },
    { id: 'og-c1a', nomer: '1392-1', zakazId: 'zk-c1', dogovorId: null, partii: ['pt-c1a'], sposob: 'samovyvoz', data: wk(-3, 2), ploshchadkaId: 'nizhnekamsk',
      samovyvoz: { okno: { data: wk(-3, 2), s: '09:00', po: '12:00' }, ploshchadkaId: 'nizhnekamsk', vorota: 'Ворота 3' }, status: 'poluchena', polucheno: wk(-3, 3) },
    { id: 'og-c2a', nomer: '1411-1', zakazId: 'zk-c2', dogovorId: null, partii: ['pt-c2a'], sposob: 'samovyvoz', data: off(2), ploshchadkaId: 'nizhnekamsk',
      samovyvoz: { okno: { data: off(2), s: '09:00', po: '12:00' }, ploshchadkaId: 'nizhnekamsk', vorota: 'Ворота 3' }, status: 'plan', polucheno: null }
  ];

  /* ---------- претензии ----------
     События: pretenziya — отправлена, vzyata — в работе, otvet — ответ
     службы сервиса, obraztsy — запрошены образцы, zakryta — решение. */

  var pretenzii = [
    {
      id: 'pr-c1', nomer: '31', zakazchikId: 'tsement', partiyaId: 'pt-c1a', vid: 'shov',
      opisanie: 'На линии фасовки мешки рвутся по боковому шву. Брак около 2 % мешков партии.',
      foto: ['foto-shov'],
      sobytiya: [s('pretenziya', t(-2, '11:30'), C_T)]
    },
    {
      id: 'pr-u1', nomer: '27', zakazchikId: 'udobreniya', partiyaId: 'pt-u1a', vid: 'pechat',
      opisanie: 'На части мешков смазана надпись «50 кг». На складе такие мешки путают с другой фасовкой.',
      foto: ['foto-pechat'],
      sobytiya: [
        s('pretenziya', wk(-5, 2, '10:20'), U_Z),
        s('vzyata', wk(-5, 2, '14:05'), SER),
        s('otvet', wk(-5, 3, '11:30'), SER, { text: 'Брак печати по фото подтверждаем. Проверим мешки из партии в лаборатории КЗПМ.' }),
        s('obraztsy', wk(-5, 3, '11:35'), SER, { text: 'Просим отправить пять мешков с дефектом из партии 1371-1.' }),
        s('zakryta', wk(-4, 2, '16:00'), SER, { reshenie: 'Лаборатория подтвердила смещение печати на части партии 1371-1. Мешки с дефектом заменены и отгружены вместе с партией 1385-1.' })
      ]
    }
  ];

  /* ---------- документы ----------
     Здесь документы, которых не вывести из других данных: расчёты,
     протоколы заказчика, спецификации, договор. Паспорт качества каждой
     партии, УПД и транспортную накладную каждой ушедшей отгрузки и листы
     версий макета dannye.js выводит сам. */

  function dk(id, tip, nomer, data, ktip, kid, extra) {
    var d = { id: id, tip: tip, nomer: nomer, data: data, k: { tip: ktip, id: kid } };
    for (var k in extra || {}) { d[k] = extra[k]; }
    return d;
  }
  var dokumenty = [
    dk('dk-dg-u', 'dogovor', '47-П', '@-8m', 'dogovor', 'dg-u'),
    dk('dk-r-u-ffs', 'raschet', 'Р-104', off(-210), 'produkt', 'p-u-ffs'),
    dk('dk-pi-u-ffs', 'protokol', 'ПИ-7', off(-180), 'produkt', 'p-u-ffs', { fayl: { name: 'Протокол испытаний FFS-мешков.pdf' } }),
    dk('dk-s-u-ffs', 'specifikaciya', '3', off(-176), 'produkt', 'p-u-ffs'),
    dk('dk-r-u-npk', 'raschet', 'Р-276', off(-46), 'produkt', 'p-u-npk'),
    dk('dk-pi-u-npk', 'protokol', 'ПИ-9', off(-16), 'produkt', 'p-u-npk', { fayl: { name: 'Протокол испытаний мешков под нитроаммофоску.pdf' } }),
    dk('dk-r-u-hud', 'raschet', 'Р-115', off(-158), 'produkt', 'p-u-hud'),
    dk('dk-pi-u-hud', 'protokol', 'ПИ-11', off(-129), 'produkt', 'p-u-hud', { fayl: { name: 'Протокол испытаний стрейч-худа.pdf' } }),
    dk('dk-s-u-hud', 'specifikaciya', '4', off(-127), 'produkt', 'p-u-hud'),
    dk('dk-r-c-ffs', 'raschet', 'Р-121', off(-129), 'produkt', 'p-c-ffs'),
    dk('dk-pi-c-ffs', 'protokol', 'ПИ-3', off(-102), 'produkt', 'p-c-ffs', { fayl: { name: 'Протокол испытаний мешков.pdf' } }),
    dk('dk-s-c-ffs', 'specifikaciya', '1', off(-96), 'produkt', 'p-c-ffs'),
    dk('dk-r-c-smesi', 'raschet', 'Р-301', off(-17), 'produkt', 'p-c-smesi'),
    dk('dk-r-p-0140', 'raschet', 'Р-112', off(-168), 'produkt', 'p-p-0140'),
    dk('dk-pi-p-0140', 'protokol', 'ПИ-21', off(-139), 'produkt', 'p-p-0140', { fayl: { name: 'Протокол испытаний CARBOLEN.pdf' } }),
    dk('dk-s-p-0140', 'specifikaciya', '1', off(-137), 'produkt', 'p-p-0140'),
    dk('dk-r-p-0130', 'raschet', 'Р-298', off(-22), 'produkt', 'p-p-0130')
  ];

  /* ---------- справочник ---------- */

  function etapy(list) { return list.map(function (x) { return { id: x[0], title: x[1] }; }); }

  /* ---------- правила полей форм ----------
     Форма — { поле: правило }. pusto — текст ошибки пустого поля: поле обязательное.
     format — образец значения (регулярное выражение), min — значение не раньше
     (смещение от дня показа: «@0» — сегодня), posle — значение позже другого поля
     формы; oshibka — текст ошибки, когда значение не подходит под format, min или posle.
     Поле без правила не проверяется. У формы с вариантами — по правилам на вариант. */
  var CHISLO = '^(?=.*[1-9])\\d[\\d\\s]*([.,]\\d+)?$';   /* число больше нуля: «50», «1 200», «0,5» */
  var TSELOE = '^0*[1-9]\\d*$';                          /* целое число больше нуля */
  var OBEM_GOD = { pusto: 'Укажите объём в год в тоннах.', format: CHISLO, oshibka: 'Объём в год указывается числом больше нуля, например 1200.' };
  function zaprosPlenki(razmery) {
    return {
      produktFasovki: { pusto: 'Укажите, что вы фасуете.' },
      vesFasovki: { pusto: 'Укажите вес фасовки в килограммах.', format: CHISLO, oshibka: 'Вес фасовки указывается числом больше нуля, например 50.' },
      razmery: { pusto: razmery },
      tolshchina: { format: CHISLO, oshibka: 'Толщина указывается числом в микрометрах. Если толщина неизвестна, оставьте поле пустым.' },
      tsvetov: { format: TSELOE, oshibka: 'Число цветов указывается целым числом больше нуля. Если число цветов неизвестно, оставьте поле пустым.' },
      obemGod: OBEM_GOD
    };
  }

  var spravochnik = {
    /* Путь продукта до заявки (спецификация, «Предметная модель»). */
    etapyOtrabotki: etapy([['zapros', 'Запрос'], ['raschet', 'Расчёт отправлен'], ['retseptura', 'Рецептура подобрана'],
      ['obraztsy', 'Образцы отправлены'], ['ispytaniya', 'Испытания у заказчика'], ['odobren', 'Одобрен']]),
    /* Ленты заказа по группам продукции — дословно по спецификации. */
    etapyZakaza: {
      ffs: etapy([['prinyata', 'Заявка принята'], ['ekstruziya', 'Экструзия'], ['pechat', 'Печать'], ['izgotovlenie', 'Изготовление мешков'],
        ['kontrol', 'Контроль качества'], ['otgruzka', 'Отгрузка'], ['v-puti', 'В пути'], ['polucheno', 'Получено']]),
      plenka: etapy([['prinyata', 'Заявка принята'], ['ekstruziya', 'Экструзия'], ['rezka', 'Резка и намотка'],
        ['kontrol', 'Контроль качества'], ['otgruzka', 'Отгрузка'], ['v-puti', 'В пути'], ['polucheno', 'Получено']]),
      laminat: etapy([['prinyata', 'Заявка принята'], ['ekstruziya', 'Экструзия'], ['pechat', 'Печать'], ['laminirovanie', 'Ламинирование'],
        ['rezka', 'Резка и намотка'], ['kontrol', 'Контроль качества'], ['otgruzka', 'Отгрузка'], ['v-puti', 'В пути'], ['polucheno', 'Получено']]),
      kompaund: etapy([['prinyata', 'Заявка принята'], ['kompaundirovanie', 'Компаундирование'], ['kontrol', 'Контроль качества'],
        ['otgruzka', 'Отгрузка'], ['v-puti', 'В пути'], ['polucheno', 'Получено']])
    },
    vidyPretenziy: {
      shov: 'Расходится сварной шов',
      razryv: 'Разрывы мешков при фасовке',
      razmer: 'Размеры не по спецификации',
      tolshchina: 'Толщина плёнки не по спецификации',
      pechat: 'Дефект печати',
      kolichestvo: 'Недостача',
      drugoe: 'Другое'
    },
    tipyDokumentov: {
      raschet: 'Расчёт',
      protokol: 'Протокол испытаний',
      specifikaciya: 'Спецификация',
      dogovor: 'Договор поставки',
      maket: 'Макет печати',
      pasport: 'Паспорт качества партии',
      upd: 'УПД',
      nakladnaya: 'Транспортная накладная'
    },
    statusyPretenzii: {
      novaya: { title: 'Новая', cls: 'badge--warn' },
      'v-rabote': { title: 'В работе', cls: 'badge--info' },
      zakryta: { title: 'Закрыта', cls: 'badge--neutral' }
    },
    statusyOtgruzki: { plan: 'Запланирована', 'v-puti': 'В пути', poluchena: 'Получена' },
    sposoby: { vagon: 'Вагон', samovyvoz: 'Самовывоз' },
    /* Поля запроса и параметры продукта: подпись, единица, что показать
       на месте пустого. Порядок — порядок формы. */
    parametry: [
      { key: 'produktFasovki', title: 'Продукт фасовки', unit: '' },
      { key: 'vesFasovki', title: 'Вес фасовки', unit: 'кг' },
      { key: 'razmery', title: 'Размеры мешка', unit: '' },
      { key: 'tolshchina', title: 'Толщина плёнки', unit: 'мкм', pusto: 'Подберёт лаборатория КЗПМ' },
      { key: 'pechat', title: 'Печать', unit: '', znacheniya: { net: 'Без печати', tsvetnaya: 'Цветная печать' } },
      { key: 'tsvetov', title: 'Число цветов', unit: '' },
      { key: 'laminirovanie', title: 'Ламинирование', unit: '', znacheniya: { 'true': 'Нужно', 'false': 'Не нужно' } },
      { key: 'marka', title: 'Марка', unit: '', pusto: 'Подберёт лаборатория КЗПМ' },
      { key: 'naznachenie', title: 'Назначение', unit: '' },
      { key: 'obemGod', title: 'Объём в год', unit: 'т' },
      { key: 'osnova', title: 'Основа', unit: '' },
      { key: 'ptr', title: 'Показатель текучести расплава', unit: 'г/10 мин.' },
      { key: 'koncentraciya', title: 'Концентрация технического углерода', unit: '%' },
      { key: 'kommentariy', title: 'Комментарий', unit: '' }
    ],
    /* Правила полей форм: одна правда для формы и для ACT. Варианты запроса — плёнка,
       мешок (FFS-мешки, у размеров своя подсказка) и компаунд; отгрузки — вагон и окно
       самовывоза; ответа на замечание к макету — «принято» и пояснение. */
    formy: {
      zapros: {
        plenka: zaprosPlenki('Укажите размеры.'),
        meshok: zaprosPlenki('Укажите размеры мешка.'),
        kompaund: { naznachenie: { pusto: 'Укажите назначение компаунда.' }, obemGod: OBEM_GOD }
      },
      obraztsy: {
        kolvo: { pusto: 'Укажите, сколько образцов отправлено.', format: TSELOE, oshibka: 'Количество образцов указывается целым числом больше нуля.' },
        sposob: { pusto: 'Укажите, как отправлены образцы.' }
      },
      protokol: { fayl: { pusto: 'Выберите файл протокола или приложите демо-протокол.' } },
      reshenie: { prichina: { pusto: 'Укажите причину, по которой образец не подходит.' } },
      zakaz: {
        obem: { pusto: 'Укажите объём заказа в тоннах.', format: CHISLO, oshibka: 'Объём указывается числом больше нуля, например 60.' },
        data: { pusto: 'Укажите желаемую дату.', min: '@0', oshibka: 'Желаемая дата не может быть раньше сегодняшней.' },
        sposob: { pusto: 'Выберите способ получения.' }
      },
      otgruzka: {
        vagon: {
          nomer: { pusto: 'Укажите номер вагона.', format: '^\\d{8}$', oshibka: 'Номер вагона состоит из восьми цифр.' },
          stantsiya: { pusto: 'Укажите станцию назначения.' }
        },
        samovyvoz: {
          data: { pusto: 'Укажите дату окна.' },
          s: { pusto: 'Укажите время начала окна.' },
          po: { pusto: 'Укажите время окончания окна.', posle: 's', oshibka: 'Время окончания окна должно быть позже времени начала.' },
          ploshchadkaId: { pusto: 'Выберите площадку.' }
        }
      },
      pretenziya: {
        partiyaId: { pusto: 'Выберите партию из полученных.' },
        vid: { pusto: 'Выберите вид проблемы.' },
        opisanie: { pusto: 'Опишите проблему с партией.' }
      },
      hodPretenzii: { otvet: { pusto: 'Напишите ответ заказчику.' }, reshenie: { pusto: 'Запишите решение по претензии.' } },
      maketZamechanie: {
        metka: { pusto: 'Поставьте метку, нажав на то место рисунка, к которому относится замечание.' },
        text: { pusto: 'Опишите, что нужно изменить в макете.' }
      },
      maketOtvet: { prinyato: {}, poyasnenie: { text: { pusto: 'Напишите пояснение, почему замечание не вносится в макет.' } } }
    }
  };

  /* ---------- заготовки для «Заполнить демо-данными» и демо-файлов ---------- */

  var demo = {
    zapros: { tip: 'ffs-meshki', produktFasovki: 'Карбамид', vesFasovki: 50, razmery: '550 × 950 мм, фальц 90 мм', tolshchina: null,
      pechat: 'tsvetnaya', tsvetov: 2, laminirovanie: false, obemGod: 1200,
      kommentariy: 'Фасовка на автоматической линии. Нужен эффект антискольжения.' },
    zaprosKompaund: { tip: 'carbolen', marka: 'CARBOLEN 0140 арт. 7', naznachenie: 'Окрашивание плёнки в чёрный цвет', obemGod: 120, kommentariy: '' },
    obraztsy: { kolvo: 20, sposob: 'Транспортной компанией' },
    protokol: { name: 'Протокол испытаний образцов.pdf' },
    maketZamechanie: { x: 50, y: 40, text: 'Название продукта прошу сделать крупнее.' },
    maketOtvet: { text: 'Принято, исправим в следующей версии.', prinyato: true },
    zakaz: { obem: 60, data: off(30), sposob: 'vagon' },
    otgruzka: {
      vagon: { nomer: '24590112', stantsiya: 'Синебор' },
      samovyvoz: { okno: { data: off(2), s: '09:00', po: '12:00' }, ploshchadkaId: 'nizhnekamsk', vorota: 'Ворота 2' }
    },
    /* Факт паспорта партии, которую выпускают на показе: по строкам
       из параметров продукта. */
    pasport: { tolshchina: 'соответствует', razmery: 'соответствуют', pechat: 'соответствует', marka: 'соответствует',
      osnova: 'соответствует', koncentraciya: 'соответствует' },
    pretenziya: { vid: 'razryv', opisanie: 'Мешки рвутся при падении с транспортёра. Брак около 1 % мешков партии.', foto: ['foto-razryv'] },
    otvet: 'Проверяем партию по фото. Ответим после проверки образцов в лаборатории КЗПМ.',
    reshenie: 'Дефект подтверждён. Мешки с дефектом заменим в следующей отгрузке.',
    foto: [
      { key: 'foto-shov', name: 'Шов мешка.jpg', title: 'Разошедшийся боковой шов' },
      { key: 'foto-pechat', name: 'Печать на мешке.jpg', title: 'Смазанная надпись на мешке' },
      { key: 'foto-razryv', name: 'Разрыв мешка.jpg', title: 'Разрыв мешка на транспортёре' }
    ]
  };

  /* ---------- фон: первая волна подключения ----------
     Кабинет показан как первая волна подключения ключевых заказчиков: три
     сценарных выше и девять фоновых ниже. Фон даёт сводке, спискам и очереди
     масштаб завода и сценарных объектов не меняет. Записи явные, случайных
     чисел нет: помощники разворачивают короткую запись в продукт или заказ
     с событиями, партиями и отгрузками. Номера заказов растут с днём заявки
     и встают между номерами сценарных. У фоновых макетов замечаний нет. */

  var FON_ZAKAZCHIK = { h: 'svetlodol', a: 'kremnegorsk', k: 'kamenorechye', m: 'yasnobor', r: 'rzhanye', s: 'starobor',
    v: 'vetrogorsk', d: 'kedrobor', l: 'listvensk' };
  var BUKVY = 'abcdef';
  var fonDokumenty = [];
  /* Дата строкой и время: vt(wk(-6, 1), '08:00') → «@w-6+1 08:00». */
  function vt(d, hm) { return d + ' ' + hm; }
  function plus5(hm) { var m = +hm.slice(3) + 5; return hm.slice(0, 3) + (m < 10 ? '0' : '') + m; }
  /* Дни-числа → смещения «@N», строки-недели остаются как есть. */
  function dni(list) { return list.map(function (x) { return typeof x === 'number' ? off(x) : x; }); }
  function katalogTip(tip) { return zavod.katalog.filter(function (k) { return k.tip === tip; })[0]; }

  /* Фоновый продукт. put — дни шагов отработки по порядку: запрос, расчёт, рецептура,
     образцы, испытания, протокол; продукт дошёл до последнего названного шага.
     odobren — образец подошёл в день протокола. У продукта с печатью — макет:
     одна версия, согласована без замечаний (maket.v1, maket.soglasovan). */
  function fonProdukt(o) {
    var T = o.k + '-tehnolog', Z = o.k + '-zakupshchik', suf = o.id.slice(2), d = o.put, sob = [];
    var shagi = [
      function (x) { return s('zapros', t(x, '10:30'), T); },
      function (x) { return s('raschet', t(x, '15:10'), MEN, { dokumentId: 'dk-r-' + suf }); },
      function (x) { return s('retseptura', t(x, '11:20'), LAB); },
      function (x) { return s('obraztsy', t(x, '16:00'), LAB, { kolvo: o.obr[0], sposob: o.obr[1] }); },
      function (x) { return s('ispytaniya', t(x, '09:30'), T); },
      function (x) { return s('protokol', t(x, '14:20'), T, { dokumentId: 'dk-pi-' + suf }); }
    ];
    d.forEach(function (x, i) { sob.push(shagi[i](x)); });
    if (o.odobren) { sob.push(s('reshenie', t(d[5], '14:25'), T, { podhodit: true })); }
    if (o.maket) { sob.push(s('maketSoglasovan', t(o.maket.soglasovan, '11:40'), Z, { versiya: 1 })); }
    if (d.length > 1) { fonDokumenty.push(dk('dk-r-' + suf, 'raschet', o.nr, off(d[1]), 'produkt', o.id)); }
    if (d.length > 5) { fonDokumenty.push(dk('dk-pi-' + suf, 'protokol', o.npi, off(d[5]), 'produkt', o.id, { fayl: { name: o.fayl } })); }
    if (o.odobren) { fonDokumenty.push(dk('dk-s-' + suf, 'specifikaciya', o.ns, off((o.maket ? o.maket.soglasovan : d[5]) + 2), 'produkt', o.id)); }
    return {
      id: o.id, zakazchikId: FON_ZAKAZCHIK[o.k], tip: o.tip, nazvanie: o.nazvanie, parametry: o.par, sobytiya: sob,
      maket: o.par.pechat !== 'tsvetnaya' ? null : {
        versii: o.maket ? [{ n: 1, data: t(o.maket.v1, '10:30'), kto: MEN, risunok: o.maket.risunok, ispravleno: [] }] : [],
        zamechaniya: []
      }
    };
  }

  var fonProdukty = [
    /* Светлодольский химический комбинат */
    fonProdukt({ id: 'p-h-ffs', k: 'h', tip: 'ffs-meshki', nazvanie: 'FFS-мешок 25 кг под полиэтилен в гранулах',
      par: { produktFasovki: 'Полиэтилен в гранулах', vesFasovki: 25, razmery: '470 × 750 мм, фальц 80 мм', tolshchina: 150,
        pechat: 'tsvetnaya', tsvetov: 2, laminirovanie: false, obemGod: 3600, kommentariy: '' },
      put: [-240, -238, -231, -227, -221, -208], obr: [40, 'Транспортной компанией'], odobren: true,
      maket: { v1: -205, soglasovan: -203, risunok: { nadpis: 'Светлодольский химический комбинат', produkt: 'Полиэтилен', massa: '25 кг',
        krupnoeNazvanie: false, krupnayaMassa: true, znaki: ['verh', 'vlaga'] } },
      nr: 'Р-83', npi: 'ПИ-14', ns: '1', fayl: 'Протокол испытаний мешков 25 кг.pdf' }),
    fonProdukt({ id: 'p-h-plenka', k: 'h', tip: 'ffs-plenka', nazvanie: 'FFS-плёнка (рукав) под полипропилен в гранулах',
      par: { produktFasovki: 'Полипропилен в гранулах', vesFasovki: 25, razmery: 'рукав 470 мм, фальц 80 мм', tolshchina: null,
        pechat: 'tsvetnaya', tsvetov: 2, laminirovanie: false, obemGod: 1800, kommentariy: 'Плёнка для своей линии формовки мешков.' },
      put: [-1] }),
    /* Кремнегорский завод азотных удобрений */
    fonProdukt({ id: 'p-a-ffs', k: 'a', tip: 'ffs-meshki', nazvanie: 'FFS-мешок 50 кг под сульфат аммония',
      par: { produktFasovki: 'Сульфат аммония', vesFasovki: 50, razmery: '550 × 1000 мм, фальц 90 мм', tolshchina: 170,
        pechat: 'tsvetnaya', tsvetov: 2, laminirovanie: false, obemGod: 2800, kommentariy: '' },
      put: [-300, -298, -291, -287, -281, -266], obr: [40, 'Транспортной компанией'], odobren: true,
      maket: { v1: -264, soglasovan: -262, risunok: { nadpis: 'Кремнегорский завод азотных удобрений', produkt: 'Сульфат аммония', massa: '50 кг',
        krupnoeNazvanie: false, krupnayaMassa: true, znaki: ['verh', 'vlaga', 'ne-brosat'] } },
      nr: 'Р-58', npi: 'ПИ-5', ns: '1', fayl: 'Протокол испытаний мешков под сульфат аммония.pdf' }),
    fonProdukt({ id: 'p-a-kolp', k: 'a', tip: 'kolpaki', nazvanie: 'Укрывной колпак для паллет с удобрениями',
      par: { produktFasovki: 'Паллеты с мешками удобрений', vesFasovki: 1200, razmery: 'рукав 1500 мм, фальц 400 мм', tolshchina: 120,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 300, kommentariy: 'Паллеты хранятся на открытой площадке.' },
      put: [-52, -50, -44, -40, -34], obr: [15, 'Транспортной компанией'], nr: 'Р-268' }),
    /* Каменореченский завод сухих смесей */
    fonProdukt({ id: 'p-k-hud', k: 'k', tip: 'stretch-hood', nazvanie: 'Стрейч-худ для паллет с сухими смесями',
      par: { produktFasovki: 'Паллеты с мешками сухих смесей', vesFasovki: 1400, razmery: 'рукав 1250 мм, фальц 300 мм', tolshchina: 90,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 1800, kommentariy: '' },
      put: [-234, -232, -225, -222, -216, -204], obr: [12, 'Транспортной компанией'], odobren: true,
      nr: 'Р-86', npi: 'ПИ-3', ns: '1', fayl: 'Протокол испытаний стрейч-худа.pdf' }),
    /* Ясноборский молочный комбинат */
    fonProdukt({ id: 'p-m-term', k: 'm', tip: 'termousadka', nazvanie: 'Термоусадочная плёнка для групповой упаковки бутылок',
      par: { produktFasovki: 'Бутылки с молочной продукцией, по шесть штук', vesFasovki: 6, razmery: 'полотно 600 мм', tolshchina: 50,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 240, kommentariy: '' },
      put: [-154, -152, -146, -143, -137, -125], obr: [6, 'Курьерской службой'], odobren: true,
      nr: 'Р-117', npi: 'ПИ-41', ns: '1', fayl: 'Протокол испытаний термоусадочной плёнки.pdf' }),
    fonProdukt({ id: 'p-m-lam', k: 'm', tip: 'laminirovannye', nazvanie: 'Ламинированная плёнка для упаковки сыра',
      par: { produktFasovki: 'Сыр в брусках', vesFasovki: 3, razmery: 'полотно 420 мм', tolshchina: 90,
        pechat: 'net', tsvetov: null, laminirovanie: true, obemGod: 60, kommentariy: 'Нужен средний барьер.' },
      put: [-98, -96, -89, -85, -79, -62], obr: [5, 'Курьерской службой'], odobren: true,
      nr: 'Р-198', npi: 'ПИ-44', ns: '2', fayl: 'Протокол испытаний ламинированной плёнки.pdf' }),
    fonProdukt({ id: 'p-m-bar', k: 'm', tip: 'laminirovannye', nazvanie: 'Ламинированная плёнка с высоким барьером для творога',
      par: { produktFasovki: 'Творог', vesFasovki: 0.5, razmery: 'полотно 380 мм', tolshchina: null,
        pechat: 'net', tsvetov: null, laminirovanie: true, obemGod: 40, kommentariy: 'Нужен срок хранения творога 14 суток.' },
      put: [-6, -3], nr: 'Р-305' }),
    /* Агрофирма «Ржаные Ключи»: образец одобрен в этом месяце */
    fonProdukt({ id: 'p-r-kolp', k: 'r', tip: 'kolpaki', nazvanie: 'Укрывной колпак для паллет с семенами',
      par: { produktFasovki: 'Паллеты с мешками семян', vesFasovki: 1000, razmery: 'рукав 1400 мм, фальц 350 мм', tolshchina: 110,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 120, kommentariy: '' },
      put: [-62, -60, -54, -51, -45, -27], obr: [10, 'Транспортной компанией'], odobren: true,
      nr: 'Р-251', npi: 'ПИ-2', ns: '1', fayl: 'Протокол испытаний колпаков.pdf' }),
    /* Староборский завод теплоизоляции: расчёт отправлен, рецептура дольше срока */
    fonProdukt({ id: 'p-s-hud', k: 's', tip: 'stretch-hood', nazvanie: 'Стрейч-худ для паллет с минеральной ватой',
      par: { produktFasovki: 'Паллеты с плитами минеральной ваты', vesFasovki: 450, razmery: 'рукав 1600 мм, фальц 450 мм', tolshchina: 80,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 500, kommentariy: '' },
      put: [-205, -203, -196, -193, -187, -175], obr: [8, 'Транспортной компанией'], odobren: true,
      nr: 'Р-106', npi: 'ПИ-17', ns: '1', fayl: 'Протокол испытаний стрейч-худа.pdf' }),
    fonProdukt({ id: 'p-s-term', k: 's', tip: 'termousadka', nazvanie: 'Термоусадочная плёнка для пачек утеплителя',
      par: { produktFasovki: 'Пачки плит утеплителя', vesFasovki: 12, razmery: 'рукав 1200 мм', tolshchina: null,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 200, kommentariy: '' },
      put: [-15, -12], nr: 'Р-302' }),
    /* Ветрогорский завод бытовой техники */
    fonProdukt({ id: 'p-v-term', k: 'v', tip: 'termousadka', nazvanie: 'Термоусадочная плёнка для упаковки холодильников',
      par: { produktFasovki: 'Холодильники в коробках', vesFasovki: 70, razmery: 'полотно 1800 мм', tolshchina: 60,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 300, kommentariy: '' },
      put: [-133, -131, -124, -121, -115, -103], obr: [6, 'Транспортной компанией'], odobren: true,
      nr: 'Р-120', npi: 'ПИ-8', ns: '1', fayl: 'Протокол испытаний термоусадочной плёнки.pdf' }),
    fonProdukt({ id: 'p-v-hud', k: 'v', tip: 'stretch-hood', nazvanie: 'Стрейч-худ для паллет со стиральными машинами',
      par: { produktFasovki: 'Стиральные машины в коробках', vesFasovki: 75, razmery: 'рукав 1300 мм, фальц 350 мм', tolshchina: null,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 150, kommentariy: '' },
      put: [-2] }),
    /* Кедроборский лесокомбинат */
    fonProdukt({ id: 'p-d-kolp', k: 'd', tip: 'kolpaki', nazvanie: 'Укрывной колпак для пакетов пиломатериалов',
      par: { produktFasovki: 'Пакеты пиломатериалов', vesFasovki: 2500, razmery: 'рукав 1800 мм, фальц 500 мм', tolshchina: 150,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 360, kommentariy: '' },
      put: [-138, -136, -129, -126, -120, -106], obr: [10, 'Транспортной компанией'], odobren: true,
      nr: 'Р-119', npi: 'ПИ-26', ns: '1', fayl: 'Протокол испытаний колпаков.pdf' }),
    fonProdukt({ id: 'p-d-term', k: 'd', tip: 'termousadka', nazvanie: 'Термоусадочная плёнка для пачек шпона',
      par: { produktFasovki: 'Пачки шпона', vesFasovki: 800, razmery: 'рукав 1400 мм', tolshchina: 100,
        pechat: 'net', tsvetov: null, laminirovanie: false, obemGod: 180, kommentariy: '' },
      put: [-24, -20, -12, -5], obr: [6, 'Транспортной компанией'], nr: 'Р-299' }),
    /* Лиственский завод упаковочных плёнок: компаунды */
    fonProdukt({ id: 'p-l-0140', k: 'l', tip: 'carbolen', nazvanie: 'CARBOLEN 0140 арт. 7',
      par: { marka: 'CARBOLEN 0140 арт. 7', naznachenie: 'Окрашивание плёнки в чёрный цвет', obemGod: 150, kommentariy: '',
        osnova: 'LLDPE/LDPE', ptr: 1, koncentraciya: 40 },
      put: [-120, -118, -111, -107, -101, -89], obr: [3, 'Курьерской службой, пакеты по 5 кг'], odobren: true,
      nr: 'Р-152', npi: 'ПИ-6', ns: '1', fayl: 'Протокол испытаний CARBOLEN.pdf' }),
    fonProdukt({ id: 'p-l-6114', k: 'l', tip: 'kamlen', nazvanie: 'KAMLEN® 6114',
      par: { marka: 'KAMLEN® 6114', naznachenie: 'Окрашивание многослойной плёнки в белый цвет', obemGod: 90, kommentariy: '',
        osnova: 'LLDPE', ptr: 15 },
      put: [-40, -38, -31, -27, -15, -2], obr: [2, 'Курьерской службой, пакеты по 5 кг'],
      nr: 'Р-283', npi: 'ПИ-9', fayl: 'Протокол испытаний KAMLEN 6114.pdf' })
  ];

  /* Факт паспорта партии фонового заказа — по строкам из параметров продукта. */
  function fonPasport(p) {
    var par = p.parametry;
    if (par.marka) { return { marka: 'соответствует', osnova: 'соответствует', koncentraciya: par.koncentraciya ? String(par.koncentraciya) : 'соответствует' }; }
    var x = { tolshchina: String(par.tolshchina), razmery: 'соответствуют' };
    if (par.pechat === 'tsvetnaya') { x.pechat = 'соответствует'; }
    return x;
  }

  /* Фоновый заказ. z — день заявки; hod — дни начала этапов ленты после «заявка принята»
     по порядку, до текущего (у отгруженного — до «отгрузки»); partii — [[день, т], …],
     партии выпускаются на контроле качества; otgr — отгрузки { d: дата, eta: прибытие
     (у самовывоза — день получения), p: номера партий, v: вагон, st: статус, t: тонн
     у запланированной без партий, tm: время, s/po/vorota: окно самовывоза };
     okno — день, когда назначено окно; pol — день подтверждения получения;
     plan — плановое окончание каждого этапа (день-число или строка недели). */
  var fonZakazy = [], fonPartii = [], fonOtgruzki = [];
  function fonZakaz(o) {
    var zak = zakazchiki.filter(function (x) { return x.id === FON_ZAKAZCHIK[o.k]; })[0];
    var pr = fonProdukty.filter(function (x) { return x.id === o.prod; })[0];
    var ids = spravochnik.etapyZakaza[katalogTip(pr.tip).lenta].map(function (e) { return e.id; });
    var ZAK = o.k + '-zakupshchik', kod = o.id.slice(3), sob = [s('zayavka', t(o.z, o.zt), ZAK)];
    var pt = (o.partii || []).map(function (x, i) {
      return { id: 'pt-' + kod + BUKVY[i], nomer: o.nomer + '-' + (i + 1), zakazId: o.id, obem: x[1], data: off(x[0]), pasport: fonPasport(pr) };
    });
    o.hod.forEach(function (den, i) {
      var etap = ids[i + 1];
      if (etap === 'otgruzka') { pt.forEach(function (x, j) { sob.push(s('partiya', t(o.partii[j][0], '14:00'), MEN, { partiyaId: x.id })); }); }
      sob.push(s('etap', t(den, etap === 'otgruzka' ? '17:00' : '09:00'), MEN, { etap: etap }));
    });
    var og = (o.otgr || []).map(function (g, i) {
      var st = g.st || 'poluchena';
      var x = { id: 'og-' + kod + BUKVY[i], nomer: o.nomer + '-' + (i + 1), zakazId: o.id, dogovorId: o.dg || null,
        partii: (g.p || []).map(function (j) { return pt[j].id; }), sposob: o.sposob, data: g.d, ploshchadkaId: o.pl,
        status: st, polucheno: st === 'poluchena' ? g.eta : null };
      if (o.sposob === 'vagon') { x.vagon = st === 'plan' ? null : { nomer: g.v, stantsiya: zak.stantsiya, eta: g.eta }; }
      else { x.samovyvoz = { okno: { data: g.d, s: g.s, po: g.po }, ploshchadkaId: o.pl, vorota: g.vorota }; }
      if (g.t) { x.obemPlan = g.t; }
      return x;
    });
    if (o.okno !== undefined) { sob.push(s('okno', t(o.okno, '10:00'), MEN, { otgruzkaId: og[0].id })); }
    var ushla = false;
    og.forEach(function (x, i) {
      if (x.status === 'plan') { return; }
      var hm = o.otgr[i].tm || '08:00';
      sob.push(s('otgruzka', vt(x.data, hm), MEN, { otgruzkaId: x.id }));
      if (!ushla) { sob.push(s('etap', vt(x.data, plus5(hm)), MEN, { etap: 'v-puti' })); ushla = true; }
    });
    if (o.pol) { sob.push(s('polucheno', vt(o.pol, o.sposob === 'vagon' ? '15:00' : '12:00'), ZAK)); }
    var plan = dni(o.plan);
    fonZakazy.push({ id: o.id, nomer: o.nomer, zakazchikId: zak.id, produktId: pr.id, obem: o.obem, sposob: o.sposob,
      zhelaemayaData: plan[plan.length - 1], dogovorId: o.dg || null, plan: plan, sobytiya: sob });
    Array.prototype.push.apply(fonPartii, pt);
    Array.prototype.push.apply(fonOtgruzki, og);
  }

  [
    /* Светлодольский химический комбинат: договор 39-П, вагоны из Тобольска. Заказ 1372 ушёл до графика. */
    { id: 'zk-h0', nomer: '1372', k: 'h', prod: 'p-h-ffs', obem: 60, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -75, zt: '10:20',
      hod: [-74, -69, -65, -61, -60], partii: [[-60, 60]], otgr: [{ d: off(-58), eta: off(-55), p: [0], v: '25103347' }], pol: off(-55),
      plan: [-74, -69, -65, -61, -60, -58, -55, -55] },
    { id: 'zk-h1', nomer: '1378', k: 'h', prod: 'p-h-ffs', obem: 180, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -65, zt: '11:10',
      hod: [-64, -59, -55, -51, -49], partii: [[-51, 60], [-50, 60], [-49, 60]],
      otgr: [{ d: wk(-6, 1), eta: wk(-6, 4), p: [0], v: '25131208' }, { d: wk(-5, 0), eta: wk(-5, 3), p: [1], v: '25131216' },
        { d: wk(-5, 1), eta: wk(-5, 4), p: [2], v: '25131224' }], pol: wk(-5, 4),
      plan: [-64, -59, -55, -51, -49, wk(-6, 1), wk(-5, 4), wk(-5, 4)] },
    { id: 'zk-h2', nomer: '1394', k: 'h', prod: 'p-h-ffs', obem: 120, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -43, zt: '09:40',
      hod: [-42, -37, -33, -29, -27], partii: [[-28, 60], [-27, 60]],
      otgr: [{ d: wk(-3, 1), eta: wk(-3, 4), p: [0], v: '25174570' }, { d: wk(-3, 3), eta: wk(-3, 5), p: [1], v: '25174588' }], pol: wk(-3, 5),
      plan: [-42, -37, -33, -29, -27, wk(-3, 1), wk(-3, 5), wk(-3, 5)] },
    { id: 'zk-h3', nomer: '1396', k: 'h', prod: 'p-h-ffs', obem: 180, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -37, zt: '10:50',
      hod: [-36, -31, -27, -23, -20], partii: [[-22, 60], [-21, 60], [-20, 60]],
      otgr: [{ d: wk(-2, 1), eta: wk(-2, 4), p: [0], v: '25186029' }, { d: wk(-2, 3), eta: wk(-2, 5), p: [1], v: '25186037' },
        { d: wk(-1, 1), eta: wk(-1, 4), p: [2], v: '25186045' }], pol: wk(-1, 4),
      plan: [-36, -31, -27, -23, -20, wk(-2, 1), wk(-1, 4), wk(-1, 4)] },
    { id: 'zk-h4', nomer: '1412', k: 'h', prod: 'p-h-ffs', obem: 120, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -24, zt: '14:30',
      hod: [-23, -18, -14, -10, -8], partii: [[-9, 60], [-8, 60]],
      otgr: [{ d: wk(0, 0), eta: off(2), p: [0], v: '25234418', st: 'v-puti', tm: '08:00' },
        { d: wk(0, 0), eta: off(3), p: [1], v: '25234426', st: 'v-puti', tm: '08:20' }],
      plan: [-23, -18, -14, -10, -8, wk(0, 0), 3, 3] },
    { id: 'zk-h5', nomer: '1417', k: 'h', prod: 'p-h-ffs', obem: 180, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -17, zt: '11:30',
      hod: [-16, -11, -7, -3],
      otgr: [{ d: wk(1, 2), st: 'plan', t: 60 }, { d: wk(2, 2), st: 'plan', t: 60 }, { d: wk(3, 2), st: 'plan', t: 60 }],
      plan: [-16, -11, -7, -3, 1, wk(1, 2), wk(3, 5), wk(3, 5)] },
    { id: 'zk-h6', nomer: '1428', k: 'h', prod: 'p-h-ffs', obem: 120, sposob: 'vagon', dg: 'dg-h', pl: 'tobolsk', z: -3, zt: '16:10',
      hod: [], otgr: [{ d: wk(4, 2), st: 'plan', t: 60 }, { d: wk(5, 2), st: 'plan', t: 60 }],
      plan: [1, 6, 10, 14, 16, wk(4, 2), wk(5, 5), wk(5, 5)] },

    /* Кремнегорский завод азотных удобрений: договор 49-П, вагоны из Казани */
    { id: 'zk-a1', nomer: '1381', k: 'a', prod: 'p-a-ffs', obem: 120, sposob: 'vagon', dg: 'dg-a', pl: 'kazan', z: -63, zt: '10:40',
      hod: [-62, -57, -53, -49, -48], partii: [[-49, 60], [-48, 60]],
      otgr: [{ d: wk(-6, 2), eta: wk(-6, 4), p: [0], v: '25142650' }, { d: wk(-5, 2), eta: wk(-5, 4), p: [1], v: '25142668' }], pol: wk(-5, 4),
      plan: [-62, -57, -53, -49, -48, wk(-6, 2), wk(-5, 4), wk(-5, 4)] },
    { id: 'zk-a2', nomer: '1387', k: 'a', prod: 'p-a-ffs', obem: 180, sposob: 'vagon', dg: 'dg-a', pl: 'kazan', z: -51, zt: '11:50',
      hod: [-50, -45, -41, -37, -35], partii: [[-37, 60], [-36, 60], [-35, 60]],
      otgr: [{ d: wk(-4, 0), eta: wk(-4, 3), p: [0], v: '25163115' }, { d: wk(-4, 2), eta: wk(-4, 4), p: [1], v: '25163123' },
        { d: wk(-3, 1), eta: wk(-3, 4), p: [2], v: '25163131' }], pol: wk(-3, 4),
      plan: [-50, -45, -41, -37, -35, wk(-4, 0), wk(-3, 4), wk(-3, 4)] },
    { id: 'zk-a3', nomer: '1408', k: 'a', prod: 'p-a-ffs', obem: 60, sposob: 'vagon', dg: 'dg-a', pl: 'kazan', z: -29, zt: '09:20',
      hod: [-28, -23, -19, -15, -14], partii: [[-14, 60]], otgr: [{ d: wk(-1, 1), eta: wk(-1, 4), p: [0], v: '25212037' }], pol: wk(-1, 4),
      plan: [-28, -23, -19, -15, -14, wk(-1, 1), wk(-1, 4), wk(-1, 4)] },
    { id: 'zk-a4', nomer: '1409', k: 'a', prod: 'p-a-ffs', obem: 60, sposob: 'vagon', dg: 'dg-a', pl: 'kazan', z: -27, zt: '15:00',
      hod: [-26, -21, -17, -13, -11], partii: [[-11, 60]],
      otgr: [{ d: wk(0, 0), eta: off(2), p: [0], v: '25223705', st: 'v-puti', tm: '08:40' }],
      plan: [-26, -21, -17, -13, -11, wk(0, 0), 2, 2] },
    { id: 'zk-a5', nomer: '1422', k: 'a', prod: 'p-a-ffs', obem: 180, sposob: 'vagon', dg: 'dg-a', pl: 'kazan', z: -11, zt: '10:10',
      hod: [-10, -5, -1],
      otgr: [{ d: wk(1, 4), st: 'plan', t: 60 }, { d: wk(2, 4), st: 'plan', t: 60 }, { d: wk(3, 4), st: 'plan', t: 60 }],
      plan: [-10, -5, -1, 3, 4, wk(1, 4), wk(3, 6), wk(3, 6)] },
    { id: 'zk-a6', nomer: '1425', k: 'a', prod: 'p-a-ffs', obem: 120, sposob: 'vagon', dg: 'dg-a', pl: 'kazan', z: -8, zt: '13:40',
      hod: [-7, -2], otgr: [{ d: wk(4, 1), st: 'plan', t: 60 }, { d: wk(5, 1), st: 'plan', t: 60 }],
      plan: [-7, -2, 3, 7, 9, wk(4, 1), wk(5, 4), wk(5, 4)] },

    /* Каменореченский завод сухих смесей: договор 58-П, стрейч-худ вагонами из Казани. Заказ 1376 ушёл до графика. */
    { id: 'zk-k0', nomer: '1376', k: 'k', prod: 'p-k-hud', obem: 40, sposob: 'vagon', dg: 'dg-k', pl: 'kazan', z: -70, zt: '14:10',
      hod: [-69, -65, -62, -60], partii: [[-60, 40]], otgr: [{ d: off(-59), eta: off(-56), p: [0], v: '25120956' }], pol: off(-56),
      plan: [-69, -65, -62, -60, -59, -56, -56] },
    { id: 'zk-k1', nomer: '1383', k: 'k', prod: 'p-k-hud', obem: 120, sposob: 'vagon', dg: 'dg-k', pl: 'kazan', z: -60, zt: '10:30',
      hod: [-59, -55, -52, -49], partii: [[-51, 40], [-50, 40], [-49, 40]],
      otgr: [{ d: wk(-6, 1), eta: wk(-6, 4), p: [0], v: '25150394' }, { d: wk(-5, 1), eta: wk(-5, 4), p: [1], v: '25150402' },
        { d: wk(-4, 1), eta: wk(-4, 4), p: [2], v: '25150410' }], pol: wk(-4, 4),
      plan: [-59, -55, -52, -49, wk(-6, 1), wk(-4, 4), wk(-4, 4)] },
    { id: 'zk-k2', nomer: '1406', k: 'k', prod: 'p-k-hud', obem: 80, sposob: 'vagon', dg: 'dg-k', pl: 'kazan', z: -30, zt: '11:00',
      hod: [-29, -25, -22, -20], partii: [[-21, 40], [-20, 40]],
      otgr: [{ d: wk(-2, 1), eta: wk(-2, 4), p: [0], v: '25201488' }, { d: wk(-1, 1), eta: wk(-1, 4), p: [1], v: '25201496' }], pol: wk(-1, 4),
      plan: [-29, -25, -22, -20, wk(-2, 1), wk(-1, 4), wk(-1, 4)] },
    { id: 'zk-k3', nomer: '1416', k: 'k', prod: 'p-k-hud', obem: 40, sposob: 'vagon', dg: 'dg-k', pl: 'kazan', z: -18, zt: '09:50',
      hod: [-17, -13, -10, -8], partii: [[-8, 40]], otgr: [{ d: wk(0, 0), eta: off(4), p: [0], v: '25245150', st: 'v-puti', tm: '08:50' }],
      plan: [-17, -13, -10, -8, wk(0, 0), 4, 4] },
    { id: 'zk-k4', nomer: '1427', k: 'k', prod: 'p-k-hud', obem: 120, sposob: 'vagon', dg: 'dg-k', pl: 'kazan', z: -5, zt: '10:20',
      hod: [-4], otgr: [{ d: wk(2, 1), st: 'plan', t: 40 }, { d: wk(3, 1), st: 'plan', t: 40 }, { d: wk(4, 1), st: 'plan', t: 40 }],
      plan: [-4, 2, 5, 7, wk(2, 1), wk(4, 4), wk(4, 4)] },

    /* Ясноборский молочный комбинат: самовывоз из Казани; ламинирование отстаёт от плана */
    { id: 'zk-m1', nomer: '1379', k: 'm', prod: 'p-m-term', obem: 20, sposob: 'samovyvoz', pl: 'kazan', z: -64, zt: '12:20',
      hod: [-63, -59, -56, -55], partii: [[-55, 20]], okno: -54,
      otgr: [{ d: off(-52), eta: off(-51), p: [0], tm: '09:30', s: '09:00', po: '12:00', vorota: 'Ворота 1' }], pol: off(-51),
      plan: [-63, -59, -56, -55, -52, -51, -51] },
    { id: 'zk-m2', nomer: '1414', k: 'm', prod: 'p-m-lam', obem: 12, sposob: 'samovyvoz', pl: 'kazan', z: -20, zt: '10:00',
      hod: [-19, -15, -10], plan: [-19, -15, -10, -1, 2, 4, 6, 7, 7] },
    { id: 'zk-m3', nomer: '1423', k: 'm', prod: 'p-m-term', obem: 20, sposob: 'samovyvoz', pl: 'kazan', z: -10, zt: '11:40',
      hod: [-9, -4], plan: [-9, -4, 1, 3, 5, 6, 6] },

    /* Агрофирма «Ржаные Ключи»: первый заказ, экструзия отстаёт от плана */
    { id: 'zk-r1', nomer: '1421', k: 'r', prod: 'p-r-kolp', obem: 15, sposob: 'samovyvoz', pl: 'kazan', z: -13, zt: '15:20',
      hod: [-12], plan: [-12, -2, 1, 3, 4, 6, 6] },

    /* Староборский завод теплоизоляции: вагоны из Казани */
    { id: 'zk-s1', nomer: '1397', k: 's', prod: 'p-s-hud', obem: 30, sposob: 'vagon', pl: 'kazan', z: -36, zt: '13:10',
      hod: [-35, -31, -28, -27], partii: [[-27, 30]], otgr: [{ d: off(-25), eta: off(-22), p: [0], v: '25190763' }], pol: off(-22),
      plan: [-35, -31, -28, -27, -25, -22, -22] },
    { id: 'zk-s2', nomer: '1415', k: 's', prod: 'p-s-hud', obem: 40, sposob: 'vagon', pl: 'kazan', z: -19, zt: '14:50',
      hod: [-18, -9, -3], plan: [-18, -10, -4, 1, 3, 6, 6] },

    /* Ветрогорский завод бытовой техники: самовывоз из Нижнекамска; окно назначено */
    { id: 'zk-v1', nomer: '1389', k: 'v', prod: 'p-v-term', obem: 25, sposob: 'samovyvoz', pl: 'nizhnekamsk', z: -48, zt: '10:50',
      hod: [-47, -43, -40, -39], partii: [[-39, 25]], okno: -38,
      otgr: [{ d: off(-36), eta: off(-35), p: [0], tm: '13:30', s: '13:00', po: '16:00', vorota: 'Ворота 2' }], pol: off(-35),
      plan: [-47, -43, -40, -39, -36, -35, -35] },
    { id: 'zk-v2', nomer: '1413', k: 'v', prod: 'p-v-term', obem: 25, sposob: 'samovyvoz', pl: 'nizhnekamsk', z: -23, zt: '11:20',
      hod: [-22, -18, -15, -13], partii: [[-13, 25]], okno: -4,
      otgr: [{ d: off(3), st: 'plan', p: [0], s: '13:00', po: '16:00', vorota: 'Ворота 2' }],
      plan: [-22, -18, -15, -13, 3, 4, 4] },

    /* Кедроборский лесокомбинат: вагоны из Тобольска */
    { id: 'zk-d1', nomer: '1374', k: 'd', prod: 'p-d-kolp', obem: 30, sposob: 'vagon', pl: 'tobolsk', z: -74, zt: '09:30',
      hod: [-73, -69, -66, -64], partii: [[-64, 30]], otgr: [{ d: off(-62), eta: off(-59), p: [0], v: '25117482' }], pol: off(-59),
      plan: [-73, -69, -66, -64, -62, -59, -59] },
    { id: 'zk-d2', nomer: '1424', k: 'd', prod: 'p-d-kolp', obem: 30, sposob: 'vagon', pl: 'tobolsk', z: -9, zt: '10:30',
      hod: [-8, -3], plan: [-8, -3, 2, 4, 6, 9, 9] },

    /* Лиственский завод упаковочных плёнок: компаунд самовывозом из Казани; окно ещё не назначено */
    { id: 'zk-l1', nomer: '1393', k: 'l', prod: 'p-l-0140', obem: 10, sposob: 'samovyvoz', pl: 'kazan', z: -44, zt: '15:40',
      hod: [-43, -38, -37], partii: [[-37, 10]], okno: -36,
      otgr: [{ d: off(-34), eta: off(-33), p: [0], tm: '10:30', s: '10:00', po: '12:00', vorota: 'Ворота 4' }], pol: off(-33),
      plan: [-43, -38, -37, -34, -33, -33] },
    { id: 'zk-l2', nomer: '1419', k: 'l', prod: 'p-l-0140', obem: 15, sposob: 'samovyvoz', pl: 'kazan', z: -15, zt: '13:20',
      hod: [-14, -8, -6], partii: [[-6, 15]], plan: [-14, -8, -6, 2, 3, 3] }
  ].forEach(fonZakaz);

  /* Рамочные договоры фона: план по неделям того же «квартала», что у договора 47-П. */
  function nedeli(tonny) { return tonny.map(function (tonn, i) { return { nedelya: wk(i - 6, 0), tonn: tonn }; }); }
  var fonDogovory = [
    { id: 'dg-h', nomer: '39-П', zakazchikId: 'svetlodol', s: '@-10m', po: '@+2m', plan: nedeli([60, 120, 60, 60, 120, 60, 120, 60, 60, 120, 60, 60, 120]) },
    { id: 'dg-a', nomer: '49-П', zakazchikId: 'kremnegorsk', s: '@-7m', po: '@+5m', plan: nedeli([60, 60, 120, 60, 60, 60, 120, 60, 60, 60, 120, 60, 60]) },
    { id: 'dg-k', nomer: '58-П', zakazchikId: 'kamenorechye', s: '@-3m', po: '@+9m', plan: nedeli([40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40]) }
  ];
  fonDogovory.forEach(function (d) { fonDokumenty.push(dk('dk-' + d.id, 'dogovor', d.nomer, d.s, 'dogovor', d.id)); });

  /* Претензии фона: четыре закрыты, три открыты на разных шагах службы сервиса.
     Номера растут с днём подачи вместе со сценарными № 27 и № 31. */
  var fonPretenzii = [
    { id: 'pr-d1', nomer: '23', zakazchikId: 'kedrobor', partiyaId: 'pt-d1a', vid: 'tolshchina',
      opisanie: 'Часть колпаков тоньше спецификации и рвётся при натяжении на пакет пиломатериалов.', foto: [],
      sobytiya: [
        s('pretenziya', t(-55, '10:40'), 'd-tehnolog'),
        s('vzyata', t(-55, '15:20'), SER),
        s('otvet', t(-54, '11:00'), SER, { text: 'Проверяем толщину по контрольным образцам партии в лаборатории КЗПМ.' }),
        s('zakryta', t(-45, '16:30'), SER, { reshenie: 'Лаборатория подтвердила отклонение толщины на части рулонов. Колпаки с дефектом заменены отдельной отгрузкой.' })
      ] },
    { id: 'pr-h0', nomer: '24', zakazchikId: 'svetlodol', partiyaId: 'pt-h0a', vid: 'shov',
      opisanie: 'На линии фасовки часть мешков расходится по верхнему шву после заполнения.', foto: ['foto-shov'],
      sobytiya: [
        s('pretenziya', t(-50, '09:50'), 'h-tehnolog'),
        s('vzyata', t(-50, '13:30'), SER),
        s('otvet', t(-49, '10:15'), SER, { text: 'Запросили у лаборатории режим сварки по партии. Ответим после проверки.' }),
        s('zakryta', t(-43, '15:00'), SER, { reshenie: 'Причиной был режим сварки на одной линии. Режим исправлен, мешки с дефектом заменены.' })
      ] },
    { id: 'pr-k0', nomer: '25', zakazchikId: 'kamenorechye', partiyaId: 'pt-k0a', vid: 'razmer',
      opisanie: 'Рукав уже спецификации на 20 мм, худ плохо надевается на паллету.', foto: [],
      sobytiya: [
        s('pretenziya', t(-47, '11:20'), 'k-tehnolog'),
        s('vzyata', t(-47, '14:40'), SER),
        s('otvet', t(-46, '10:30'), SER, { text: 'Ширину рукава проверим по контрольным образцам партии.' }),
        s('obraztsy', t(-46, '10:35'), SER, { text: 'Просим отправить два рулона из партии № 1376-1 для проверки в лаборатории КЗПМ.' }),
        s('zakryta', t(-41, '16:10'), SER, { reshenie: 'Ширина рукава в допуске спецификации. В следующих заказах рукав будет шире на 20 мм под линию заказчика.' })
      ] },
    { id: 'pr-m1', nomer: '26', zakazchikId: 'yasnobor', partiyaId: 'pt-m1a', vid: 'kolichestvo',
      opisanie: 'При приёмке на складе не хватило двух рулонов против накладной.', foto: [],
      sobytiya: [
        s('pretenziya', t(-44, '10:05'), 'm-zakupshchik'),
        s('vzyata', t(-44, '13:15'), SER),
        s('otvet', t(-43, '11:40'), SER, { text: 'Сверяем выдачу по весу и журналу склада.' }),
        s('zakryta', t(-40, '15:20'), SER, { reshenie: 'Недостача подтверждена. Два рулона выданы по следующему окну самовывоза.' })
      ] },
    { id: 'pr-a1', nomer: '28', zakazchikId: 'kremnegorsk', partiyaId: 'pt-a2b', vid: 'pechat',
      opisanie: 'На части мешков печать смещена к шву, номер партии на мешке не читается.', foto: ['foto-pechat'],
      sobytiya: [
        s('pretenziya', t(-12, '10:30'), 'a-zakupshchik'),
        s('vzyata', t(-12, '14:10'), SER),
        s('otvet', t(-11, '11:20'), SER, { text: 'Смещение печати на фото видно. Проверим мешки из партии в лаборатории КЗПМ.' }),
        s('obraztsy', t(-11, '11:25'), SER, { text: 'Просим отправить пять мешков с дефектом из партии № 1387-2 для проверки в лаборатории КЗПМ.' })
      ] },
    { id: 'pr-h1', nomer: '29', zakazchikId: 'svetlodol', partiyaId: 'pt-h3b', vid: 'razryv',
      opisanie: 'Часть мешков рвётся по дну при сбросе на транспортёр, около 1 % мешков партии.', foto: ['foto-razryv'],
      sobytiya: [
        s('pretenziya', t(-5, '09:40'), 'h-tehnolog'),
        s('vzyata', t(-5, '13:00'), SER),
        s('otvet', t(-2, '10:30'), SER, { text: 'Лаборатория проверила прочность мешков из контрольных образцов партии. Готовим решение по замене.' })
      ] },
    { id: 'pr-s1', nomer: '30', zakazchikId: 'starobor', partiyaId: 'pt-s1a', vid: 'tolshchina',
      opisanie: 'Плёнка на части рулонов тоньше спецификации, худ рвётся на углах паллеты.', foto: [],
      sobytiya: [
        s('pretenziya', t(-3, '11:15'), 's-tehnolog'),
        s('vzyata', t(-2, '09:30'), SER)
      ] }
  ];

  Array.prototype.push.apply(produkty, fonProdukty);
  Array.prototype.push.apply(zakazy, fonZakazy);
  Array.prototype.push.apply(partii, fonPartii);
  Array.prototype.push.apply(otgruzki, fonOtgruzki);
  Array.prototype.push.apply(dogovory, fonDogovory);
  Array.prototype.push.apply(pretenzii, fonPretenzii);
  Array.prototype.push.apply(dokumenty, fonDokumenty);

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }

  w.MOCK = freeze({
    zavod: zavod,
    lyudi: lyudi,
    zakazchiki: zakazchiki,
    produkty: produkty,
    zakazy: zakazy,
    partii: partii,
    otgruzki: otgruzki,
    dogovory: dogovory,
    pretenzii: pretenzii,
    dokumenty: dokumenty,
    spravochnik: spravochnik,
    demo: demo
  });
})(window);

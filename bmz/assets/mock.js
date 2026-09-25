/* Исходные демо-данные. Неизменны: всё, что меняется в показе, пишется
   в журнал действий (store.js) и проигрывается поверх в dannye.js.
   Читает этот файл только dannye.js.

   Даты — смещения от дня показа, строкой: «@-30» — 30 дней назад,
   «@+14» — через 14 дней, «@-21m» — 21 месяц назад. В ISO их превращает
   dannye.js при открытии страницы.

   Завод, его направления, отделы, типы аппаратов, условные обозначения и ТУ —
   из материалов завода. Заказчики — предприятия из слайда «Нам доверяют»
   и списка партнёров завода. Что им поставлено, неизвестно: аппараты,
   техпозиции, даты и люди выдуманы. Сотрудники завода, кроме директора, выдуманы, должности
   настоящие. Сумм нет. */
(function (w) {
  'use strict';

  /* ---------- справочники ---------- */

  var zavod = {
    name: 'ООО «Бугульминский механический завод»',
    short: 'ООО «БМЗ»',
    gruppa: 'Группа «Татнефть»',
    gorod: 'Бугульма',
    telefon: '8 (85594) 7-60-72, 7-60-74',
    napravleniya: [
      'Нефтеаппаратура: аппараты воздушного охлаждения, теплообменные и ёмкостные аппараты',
      'Трубная продукция и антикоррозионное покрытие труб',
      'Нефтепромысловое оборудование',
      'Блоки технологические'
    ],
    otdely: [
      { id: 'omp', title: 'Отдел маркетинга и продаж' },
      { id: 'ggk', title: 'Группа главного конструктора' },
      { id: 'otk', title: 'Служба технического контроля (ОТК)' }
    ]
  };

  var etapy = [
    { id: 'zayavka', title: 'Заявка' },
    { id: 'raschet', title: 'Расчёт и ТКП' },
    { id: 'dogovor', title: 'Договор' },
    { id: 'chertezh', title: 'Чертёж согласован' },
    { id: 'metall', title: 'Металл получен' },
    { id: 'svarka', title: 'Сварка' },
    { id: 'ispytaniya', title: 'Гидроиспытания' },
    { id: 'gotov', title: 'Готов' },
    { id: 'otgruzhen', title: 'Отгружен' }
  ];

  var tipy = {
    avo: { title: 'Аппарат воздушного охлаждения', short: 'АВО' },
    teploobmennik: { title: 'Теплообменный аппарат', short: 'Теплообменник' },
    emkost: { title: 'Ёмкостный аппарат', short: 'Ёмкость' }
  };

  var vidy = {
    tkp: 'Технико-коммерческое предложение',
    sborochnyy: 'Сборочный чертёж общего вида',
    raschet: 'Расчёт на прочность',
    pmi: 'Программа и методика испытаний',
    pasport: 'Паспорт',
    re: 'Руководство по эксплуатации',
    protokol: 'Протокол'
  };

  var kody = { 1: 'Одобрено', 2: 'Одобрено с замечаниями', 3: 'Переделать', 4: 'Для сведения' };

  /* ---------- люди ---------- */

  var lyudi = [
    { id: 'z-garipova', side: 'zavod', otdel: 'omp', name: 'Алсу Гарипова', position: 'Ведущий специалист отдела маркетинга и продаж', phone: '+7 000 000-11-01', email: 'demo@bmz.example' },
    { id: 'z-safin', side: 'zavod', otdel: 'omp', name: 'Денис Сафин', position: 'Ведущий специалист отдела маркетинга и продаж', phone: '+7 000 000-11-02', email: 'demo@bmz.example' },
    { id: 'z-valeev', side: 'zavod', otdel: 'omp', name: 'Рустем Валеев', position: 'Начальник отдела маркетинга и продаж', phone: '+7 000 000-11-03', email: 'demo@bmz.example' },
    { id: 'z-hasanov', side: 'zavod', otdel: 'ggk', name: 'Ильдар Хасанов', position: 'Инженер-конструктор группы главного конструктора', phone: '+7 000 000-11-04', email: 'demo@bmz.example' },
    { id: 'z-kuznecova', side: 'zavod', otdel: 'ggk', name: 'Марина Кузнецова', position: 'Инженер-конструктор группы главного конструктора', phone: '+7 000 000-11-05', email: 'demo@bmz.example' },
    { id: 'z-orlov', side: 'zavod', otdel: 'otk', name: 'Сергей Орлов', position: 'Контролёр ОТК', phone: '+7 000 000-11-06', email: 'demo@bmz.example' },
    /* Директор завода — настоящий человек, решение Аделя 26.09: демо персонализировано для него.
       Должность — как в реквизитах завода. Других настоящих имён не добавлять.
       home — своя главная: после входа и по логотипу — сводка; у остальных главная роли. */
    { id: 'z-valikov', side: 'zavod', otdel: null, name: 'Эдуард Валиков', position: 'Директор', phone: '+7 000 000-11-00', email: 'demo@bmz.example', home: 'svodka.html' },

    { id: 'k-mironov', side: 'zakazchik', zakazchikId: 'taneko', ustanovka: 'Установка гидроочистки дизельного топлива', name: 'Олег Миронов', position: 'Ведущий специалист отдела материально-технического обеспечения', phone: '+7 000 000-21-01', email: 'demo@taneko.example' },
    { id: 'k-zaycev', side: 'zakazchik', zakazchikId: 'taneko', ustanovka: 'Установка гидроочистки дизельного топлива', name: 'Андрей Зайцев', position: 'Инженер установки гидроочистки', phone: '+7 000 000-21-02', email: 'demo@taneko.example' },
    { id: 'k-gubaydullin', side: 'zakazchik', zakazchikId: 'taneko', ustanovka: 'Установка замедленного коксования', name: 'Ринат Губайдуллин', position: 'Механик установки замедленного коксования', phone: '+7 000 000-21-03', email: 'demo@taneko.example' },
    { id: 'k-sokolov', side: 'zakazchik', zakazchikId: 'omsk', ustanovka: null, name: 'Павел Соколов', position: 'Главный механик', phone: '+7 000 000-22-01', email: 'demo@onpz.example' },
    { id: 'k-belova', side: 'zakazchik', zakazchikId: 'perm', ustanovka: null, name: 'Елена Белова', position: 'Инженер отдела оборудования', phone: '+7 000 000-23-01', email: 'demo@pnos.example' },
    { id: 'k-nikitin', side: 'zakazchik', zakazchikId: 'nizhny', ustanovka: null, name: 'Игорь Никитин', position: 'Ведущий инженер-механик', phone: '+7 000 000-24-01', email: 'demo@nnos.example' },
    { id: 'k-frolov', side: 'zakazchik', zakazchikId: 'syzran', ustanovka: null, name: 'Максим Фролов', position: 'Инженер по снабжению', phone: '+7 000 000-25-01', email: 'demo@snpz.example' },
    { id: 'k-shakirova', side: 'zakazchik', zakazchikId: 'kazan', ustanovka: null, name: 'Гульнара Шакирова', position: 'Инженер-механик цеха', phone: '+7 000 000-26-01', email: 'demo@kos.example' },
    { id: 'k-romanov', side: 'zakazchik', zakazchikId: 'ink', ustanovka: null, name: 'Виктор Романов', position: 'Главный механик', phone: '+7 000 000-27-01', email: 'demo@ink.example' },
    { id: 'k-kovalev', side: 'zakazchik', zakazchikId: 'belorus', ustanovka: null, name: 'Дмитрий Ковалёв', position: 'Инженер отдела главного механика', phone: '+7 000 000-28-01', email: 'demo@bn.example' }
  ];

  /* Кто открывает прототип в каждой роли, пока человек не выбран. */
  var poUmolchaniyu = { zakazchik: 'k-zaycev', zavod: 'z-garipova' };

  /* ---------- заказчики ---------- */

  var GO = 'Установка гидроочистки дизельного топлива';
  var AVT = 'ЭЛОУ-АВТ-7';
  var UZK = 'Установка замедленного коксования';
  var GK = 'Комплекс гидрокрекинга';

  var zakazchiki = [
    { id: 'taneko', name: 'АО «ТАНЕКО»', group: 'Группа «Татнефть»', city: 'Нижнекамск', ustanovki: [GO, AVT, UZK, GK] },
    { id: 'omsk', name: 'АО «Газпромнефть — Омский НПЗ»', group: 'Газпром нефть', city: 'Омск', ustanovki: ['Установка каталитического риформинга', 'Установка АВТ-10'] },
    { id: 'perm', name: 'ООО «ЛУКОЙЛ-Пермнефтеоргсинтез»', group: 'ЛУКОЙЛ', city: 'Пермь', ustanovki: ['Установка гидроочистки', 'Установка АВТ-4'] },
    { id: 'nizhny', name: 'ООО «ЛУКОЙЛ-Нижегороднефтеоргсинтез»', group: 'ЛУКОЙЛ', city: 'Кстово', ustanovki: ['Установка каталитического крекинга'] },
    { id: 'syzran', name: 'АО «Сызранский НПЗ»', group: 'Роснефть', city: 'Сызрань', ustanovki: ['Установка АВТ-6'] },
    { id: 'kazan', name: 'ПАО «Казаньоргсинтез»', group: 'СИБУР', city: 'Казань', ustanovki: ['Производство этилена'] },
    { id: 'ink', name: 'ООО «Иркутская нефтяная компания»', group: 'ИНК', city: 'Иркутск', ustanovki: ['Установка подготовки нефти'] },
    { id: 'belorus', name: 'РУП «Производственное объединение «Белоруснефть»', group: 'Белоруснефть', city: 'Гомель', ustanovki: ['Цех подготовки и перекачки нефти'] }
  ];

  /* ---------- шаблоны опросных листов (демо) ---------- */

  var oprosnye = {
    avo: {
      tip: 'avo', nazvanie: 'АВО зигзагообразный', oboznachenie: 'АВЗ-Д-9-Ж-1,6-Б1-В1Т/4-2-8 УХЛ1', tu: 'ТУ 26-02-1043-87',
      /* Ровно поля короткого опросного листа (06a): без количества, режима листа
         и климатического исполнения. Кнопка «Заполнить демо-данными» новой
         заявки берёт отсюда всё, включая демо-схему. */
      techPoz: 'ВХ-115', status: 'Вновь вводимое',
      sreda: 'Дизельная фракция', rashod: '42 т/ч', nagruzka: '2,5 МВт', davlenieRaschetnoe: '1,6 МПа',
      tempVhod: '140 °C', tempVyhod: '55 °C', garantiyaMes: 24,
      shefMontazh: true, zip: 'На два года эксплуатации',
      skhema: { name: 'Схема ВХ-115 — привязка штуцеров.pdf', size: 190464, type: 'application/pdf', demo: true }
    },
    teploobmennik: {
      tip: 'teploobmennik', nazvanie: 'Теплообменник с плавающей головкой', oboznachenie: 'ТП 800-1,6-М1/25-6-2', tu: 'ТУ 3612-023-00220302-01',
      techPoz: 'Т-210', kolichestvo: 1, status: 'Для заказа', sreda: 'Нефть / дизельная фракция',
      davlenieRaschetnoe: '1,6 МПа', tempVhod: '220 °C', tempVyhod: '120 °C', garantiyaMes: 24, shefMontazh: false, skhema: null
    },
    emkost: {
      tip: 'emkost', nazvanie: 'Ёмкость горизонтальная', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3615-023-00220322-2001',
      techPoz: 'Е-320', kolichestvo: 1, sreda: 'Нефтепродукт', obyom: '25 м³', davlenieRaschetnoe: '0,07 МПа',
      gruppa: 'Группа 3 по ГОСТ 34347-2017', garantiyaMes: 24, shefMontazh: false, skhema: null
    }
  };

  /* ---------- помощники сборки (данные на выходе, не логика) ---------- */

  var ETAPY = etapy.map(function (e) { return e.id; });

  function off(n) { return '@' + (n < 0 ? '' : '+') + n; }
  function offM(n) { return '@' + (n < 0 ? '' : '+') + n + 'm'; }

  /* Даты этапов по порядку: заявка … отгружен. */
  function daty(list) {
    var out = {};
    ETAPY.forEach(function (id, i) { out[id] = list[i]; });
    return out;
  }
  function datyDni(a) { return daty(a.map(off)); }

  function rev(r, date, kod, naKom, srok) {
    return { rev: r, date: date, kod: kod === undefined ? null : kod, naKom: naKom || null, srok: srok || null };
  }
  /* extra — поля листа для превью: nomer — исходящий номер ТКП или номер протокола. */
  function doc(id, vid, revizii, title, extra) {
    var d = { id: id, vid: vid, title: title || vidy[vid], revizii: revizii || [] };
    for (var k in extra || {}) { d[k] = extra[k]; }
    return d;
  }
  function sob(date, kto, chto) { return { date: date, kto: kto, chto: chto }; }

  function base(o) {
    var a = {
      kolichestvo: 1, zavNomer: null, naKom: null, srokOtveta: null, zadanie: null, oprosnyList: null,
      pmi: [], dokumenty: [], zamechaniya: [], istoriya: [], postavka: null, obrashcheniya: []
    };
    for (var k in o) { a[k] = o[k]; }
    return a;
  }

  var MAT = {
    avo: [
      { element: 'Камеры, кожух', marka: 'Ст3сп', gost: 'ГОСТ 380-94' },
      { element: 'Трубные решётки', marka: '16ГС', gost: 'ГОСТ 5520-79' },
      { element: 'Трубы', marka: 'Сталь 20', gost: 'ГОСТ 8733-74' }
    ],
    teploobmennik: [
      { element: 'Корпус', marka: '09Г2С', gost: 'ГОСТ 5520-2017' },
      { element: 'Трубные решётки', marka: '16ГС', gost: 'ГОСТ 5520-2017' },
      { element: 'Трубы', marka: 'Сталь 20', gost: 'ГОСТ 8733-74' }
    ],
    emkost: [
      { element: 'Обечайка и днища', marka: '09Г2С', gost: 'ГОСТ 5520-2017' },
      { element: 'Опоры', marka: 'Ст3сп', gost: 'ГОСТ 380-2005' },
      { element: 'Фланцы штуцеров', marka: '09Г2С', gost: 'ГОСТ 33259-2015' }
    ]
  };

  function pasport(tip, h) {
    h = h || {};
    return {
      obshchie: {
        naznachenie: h.naznachenie || (tip === 'avo' ? 'Охлаждение нефтепродуктов' : tip === 'teploobmennik' ? 'Теплообмен между технологическими средами' : 'Приём и хранение технологической среды')
      },
      harakteristiki: {
        davlenieRabochee: h.pRab || '1,2 МПа',
        davlenieRaschetnoe: h.pRasch || '1,6 МПа',
        davlenieProbnoe: h.pProb || '2,3 МПа',
        tempRaschetnaya: h.t || '200 °C',
        tempMinStenki: h.tMin || 'минус 40 °C',
        sreda: h.sreda || 'Нефтепродукт',
        gruppa: h.gruppa || 'Группа 1 по ГОСТ 34347-2017',
        obyom: h.obyom || '—',
        massa: h.massa || '12 400 кг',
        pribavka: h.pribavka || '3 мм'
      },
      materialy: MAT[tip],
      svarka: 'Автоматическая под флюсом и ручная дуговая; контроль швов РК 100 %, УЗК',
      termoobrabotka: h.to || 'Высокий отпуск 620 ± 20 °C, выдержка 2 ч, охлаждение с печью',
      gidro: { davlenie: h.pProb || '2,3 МПа', vyderzhka: '10 мин', sreda: 'Вода', rezultat: 'Течей и потения нет' },
      otk: 'Аппарат изготовлен и испытан в соответствии с конструкторской документацией и ТУ, признан годным к эксплуатации'
    };
  }

  var ZIP_OBSHCHIY = {
    avo: [['Прокладка крышки камеры', 'АВЗ.ЗИП.01', 8, 10], ['Пробка камеры с прокладкой', 'АВЗ.ЗИП.02', 20, 7], ['Лопасть вентилятора', 'АВЗ.ЗИП.03', 4, 30],
      ['Ремень клиновой привода вентилятора', 'АВЗ.ЗИП.04', 4, 14], ['Подшипник вала вентилятора', 'АВЗ.ЗИП.05', 2, 21], ['Прокладка штуцера Ду150 Ру1,6', 'АВЗ.ЗИП.06', 4, 10]],
    teploobmennik: [['Прокладка распределительной камеры', 'ТП.ЗИП.01', 2, 14], ['Прокладка плавающей головки', 'ТП.ЗИП.02', 2, 14], ['Шпилька М24 с гайками', 'ТП.ЗИП.03', 24, 7],
      ['Прокладка крышки кожуха', 'ТП.ЗИП.04', 2, 14], ['Прокладка штуцера Ду100 Ру1,6', 'ТП.ЗИП.05', 6, 10]],
    emkost: [['Прокладка штуцера Ду80', 'Е.ЗИП.01', 6, 10], ['Прокладка люка Ду500', 'Е.ЗИП.02', 2, 14], ['Указатель уровня', 'Е.ЗИП.03', 1, 30],
      ['Крепёж люка: шпилька М20 с гайками', 'Е.ЗИП.04', 20, 7], ['Прокладка штуцера Ду50', 'Е.ЗИП.05', 4, 10]]
  };
  function zip(prefix, rows) {
    return rows.map(function (r, i) {
      return { id: prefix + '-zip-' + (i + 1), title: r[0], oboznachenie: r[1], kolvo: r[2], srokIzgotovleniyaDney: r[3] };
    });
  }

  /* Ближайший осмотр — раз в два года от ввода, гидроиспытание — раз в восемь лет.
     Периодичность демо: по ФНП 536 и паспорту не сверялась. */
  function osvid(vvodM, blizh) {
    var k = 24 - (vvodM % 24);
    var n = blizh || offM(k);
    return [
      { vid: 'naruzhnyy', date: n },
      { vid: 'vnutrenniy', date: n },
      { vid: 'gidro', date: offM(96 - (vvodM % 96)) }
    ];
  }

  /* Поставленный аппарат: этапы пройдены, паспорт, ЗИП, календарь осмотров. */
  function postavlen(o) {
    var m = o.vvodM;
    var a = base({
      id: o.id, tip: o.tip, nazvanie: o.nazvanie, oboznachenie: o.oboznachenie, tu: o.tu,
      zakazchikId: o.zakazchikId, ustanovka: o.ustanovka, techPoz: o.techPoz, zavNomer: o.zavNomer,
      etap: 'otgruzhen', managerId: o.managerId || (o.zakazchikId === 'taneko' ? 'z-garipova' : 'z-safin'),
      etapDaty: daty([offM(-m - 10), offM(-m - 9), offM(-m - 8), offM(-m - 7), offM(-m - 6), offM(-m - 5), offM(-m - 3), offM(-m - 2), offM(-m - 1)]),
      nachaloEtapa: offM(-m - 1),
      dokumenty: [
        doc(o.id + '-sborochnyy', 'sborochnyy', [rev('A', offM(-m - 7), 1)]),
        doc(o.id + '-pasport', 'pasport', [rev('1', offM(-m - 1), null)]),
        doc(o.id + '-re', 're', [rev('1', offM(-m - 1), null)]),
        doc(o.id + '-gidro', 'protokol', [rev('1', offM(-m - 3), null)], 'Протокол гидравлических испытаний')
      ],
      istoriya: [
        sob(offM(-m - 1), o.managerId || (o.zakazchikId === 'taneko' ? 'z-garipova' : 'z-safin'), 'Аппарат отгружен, паспорт и руководство переданы'),
        sob(offM(-m), 'z-orlov', 'Аппарат введён в эксплуатацию')
      ],
      postavka: {
        vvod: offM(-m), garantiyaMes: o.garantiyaMes || 24,
        osvid: o.osvid || osvid(m, o.blizh),
        zip: o.zip || zip(o.id, ZIP_OBSHCHIY[o.tip]),
        pasport: pasport(o.tip, o.h),
        shefMontazh: !!o.shefMontazh
      }
    });
    return a;
  }

  /* ---------- опорные аппараты ТАНЕКО, установка гидроочистки ---------- */

  var vh101 = base({
    id: 'vh-101', tip: 'avo', nazvanie: 'АВО зигзагообразный', oboznachenie: 'АВЗ-Д-9-Ж-1,6-Б1-В1Т/4-2-8 УХЛ1',
    tu: 'ТУ 26-02-1043-87', zakazchikId: 'taneko', ustanovka: GO, techPoz: 'ВХ-101', kolichestvo: 1,
    etap: 'chertezh', etapDaty: datyDni([-70, -62, -48, 12, 40, 65, 90, 100, 110]), nachaloEtapa: off(-48),
    naKom: 'zavod', srokOtveta: off(2), managerId: 'z-garipova',
    zadanie: { konstruktorId: 'z-hasanov', srok: off(-10), status: 'naznacheno', komment: 'Сборочный чертёж и 3D-модель по опросному листу' },
    oprosnyList: Object.assign({}, oprosnye.avo, { techPoz: 'ВХ-101',
      skhema: { name: 'Схема ВХ-101 — привязка штуцеров.pdf', size: 190464, type: 'application/pdf' } }),
    dokumenty: [
      doc('vh-101-tkp', 'tkp', [rev('A', off(-62), 1)], null, { nomer: '11-2/0418' }),
      doc('vh-101-sborochnyy', 'sborochnyy', [rev('A', off(-8), 2, 'zavod', off(2))]),
      doc('vh-101-raschet', 'raschet', [rev('A', off(-8), 4)]),
      doc('vh-101-pmi', 'pmi', []),
      doc('vh-101-pasport', 'pasport', [])
    ],
    zamechaniya: [
      { id: 'vh-101-zm-1', dokumentId: 'vh-101-sborochnyy', rev: 'A', poziciya: 'штуцер А', text: 'Перенести штуцер А на третью пару секций — ближе к нашему трубопроводу', avtor: 'k-zaycev', date: off(-3), otvet: null },
      { id: 'vh-101-zm-2', dokumentId: 'vh-101-sborochnyy', rev: 'A', poziciya: null, text: 'Добавить площадку обслуживания у коллекторов со стороны штуцеров', avtor: 'k-zaycev', date: off(-3), otvet: null }
    ],
    istoriya: [
      sob(off(-70), 'k-zaycev', 'Заявка с опросным листом отправлена заводу'),
      sob(off(-62), 'z-garipova', 'ТКП направлено заказчику'),
      sob(off(-48), 'z-garipova', 'ТКП принято, договор подписан'),
      sob(off(-47), 'z-garipova', 'Задание передано конструктору'),
      sob(off(-8), 'z-hasanov', 'Сборочный чертёж общего вида, рев. A, выложен на согласование вместе с 3D-моделью'),
      sob(off(-3), 'k-zaycev', 'Два замечания к сборочному чертежу, рев. A'),
      sob(off(-3), 'k-zaycev', 'Ответ на сборочный чертёж, рев. A: код 2 «Одобрено с замечаниями»')
    ]
  });

  var t203 = base({
    id: 't-203', tip: 'teploobmennik', nazvanie: 'Теплообменник с плавающей головкой', oboznachenie: 'ТП 800-1,6-М1/25-6-2',
    tu: 'ТУ 3612-023-00220302-01', zakazchikId: 'taneko', ustanovka: GO, techPoz: 'Т-203', zavNomer: '41206',
    etap: 'svarka', etapDaty: datyDni([-150, -140, -125, -95, -60, 8, 14, 22, 30]), nachaloEtapa: off(-60),
    naKom: 'zakazchik', srokOtveta: off(2), managerId: 'z-garipova',
    zadanie: { konstruktorId: 'z-kuznecova', srok: off(-100), status: 'vypolneno', komment: 'КД по опросному листу, согласование с ТАНЕКО' },
    oprosnyList: oprosnye.teploobmennik,
    pmi: [
      { id: 't-203-p1', title: 'Входной контроль металла', tip: 'R', status: 'done', date: off(-58), protokol: true, otvetZakazchika: null, priedut: null },
      { id: 't-203-p2', title: 'Вальцовка и сборка корпуса', tip: 'R', status: 'done', date: off(-30), protokol: true, otvetZakazchika: null, priedut: null },
      { id: 't-203-p3', title: 'Неразрушающий контроль сварных швов (РК)', kratko: 'РК', tip: 'H', status: 'current', date: off(-2), protokol: true, otvetZakazchika: null, priedut: null },
      { id: 't-203-p4', title: 'Сборка трубного пучка', tip: 'R', status: 'plan', date: off(6), protokol: false, otvetZakazchika: null, priedut: null },
      { id: 't-203-p5', title: 'Гидравлические испытания', kratko: 'гидроиспытания', tip: 'W', status: 'plan', date: off(14), protokol: false, otvetZakazchika: null, priedut: null },
      { id: 't-203-p6', title: 'Окраска и консервация', tip: 'R', status: 'plan', date: off(20), protokol: false, otvetZakazchika: null, priedut: null },
      { id: 't-203-p7', title: 'Приёмка перед отгрузкой', tip: 'H', status: 'plan', date: off(26), protokol: false, otvetZakazchika: null, priedut: null }
    ],
    dokumenty: [
      doc('t-203-tkp', 'tkp', [rev('A', off(-140), 1)], null, { nomer: '11-2/0236' }),
      doc('t-203-sborochnyy', 'sborochnyy', [rev('A', off(-115), 2), rev('B', off(-100), 1)]),
      doc('t-203-raschet', 'raschet', [rev('A', off(-115), 4)]),
      doc('t-203-pmi', 'pmi', [rev('A', off(-100), 1)]),
      doc('t-203-p1-protokol', 'protokol', [rev('1', off(-58), null)], 'Протокол входного контроля металла'),
      doc('t-203-p2-protokol', 'protokol', [rev('1', off(-30), null)], 'Протокол вальцовки и сборки корпуса'),
      doc('t-203-p3-protokol', 'protokol', [rev('1', off(-2), null, 'zakazchik', off(2))], 'Протокол радиографического контроля сварных швов'),
      doc('t-203-pasport', 'pasport', [])
    ],
    istoriya: [
      sob(off(-150), 'k-mironov', 'Заявка с опросным листом отправлена заводу'),
      sob(off(-140), 'z-garipova', 'ТКП направлено заказчику'),
      sob(off(-125), 'z-garipova', 'ТКП принято, договор подписан'),
      sob(off(-95), 'k-zaycev', 'Ответ на сборочный чертёж, рев. B: код 1 «Одобрено»'),
      sob(off(-60), 'z-orlov', 'Металл получен, входной контроль пройден'),
      sob(off(-30), 'z-orlov', 'Точка «Вальцовка и сборка корпуса» пройдена, протокол приложен'),
      sob(off(-2), 'z-orlov', 'Протокол РК приложен, точка остановки ждёт подтверждения заказчика')
    ]
  });

  var s305 = postavlen({
    id: 's-305', tip: 'emkost', nazvanie: 'Ёмкость-сепаратор 50 м³', oboznachenie: '[обозначение уточняется]',
    tu: 'ТУ 3683-015-00220322-99', zakazchikId: 'taneko', ustanovka: GO, techPoz: 'С-305', zavNomer: '40718',
    vvodM: 12, garantiyaMes: 24, shefMontazh: true,
    osvid: [
      { vid: 'naruzhnyy', date: '@+3m' },
      { vid: 'vnutrenniy', date: '@+3m' },
      { vid: 'gidro', date: '@+75m' }
    ],
    zip: [
      { id: 's-305-zip-1', title: 'Прокладка штуцера Ду150 Ру1,6', oboznachenie: 'С50.ЗИП.01', kolvo: 4, srokIzgotovleniyaDney: 10 },
      { id: 's-305-zip-2', title: 'Прокладка штуцера Ду80 Ру1,6', oboznachenie: 'С50.ЗИП.02', kolvo: 6, srokIzgotovleniyaDney: 10 },
      { id: 's-305-zip-3', title: 'Прокладка люка Ду500', oboznachenie: 'С50.ЗИП.03', kolvo: 2, srokIzgotovleniyaDney: 14 },
      { id: 's-305-zip-4', title: 'Крепёж люка: шпилька М24 с гайками', oboznachenie: 'С50.ЗИП.04', kolvo: 20, srokIzgotovleniyaDney: 7 },
      { id: 's-305-zip-5', title: 'Указатель уровня', oboznachenie: 'С50.ЗИП.05', kolvo: 1, srokIzgotovleniyaDney: 30 },
      { id: 's-305-zip-6', title: 'Сетчатый отбойник', oboznachenie: 'С50.ЗИП.06', kolvo: 1, srokIzgotovleniyaDney: 21 }
    ],
    h: { naznachenie: 'Отделение газа от жидкой фазы', pRab: '1,0 МПа', pRasch: '1,6 МПа', pProb: '2,3 МПа', t: '100 °C', sreda: 'Нефтепродукт, углеводородный газ', obyom: '50 м³', massa: '14 800 кг', gruppa: 'Группа 1 по ГОСТ 34347-2017' }
  });

  var e307 = postavlen({
    id: 'e-307', tip: 'emkost', nazvanie: 'Ёмкость подземная горизонтальная дренажная', oboznachenie: 'ЕП 25-2400-1-1',
    tu: 'ТУ 3615-023-00220322-2001', zakazchikId: 'taneko', ustanovka: GO, techPoz: 'Е-307', zavNomer: '38841',
    vvodM: 40, garantiyaMes: 24,
    h: { naznachenie: 'Сбор дренажа нефтепродуктов', pRab: '0,05 МПа', pRasch: '0,07 МПа', pProb: '0,1 МПа', t: '60 °C', obyom: '25 м³', massa: '6 900 кг', gruppa: 'Группа 3 по ГОСТ 34347-2017' }
  });

  /* ---------- парк ТАНЕКО: поставленные аппараты на разных установках ---------- */

  var AVZ = ['АВО зигзагообразный', 'АВЗ-20-Ж-0,6-Б1-37/4-2-6 УХЛ1', 'ТУ 26-02-1043-87'];
  var AVG = ['АВО горизонтальный', 'АВГ-9-Ж-1,6-Б1-22-П/4-1-4 УХЛ1', 'ТУ 26-02-1158-96'];
  var TP = ['Теплообменник с плавающей головкой', 'ТП 800-1,6-М1/25-6-2', 'ТУ 3612-023-00220302-01'];
  var TN = ['Теплообменник с неподвижными трубными решётками', '[обозначение уточняется]', 'ТУ 3612-024-00220302-02'];
  var EM = ['Ёмкость горизонтальная', '[обозначение уточняется]', 'ТУ 3615-023-00220322-2001'];
  var NGS = ['Сепаратор нефтегазовый', '[обозначение уточняется]', 'ТУ 3683-015-00220322-99'];

  function park(zakId, rows) {
    return rows.map(function (r) {
      var t = r[2];
      return postavlen({
        id: r[0], techPoz: r[1], tip: t === AVZ || t === AVG ? 'avo' : (t === TP || t === TN ? 'teploobmennik' : 'emkost'),
        nazvanie: t[0], oboznachenie: t[1], tu: t[2], ustanovka: r[3], vvodM: r[4], zavNomer: r[5],
        zakazchikId: zakId, blizh: r[6] || null
      });
    });
  }

  var parkTaneko = park('taneko', [
    ['vh-102', 'ВХ-102', AVZ, GO, 22, '39512'],
    ['t-204', 'Т-204', TP, GO, 30, '39120'],
    ['e-308', 'Е-308', EM, GO, 52, '37305'],
    ['avt-vh-11', 'ВХ-11', AVG, AVT, 47, '37011'],
    ['avt-vh-12', 'ВХ-12', AVG, AVT, 47, '37012'],
    ['avt-t-21', 'Т-21', TN, AVT, 60, '36240'],
    ['avt-t-22', 'Т-22', TN, AVT, 60, '36241'],
    ['avt-e-31', 'Е-31', EM, AVT, 66, '35917'],
    ['avt-s-32', 'С-32', NGS, AVT, 66, '35918'],
    ['uzk-vh-401', 'ВХ-401', AVZ, UZK, 34, '38020'],
    ['uzk-vh-402', 'ВХ-402', AVZ, UZK, 34, '38021'],
    ['uzk-vh-403', 'ВХ-403', AVZ, UZK, 34, '38022'],
    ['uzk-t-410', 'Т-410', TP, UZK, 36, '37940'],
    ['uzk-e-420', 'Е-420', EM, UZK, 36, '37941'],
    ['gk-vh-501', 'ВХ-501', AVG, GK, 14, '40910'],
    ['gk-vh-502', 'ВХ-502', AVG, GK, 14, '40911'],
    ['gk-t-510', 'Т-510', TP, GK, 16, '40830'],
    ['gk-t-511', 'Т-511', TP, GK, 16, '40831'],
    ['gk-s-520', 'С-520', NGS, GK, 18, '40602'],
    ['gk-e-530', 'Е-530', EM, GK, 18, '40603']
  ]);

  /* ---------- остальные заказчики: по 2–6 аппаратов разных стадий ---------- */

  function vRabote(o) {
    var a = base(o);
    a.managerId = o.managerId || 'z-safin';
    a.dokumenty = o.dokumenty || [doc(o.id + '-sborochnyy', 'sborochnyy', [])];
    return a;
  }

  var drugie = [
    vRabote({
      id: 'omsk-vh-7', tip: 'avo', nazvanie: 'АВО горизонтальный', oboznachenie: 'АВГ-9-Ж-1,6-Б1-22-П/4-1-4 УХЛ1', tu: 'ТУ 26-02-1158-96',
      zakazchikId: 'omsk', ustanovka: 'Установка каталитического риформинга', techPoz: 'ВХ-7',
      etap: 'zayavka', etapDaty: datyDni([-1, 7, 20, 45, 70, 95, 120, 130, 140]), nachaloEtapa: off(-1),
      naKom: 'zavod', srokOtveta: off(2),
      istoriya: [sob(off(-1), 'k-sokolov', 'Заявка с опросным листом отправлена заводу')]
    }),
    vRabote({
      id: 'omsk-t-14', tip: 'teploobmennik', nazvanie: 'Теплообменник с U-образными трубами', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3612-023-00220302-01',
      zakazchikId: 'omsk', ustanovka: 'Установка АВТ-10', techPoz: 'Т-14',
      etap: 'dogovor', etapDaty: datyDni([-30, -20, 5, 35, 60, 85, 110, 120, 130]), nachaloEtapa: off(-12),
      naKom: 'zakazchik', srokOtveta: off(6),
      dokumenty: [doc('omsk-t-14-tkp', 'tkp', [rev('A', off(-20), 1)]), doc('omsk-t-14-sborochnyy', 'sborochnyy', [])],
      istoriya: [sob(off(-30), 'k-sokolov', 'Заявка с опросным листом отправлена заводу'), sob(off(-20), 'z-safin', 'ТКП направлено заказчику'), sob(off(-12), 'k-sokolov', 'ТКП принято, договор на подписании у заказчика')]
    }),
    vRabote({
      id: 'perm-e-3', tip: 'emkost', nazvanie: 'Ёмкость горизонтальная', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3615-023-00220322-2001',
      zakazchikId: 'perm', ustanovka: 'Установка гидроочистки', techPoz: 'Е-3', zavNomer: '41350',
      /* Плановая дата поставки металла прошла четыре дня назад, отгрузка по плану
         впереди: на сводке у Е-3 пометка «риск срока» (11a). */
      etap: 'metall', etapDaty: datyDni([-90, -80, -70, -40, -4, 25, 40, 48, 55]), nachaloEtapa: off(-40),
      naKom: 'zavod', srokOtveta: null,
      istoriya: [sob(off(-90), 'k-belova', 'Заявка с опросным листом отправлена заводу'), sob(off(-40), 'k-belova', 'Ответ на сборочный чертёж, рев. A: код 1 «Одобрено»')]
    }),
    vRabote({
      id: 'perm-vh-9', tip: 'avo', nazvanie: 'АВО зигзагообразный', oboznachenie: 'АВЗ-20-Ж-0,6-Б1-37/4-2-6 УХЛ1', tu: 'ТУ 26-02-1043-87',
      zakazchikId: 'perm', ustanovka: 'Установка АВТ-4', techPoz: 'ВХ-9', zavNomer: '41022',
      etap: 'ispytaniya', etapDaty: datyDni([-160, -150, -135, -110, -80, -30, 4, 12, 20]), nachaloEtapa: off(-6),
      naKom: 'zavod', srokOtveta: null,
      istoriya: [sob(off(-160), 'k-belova', 'Заявка с опросным листом отправлена заводу'), sob(off(-6), 'z-orlov', 'Сварка закончена, аппарат на стенде гидроиспытаний')]
    }),
    vRabote({
      id: 'nizhny-t-5', tip: 'teploobmennik', nazvanie: 'Теплообменник «труба в трубе»', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3612-014-00220302-99',
      zakazchikId: 'nizhny', ustanovka: 'Установка каталитического крекинга', techPoz: 'Т-5',
      etap: 'raschet', etapDaty: datyDni([-14, 3, 25, 50, 75, 100, 125, 135, 145]), nachaloEtapa: off(-9),
      naKom: 'zakazchik', srokOtveta: off(5),
      dokumenty: [doc('nizhny-t-5-tkp', 'tkp', [rev('A', off(-4), null, 'zakazchik', off(5))]), doc('nizhny-t-5-sborochnyy', 'sborochnyy', [])],
      istoriya: [sob(off(-14), 'k-nikitin', 'Заявка с опросным листом отправлена заводу'), sob(off(-4), 'z-safin', 'ТКП направлено заказчику')]
    }),
    vRabote({
      id: 'syzran-t-8', tip: 'teploobmennik', nazvanie: 'Испаритель с паровым пространством', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3612-013-00220302-99',
      zakazchikId: 'syzran', ustanovka: 'Установка АВТ-6', techPoz: 'Т-8',
      etap: 'raschet', etapDaty: datyDni([-12, -2, 20, 45, 70, 95, 120, 130, 140]), nachaloEtapa: off(-9),
      naKom: 'zavod', srokOtveta: off(-2),
      istoriya: [sob(off(-12), 'k-frolov', 'Заявка с опросным листом отправлена заводу'), sob(off(-9), 'z-safin', 'Заявка принята в расчёт')]
    }),
    vRabote({
      id: 'kazan-vh-2', tip: 'avo', nazvanie: 'АВО горизонтальный', oboznachenie: 'АВГ-9-Ж-1,6-Б1-22-П/4-1-4 УХЛ1', tu: 'ТУ 26-02-1158-96',
      zakazchikId: 'kazan', ustanovka: 'Производство этилена', techPoz: 'ВХ-2', zavNomer: '40995',
      etap: 'gotov', etapDaty: datyDni([-180, -170, -150, -120, -90, -45, -10, 3, 9]), nachaloEtapa: off(-10),
      naKom: 'zakazchik', srokOtveta: off(4),
      istoriya: [sob(off(-180), 'k-shakirova', 'Заявка с опросным листом отправлена заводу'), sob(off(-10), 'z-orlov', 'Гидроиспытания проведены, аппарат готов к отгрузке')]
    }),
    vRabote({
      id: 'ink-e-12', tip: 'emkost', nazvanie: 'Ёмкость горизонтальная', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3615-023-00220322-2001',
      zakazchikId: 'ink', ustanovka: 'Установка подготовки нефти', techPoz: 'Е-12',
      etap: 'zayavka', etapDaty: datyDni([-3, 5, 20, 45, 70, 95, 120, 130, 140]), nachaloEtapa: off(-3),
      naKom: 'zavod', srokOtveta: off(1),
      istoriya: [sob(off(-3), 'k-romanov', 'Заявка с опросным листом отправлена заводу')]
    }),
    vRabote({
      id: 'belorus-s-4', tip: 'emkost', nazvanie: 'Сепаратор нефтегазовый', oboznachenie: '[обозначение уточняется]', tu: 'ТУ 3683-015-00220322-99',
      zakazchikId: 'belorus', ustanovka: 'Цех подготовки и перекачки нефти', techPoz: 'С-4',
      etap: 'chertezh', etapDaty: datyDni([-60, -50, -35, 8, 35, 60, 85, 95, 105]), nachaloEtapa: off(-35),
      naKom: 'zakazchik', srokOtveta: off(3),
      zadanie: { konstruktorId: 'z-kuznecova', srok: off(-5), status: 'naznacheno', komment: 'Сборочный чертёж по опросному листу' },
      dokumenty: [doc('belorus-s-4-tkp', 'tkp', [rev('A', off(-50), 1)]), doc('belorus-s-4-sborochnyy', 'sborochnyy', [rev('A', off(-4), null, 'zakazchik', off(3))])],
      istoriya: [sob(off(-60), 'k-kovalev', 'Заявка с опросным листом отправлена заводу'), sob(off(-4), 'z-kuznecova', 'Сборочный чертёж общего вида, рев. A, выложен на согласование')]
    })
  ];

  var parkDrugie = [].concat(
    park('omsk', [['omsk-vh-3', 'ВХ-3', AVG, 'Установка АВТ-10', 30, '39301']]),
    park('perm', [['perm-t-1', 'Т-1', TP, 'Установка АВТ-4', 26, '39480']]),
    park('nizhny', [['nizhny-vh-4', 'ВХ-4', AVZ, 'Установка каталитического крекинга', 40, '38610', '@+20']]),
    park('syzran', [['syzran-e-2', 'Е-2', EM, 'Установка АВТ-6', 28, '39205']]),
    park('kazan', [['kazan-t-6', 'Т-6', TN, 'Производство этилена', 32, '38990'], ['kazan-e-7', 'Е-7', EM, 'Производство этилена', 32, '38991']]),
    park('ink', [['ink-s-1', 'С-1', NGS, 'Установка подготовки нефти', 20, '39870']]),
    park('belorus', [['belorus-e-1', 'Е-1', EM, 'Цех подготовки и перекачки нефти', 44, '37620']])
  );

  var apparaty = [vh101, t203, s305, e307].concat(parkTaneko, drugie, parkDrugie);

  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }

  w.MOCK = freeze({
    zavod: zavod,
    etapy: etapy,
    tipy: tipy,
    vidy: vidy,
    kody: kody,
    lyudi: lyudi,
    poUmolchaniyu: poUmolchaniyu,
    zakazchiki: zakazchiki,
    oprosnye: oprosnye,
    apparaty: apparaty
  });
})(window);

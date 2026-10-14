/* Prevyu — превью документов кабинета. Владелец — таск 03 (опорный экран).

   Лист — нейтральный образец A4 по фирменному бланку письма КЗПМ (брендбук,
   стр. 20): сверху светло-фиолетовая плашка с одним крупным скруглением и
   цветным логотипом слева, заголовок 14 pt, текст 10 pt PT Sans, внизу
   контурная пилюля с контактами сайта. Пометка «ОБРАЗЕЦ», без цен, сумм,
   подписей и печатей, без пиктограмм. Рисунок мешка для макета печати —
   не здесь: лист макета зовёт Maket.risunok, если модуль подключён.

   Лист рисуется в единицах 96 dpi (viewBox 0 0 794 1123 — это A4). Цвета и
   кегли — классами из styles.css (раздел «превью документа»), литералов нет.

   Prevyu.svg(dokument)       → строка SVG листа; dokument — из DATA.dokument(id)
   Prevyu.open(dokumentId)    → окно Render.modal с листом, «Скачать» и «Закрыть»;
                                 пока окно открыто, в адресе #doc=<id>
   Prevyu.skachat(dokumentId) → true, если отдал лист в печать: печатная форма
                                 A4 без полей, в окне печати — «Сохранить как PDF»
   Prevyu.mount()             → страница зовёт после Shell.mount: кнопки
                                 data-act="prevyu-open" и "prevyu-skachat"
                                 с data-id, #doc=<id> в адресе открывает документ,
                                 смена хэша — тоже.

   Данные — только DATA (документ, завод, заказчик). */
(function (w) {
  'use strict';

  var W = 794, H = 1123;            /* A4 при 96 dpi */
  var X0 = 72, X1 = W - 72;         /* поля текста */
  var KV = 188;                     /* колонка подписей в строках «подпись — значение» */
  var PLASHKA = 136, DUGA = 112;    /* плашка бланка и её скругление */
  var PILYULYA = 1046;              /* верх пилюли с контактами */
  var NIZ = 1012;                   /* ниже — подвал листа */
  var LH = 19, LH_H = 24, LH_SM = 15;
  /* Средняя ширина знака PT Sans в долях кегля — только для переноса строк
     (с запасом) и для раскладки контактов в пилюле (по замеру листа). */
  var ZNAK = 0.55, ZNAK_KONTAKT = 0.45;

  /* Логотип — рядом со скриптом: assets/img/logo.svg, откуда бы ни открыли страницу. */
  var LOGO = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^\/]*$/, '') + 'img/logo.svg' : 'assets/img/logo.svg';
  })();

  function R() { return w.Render; }
  function esc(v) { return R().esc(v); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function docData(iso) { return iso ? R().data(iso, { format: 'doc' }) : ''; }
  function tonn(n) { return n === null || n === undefined || n === '' ? '' : String(n).replace('.', ',') + ' т'; }

  /* Кегль класса текста — из токенов --fs-doc*, как его увидит лист. */
  var kegl = {};
  function fs(tok) {
    if (!kegl[tok]) {
      var v = parseFloat(w.getComputedStyle(document.documentElement).getPropertyValue('--fs-' + tok));
      kegl[tok] = v > 0 ? v : (tok === 'doc-title' ? 18.67 : tok === 'doc-sm' ? 10.67 : 13.33);
    }
    return kegl[tok];
  }
  function znak(cls) {
    return ZNAK * fs(cls === 'pv-h' ? 'doc-title' : cls === 'pv-sm' || cls === 'pv-kontakt' ? 'doc-sm' : 'doc');
  }
  /* Строки по ширине: слова переносятся целиком, слишком длинное слово режется. */
  function stroki(str, shirina, cls) {
    var max = Math.max(4, Math.floor(shirina / znak(cls)));
    str = String(str === null || str === undefined ? '' : str).replace(/№ /g, '№\u00a0');   /* знак номера не отрывается от номера */
    var out = [], cur = '';
    /* неразрывный пробел держит слова вместе: «60 т», «№ 1398» не рвутся */
    String(str === null || str === undefined ? '' : str).split(/[ \t\r\n]+/).forEach(function (slovo) {
      if (!slovo) { return; }
      while (slovo.length > max) {
        if (cur) { out.push(cur); cur = ''; }
        out.push(slovo.slice(0, max)); slovo = slovo.slice(max);
      }
      if (!cur) { cur = slovo; } else if ((cur + ' ' + slovo).length <= max) { cur += ' ' + slovo; } else { out.push(cur); cur = slovo; }
    });
    if (cur) { out.push(cur); }
    return out;
  }

  /* --- примитивы SVG ------------------------------------------------------- */
  function sv(tag, at, inner) {
    var s = '<' + tag;
    for (var k in at) { if (at[k] !== null && at[k] !== undefined && at[k] !== '') { s += ' ' + k + '="' + esc(String(at[k])) + '"'; } }
    return s + (inner === undefined ? '/>' : '>' + inner + '</' + tag + '>');
  }
  function tx(x, y, str, cls, anchor) {
    return sv('text', { x: r1(x), y: r1(y), 'class': cls, 'text-anchor': anchor || null }, esc(str));
  }
  function rc(x, y, wd, h, cls, rx) {
    return sv('rect', { x: r1(x), y: r1(y), width: r1(wd), height: r1(h), rx: rx ? r1(rx) : null, 'class': cls });
  }
  function ln(x1, y1, x2, y2, cls) { return sv('line', { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), 'class': cls || 'pv-line' }); }

  /* --- вёрстка тела листа: курсор сверху вниз --------------------------------
     st.y — верх следующего блока; блок, который не влезает над подвалом,
     не рисуется (лист-образец не продолжается на второй странице). */
  function list() { return { y: 0, s: '' }; }
  function vlezet(st, h) { return st.y + h <= NIZ; }

  function abzac(st, text, cls) {
    cls = cls || 'pv-t';
    var ls = stroki(text, X1 - X0, cls);
    if (!ls.length || !vlezet(st, ls.length * LH)) { return; }
    ls.forEach(function (l, i) { st.s += tx(X0, st.y + 14 + i * LH, l, cls); });
    st.y += ls.length * LH + 8;
  }
  function razdel(st, title) {
    if (!vlezet(st, 16 + LH + 40)) { st.y = NIZ; return; }
    st.y += 16;
    st.s += tx(X0, st.y + 14, title, 'pv-acc');
    st.s += ln(X0, st.y + LH + 2, X1, st.y + LH + 2, 'pv-line-acc');
    st.y += LH + 12;
  }
  /* Строки «подпись — значение»; пустые значения пропускаются. */
  function kv(st, rows) {
    rows.forEach(function (r) {
      if (r[1] === null || r[1] === undefined || r[1] === '') { return; }
      var a = stroki(r[0], KV - 16, 'pv-lab'), b = stroki(r[1], X1 - X0 - KV, 'pv-t');
      var n = Math.max(a.length, b.length);
      if (!vlezet(st, n * LH)) { return; }
      a.forEach(function (l, i) { st.s += tx(X0, st.y + 14 + i * LH, l, 'pv-lab'); });
      b.forEach(function (l, i) { st.s += tx(X0 + KV, st.y + 14 + i * LH, l, 'pv-t'); });
      st.y += n * LH + 6;
    });
  }
  /* Таблица: cols [{ t, w — доля ширины, end — по правому краю }], rows — массивы строк. */
  function tablica(st, cols, rows, itog) {
    var shir = X1 - X0, x = X0;
    var xs = cols.map(function (c) { var a = x; x += c.w * shir; return { x: a, w: c.w * shir, end: !!c.end }; });
    function yacheyka(c, str, y, cls) {
      return stroki(str, c.w - 16, cls).map(function (l, i) {
        return tx(c.end ? c.x + c.w - 8 : c.x + 8, y + i * LH, l, cls, c.end ? 'end' : null);
      }).join('');
    }
    if (!vlezet(st, 30 + LH + 12)) { return; }
    st.s += rc(X0, st.y, shir, 30, 'pv-thead');
    cols.forEach(function (c, i) { st.s += yacheyka(xs[i], c.t, st.y + 20, 'pv-th'); });
    st.y += 30;
    rows.concat(itog ? [itog] : []).forEach(function (r, j) {
      var n = 1;
      r.forEach(function (v, i) { n = Math.max(n, stroki(v, xs[i].w - 16, 'pv-t').length); });
      var h = n * LH + 12;
      if (!vlezet(st, h)) { return; }
      var cls = itog && j === rows.length ? 'pv-acc' : 'pv-t';
      r.forEach(function (v, i) { st.s += yacheyka(xs[i], v, st.y + 6 + 14, cls); });
      st.y += h;
      st.s += ln(X0, st.y, X1, st.y);
    });
    st.y += 8;
  }
  /* Серые полосы на месте текста договора: имитация, не содержание. */
  function bary(st, n) {
    var dl = [1, 0.94, 0.97, 0.62];
    for (var i = 0; i < n; i++) {
      if (!vlezet(st, 16)) { return; }
      st.s += rc(X0, st.y + 5, (X1 - X0) * dl[i % dl.length], 7, 'pv-bar', 3.5);
      st.y += 16;
    }
    st.y += 4;
  }
  function parametry(list_) {
    return (list_ || []).map(function (p) { return [p.title, p.znachenie]; });
  }

  /* --- шапка и подвал листа по бланку --------------------------------------- */
  function zavod() { try { return w.DATA.zavod(); } catch (e) { return null; } }
  function gorodZakazchika(d) {
    try { var z = d.zakazchik && w.DATA.zakazchik(d.zakazchik.id); return z && z.gorod ? 'г. ' + z.gorod : ''; } catch (e) { return ''; }
  }
  var ZAGOLOVOK = {
    upd: function (d) { return 'Универсальный передаточный документ' + (d.nomer ? ' № ' + d.nomer : ''); },
    specifikaciya: function (d, dn) { return d.title + (dn.dogovor && dn.dogovor.nomer ? ' к договору поставки № ' + dn.dogovor.nomer : ''); }
  };
  function zagolovok(d) { var f = ZAGOLOVOK[d.tip]; return f ? f(d, d.dannye || {}) : d.title; }
  /* Протокол испытаний — документ заказчика: адресата на бланке КЗПМ у него нет. */
  var BEZ_ADRESATA = { protokol: true };

  function shapka(st, d) {
    var s = '';
    s += rc(0, 0, W, H, 'pv-paper');
    /* плашка: во всю ширину, нижний правый угол скруглён одной большой дугой (бланк, стр. 12 и 20) */
    s += sv('path', { 'class': 'pv-plashka', d: 'M0 0H' + W + 'V' + (PLASHKA - DUGA) + 'A' + DUGA + ' ' + DUGA + ' 0 0 1 ' + (W - DUGA) + ' ' + PLASHKA + 'H0Z' });
    s += sv('image', { href: LOGO, x: 56, y: 38, width: 230, height: 60, preserveAspectRatio: 'xMinYMid meet' });
    s += rc(W - X0 - 132, 52, 132, 32, 'pv-pill pv-pill-mark', 16);
    s += tx(W - X0 - 66, 73, 'ОБРАЗЕЦ', 'pv-mark', 'middle');
    /* слева: номер и дата, к чему документ; справа «Кому» в уголках, как на бланке */
    s += tx(X0, 190, (d.nomer ? '№ ' + d.nomer + ' ' : '') + 'от ' + docData(d.data), 'pv-t');
    stroki(d.k && d.k.title, 300, 'pv-lab').slice(0, 2).forEach(function (l, i) { s += tx(X0, 190 + LH + i * LH, l, 'pv-lab'); });
    var kx = 430;
    if (!BEZ_ADRESATA[d.tip]) { s += sv('path', { 'class': 'pv-ugol', d: 'M' + kx + ' 184V172H' + (kx + 10) + 'M' + (X1 - 10) + ' 172H' + X1 + 'V184' }); }
    var komu = d.zakazchik && !BEZ_ADRESATA[d.tip] ? d.zakazchik.name : '';
    var ky = 190;
    if (komu) {
      s += tx(kx + 10, ky, 'Кому', 'pv-lab');
      var kl = stroki(komu, X1 - kx - 62, 'pv-t');
      kl.forEach(function (l, i) { s += tx(kx + 58, ky + i * LH, l, 'pv-t'); });
      ky += kl.length * LH;
      var kuda = gorodZakazchika(d);
      if (kuda) { s += tx(kx + 10, ky, 'Куда', 'pv-lab') + tx(kx + 58, ky, kuda, 'pv-t'); ky += LH; }
    }
    /* заголовок документа: 14 pt */
    var top = Math.max(250, ky + 26);
    var zl = stroki(zagolovok(d), X1 - X0, 'pv-h');
    zl.forEach(function (l, i) { s += tx(X0, top + 18 + i * LH_H, l, 'pv-h'); });
    st.s += s;
    st.y = top + zl.length * LH_H + 18;
  }

  function podval(st) {
    var z = zavod() || {}, k = z.kontakty || {};
    var s = tx(X0, PILYULYA - 18, 'Образец документа. Данные демонстрационные.', 'pv-sm');
    s += rc(40, PILYULYA, W - 80, 36, 'pv-pill pv-pill-niz', 18);
    var items = [z.sayt, k.priemnaya, k.pochta, k.adres].filter(Boolean);
    var shir = items.map(function (t) { return t.length * ZNAK_KONTAKT * fs('doc-sm') + 12; });
    var vsego = shir.reduce(function (a, b) { return a + b; }, 0);
    var x = 64, zazor = items.length > 1 ? Math.max(12, (W - 128 - vsego) / (items.length - 1)) : 0;
    items.forEach(function (t, i) {
      s += sv('circle', { cx: r1(x + 3), cy: PILYULYA + 18, r: 3, 'class': 'pv-dot' });
      s += tx(x + 12, PILYULYA + 22, t, 'pv-kontakt');
      x += shir[i] + zazor;
    });
    st.s += s;
  }

  /* --- тело листа по типу документа ----------------------------------------- */
  function postavshchik(p) { return p ? [p.name, p.polnoe].filter(Boolean).join(', ') : ''; }
  function naim(x) { return x && x.name ? x.name : ''; }

  var TELO = {
    pasport: function (st, d, dn) {
      var pt = dn.partiya || {}, z = dn.zakaz || {}, iz = dn.izgotovitel;
      kv(st, [
        ['Продукция', dn.produkt && dn.produkt.nazvanie],
        ['Изготовитель', postavshchik(iz)],
        ['Адрес изготовителя', iz && iz.adres],
        ['Покупатель', naim(dn.zakazchik)],
        ['Заказ', z.nomer ? '№ ' + z.nomer + ', ' + tonn(z.obem) : ''],
        ['Партия', pt.nomer ? '№ ' + pt.nomer + ', ' + tonn(pt.obem) : ''],
        ['Дата выпуска', docData(pt.data)],
        ['Спецификация', dn.specifikaciya ? '№ ' + dn.specifikaciya.nomer + (dn.dogovor ? ' к договору поставки № ' + dn.dogovor.nomer : '') : '']
      ]);
      razdel(st, 'Показатели качества партии');
      tablica(st, [{ t: 'Показатель', w: 0.44 }, { t: 'Норма', w: 0.32 }, { t: 'Факт', w: 0.24 }],
        (dn.pokazateli || []).map(function (r) { return [r.title, r.norma, r.fakt]; }));
      razdel(st, 'Заключение');
      abzac(st, dn.zaklyuchenie);
    },
    upd: function (st, d, dn) {
      var o = dn.otgruzka || {};
      kv(st, [
        ['Продавец', postavshchik(dn.postavshchik)],
        ['Адрес продавца', dn.postavshchik && dn.postavshchik.adres],
        ['Покупатель', naim(dn.pokupatel)],
        ['Основание', dn.zakaz ? 'Заказ № ' + dn.zakaz.nomer : ''],
        ['Отгрузка', o.nomer ? '№ ' + o.nomer + ' от ' + docData(o.data) : '']
      ]);
      razdel(st, 'Товары');
      tablica(st, [{ t: '№', w: 0.08 }, { t: 'Наименование товара', w: 0.56 }, { t: 'Ед. изм.', w: 0.14 }, { t: 'Количество', w: 0.22, end: true }],
        (dn.stroki || []).map(function (r, i) { return [String(i + 1), r.naimenovanie, r.edinitsa, String(r.kolichestvo).replace('.', ',')]; }),
        ['', 'Всего', 'т', String(dn.vsegoTonn || 0).replace('.', ',')]);
    },
    nakladnaya: function (st, d, dn) {
      var o = dn.otgruzka || {}, go = dn.gruzootpravitel || {};
      if (dn.vid === 'zhd') {
        kv(st, [
          ['Грузоотправитель', go.name],
          ['Адрес отправления', go.adres],
          ['Грузополучатель', naim(dn.gruzopoluchatel)],
          ['Вагон', dn.vagon ? '№ ' + dn.vagon.nomer : ''],
          ['Станция назначения', dn.vagon && dn.vagon.stantsiya],
          ['Дата отправления', docData(o.data)]
        ]);
      } else {
        var ok = dn.samovyvoz && dn.samovyvoz.okno;
        kv(st, [
          ['Грузоотправитель', go.name],
          ['Пункт погрузки', go.adres],
          ['Грузополучатель', naim(dn.gruzopoluchatel)],
          ['Перевозчик', 'Транспорт грузополучателя, самовывоз'],
          ['Окно погрузки', ok ? docData(ok.data) + (ok.s && ok.po ? ', с ' + ok.s + ' до ' + ok.po : '') : ''],
          ['Ворота', dn.samovyvoz && dn.samovyvoz.vorota],
          ['Дата отгрузки', docData(o.data)]
        ]);
      }
      razdel(st, 'Груз');
      tablica(st, [{ t: 'Наименование груза', w: 0.5 }, { t: 'Партии', w: 0.28 }, { t: 'Масса, т', w: 0.22, end: true }],
        [[dn.gruz || '', (dn.partii || []).join(', '), String(dn.massaTonn || 0).replace('.', ',')]]);
    },
    raschet: function (st, d, dn) {
      kv(st, [
        ['Заказчик', naim(dn.zakazchik)],
        ['Продукт', dn.produkt && dn.produkt.nazvanie],
        ['Вид продукции', dn.produkt && dn.produkt.tipTitle],
        ['Исполнитель', postavshchik(dn.postavshchik)]
      ]);
      razdel(st, 'Параметры запроса');
      tablica(st, [{ t: 'Параметр', w: 0.42 }, { t: 'Значение', w: 0.58 }], parametry(dn.parametry));
      if (dn.primechanie) { abzac(st, 'Расчёт подготовлен по параметрам запроса, ' + dn.primechanie + '.'); }
    },
    protokol: function (st, d, dn) {
      kv(st, [
        ['Заказчик', naim(dn.zakazchik)],
        ['Продукт', dn.produkt && dn.produkt.nazvanie],
        ['Файл протокола', dn.fayl && dn.fayl.name]
      ]);
      razdel(st, 'Параметры образца');
      tablica(st, [{ t: 'Параметр', w: 0.42 }, { t: 'Значение', w: 0.58 }], parametry(dn.parametry));
      abzac(st, 'Заказчик испытал образцы на своей линии. Протокол приложен файлом.');
    },
    dogovor: function (st, d, dn) {
      var p = dn.postavshchik;
      kv(st, [
        ['Поставщик', postavshchik(p)],
        ['Адрес поставщика', p && p.adres],
        ['Покупатель', naim(dn.zakazchik)],
        ['Срок действия', dn.s && dn.po ? 'с ' + docData(dn.s) + ' по ' + docData(dn.po) : ''],
        ['Предмет договора', dn.predmet]
      ]);
      ['1. Предмет договора', '2. Порядок поставки и график отгрузок', '3. Качество продукции', '4. Приёмка и претензии'].forEach(function (t, i) {
        razdel(st, t);
        bary(st, i === 1 ? 4 : 3);
      });
    },
    specifikaciya: function (st, d, dn) {
      kv(st, [
        ['Поставщик', postavshchik(dn.postavshchik)],
        ['Покупатель', naim(dn.zakazchik)],
        ['Продукция', dn.produkt && dn.produkt.nazvanie],
        ['Вид продукции', dn.produkt && dn.produkt.tipTitle]
      ]);
      razdel(st, 'Параметры продукции');
      tablica(st, [{ t: 'Параметр', w: 0.42 }, { t: 'Значение', w: 0.58 }], parametry(dn.parametry));
    },
    maket: function (st, d, dn) {
      var v = dn.versiya || {}, kto = v.kto || {};
      kv(st, [
        ['Продукт', dn.produkt && dn.produkt.nazvanie],
        ['Заказчик', naim(dn.zakazchik)],
        ['Версия', v.n ? String(v.n) : ''],
        ['Загружена', v.data ? R().data(v.data, { format: 'docTime' }) : ''],
        ['Загрузил', [kto.name, kto.position].filter(Boolean).join(', ')]
      ]);
      var h = 400;
      if (vlezet(st, h + 16)) {
        st.y += 8;
        var risunok = '';
        if (w.Maket && typeof w.Maket.risunok === 'function') {
          try { risunok = w.Maket.risunok(dn.versiya, { metki: dn.zamechaniya || [] }) || ''; } catch (e) { risunok = ''; }
        }
        if (risunok) {
          st.s += sv('foreignObject', { x: X0, y: r1(st.y), width: X1 - X0, height: h }, '<div class="pv-risunok">' + risunok + '</div>');
        } else {
          st.s += rc(X0, st.y, X1 - X0, h, 'pv-ramka', 8);
          st.s += tx(W / 2, st.y + h / 2, 'Рисунок макета показан в карточке продукта, в разделе «Макет печати»', 'pv-lab', 'middle');
        }
        st.y += h + 8;
      }
      if (v.ispravleno && v.ispravleno.length) {
        abzac(st, 'В этой версии исправлены замечания ' + v.ispravleno.join(', ') + ' к прошлой версии.');
      }
      if (dn.zamechaniya && dn.zamechaniya.length) {
        razdel(st, 'Замечания заказчика к версии');
        dn.zamechaniya.forEach(function (z) { abzac(st, z.nomer + '. ' + z.text); });
      }
    },
    prochee: function (st, d) {
      kv(st, [['Документ', d.tipTitle], ['Покупатель', naim(d.zakazchik)]]);
    }
  };

  /* --- выдача -------------------------------------------------------------- */
  function dokument(x) {
    if (!x) { return null; }
    if (typeof x === 'string') { try { return w.DATA.dokument(x); } catch (e) { return null; } }
    if (!x.dannye && x.id && w.DATA) { try { return w.DATA.dokument(x.id) || x; } catch (e) { return x; } }
    return x;
  }

  function svg(x) {
    var d = dokument(x);
    if (!d) { return ''; }
    var st = list();
    shapka(st, d);
    (TELO[d.tip] || TELO.prochee)(st, d, d.dannye || {});
    podval(st);
    return '<svg class="pv prevyu__list" viewBox="0 0 ' + W + ' ' + H + '" role="img" data-tip="' + esc(d.tip) + '" data-dok="' + esc(d.id) +
      '" aria-label="' + esc(zagolovok(d) + ', образец') + '">' + st.s + '</svg>';
  }

  /* --- адрес #doc=<id> -------------------------------------------------------- */
  function izAdresa() {
    var m = /(?:^#|&)doc=([^&]+)/.exec(String(w.location.hash || ''));
    if (!m) { return null; }
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }
  function postavitAdres(id) {
    try { w.history.replaceState(null, '', w.location.pathname + w.location.search + '#doc=' + encodeURIComponent(id)); } catch (e) { /* file:// без истории — не страшно */ }
  }
  function ubratAdres(id) {
    if (izAdresa() !== id) { return; }
    try { w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) { /* file:// без истории — не страшно */ }
  }

  /* --- окно ----------------------------------------------------------------- */
  function shellGotov() { return !!(w.Shell && w.Shell.on && w.Shell.role && w.Shell.role()); }
  function knopki() {
    if (!shellGotov()) { return false; }
    w.Shell.on('prevyu-open', function (b) { open(b.getAttribute('data-id')); });
    w.Shell.on('prevyu-skachat', function (b) { skachat(b.getAttribute('data-id')); });
    return true;
  }
  function otkrytoe(id) {
    var f = document.querySelectorAll('.modal .prevyu[data-dok]');
    for (var i = 0; i < f.length; i++) { if (f[i].getAttribute('data-dok') === id) { return f[i].closest('.modal'); } }
    return null;
  }

  function open(id) {
    var d = id ? dokument(String(id)) : null;
    if (!d) {
      return R().modal({ title: 'Документ недоступен', text: 'Такого документа нет, или он относится к другому предприятию.' });
    }
    var uzhe = otkrytoe(d.id);
    if (uzhe) { return uzhe; }
    var cherezShell = knopki();
    var m = R().modal({
      title: d.title, wide: true,
      body: '<figure class="prevyu" data-dok="' + esc(d.id) + '">' + svg(d) +
        '<figcaption class="prevyu__podpis">Кнопка «Скачать» открывает печатную форму листа. Чтобы получить файл, выберите в окне печати «Сохранить как PDF».</figcaption></figure>',
      foot: '<button class="btn btn--primary" type="button" data-act="prevyu-skachat" data-id="' + esc(d.id) + '">Скачать</button>' +
        '<button class="btn btn--secondary" type="button" data-close>Закрыть</button>',
      onClose: function () { ubratAdres(d.id); }
    });
    if (!cherezShell) {
      /* без смонтированного каркаса (стенд) кнопка работает сама */
      var b = m.querySelector('[data-act="prevyu-skachat"]');
      if (b) { b.addEventListener('click', function (e) { e.preventDefault(); skachat(d.id); }); }
    }
    postavitAdres(d.id);
    return m;
  }

  /* --- «Скачать»: печатная форма листа --------------------------------------
     Лист кладётся в отдельный блок, правило печати в styles.css прячет
     остальное и ставит страницу A4 без полей. Название документа на время
     печати становится заголовком страницы — это имя файла при «Сохранить
     как PDF». Форма снимается только по afterprint: в Safari и Firefox print()
     не ждёт окна печати, таймер срезал бы лист до печати. Новый «Скачать»,
     пока прошлая печать не закончилась, сначала убирает прошлую форму. */
  var pechat = null;   /* уборка формы, которая ещё ждёт afterprint */
  function skachat(id) {
    var d = id ? dokument(String(id)) : null;
    if (!d) { return false; }
    if (pechat) { pechat(); }
    var box = document.createElement('div');
    box.className = 'prevyu-pechat';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = svg(d);
    document.body.appendChild(box);
    document.body.classList.add('is-pechat');
    var title0 = document.title;
    document.title = d.title;
    function ubrat() {
      if (pechat !== ubrat) { return; }
      pechat = null;
      w.removeEventListener('afterprint', ubrat);
      document.title = title0;
      document.body.classList.remove('is-pechat');
      if (box.parentNode) { box.parentNode.removeChild(box); }
    }
    pechat = ubrat;
    w.addEventListener('afterprint', ubrat);
    try { w.print(); } catch (e) { ubrat(); }
    return true;
  }

  var slushaet = false;
  function poAdresu() {
    var id = izAdresa();
    if (id && !otkrytoe(id)) { open(id); }
  }
  function mount() {
    knopki();
    poAdresu();
    if (!slushaet) { w.addEventListener('hashchange', poAdresu); slushaet = true; }
  }

  w.Prevyu = { svg: svg, open: open, skachat: skachat, mount: mount };
})(window);

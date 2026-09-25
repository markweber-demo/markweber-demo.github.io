/* Табличка аппарата и QR — таск 06.

   Shildik.render(el, apparat) рисует металлическую табличку поставленного
   аппарата: знак завода, наименование, обозначение, зав. №, год изготовления,
   расчётные давление и температура, масса, QR. Клик по QR открывает
   proverka.html?n=<зав. №> этого аппарата.

   QR кодирует адрес страницы проверки: QR_BAZA + 'proverka.html?n=<зав. №>'.
   QR_BAZA подставляет скрипт выкладки (tools/vylozhit.sh, таск 08) — строка
   ниже с меткой @QR_BAZA@ меняется целиком. Пусто: на http(s) — папка текущей
   страницы, по file:// — относительный путь.

   Стиль модуль ставит сам, один раз (<style id="shl-style">), только токены
   из styles.css. Нужна библиотека assets/vendor/qrcode/qrcode.js (глобал qrcode). */
(function (w) {
  'use strict';

  var QR_BAZA = 'https://markweber-demo.github.io/bmz/'; /* @QR_BAZA@ */

  var LOGO = 'assets/img/logo-bmz-70-siniy.svg';

  function esc(v) { return w.Render.esc(v); }
  /* Имя завода и город — из справочника, своих копий нет. */
  function zavod() { var s = (w.DATA && w.DATA.spravochnik()) || {}; return s.zavod || {}; }

  function baza() {
    if (QR_BAZA) { return QR_BAZA.replace(/\/?$/, '/'); }
    var loc = w.location || {};
    if (/^https?:$/.test(loc.protocol || '')) { return String(loc.href).replace(/[?#].*$/, '').replace(/[^/]*$/, ''); }
    return '';
  }
  function ssylka(zavNomer) { return 'proverka.html?n=' + encodeURIComponent(zavNomer); }
  /** Строка, которую кодирует QR. */
  function adres(zavNomer) { return baza() + ssylka(zavNomer); }

  /* QR как SVG: тёмные модули одним путём, тихая зона 4 модуля. */
  function qrSvg(text) {
    if (typeof w.qrcode !== 'function') { return '<span class="shl__noqr">QR</span>'; }
    var qr = w.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), q = 4, d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) { d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z'; }
      }
    }
    var s = n + q * 2;
    return '<svg class="shl__qrsvg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges" role="img" aria-label="QR-код: ' + esc(text) + '">' +
      '<rect class="shl__qrbg" width="' + s + '" height="' + s + '"/><path class="shl__qrfg" d="' + d + '"/></svg>';
  }

  var CSS = [
    '.shl{--shl-metal:var(--c-surface-2);--shl-edge:var(--c-line-strong);--shl-ink:var(--c-navy);',
    'position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-3) var(--space-4);',
    'padding:var(--space-5) var(--space-5) var(--space-4);border:2px solid var(--shl-edge);border-radius:6px;color:var(--shl-ink);',
    'background:repeating-linear-gradient(90deg,var(--shl-metal) 0 2px,var(--c-surface) 2px 3px,var(--shl-metal) 3px 5px),var(--shl-metal);',
    'box-shadow:inset 0 0 0 4px var(--c-surface),inset 0 0 0 5px var(--c-line),var(--shadow);font-family:var(--font);max-width:640px}',
    '.shl__vint{position:absolute;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 35%,var(--c-surface),var(--shl-edge) 70%);',
    'border:1px solid var(--c-muted)}',
    '.shl__vint--1{top:8px;left:8px}.shl__vint--2{top:8px;right:8px}.shl__vint--3{bottom:8px;left:8px}.shl__vint--4{bottom:8px;right:8px}',
    '.shl__top{grid-column:1/-1;display:flex;align-items:center;gap:var(--space-3);padding-bottom:var(--space-2);border-bottom:1px solid var(--shl-edge);flex-wrap:wrap}',
    '.shl__logo{display:block;height:34px;width:auto;flex:none}',
    '.shl__zavod{font-family:var(--font-mono);font-size:var(--fs-2xs);text-transform:uppercase;letter-spacing:var(--track-mono);line-height:1.35}',
    '.shl__rows{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px var(--space-3);align-content:start;min-width:0}',
    '.shl__rows dt{font-size:var(--fs-2xs);text-transform:uppercase;letter-spacing:var(--track-mono);opacity:.85;padding-top:2px;white-space:nowrap}',
    '.shl__rows dd{margin:0;font-family:var(--font-mono);font-size:var(--fs-sm);font-weight:500;overflow-wrap:anywhere}',
    '.shl__rows dd.shl__big{font-size:var(--fs-md);font-weight:600;letter-spacing:.06em}',
    '.shl__qr{display:flex;flex-direction:column;align-items:center;gap:var(--space-1);text-decoration:none;color:inherit;align-self:start}',
    '.shl__qrsvg{display:block;width:132px;height:132px;border:1px solid var(--shl-edge)}',
    '.shl__qrbg{fill:var(--c-surface)}.shl__qrfg{fill:var(--c-text)}',
    '.shl__qr:hover .shl__qrsvg,.shl__qr:focus-visible .shl__qrsvg{outline:3px solid var(--c-blue);outline-offset:2px}',
    '.shl__qrcap{font-size:var(--fs-2xs);text-transform:uppercase;letter-spacing:var(--track-mono)}',
    '.shl__noqr{display:grid;place-items:center;width:132px;height:132px;border:1px dashed var(--shl-edge)}',
    '.shl__foot{grid-column:1/-1;font-family:var(--font-mono);font-size:var(--fs-2xs);text-transform:uppercase;letter-spacing:var(--track-mono);',
    'padding-top:var(--space-2);border-top:1px solid var(--shl-edge);display:flex;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap}',
    '@media (max-width:767px){.shl{grid-template-columns:minmax(0,1fr);padding:var(--space-4)}',
    '.shl__qr{justify-self:center}.shl__rows{grid-template-columns:minmax(0,1fr)}.shl__rows dt{padding-top:var(--space-1)}}'
  ].join('');

  function style() {
    if (document.getElementById('shl-style')) { return; }
    var s = document.createElement('style');
    s.id = 'shl-style';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function god(iso) { return iso ? String(iso).slice(0, 4) : '—'; }

  /** el — контейнер, apparat — Apparat из DATA.apparat (нужны zavNomer и postavka). */
  function render(el, a) {
    if (!el) { return null; }
    style();
    a = a || {};
    var p = (a.postavka && a.postavka.pasport) || {}, o = p.obshchie || {}, h = p.harakteristiki || {};
    var zav = a.zavNomer || o.zavNomer || '';
    var rows = [
      ['Наименование', a.nazvanie || o.naimenovanie],
      ['Обозначение', a.oboznachenie || o.oboznachenie],
      ['Заводской №', zav, 'shl__big'],
      ['Год изготовления', god(o.dataIzgotovleniya)],
      ['Давление расчётное', h.davlenieRaschetnoe],
      ['Температура расчётная', h.tempRaschetnaya],
      ['Масса', h.massa]
    ];
    var zd = zavod();
    el.innerHTML =
      '<div class="shl" data-zav="' + esc(zav) + '">' +
        '<span class="shl__vint shl__vint--1"></span><span class="shl__vint shl__vint--2"></span>' +
        '<span class="shl__vint shl__vint--3"></span><span class="shl__vint shl__vint--4"></span>' +
        '<div class="shl__top"><img class="shl__logo" src="' + LOGO + '" alt="Товарный знак БМЗ" width="118" height="34">' +
          '<span class="shl__zavod">' + esc(zd.short || o.izgotovitel || '') + '<br>' + esc(zd.gorod ? 'г. ' + zd.gorod + ', Россия' : 'Россия') + '</span></div>' +
        '<dl class="shl__rows">' + rows.map(function (r) {
          return '<dt>' + r[0] + '</dt><dd' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' + esc(r[1] || '—') + '</dd>';
        }).join('') + '</dl>' +
        (zav ? '<a class="shl__qr" href="' + esc(ssylka(zav)) + '" data-qr="' + esc(adres(zav)) + '" title="Открыть страницу проверки">' +
          qrSvg(adres(zav)) + '<span class="shl__qrcap">Проверить аппарат</span></a>' : '') +
        '<div class="shl__foot"><span>' + esc(o.tu || a.tu || '') + '</span><span>Сделано в России</span></div>' +
      '</div>';
    return el.firstChild;
  }

  w.Shildik = { render: render, adres: adres, ssylka: ssylka };
})(window);

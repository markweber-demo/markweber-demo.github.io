/* Проверка аппарата — proverka.html?n=<зав. №>. Таск 06. Без входа, вне каркаса.

   Показывает только поля ApparatPublic из DATA.poNomeru: подлинность, ТУ,
   дата изготовления, статус гарантии, руководство по эксплуатации. Паспорт,
   протоколы и ЗИП — «доступны владельцу после входа». Заявка на ремонт без
   входа — форма; записи нет: у ApparatPublic нет id аппарата для ACT. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA;
  w.Shell.mount({ bare: true });

  var out = document.getElementById('pr-out');
  var inp = document.getElementById('pr-n');

  var param = R.param;
  function telefon() { try { return DATA.spravochnik().zavod.telefon; } catch (e) { return ''; } }
  function zavodImya() { try { return DATA.spravochnik().zavod.imya; } catch (e) { return ''; } }
  function chist(n) { return String(n || '').replace(/[\s№#]/g, ''); }

  function podskazka(pusto) {
    return '<section class="card pr-hint" data-result="pusto">' +
      '<div class="card__body pr-hint__in">' +
        '<div><h2 class="h3">' + (pusto ? 'Введите заводской номер' : 'Где найти номер') + '</h2>' +
          '<p class="pr-hint__p">Номер выбит на металлической табличке аппарата, в строке «Заводской №». Рядом с номером QR-код. Если навести на него камеру телефона, эта страница откроется сама.</p></div>' +
        '<div class="pr-plate" aria-hidden="true">' +
          '<span class="pr-plate__row">Наименование <i></i></span>' +
          '<span class="pr-plate__row">Обозначение <i></i></span>' +
          '<span class="pr-plate__row pr-plate__row--on">Заводской № <b>00000</b></span>' +
          '<span class="pr-plate__row">Год изготовления <i></i></span>' +
          '<span class="pr-plate__qr"></span>' +
        '</div>' +
      '</div></section>';
  }

  function neNayden(n) {
    return '<section class="card pr-net" data-result="net">' +
      '<div class="card__body"><h2 class="h3">Аппарат с таким номером не найден</h2>' +
        '<p>Введён номер <span class="mono">' + esc(n) + '</span>. Проверьте номер на табличке или позвоните в отдел маркетинга и продаж по телефону ' +
          '<span class="mono pr-tel">' + esc(telefon()) + '</span>.</p></div></section>';
  }

  function nayden(p) {
    var on = p.garantiya && p.garantiya.status === 'active';
    var gar = on
      ? '<span class="badge badge--ok">На гарантии до ' + esc(R.data(p.garantiya.do, { format: 'full' })) + '</span>'
      : '<span class="badge badge--neutral">Гарантия истекла ' + esc(R.data(p.garantiya.do, { format: 'doc' })) + '</span>';
    var rows = [
      ['Наименование', esc(p.nazvanie)],
      ['Условное обозначение', '<span class="mono">' + esc(p.oboznachenie) + '</span>'],
      ['Заводской №', '<span class="mono">' + esc(p.zavNomer) + '</span>'],
      ['Дата изготовления', esc(R.data(p.dataIzgotovleniya, { format: 'full' }))],
      ['Технические условия', esc(p.tu)],
      ['Гарантия', gar]
    ];
    return '<section class="card pr-ok" data-result="nayden" data-garantiya="' + (on ? 'active' : 'expired') + '">' +
        '<div class="pr-ok__head"><span class="pr-ok__mark" aria-hidden="true">✓</span>' +
          '<div><p class="label">Подлинность</p><h2 class="pr-ok__title">Аппарат изготовлен ' + esc(p.izgotovitel) + '</h2></div></div>' +
        '<dl class="pr-dl">' + rows.map(function (r) { return '<div class="pr-dl__i"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      '</section>' +
      '<div class="pr-grid">' +
        '<section class="card pr-re"><div class="card__body">' +
          '<p class="label">Открытый доступ</p><h2 class="h3">' + esc(p.re && p.re.title ? p.re.title : 'Руководство по эксплуатации') + '</h2>' +
          '<p class="pr-muted">Руководство для этого типа аппарата.</p>' +
          '<button class="btn btn--secondary" type="button" data-soon="Файл руководства по эксплуатации">Скачать руководство</button>' +
        '</div></section>' +
        '<section class="card pr-closed" data-block="posle-vhoda"><div class="card__body">' +
          '<p class="label">Для владельца</p><h2 class="h3">Паспорт, протоколы, ЗИП</h2>' +
          '<p class="pr-muted">Доступны владельцу после входа.</p>' +
          '<a class="btn btn--primary" href="index.html">Войти</a>' +
        '</div></section>' +
      '</div>' +
      '<section class="card pr-remont" id="pr-remont"><div class="card__head"><h2 class="h3">Подать заявку на ремонт</h2>' +
          '<span class="small pr-muted">без входа, по зав. № <span class="mono">' + esc(p.zavNomer) + '</span></span></div>' +
        '<div class="card__body pr-remont__grid">' +
          '<label class="field"><span class="field__label label">Предприятие</span><input class="input" id="pr-pred" placeholder="Название предприятия"></label>' +
          '<label class="field"><span class="field__label label">Контакт</span><input class="input" id="pr-kont" placeholder="Имя и телефон или почта"></label>' +
          '<label class="field pr-remont__wide"><span class="field__label label">Что случилось</span><textarea class="textarea" id="pr-opis" rows="3"></textarea></label>' +
          '<p class="pr-err pr-remont__wide" id="pr-err" hidden></p>' +
          '<div class="pr-remont__wide"><button class="btn btn--primary" type="button" data-act="pr-remont" data-n="' + esc(p.zavNomer) + '">Отправить заявку</button></div>' +
        '</div></section>';
  }

  function show(n) {
    n = chist(n);
    if (inp) { inp.value = n; }
    var p = n ? DATA.poNomeru(n) : null;
    out.innerHTML = !n ? podskazka(false) : (p ? nayden(p) : neNayden(n) + podskazka(false));
    document.title = (p ? 'Зав. № ' + p.zavNomer + ' — ' : '') + 'Проверка аппарата — ' + zavodImya();
  }

  w.Shell.on('pr-check', function () {
    var n = chist(inp ? inp.value : '');
    if (!n) {
      out.innerHTML = podskazka(true);
      if (inp) { inp.classList.add('input--error'); inp.focus(); }
      return;
    }
    if (inp) { inp.classList.remove('input--error'); }
    try { w.history.replaceState(null, '', '?n=' + encodeURIComponent(n)); } catch (e) { /* file:// без истории */ }
    show(n);
  });
  document.getElementById('pr-form').addEventListener('submit', function (e) { e.preventDefault(); });

  w.Shell.on('pr-remont', function (t) {
    var opis = document.getElementById('pr-opis'), kont = document.getElementById('pr-kont'), e = document.getElementById('pr-err');
    var pred = document.getElementById('pr-pred'), miss = [];
    [[pred, 'предприятие'], [kont, 'контакт'], [opis, 'что случилось']].forEach(function (x) {
      var bad = !x[0] || !x[0].value.trim();
      if (x[0]) { x[0].classList.toggle('input--error', bad); }
      if (bad) { miss.push(x[1]); }
    });
    if (miss.length) {
      if (e) { e.textContent = 'Заполните: ' + (miss.length > 1 ? miss.slice(0, -1).join(', ') + ' и ' + miss[miss.length - 1] : miss[0]) + '.'; e.hidden = false; }
      return;
    }
    var n = t.getAttribute('data-n');
    var id = w.ACT.zayavkaPoQr(n, { predpriyatie: pred.value, kontakt: kont.value, text: opis.value });
    if (!id) { if (e) { e.textContent = 'Не удалось отправить заявку. Проверьте заводской номер и поля.'; e.hidden = false; } return; }
    var box = document.getElementById('pr-remont');
    box.setAttribute('data-sent', id);
    box.innerHTML = '<div class="card__head"><h2 class="h3">Заявка на ремонт № ' + esc(String(id).replace(/^ob-/, '')) + ' отправлена</h2></div>' +
      '<div class="card__body"><p>Заявка по аппарату зав. № <span class="mono">' + esc(n) + '</span> передана в сервис завода. ' +
      'Специалист свяжется по контакту: ' + esc(kont.value.trim()) + '.</p></div>';
  });

  show(param('n'));
})(window);

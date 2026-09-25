/* Мои аппараты — apparaty.html. Экран заказчика, таск 05.

   Читает только DATA. Своих правил ходов нет: что ждёт ответа заказчика,
   говорят признаки mozhno* из dannye.js (точки ПМИ, коды документа).

   Раскладка: блок «Требуют вашего ответа» (только если есть что ответить),
   карточки — заявки и аппараты в работе (ранний этап выше, свежая заявка
   первой) и последний поставленный; остальной парк установки — строками.
   Что карточкой, что строкой и в каком порядке — признаки raskladka и poryadok из данных. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc;
  var DATA = w.DATA;

  if (!w.Shell.mount({ active: 'apparaty', role: 'zakazchik' })) { return; }
  var page = document.getElementById('page');


  function spr() { return DATA.spravochnik() || {}; }
  function current(a) {
    var c = null;
    (a.etapy || []).forEach(function (e) { if (e.status === 'current') { c = e; } });
    return c;
  }
  function tipTitle(a) { var t = (spr().tipy || {})[a.tip]; return t ? t.title : ''; }
  function href(a) { return (a.postavlen ? 'pasport.html?id=' : 'apparat.html?id=') + encodeURIComponent(a.id); }
  function pmiById(a, id) {
    var r = null;
    (a.pmi || []).forEach(function (p) { if (p.id === id) { r = p; } });
    return r;
  }

  /* Ближайшая дата карточки — одна строка. Даты и сроки уже посчитаны в данных. */
  function blizhe(a) {
    if (a.postavlen) {
      var b = a.osvidBlizh;
      if (!b) { return ''; }
      /* Подпись видов — одна склейка в данных: osvidBlizh.title (11a). */
      return b.title + ' ' + kogda(b) + ' · ' + R.data(b.date, { format: 'text' });
    }
    if (a.etap === 'zayavka') {
      return a.srokOtveta ? 'Ответ завода до ' + R.data(a.srokOtveta, { format: 'text' }) : '';
    }
    var w1 = a.blizhW ? pmiById(a, a.blizhW) : null;
    if (w1) { return cap(w1.title) + ' ' + R.data(w1.date, { format: 'text' }); }
    var c = current(a);
    return c && c.date ? cap(c.title) + ' до ' + R.data(c.date, { format: 'text' }) : '';
  }
  /* «через 3 месяца» для дальних дат, ближние — как у Render.data rel. */
  function kogda(b) {
    if (b.dney < 45) { return R.data(b.date, { format: 'rel' }); }
    var m = Math.round(b.dney / 30.4);
    return 'через ' + m + ' ' + R.plural(m, 'месяц', 'месяца', 'месяцев');
  }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function sostoyanie(a) {
    if (a.etap === 'zayavka') { return '<span class="badge badge--info" data-status="zayavka">Заявка отправлена</span>'; }
    if (a.garantiya) {
      return a.garantiya.status === 'active' ? '<span class="badge badge--ok">Гарантия до ' + esc(R.data(a.garantiya.do, { format: 'doc' })) + '</span>'
        : '<span class="badge badge--neutral">Гарантия истекла</span>';
    }
    return '';
  }

  function card(a) {
    var c = current(a);
    var etap = a.postavlen ? 'В эксплуатации с ' + R.data(a.postavka.vvod, { format: 'full' })
      : 'Этап: ' + (c ? c.title : '—');
    var date = blizhe(a);
    return '<a class="card card--link apy-card" href="' + esc(href(a)) + '" data-apparat="' + esc(a.id) + '" data-nakom="' + esc(a.naKom || 'none') + '">' +
      '<div class="apy-card__top"><p class="label">' + esc([tipTitle(a), a.techPoz ? 'поз. ' + a.techPoz : ''].filter(Boolean).join(' · ')) + '</p>' + sostoyanie(a) + '</div>' +
      '<h3 class="apy-card__title">' + esc(a.nazvanie) + '</h3>' +
      '<p class="apy-card__obozn">' + esc(a.oboznachenie || '') + '</p>' +
      '<p class="apy-card__nomer">' + (a.zavNomer ? 'Заводской № <span class="mono">' + esc(a.zavNomer) + '</span>'
        : '<span class="muted">Заводской № присвоят при изготовлении</span>') + '</p>' +
      '<div class="apy-card__etap"><span class="apy-card__etap-t">' + esc(etap) + '</span>' + R.etapy(a, { mini: true }) + '</div>' +
      '<p class="apy-card__date" data-date>' + (date ? esc(date) : '<span class="muted">Ближайших дат нет</span>') + '</p>' +
      (a.naKom ? '<div class="apy-card__foot">' + R.naKom(a) + '</div>' : '') +
    '</a>';
  }

  /* «Требуют вашего ответа»: точки остановки, приглашения, документы с кодами.
     Протокол, который подтверждается точкой H, второй строкой не дублируем. */
  function otvety(list) {
    var items = [];
    list.forEach(function (a) {
      var skip = {};
      var base = 'apparat.html?id=' + encodeURIComponent(a.id);
      (a.pmi || []).forEach(function (p) {
        if (p.mozhnoPodtverdit) {
          (p.dokumenty || []).forEach(function (d) { skip[d.id] = true; });
          items.push({ a: a, kind: 'hold', text: (p.dokumenty && p.dokumenty.length ? 'Подтвердить протокол: ' : 'Подтвердить точку остановки: ') + p.title,
            note: 'На точке остановки завод ждёт вашего подтверждения', srok: a.srokOtveta, href: base + '#proizvodstvo' });
        }
        if (p.mozhnoOtvetit) {
          items.push({ a: a, kind: 'priglashenie', text: 'Ответить на приглашение: ' + p.title.toLowerCase() + ' ' + R.data(p.date, { format: 'text' }),
            note: 'Приедете на инспекцию или завод проведёт испытания без вас', srok: null, href: base + '#proizvodstvo' });
        }
      });
      (a.dokumenty || []).forEach(function (d) {
        if (!d.mozhno || !d.mozhno.kody || !d.mozhno.kody.length || skip[d.id]) { return; }
        var r = d.revizii && d.revizii.length ? d.revizii[d.revizii.length - 1] : null;
        items.push({ a: a, kind: 'dokument', text: 'Согласовать: ' + d.title + (r ? ', рев. ' + r.rev : ''),
          note: 'Поставьте код ответа, замечания привяжите к позиции', srok: r && r.srok, href: base + '#doc=' + encodeURIComponent(d.id) });
      });
    });
    if (!items.length) { return ''; }
    return '<section class="card apy-otvet" data-block="otvet" aria-label="Требуют вашего ответа">' +
      '<div class="card__head"><h2 class="apy-sec-title">Требуют вашего ответа</h2><span class="badge badge--warn badge--plain">' + items.length + '</span></div>' +
      '<ul class="apy-otvet__list">' + items.map(function (it) {
        return '<li class="apy-otvet__i" data-otvet="' + esc(it.kind) + '" data-apparat="' + esc(it.a.id) + '">' +
          '<span class="apy-otvet__poz mono">' + esc(it.a.techPoz || '') + '</span>' +
          '<span class="apy-otvet__main"><a class="apy-otvet__link" href="' + esc(it.href) + '">' + esc(it.text) + '</a>' +
            '<span class="apy-otvet__note">' + esc(it.a.nazvanie + ' · ' + it.note) + '</span></span>' +
          '<span class="apy-otvet__srok">' + (it.srok ? 'до ' + esc(R.data(it.srok, { format: 'text' })) : '') + '</span>' +
        '</li>';
      }).join('') + '</ul></section>';
  }

  function ostalnye(list) {
    if (!list.length) { return ''; }
    return '<section class="section apy-rest" data-block="ostalnye">' +
      '<div class="section__head"><h2 class="apy-sec-title">Ещё в эксплуатации на установке</h2><span class="small muted">' + esc(list.length + ' ' + R.plural(list.length, 'аппарат', 'аппарата', 'аппаратов')) + '</span></div>' +
      '<div class="card">' + R.table({
        cols: [
          { key: 'techPoz', title: 'Поз.', nowrap: true, render: function (a) { return '<span class="mono">' + esc(a.techPoz) + '</span>'; } },
          { key: 'nazvanie', title: 'Аппарат', render: function (a) { return esc(a.nazvanie) + '<span class="apy-rest__obozn">' + esc(a.oboznachenie || '') + '</span>'; } },
          { key: 'zavNomer', title: 'Зав. №', nowrap: true, render: function (a) { return '<span class="mono">' + esc(a.zavNomer || '—') + '</span>'; } },
          { key: 'garantiya', title: 'Гарантия', nowrap: true, render: function (a) { return sostoyanie(a); } },
          { key: 'osvid', title: 'Ближайшее освидетельствование', render: function (a) { return esc(blizhe(a) || '—'); } }
        ],
        rows: list,
        rowHref: href
      }) + '</div></section>';
  }

  function render() {
    var me = DATA.me() || {};
    var z = me.zakazchikId ? DATA.zakazchik(me.zakazchikId) : null;
    var all = (DATA.apparaty({}) || []).slice().sort(function (p, q) { return p.poryadok - q.poryadok; });
    var cards = all.filter(function (a) { return a.raskladka === 'kartochka'; });
    var stroki = all.filter(function (a) { return a.raskladka === 'stroka'; });
    var vRabote = all.filter(function (a) { return !a.postavlen; });

    var head = '<div class="page-head apy-head"><div class="apy-head__main">' +
        '<h1 class="h1">Мои аппараты</h1>' +
        '<p class="apy-head__where">' + esc([z ? z.name : '', me.ustanovka || ''].filter(Boolean).join(' · ')) + '</p></div>' +
        '<div class="page-head__actions"><a class="btn btn--primary btn--lg" href="zayavka-novaya.html" data-new>Новая заявка</a></div></div>';

    if (!all.length) {
      page.innerHTML = head + '<section class="card">' + R.pusto({ text: 'На вашей установке аппаратов завода пока нет. Отправьте опросный лист, и заявка появится здесь.',
        action: { label: 'Новая заявка', href: 'zayavka-novaya.html' } }) + '</section>';
      return;
    }
    page.innerHTML = head + otvety(vRabote) +
      '<section class="section" data-block="kartochki" aria-label="Аппараты">' +
        '<div class="section__head"><h2 class="apy-sec-title">Заявки, производство, последняя поставка</h2></div>' +
        '<div class="apy-grid">' + cards.map(card).join('') + '</div></section>' +
      ostalnye(stroki);
  }

  render();
})(window);

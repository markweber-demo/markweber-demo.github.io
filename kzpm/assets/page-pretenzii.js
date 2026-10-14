/* Претензии — список. Сценарий Д «Претензия по партии». Владелец — таск 07.

   pretenzii.html. Заказчик видит претензии своего предприятия со статусом и
   «на ком шаг» и кнопку «Новая претензия». Служба сервиса (её главная) видит
   очередь всех претензий: открытые сверху, новые выше, дни без ответа и
   «Взять в работу». Менеджер и директор смотрят очередь без ходов: ходы
   претензий делает только служба сервиса.

   Читает DATA.pretenzii, пишет ACT.vzyatPretenziyu; доступность хода — признак
   mozhno.vzyat из данных, сроки и просрочку считает слой данных. */
(function (w) {
  'use strict';

  var R = w.Render, esc = R.esc, DATA = w.DATA, ACT = w.ACT, Shell = w.Shell;

  if (!Shell.mount({ active: 'pretenzii' })) { return; }

  var page = document.getElementById('page');
  var me = DATA.me() || {};
  var zavod = me.side === 'zavod';
  var NAZVANIE = 'Личный кабинет заказчика КЗПМ';

  function dniBezOtveta(x) { return R.dney(x.dneyBezOtveta); }
  /* Срок плашки: пока ответа не было — «ответ до», после ответа и запроса образцов — «решение до». */
  function srok(x) {
    return x.otvety && x.otvety.length ? { podpis: 'решение до', bylo: 'решение ожидалось' } : { podpis: 'ответ до', bylo: 'ответ ожидался' };
  }

  /* --- колонки ---------------------------------------------------------------- */
  /* Ширины колонок задаются одинаково у открытых и закрытых: таблицы встают друг под другом ровно. */
  function kolonki() {
    var cols = [
      { key: 'nomer', title: 'Претензия', width: zavod ? '19%' : '32%', render: function (x) {
        return '<a class="prs-nom" href="pretenziya.html?id=' + esc(encodeURIComponent(x.id)) + '">Претензия № ' + esc(x.nomer) + '</a>' +
          '<span class="prs-sub">' + esc((x.partiya ? 'Партия № ' + x.partiya.nomer + ', ' : '') + x.vidTitle.toLowerCase()) + '</span>';
      } }
    ];
    if (zavod) { cols.push({ key: 'zakazchik', title: 'Заказчик', width: '15%', render: function (x) { return esc(x.zakazchik ? x.zakazchik.kratko : ''); } }); }
    cols.push({ key: 'data', title: 'Подана', width: zavod ? '13%' : '16%', render: function (x) {
      return '<span class="prs-data">' + esc(R.data(x.data)) + '</span>' + (zavod && x.dneyBezOtveta !== null && x.dneyBezOtveta !== undefined
        ? '<span class="prs-sub prs-dni' + (x.prosrocheno ? ' is-overdue' : '') + '">' + esc(dniBezOtveta(x)) + ' без ответа</span>' : '');
    } });
    cols.push({ key: 'status', title: 'Статус', width: zavod ? '11%' : '14%', render: function (x) {
      return '<span class="badge ' + esc(x.statusCls) + '" data-status="' + esc(x.status) + '">' + esc(x.statusTitle) + '</span>';
    } });
    cols.push({ key: 'nakom', title: 'На ком шаг', width: zavod ? '24%' : '38%', render: function (x) {
      return R.naKom(x, { srok: srok(x) }) + (zavod && x.shag ? '<span class="prs-sub">' + esc(x.shag) + '</span>' : '');
    } });
    if (zavod) {
      cols.push({ key: 'akt', title: '', width: '18%', render: function (x) {
        return x.mozhno && x.mozhno.vzyat
          ? '<button class="btn btn--primary btn--sm" type="button" data-act="pr-vzyat" data-id="' + esc(x.id) + '">Взять в работу</button>' : '';
      } });
    }
    return cols;
  }

  function tablica(list) {
    return R.table({ cols: kolonki(), rows: list, rowHref: function (x) { return 'pretenziya.html?id=' + encodeURIComponent(x.id); } });
  }
  function blok(idBloka, title, body) {
    return '<section class="card prs-blok" id="' + idBloka + '" aria-labelledby="' + idBloka + '-h">' +
      '<h2 class="h2 prs-blok__h" id="' + idBloka + '-h">' + esc(title) + '</h2>' + body + '</section>';
  }

  /* --- шапка страницы ----------------------------------------------------------- */
  function lead() {
    if (me.rol === 'zakazchik') { return 'Претензии по полученным партиям вашего предприятия. Ответы службы сервиса появляются в карточке претензии.'; }
    if (me.rol === 'servis') { return 'Претензии всех заказчиков. Новые претензии показаны первыми.'; }
    return 'Претензии заказчиков. На них отвечает служба сервиса.';
  }
  function shapka() {
    return '<div class="page-head"><div class="page-head__main"><h1 class="h1">Претензии</h1><p class="page-lead">' + esc(lead()) + '</p></div>' +
      (me.rol === 'zakazchik' ? '<div class="page-head__actions"><a class="btn btn--primary" href="pretenziya.html">Новая претензия</a></div>' : '') +
      '</div>';
  }

  /* Ключевые числа очереди: сколько открыто, сколько ждёт ответа, сколько закрыто. */
  function chisla(vse, otkrytye, zakrytye) {
    var bezOtveta = otkrytye.filter(function (x) { return x.dneyBezOtveta !== null; }).length;
    function c(n, text) { return '<div class="chislo"><span class="chislo__v">' + n + '</span><span class="chislo__t">' + esc(text) + '</span></div>'; }
    return '<div class="chisla prs-chisla">' +
      c(otkrytye.length, R.plural(otkrytye.length, 'открытая претензия', 'открытые претензии', 'открытых претензий')) +
      c(bezOtveta, R.plural(bezOtveta, 'претензия без ответа', 'претензии без ответа', 'претензий без ответа')) +
      c(zakrytye.length, R.plural(zakrytye.length, 'закрытая претензия', 'закрытые претензии', 'закрытых претензий')) + '</div>';
  }

  /* --- экран -------------------------------------------------------------------- */
  function risovat() {
    document.title = 'Претензии — ' + NAZVANIE;
    var vse = DATA.pretenzii() || [];
    var otkrytye = vse.filter(function (x) { return x.status !== 'zakryta'; });
    var zakrytye = vse.filter(function (x) { return x.status === 'zakryta'; });
    var html = shapka();
    if (!vse.length) {
      html += me.rol === 'zakazchik'
        ? R.pusto({ text: 'Претензий пока нет. Если полученная партия не соответствует спецификации, подайте претензию с номером партии, видом проблемы и фото.',
          action: { label: 'Новая претензия', href: 'pretenziya.html' } })
        : R.pusto({ text: 'Претензий пока нет. Претензия появится здесь, когда заказчик подаст её по полученной партии.' });
      page.innerHTML = html;
      return;
    }
    if (zavod) { html += chisla(vse, otkrytye, zakrytye); }
    if (otkrytye.length || zavod) {
      html += blok('otkrytye', 'Открытые претензии', otkrytye.length ? tablica(otkrytye) : R.pusto({ text: 'Открытых претензий нет.' }));
    }
    if (zakrytye.length) { html += '<div class="prs-ryad">' + blok('zakrytye', 'Закрытые претензии', tablica(zakrytye)) + '</div>'; }
    page.innerHTML = html;
  }

  Shell.on('pr-vzyat', function (b) {
    var id = b.getAttribute('data-id');
    if (ACT.vzyatPretenziyu(id)) { risovat(); Shell.refresh(); return; }
    R.modal({ title: 'Действие не выполнено', text: 'Претензия уже взята в работу. Обновите страницу, чтобы увидеть текущий статус.' });
  });

  risovat();
})(window);

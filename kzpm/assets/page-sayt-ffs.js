/* Страница товара «ФФС (FFS) мешки» — sayt-ffs.html. Владелец — таск 04 (G01, R10).

   Копия страницы товара с сайта kzpm.com: шапка, подвал, крошки, заголовок, фото,
   характеристики и вкладки как на сайте. Единственное, чего на сайте нет, — кнопка
   «Запросить расчёт и образец»: она ведёт через вход (index.html?next=…) в форму
   запроса, где продукт «ФФС (FFS) мешки» уже выбран. Меню кабинета на странице нет,
   поэтому каркас монтируется без шапки: Shell даёт только кнопку панели ведущего.

   Вкладки переключает этот файл; данные страница не читает. Ссылок на настоящий
   сайт нет: разделы меню и карточки «Смотрите также» — только вид. */
(function (w) {
  'use strict';

  var Shell = w.Shell;
  if (!Shell.mount({ bare: true })) { return; }

  /* Вкладка: показать свою панель, остальные скрыть, у кнопок — выбранное состояние. */
  Shell.on('sf-tab', function (b) {
    var tab = b.getAttribute('data-tab');
    Array.prototype.forEach.call(document.querySelectorAll('.sf-vkladka'), function (v) {
      v.hidden = v.getAttribute('data-vkladka') !== tab;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="sf-tab"]'), function (t) {
      var on = t.getAttribute('data-tab') === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
})(window);

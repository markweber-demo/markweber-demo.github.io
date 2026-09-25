/* Всё изменяемое в браузере: роль, человек, журнал действий, черновики
   форм и замечания к прототипу. Один ключ localStorage — «Сбросить демо»
   чистит журнал и черновики. Формат хранения наружу не выставляется:
   только функции ниже. Людей и данные Store не знает — их знает dannye.js. */
(function (w) {
  'use strict';

  var KEY = 'bmz-servis-prototip';
  var ROLES = ['zakazchik', 'zavod'];

  var DEFAULTS = {
    role: 'zakazchik',
    person: null,
    journal: [],
    seq: 0,
    drafts: {},
    notes: []
  };

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function read() {
    var s = clone(DEFAULTS), raw = null;
    try { raw = w.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        for (var k in DEFAULTS) {
          if (Object.prototype.hasOwnProperty.call(saved, k) && saved[k] !== undefined) { s[k] = saved[k]; }
        }
      } catch (e) { /* испорченный ключ — работаем на значениях по умолчанию */ }
    }
    if (ROLES.indexOf(s.role) < 0) { s.role = DEFAULTS.role; }
    return s;
  }

  function write() {
    try { w.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }

  var state = read();

  /* Роль и человека можно задать адресом: apparat.html?id=vh-101&role=zavod.
     Этим пользуется прибор, открывая каждую страницу в обеих ролях. */
  (function fromUrl() {
    var q = (w.location && w.location.search) || '';
    if (!q) { return; }
    var changed = false;
    var r = /[?&]role=([a-z]+)/.exec(q);
    if (r && ROLES.indexOf(r[1]) > -1) { state.role = r[1]; changed = true; }
    var p = /[?&]person=([a-z0-9-]+)/.exec(q);
    if (p) { state.person = p[1]; changed = true; }
    if (changed) { write(); }
  })();

  function newDraftId() {
    return 'd-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  var Store = {
    /** 'zakazchik' | 'zavod' */
    role: function () { return state.role; },
    /** Смена роли сбрасывает выбранного человека: он принадлежал другой стороне. */
    setRole: function (r) {
      if (ROLES.indexOf(r) < 0) { return state.role; }
      if (r !== state.role) { state.person = null; }
      state.role = r;
      write();
      return r;
    },

    /** id человека или null — тогда DATA.me() берёт человека роли по умолчанию. */
    person: function () { return state.person; },
    setPerson: function (id) {
      state.person = id ? String(id) : null;
      write();
      return state.person;
    },

    /** Журнал действий — копия, по порядку записи. */
    journal: function () { return clone(state.journal); },
    /** Записать действие. Store ставит порядковый номер и время; возвращает запись. */
    push: function (action) {
      state.seq = (state.seq || 0) + 1;
      var e = clone(action) || {};
      e.seq = state.seq;
      if (!e.at) { e.at = new Date().toISOString(); }
      state.journal.push(e);
      write();
      return clone(e);
    },

    /** Черновик формы по ключу. Первый вызов заводит его с новым draftId:
        этот id делает повторную отправку той же заявки безопасной. */
    draft: function (key) {
      var k = String(key || 'default');
      if (!state.drafts[k] || !state.drafts[k].draftId) {
        state.drafts[k] = { draftId: newDraftId() };
        write();
      }
      return clone(state.drafts[k]);
    },
    /** setDraft(key, obj) — сохранить поля; setDraft(key, null) — забыть черновик. */
    setDraft: function (key, obj) {
      var k = String(key || 'default');
      if (!obj) { delete state.drafts[k]; write(); return null; }
      var prev = state.drafts[k] || {};
      var next = clone(obj);
      if (!next.draftId) { next.draftId = prev.draftId || newDraftId(); }
      state.drafts[k] = next;
      write();
      return clone(next);
    },

    /** Замечания к прототипу: { screen, text, role, at }. */
    notes: function () { return clone(state.notes); },
    addNote: function (n) {
      n = n || {};
      state.notes.push({
        screen: String(n.screen || ''),
        text: String(n.text || '').trim(),
        role: n.role || state.role,
        at: new Date().toISOString()
      });
      write();
      return state.notes.length;
    },

    /** Сброс демо: журнал и черновики. Роль, человек и замечания к прототипу
        переживают сброс — это не состояние демо, а тот, кто его смотрит. */
    reset: function () {
      state.journal = [];
      state.seq = 0;
      state.drafts = {};
      write();
      return true;
    }
  };

  w.Store = Store;
})(window);

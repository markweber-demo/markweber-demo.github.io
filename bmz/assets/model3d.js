/* Model3D — схематичная 3D-модель аппарата воздушного охлаждения для вкладки «Согласование»:
   зигзагообразного (АВЗ) или горизонтального (АВГ).

   Контракт:
     Model3D.mount(el, { rev, highlight, onPick, vid }) -> { setRev(rev), highlight(poz), destroy() }
     Model3D.gabarity(vid) -> габариты вида в метрах для чертежа (копия, см. внизу файла)
     vid        "avz" | "avg" — вид аппарата; пусто или другое = "avz". Корень .m3d несёт data-vid.
     rev        "A" | "B" (кириллица А/В тоже понимается; пусто = "A")
     highlight  "shtucer-A" | "shtucer-B" | null
     onPick(poz) вызывается кликом по штуцеру, poz — "shtucer-A" | "shtucer-B"

   Зависимости: страница подключает до этого файла
     assets/vendor/three/three.min.js и assets/vendor/three/OrbitControls.js (three r147).
   Нет WebGL или нет three — вместо модели схема торца и строка «3D недоступно в этом браузере»;
   клик по штуцеру на схеме работает так же.

   АВЗ — три пары секций шатром над коробом вентиляторов. АВГ — три секции плашмя одним
   ярусом в коробе, под ним высокие диффузоры с колёсами, камеры по торцам секций.
   Рев. A: штуцер А на камере первой секции (у АВЗ — на коньке первой пары). Рев. B: штуцер А
   перенесён на камеру третьей, у торца с камерами появилась площадка обслуживания
   с ограждением и лестницей. Штуцер Б в обеих ревизиях на месте. */
(function (w) {
  'use strict';

  var POZ = ['shtucer-A', 'shtucer-B'];
  var CAPTION = 'Схематичная модель. В работе — модель конструкторской службы';
  var NO_GL = '3D недоступно в этом браузере';
  // Подсказка: на Mac зум — ⌘ + прокрутка, на остальных (на заводе — Windows) — Ctrl + прокрутка.
  // Систему спрашиваем при каждом mount, а не при загрузке файла.
  function isMac() {
    var n = w.navigator || {};
    var p = (n.userAgentData && n.userAgentData.platform) || n.platform || '';
    return /mac|iphone|ipad|ipod/i.test(p);
  }
  function hintText() {
    return 'Потяните — вращать · щипок или ' + (isMac() ? '⌘' : 'Ctrl') + ' + прокрутка — приблизить · двойной клик — исходный вид';
  }
  // Кнопки вида: [ключ, подпись, подсказка]. Ключ вида = ключ в VIEWS внутри make3D.
  var BTNS = [
    ['home', 'Исходный вид', 'Вернуть вид, как при открытии'],
    ['front', 'Спереди', 'Вид с торца коллекторов'],
    ['side', 'Сбоку', 'Вид вдоль аппарата'],
    ['top', 'Сверху', 'Вид сверху'],
    ['in', '+', 'Приблизить'],
    ['out', '−', 'Отдалить']
  ];
  var FLY_MS = 400, ZOOM_MS = 250;

  var C = {
    bg: 0xF1F3F5, ground: 0xE3E7EB, pad: 0xCDD3D8,
    steel: 0x7B858F, sheet: 0xB3BBC2, sheetDark: 0x9AA3AB,
    finBase: '#98A1A9', finLine: '#5C666F',
    chamber: 0xC29B35, plug: 0x7E6420,
    nozzle: 0x4F5A64, hl: 0x0B5998,
    deck: 0x8F99A2, rail: 0xD1A32A, edge: 0x2F3840
  };

  // Габариты, метры. X — вдоль труб, Z — поперёк, Y — вверх. Общие у обоих видов.
  var L = 9, W = 6.6;                              // длина, ширина
  var SEC = 3, TW = W / SEC;                       // три секции поперёк (у АВЗ — три пары шатром)
  var CH = 0.45, LT = L - 2 * CH;                  // толщина камеры по X, длина трубного пучка
  var XE = LT / 2 + CH / 2;                        // центр камеры по X
  var TH = 2.4;                                    // высота шатра АВЗ
  var SH = 0.42, CHH = 0.65;                       // АВГ: толщина секции, высота камеры
  var CW = TW - 0.14, CDY = 0.05;                  // АВГ: ширина камеры, насколько камера ниже секции
  var KAM_T = 0.58;                                // АВЗ: толщина камеры на скате
  var KONYOK = { w: 0.5, h: 0.24, dy: 0.2 };       // АВЗ: камера на коньке — ширина, высота, центр над коньком
  var RT = 2.1, RB = 1.62;                         // диффузор: радиус верха конуса и колеса
  var PRIVOD = { h: 1.25, rama: 0.55, plita: 0.1, motorR: 0.34, motorH: 0.62 };   // рама привода, двигатель
  var SHTUCER = { r: 0.13, flR: 0.26, flH: 0.07, lenA: 0.75, lenB: 0.65 }; // патрубок, фланец
  // Площадка обслуживания рев. B у торца с камерами: настил ниже секций на dy,
  // от торца x0…x1, шире короба на zapas; ограждение rh; проход к лестнице laz…laz+lazW от края.
  var PLOSH = { dy: 0.12, x0: 0.1, x1: 1.35, zapas: 0.2, rh: 1.1, laz: 0.45, lazW: 0.6 };

  function secZ(k) { return -W / 2 + TW * (k + 0.5); }
  var A_POS = { A: secZ(0), B: secZ(2) };          // Z штуцера А по ревизиям

  /* Чем виды различаются: числа ниже и блок секций (tentSections / flatSections, схема —
     drawTents / drawFlat). Рама, короб, вентиляторы, штуцеры, подписи, площадка,
     управление и уборка — один код.
       top   верх опорной рамы = плита с отверстиями вентиляторов
       y0    низ секций          wall  верх боковых стенок короба
       coneH, bandH  диффузор: конус и обечайка колеса; coneZ — растяжка верха конуса поперёк
             (у АВГ диффузор накрывает всю ширину яруса)
       aY    основание штуцера А (верх камеры), aLab — высота его подписи над основанием
       b     штуцер Б на торце камеры, смотрит по +X
       cam, target   исходный вид */
  var VIDY = {
    avz: { top: 3.7, y0: 4.2, wall: 4.2, coneH: 0.8, bandH: 0.75, coneZ: 1,
      aY: 4.2 + TH + 0.3, aLab: 1.7, b: [L / 2 - 0.02, 4.2 + 0.28 * TH, -W / 2 + 0.28 * TW / 2],
      cam: [15.9, 9.1, 13.8], target: [0.3, 3.9, 0], aria: 'Схема аппарата с торца' },
    avg: { top: 4.4, y0: 4.55, wall: 4.55 + 0.5, coneH: 1.7, bandH: 0.7, coneZ: 1.45,
      aY: 4.55 - CDY + CHH, aLab: 1.9, b: [L / 2 - 0.02, 4.55 + 0.17, secZ(0) - 0.5],
      cam: [15.9, 8.4, 13.8], target: [0.3, 3.4, 0], aria: 'Схема горизонтального аппарата с торца' }
  };
  function normVid(vid) { return String(vid || '').trim().toLowerCase() === 'avg' ? 'avg' : 'avz'; }

  function normRev(rev) {
    if (rev === null || rev === undefined || rev === '') { return 'A'; }
    var s = String(rev).trim().toUpperCase();
    var ch = s.charAt(s.length - 1);
    return (ch === 'A' || ch === 'А') ? 'A' : 'B';
  }
  function normPoz(poz) { return POZ.indexOf(poz) >= 0 ? poz : null; }

  /* Оформление обвязки модели — классами, стиль вставляется в документ один раз.
     Шрифт и цвета — токены страницы (var(--font), var(--c-…)); после запятой —
     запасные значения для страницы без styles.css. Специфичность — один класс:
     страница переопределяет своим селектором без !important. */
  var STYLE_ID = 'm3d-style';
  var CSS =
    '.m3d{display:flex;flex-direction:column;gap:6px;width:100%}' +
    '.m3d__view{position:relative;width:100%;aspect-ratio:16/10;min-height:260px;border-radius:8px;overflow:hidden;background:var(--c-surface-2,#F3F5F7)}' +
    '.m3d__canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}' +
    '.m3d__chertezh{display:block;width:100%;height:100%}' +
    '.m3d__rev{position:absolute;right:10px;top:10px;font:600 var(--fs-xs,13px)/1 var(--font,"Segoe UI",Arial,sans-serif);color:var(--c-surface,#fff);' +
      'background:var(--c-navy,#0F2A44);border-radius:4px;padding:6px 8px;pointer-events:none}' +
    '.m3d__hint{position:absolute;left:10px;bottom:8px;font:500 var(--fs-2xs,12px)/1.3 var(--font,"Segoe UI",Arial,sans-serif);color:var(--c-muted,#4A5968);pointer-events:none}' +
    '.m3d__caption{font:400 var(--fs-sm,13px)/1.4 var(--font,"Segoe UI",Arial,sans-serif);color:var(--c-muted,#4A5968)}' +
    '.m3d__nogl{position:absolute;left:12px;top:10px;font:600 var(--fs-sm,14px)/1.3 var(--font,"Segoe UI",Arial,sans-serif);color:var(--c-navy,#0F2A44);' +
      'background:var(--c-surface,#fff);border:1px solid var(--c-line,#C9D1D8);border-radius:6px;padding:6px 10px}' +
    '.m3d__ctrl{position:absolute;left:10px;top:10px;display:flex;flex-wrap:wrap;gap:4px;max-width:calc(100% - 96px)}' +
    '.m3d__btn{font:500 var(--fs-2xs,12px)/1 var(--font,"Segoe UI",Arial,sans-serif);color:var(--c-navy,#0F2A44);background:var(--c-surface,#fff);' +
      'border:1px solid var(--c-line,#C9D1D8);border-radius:4px;padding:0 8px;min-height:28px;cursor:pointer;touch-action:manipulation;user-select:none}' +
    '.m3d__btn:hover{color:var(--c-blue,#0B5896);border-color:var(--c-blue,#0B5896)}' +
    '.m3d__btn:focus-visible{outline:2px solid var(--c-blue,#0B5896);outline-offset:1px}' +
    '.m3d__btn--zoom{min-width:28px;padding:0 6px;font-weight:600;font-size:var(--fs-sm,15px)}' +
    '.m3d__btn--gap{margin-left:6px}' +
    '@media (pointer:coarse){.m3d__btn{min-height:36px;padding:0 10px}.m3d__btn--zoom{min-width:36px}}';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) { return; }
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    var head = document.head || document.documentElement;
    head.insertBefore(st, head.firstChild);
  }
  /* Шрифт для подписей на холсте: холст не читает CSS-переменные сам. */
  function fontFamily() {
    var f = '';
    try { f = w.getComputedStyle(document.documentElement).getPropertyValue('--font').trim(); } catch (e) { f = ''; }
    return f || '"Segoe UI", Arial, sans-serif';
  }

  function h(tag, cls, style, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (style) { n.style.cssText = style; }
    if (text) { n.textContent = text; }
    return n;
  }

  function glContext(canvas) {
    var attrs = { antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'default' };
    var gl = null;
    try {
      gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs) ||
           canvas.getContext('experimental-webgl', attrs);
    } catch (e) { gl = null; }
    return gl || null;
  }

  /* ---------- 3D ---------- */

  function make3D(view, state, api, sink) {
    var THREE = w.THREE;
    if (!THREE || !THREE.WebGLRenderer) { return null; }
    var G = VIDY[state.vid];
    var canvas = h('canvas', 'm3d__canvas');
    var gl = glContext(canvas);
    if (!gl) { return null; }
    view.appendChild(canvas);
    if (sink) { sink.uborka = uborka; }

    /* Уборка: и для destroy(), и для сбоя посреди сборки (ветка catch в mount).
       Поэтому каждое звено проверяет, успело ли оно появиться. */
    function uborka() {
      if (raf) { w.cancelAnimationFrame(raf); }
      if (hoverRaf) { w.cancelAnimationFrame(hoverRaf); }
      if (fly) { cancelFly(); }
      if (ro) { ro.disconnect(); }
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onEarlyDown);
      canvas.removeEventListener('pointerup', onEarlyUp);
      canvas.removeEventListener('pointercancel', onEarlyUp);
      canvas.removeEventListener('dblclick', onDbl);
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { canvas.removeEventListener(t, onGesture); });
      if (ctrl) { ctrl.removeEventListener('click', onCtrl); }
      if (controls) { controls.dispose(); }
      var seen = [];
      if (scene) {
        scene.traverse(function (o) {
          if (o.geometry) { o.geometry.dispose(); }
          if (o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
              if (seen.indexOf(m) < 0) { seen.push(m); if (m.map) { m.map.dispose(); } m.dispose(); }
            });
          }
        });
      }
      (textures || []).forEach(function (t) { t.dispose(); });
      if (edgeMat) { edgeMat.dispose(); }
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      else { var lose = gl.getExtension('WEBGL_lose_context'); if (lose) { lose.loseContext(); } }
      if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); }
    }

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, context: gl, antialias: true });
    renderer.setPixelRatio(Math.min(w.devicePixelRatio || 1, 2));

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(C.bg);
    scene.fog = new THREE.Fog(C.bg, 30, 75);
    var camera = new THREE.PerspectiveCamera(34, 1.6, 0.5, 200);
    camera.position.set(G.cam[0], G.cam[1], G.cam[2]);
    var target = new THREE.Vector3(G.target[0], G.target[1], G.target[2]);
    camera.lookAt(target);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xB9C0C7, 0.75));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(8, 16, 10);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-10, 6, -8);
    scene.add(fill);

    var textures = [];
    var mats = {};
    function mat(key, color, extra) {
      if (!mats[key]) {
        var o = { color: color, metalness: 0.25, roughness: 0.72 };
        for (var k in extra || {}) { o[k] = extra[k]; }
        mats[key] = new THREE.MeshStandardMaterial(o);
      }
      return mats[key];
    }
    var edgeMat = new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.28 });
    function noRay() {}

    function withEdges(mesh) {
      var e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), edgeMat);
      e.raycast = noRay;
      mesh.add(e);
      return mesh;
    }
    function box(parent, sx, sy, sz, m, x, y, z, edges) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return edges ? withEdges(mesh) : mesh;
    }
    // Балка между двумя точками, квадратное сечение t.
    var UP = new THREE.Vector3(0, 1, 0);
    function beam(parent, a, b, t, m) {
      var va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]);
      var d = vb.clone().sub(va), len = d.length();
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), m);
      mesh.position.copy(va).add(vb).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(UP, d.normalize());
      parent.add(mesh);
      return mesh;
    }
    function cyl(parent, rt, rb, hgt, m, x, y, z, seg, open) {
      var g = new THREE.CylinderGeometry(rt, rb, hgt, seg || 32, 1, !!open);
      var mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    }

    // Текстура оребрения: частые рёбра поперёк труб.
    function finTexture() {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var x = c.getContext('2d');
      x.fillStyle = C.finBase; x.fillRect(0, 0, 64, 64);
      x.fillStyle = C.finLine;
      for (var i = 0; i < 4; i++) { x.fillRect(i * 16, 0, 5, 64); }
      x.fillStyle = 'rgba(40,48,56,0.25)';
      for (var j = 0; j < 4; j++) { x.fillRect(0, j * 16 + 7, 64, 2); }
      var t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textures.push(t);
      return t;
    }
    function gratingTexture() {
      var c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      var x = c.getContext('2d');
      x.fillStyle = '#A7B0B8'; x.fillRect(0, 0, 32, 32);
      x.fillStyle = '#6D7780';
      x.fillRect(0, 0, 32, 4); x.fillRect(0, 16, 32, 4);
      x.fillRect(0, 0, 3, 32);
      var t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      textures.push(t);
      return t;
    }

    var model = new THREE.Group();
    scene.add(model);

    // Земля и фундаменты.
    var ground = new THREE.Mesh(new THREE.CircleGeometry(140, 64), new THREE.MeshBasicMaterial({ color: C.ground }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Опорная металлоконструкция.
    var steel = mat('steel', C.steel);
    var top = G.top, LEG = top - 0.3;
    var legX = [-L / 2, 0, L / 2], legZ = [-W / 2, W / 2];
    legX.forEach(function (x) {
      legZ.forEach(function (z) {
        box(model, 0.7, 0.3, 0.7, mat('pad', C.pad, { metalness: 0, roughness: 1 }), x, 0.15, z, true);
        box(model, 0.22, LEG, 0.22, steel, x, LEG / 2 + 0.3, z, true);
      });
    });
    legZ.forEach(function (z) {
      box(model, L + 0.22, 0.26, 0.22, steel, 0, top - 0.13, z, true);
      box(model, L, 0.12, 0.12, steel, 0, 1.4, z);
      [[-L / 2, 0], [0, L / 2]].forEach(function (s) {
        beam(model, [s[0], 0.5, z], [s[1], top - 0.3, z], 0.09, steel);
        beam(model, [s[1], 0.5, z], [s[0], top - 0.3, z], 0.09, steel);
      });
    });
    legX.forEach(function (x) {
      box(model, 0.22, 0.26, W, steel, x, top - 0.13, 0, true);
      beam(model, [x, 0.5, -W / 2], [x, top - 0.3, W / 2], 0.09, steel);
    });

    // Короб над вентиляторами и диффузоры. У АВГ боковые стенки закрывают ярус секций,
    // торцы открыты до низа камер.
    var sheet = mat('sheet', C.sheet, { side: THREE.DoubleSide });
    var boxH = G.wall - top, endH = Math.min(G.wall, G.y0) - top;
    box(model, L, boxH, 0.05, sheet, 0, top + boxH / 2, -W / 2, true);
    box(model, L, boxH, 0.05, sheet, 0, top + boxH / 2, W / 2, true);
    box(model, 0.05, endH, W, sheet, -L / 2, top + endH / 2, 0, true);
    box(model, 0.05, endH, W, sheet, L / 2, top + endH / 2, 0, true);
    var fanX = [-L / 4, L / 4];
    var plate = new THREE.Shape();
    plate.moveTo(-L / 2, -W / 2); plate.lineTo(L / 2, -W / 2); plate.lineTo(L / 2, W / 2); plate.lineTo(-L / 2, W / 2); plate.lineTo(-L / 2, -W / 2);
    fanX.forEach(function (fx) {
      var hole = new THREE.Path();
      hole.absellipse(fx, 0, RT, RT * G.coneZ, 0, Math.PI * 2, true);
      plate.holes.push(hole);
    });
    var plateMesh = new THREE.Mesh(new THREE.ShapeGeometry(plate, 24), sheet);
    plateMesh.rotation.x = Math.PI / 2;
    plateMesh.position.y = top;
    model.add(plateMesh);

    var sheetDark = mat('sheetDark', C.sheetDark, { side: THREE.DoubleSide });
    fanX.forEach(function (fx) {
      var coneH = G.coneH, bandH = G.bandH;
      var cone = cyl(model, RT, RB, coneH, sheet, fx, top - coneH / 2, 0, 48, true);
      if (G.coneZ !== 1) {                                   // верх конуса — эллипс под отверстие плиты
        var cp = cone.geometry.attributes.position;
        for (var q = 0; q < cp.count; q++) { cp.setZ(q, cp.getZ(q) * (1 + (G.coneZ - 1) * (cp.getY(q) / coneH + 0.5))); }
        cp.needsUpdate = true;
        cone.geometry.computeVertexNormals();
      }
      withEdges(cone);
      withEdges(cyl(model, RB, RB, bandH, sheetDark, fx, top - coneH - bandH / 2, 0, 48, true));
      [top - coneH, top - coneH - bandH].forEach(function (y) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(RB + 0.03, 0.05, 8, 48), steel);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(fx, y, 0);
        model.add(ring);
      });
      // Колесо вентилятора.
      var hubY = top - coneH - bandH * 0.45;
      cyl(model, 0.28, 0.28, 0.28, mat('hub', 0x5E6973), fx, hubY, 0, 24);
      var bladeMat = mat('blade', 0x6E7983);
      for (var i = 0; i < 6; i++) {
        var p = new THREE.Group();
        p.position.set(fx, hubY, 0);
        p.rotation.y = i * Math.PI / 3;
        var bl = box(p, 1.3, 0.04, 0.34, bladeMat, 0.25 + 0.65, 0, 0);
        bl.rotation.x = 0.28;
        model.add(p);
      }
      // Привод на отдельной раме.
      var dh = PRIVOD.h, pr = PRIVOD.rama, mz = dh + PRIVOD.plita + PRIVOD.motorH;
      [[-pr, -pr], [pr, -pr], [pr, pr], [-pr, pr]].forEach(function (q) {
        box(model, 0.12, dh, 0.12, steel, fx + q[0], dh / 2, q[1]);
      });
      box(model, 1.3, PRIVOD.plita, 1.3, steel, fx, dh + PRIVOD.plita / 2, 0, true);
      withEdges(cyl(model, PRIVOD.motorR, PRIVOD.motorR, PRIVOD.motorH, mat('motor', 0x56616B), fx, dh + PRIVOD.plita + PRIVOD.motorH / 2, 0, 28));
      cyl(model, 0.05, 0.05, hubY - mz, steel, fx, (hubY + mz) / 2, 0, 12);
    });

    // Секции и камеры коллекторов: общий материал, блок — по виду.
    var fins = finTexture();
    fins.repeat.set(LT * 5, 3);
    var finMat = new THREE.MeshStandardMaterial({ map: fins, metalness: 0.3, roughness: 0.65 });
    mats.fins = finMat;
    var chamberMat = mat('chamber', C.chamber, { metalness: 0.15, roughness: 0.6 });
    var plugMat = mat('plug', C.plug);
    // Пробка на крышке камеры: ось по X, координаты — в системе камеры.
    function plug(parent, x, y, z) {
      var pl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 12), plugMat);
      pl.rotation.z = Math.PI / 2;
      pl.position.set(x, y, z);
      parent.add(pl);
    }
    // АВЗ: пары секций шатром, камеры по торцам, на коньке камера со штуцером.
    function tentSections() {
      var Y0 = G.y0, RIDGE_Y = Y0 + TH;
      var slant = Math.sqrt(TW * TW / 4 + TH * TH);
      function section(zb, zt) {
        var yb = Y0, yt = RIDGE_Y;
        var th = Math.atan2(zt - zb, yt - yb);
        var mid = [0, (yb + yt) / 2, (zb + zt) / 2];
        var s = new THREE.Mesh(new THREE.BoxGeometry(LT, slant, 0.34), finMat);
        s.position.set(mid[0], mid[1], mid[2]);
        s.rotation.x = th;
        model.add(withEdges(s));
        [-1, 1].forEach(function (sg) {
          var c = new THREE.Mesh(new THREE.BoxGeometry(CH, slant + 0.1, KAM_T), chamberMat);
          c.position.set(sg * XE, mid[1], mid[2]);
          c.rotation.x = th;
          model.add(withEdges(c));
          for (var i = 0; i < 5; i++) { plug(c, CH / 2 + 0.03, -slant / 2 + 0.35 + i * (slant - 0.7) / 4, 0); }
        });
      }
      for (var k = 0; k < SEC; k++) {
        var zc = secZ(k);
        section(zc - TW / 2, zc);
        section(zc + TW / 2, zc);
        box(model, L, 0.14, 0.2, steel, 0, RIDGE_Y + 0.1, zc, true);       // коньковая балка
        box(model, CH + 0.04, KONYOK.h, KONYOK.w, chamberMat, XE, RIDGE_Y + KONYOK.dy, zc, true);
        box(model, CH + 0.04, KONYOK.h, KONYOK.w, chamberMat, -XE, RIDGE_Y + KONYOK.dy, zc, true);
      }
    }
    // АВГ: секции плашмя одним ярусом, камеры по торцам каждой, пробки в два ряда,
    // сверху продольные балки между секциями и поперечные прижимы трубного пучка.
    function flatSections() {
      var Y0 = G.y0, cw = CW, cy = Y0 - CDY + CHH / 2;
      for (var k = 0; k < SEC; k++) {
        var zc = secZ(k);
        box(model, LT, SH, TW - 0.1, finMat, 0, Y0 + SH / 2, zc, true);
        [-1, 1].forEach(function (sg) {
          var c = box(model, CH, CHH, cw, chamberMat, sg * XE, cy, zc, true);
          for (var i = 0; i < 6; i++) {
            for (var j = 0; j < 2; j++) { plug(c, sg * (CH / 2 + 0.03), (j - 0.5) * 0.26, -cw / 2 + 0.25 + i * (cw - 0.5) / 5); }
          }
        });
      }
      for (var v = 1; v < SEC; v++) { box(model, LT, 0.1, 0.12, steel, 0, Y0 + SH + 0.05, -W / 2 + v * TW, true); }
      for (var i2 = 1; i2 < 4; i2++) { box(model, 0.1, 0.07, W - 0.1, steel, -LT / 2 + i2 * LT / 4, Y0 + SH + 0.035, 0, true); }
    }
    if (state.vid === 'avg') { flatSections(); } else { tentSections(); }
    for (var v = 0; v <= SEC; v++) {
      box(model, L, 0.2, 0.24, steel, 0, G.y0, -W / 2 + v * TW, true);    // балки по низу секций
    }

    // Штуцеры и подписи.
    var labels = [], pickables = [], proxies = [];
    var proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    mats.proxy = proxyMat;
    var LABEL_H = 144;
    function labelTexture(title, sub, on) {
      var c = document.createElement('canvas');
      var x = c.getContext('2d');
      var fam = fontFamily();
      var f1 = '600 54px ' + fam;
      var f2 = '500 34px ' + fam;
      x.font = f1;
      var tw = x.measureText(title).width;
      x.font = f2;
      if (sub) { tw = Math.max(tw, x.measureText(sub).width); }
      var wd = Math.ceil(tw + 72), ht = LABEL_H, r = 30;
      c.width = wd; c.height = ht;
      x = c.getContext('2d');
      x.fillStyle = on ? '#0B5998' : 'rgba(255,255,255,0.96)';
      x.strokeStyle = on ? '#0B5998' : '#0F2A44';
      x.lineWidth = 5;
      var a = 4, b = wd - 4, t = 4, bt = ht - 4;
      x.beginPath();
      x.moveTo(a + r, t); x.lineTo(b - r, t); x.quadraticCurveTo(b, t, b, t + r);
      x.lineTo(b, bt - r); x.quadraticCurveTo(b, bt, b - r, bt);
      x.lineTo(a + r, bt); x.quadraticCurveTo(a, bt, a, bt - r);
      x.lineTo(a, t + r); x.quadraticCurveTo(a, t, a + r, t); x.closePath();
      x.fill(); x.stroke();
      x.fillStyle = on ? '#FFFFFF' : '#0F2A44';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = f1;
      x.fillText(title, wd / 2, sub ? 56 : 72);
      if (sub) {
        x.font = f2;
        x.fillStyle = on ? 'rgba(255,255,255,0.85)' : '#4A5968';
        x.fillText(sub, wd / 2, 106);
      }
      var tex = new THREE.CanvasTexture(c);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    }
    function makeLabel(parent, title, sub, pos, poz, scale) {
      var tex = labelTexture(title, sub, false);
      var m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
      var sp = new THREE.Sprite(m);
      var s = (scale || 1) * 0.59;
      sp.scale.set(s * tex.image.width / LABEL_H, s, 1);
      sp.position.set(pos[0], pos[1], pos[2]);
      sp.renderOrder = 10;
      sp.userData = { poz: poz || null, title: title, sub: sub };
      parent.add(sp);
      if (poz) { labels.push(sp); }
      return sp;
    }
    function leader(parent, a, b) {
      var g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]);
      var ln = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x0F2A44, transparent: true, opacity: 0.55, depthTest: false }));
      ln.renderOrder = 9;
      ln.raycast = noRay;
      parent.add(ln);
    }
    // Штуцер вдоль локальной оси +Y: патрубок, фланец, болты. Группа со своим материалом.
    function nozzle(poz, len) {
      var g = new THREE.Group();
      var m = new THREE.MeshStandardMaterial({ color: C.nozzle, metalness: 0.35, roughness: 0.55 });
      mats['nozzle-' + poz] = m;
      var pipe = new THREE.Mesh(new THREE.CylinderGeometry(SHTUCER.r, SHTUCER.r, len, 24), m);
      pipe.position.y = len / 2;
      var fl = new THREE.Mesh(new THREE.CylinderGeometry(SHTUCER.flR, SHTUCER.flR, SHTUCER.flH, 32), m);
      fl.position.y = len;
      var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.12, 24), m);
      neck.position.y = len - 0.09;
      [pipe, fl, neck].forEach(function (p) { p.userData.poz = poz; g.add(withEdges(p)); pickables.push(p); });
      var px = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, len + 0.3, 12), proxyMat);
      px.position.y = len / 2;
      px.userData = { poz: poz, proxy: true };
      g.add(px);
      proxies.push(px);
      g.userData = { poz: poz, mat: m };
      model.add(g);
      return g;
    }

    var nozA = nozzle('shtucer-A', SHTUCER.lenA);
    var labA = makeLabel(nozA, 'Штуцер А', 'вход продукта', [0, G.aLab, 0], 'shtucer-A');
    leader(nozA, [0, 0.85, 0], [0, G.aLab - 0.25, 0]);

    var nozB = nozzle('shtucer-B', SHTUCER.lenB);
    nozB.rotation.z = -Math.PI / 2;                          // смотрит по +X
    nozB.position.set(G.b[0], G.b[1], G.b[2]);
    // Подпись в системе группы: локальная +Y = мировая +X, локальная −X = мировая +Y.
    var labB = makeLabel(nozB, 'Штуцер Б', 'выход продукта', [-0.95, 1.3, -0.9], 'shtucer-B');
    leader(nozB, [0, 0.72, 0], [-0.7, 1.1, -0.7]);

    // Площадка обслуживания (рев. B).
    var platform = new THREE.Group();
    model.add(platform);
    var DX0 = L / 2 + PLOSH.x0, DX1 = L / 2 + PLOSH.x1, DY = G.y0 - PLOSH.dy, DZ = W / 2 + PLOSH.zapas;
    var grate = gratingTexture();
    grate.repeat.set(3, 18);
    var deckMat = new THREE.MeshStandardMaterial({ map: grate, metalness: 0.3, roughness: 0.7 });
    mats.deck = deckMat;
    box(platform, DX1 - DX0, 0.07, DZ * 2, deckMat, (DX0 + DX1) / 2, DY, 0, true);
    box(platform, 0.12, 0.2, DZ * 2, steel, DX1, DY - 0.12, 0, true);
    var rail = mat('rail', C.rail, { metalness: 0.2, roughness: 0.55 });
    var RH = PLOSH.rh, gap0 = -DZ + PLOSH.laz, gap1 = gap0 + PLOSH.lazW;
    // Стойки опор площадки и подкосы к раме.
    [-DZ + 0.05, 0, DZ - 0.05].forEach(function (z) {
      box(platform, 0.16, DY - 0.2, 0.16, steel, DX1 - 0.05, (DY - 0.2) / 2 + 0.1, z, true);
      beam(platform, [DX1 - 0.05, DY - 1.4, z], [L / 2, DY - 0.1, z], 0.08, steel);
    });
    // Ограждение: торцевая сторона с проходом к лестнице и две боковые.
    function railRun(a, b, posts) {
      var dx = b[0] - a[0], dz = b[2] - a[2];
      for (var i = 0; i <= posts; i++) {
        var t = i / posts;
        box(platform, 0.06, RH, 0.06, rail, a[0] + dx * t, DY + RH / 2, a[2] + dz * t);
      }
      [RH, RH * 0.5].forEach(function (y) {
        beam(platform, [a[0], DY + y, a[2]], [b[0], DY + y, b[2]], 0.05, rail);
      });
      beam(platform, [a[0], DY + 0.1, a[2]], [b[0], DY + 0.1, b[2]], 0.12, rail);  // бортик
    }
    railRun([DX1, 0, gap1], [DX1, 0, DZ], 5);
    railRun([DX1, 0, -DZ], [DX1, 0, gap0], 1);
    railRun([DX0, 0, -DZ], [DX1, 0, -DZ], 2);
    railRun([DX0, 0, DZ], [DX1, 0, DZ], 2);
    // Лестница на площадку.
    var LX = DX1 + 0.3;
    [gap0 + 0.05, gap1 - 0.05].forEach(function (z) {
      box(platform, 0.07, DY + RH, 0.07, rail, LX, (DY + RH) / 2, z);
    });
    for (var r = 0.35; r < DY; r += 0.32) {
      box(platform, 0.04, 0.04, gap1 - gap0 - 0.1, steel, LX, r, (gap0 + gap1) / 2);
    }
    makeLabel(platform, 'Площадка обслуживания', 'новая в рев. B', [DX1 + 1.4, DY + 0.1, DZ + 1.6], null);
    leader(platform, [DX1, DY + 0.05, DZ], [DX1 + 1.2, DY + 0.1, DZ + 1.3]);

    // Подсветка.
    function setHighlight() {
      [[nozA, labA], [nozB, labB]].forEach(function (pair) {
        var on = pair[0].userData.poz === state.hl;
        var m = pair[0].userData.mat;
        m.color.setHex(on ? C.hl : C.nozzle);
        m.emissive.setHex(on ? C.hl : 0x000000);
        m.emissiveIntensity = on ? 0.55 : 0;
        var sp = pair[1];
        if (sp.userData.on !== on) {
          var old = sp.material.map;
          sp.material.map = labelTexture(sp.userData.title, sp.userData.sub, on);
          sp.material.needsUpdate = true;
          old.dispose();
          sp.userData.on = on;
        }
      });
    }
    function setRevGeometry() {
      var rev = state.rev;
      nozA.position.set(XE, G.aY, A_POS[rev]);
      platform.visible = rev === 'B';
    }

    // Управление. Пределы: ближе MIN_R секция перестаёт помещаться в кадр, дальше MAX_R
    // модель занимает меньше трети окна. Угол по вертикали — от вида сверху до чуть выше
    // горизонта: камера не уходит под землю. Панорамы нет — модель не потерять.
    var MIN_R = 12, MAX_R = 34;
    var MIN_PHI = 0.02, MAX_PHI = Math.PI / 2 - 0.03;
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function now() { return (w.performance && w.performance.now) ? w.performance.now() : Date.now(); }
    function fromSph(r, phi, theta) { return new THREE.Vector3().setFromSphericalCoords(r, phi, theta).add(target); }
    function sphOf(pos) { return new THREE.Spherical().setFromVector3(pos.clone().sub(target)); }

    // Виды. «Исходный» — ровно та камера, что при открытии.
    var VIEWS = {
      home: camera.position.clone(),
      front: fromSph(24, 1.42, Math.PI / 2),   // с торца коллекторов (+X): штуцер Б и площадка
      side: fromSph(25, 1.42, 0),              // вдоль аппарата (+Z)
      top: fromSph(22, MIN_PHI, 0)             // сверху, длинная сторона по горизонтали
    };

    var controls = null;
    var still = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    function stopAuto() { if (controls) { controls.autoRotate = false; } }
    function sync() {
      if (controls) { controls.update(); } else { camera.lookAt(target); }
      renderNow();
    }

    // Плавный перелёт камеры по сфере вокруг центра модели. Конец — точно в заданной точке.
    // Кадры ведёт цикл отрисовки; таймер добивает конец, если кадров не было (фоновая вкладка).
    var fly = null, flyTimer = 0;
    function cancelFly() {
      if (!fly) { return; }
      fly = null;
      if (flyTimer) { w.clearTimeout(flyTimer); flyTimer = 0; }
      if (controls) { controls.enableDamping = true; }
    }
    function stepFly(t) {
      if (!fly) { return; }
      var k = fly.ms > 0 ? (t - fly.t0) / fly.ms : 1;
      if (!(k < 1)) {
        camera.position.copy(fly.end);
        cancelFly();
      } else {
        k = Math.max(0, k);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        var a = fly.from, b = fly.to;
        camera.position.setFromSphericalCoords(a.radius + (b.radius - a.radius) * e,
          a.phi + (b.phi - a.phi) * e, a.theta + (b.theta - a.theta) * e).add(target);
      }
      sync();
    }
    function flyTo(pos, ms) {
      stopAuto();
      cancelFly();
      if (controls) { controls.enableDamping = false; controls.update(); }   // гасим инерцию перетаскивания
      var from = sphOf(camera.position), to = sphOf(pos);
      var d = to.theta - from.theta;
      d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;   // короткой дугой
      to.theta = from.theta + d;
      fly = { t0: now(), ms: still ? 0 : ms, from: from, to: to, end: pos.clone() };
      if (fly.ms === 0) { stepFly(Infinity); return; }
      flyTimer = w.setTimeout(function () { flyTimer = 0; stepFly(Infinity); }, fly.ms + 60);
    }
    function radius() { return camera.position.distanceTo(target); }
    function setRadius(r) {
      var off = camera.position.clone().sub(target);
      off.setLength(clamp(r, MIN_R, MAX_R));
      camera.position.copy(target).add(off);
      sync();
    }
    function zoomStep(f) {
      var base = fly ? fly.end : camera.position;
      var off = base.clone().sub(target);
      off.setLength(clamp(off.length() * f, MIN_R, MAX_R));
      flyTo(off.add(target), ZOOM_MS);
    }
    function goHome() { flyTo(VIEWS.home, FLY_MS); }

    // Колесо и тачпад. Прокрутка двумя пальцами — странице, модель её не трогает.
    // Щипок на тачпаде браузер присылает как wheel с ctrlKey; ⌘/Ctrl + колесо — так же.
    function onWheel(e) {
      if (controls) { controls.enableZoom = false; }    // колесо OrbitControls не достаётся никогда
      if (!(e.ctrlKey || e.metaKey)) { return; }
      e.preventDefault();
      stopAuto();
      cancelFly();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      setRadius(radius() * clamp(Math.exp(dy * 0.01), 0.8, 1.25));
    }
    // Палец: одним — вращать (OrbitControls), двумя — щипок; зум у OrbitControls
    // включаем только для касаний. Двойной тап — исходный вид.
    var touchIds = [], tap = null, lastTap = null;
    function onEarlyDown(e) {
      stopAuto();
      cancelFly();
      var touch = e.pointerType === 'touch';
      if (controls) { controls.enableZoom = touch; }
      if (!touch) { return; }
      if (touchIds.indexOf(e.pointerId) < 0) { touchIds.push(e.pointerId); }
      tap = touchIds.length === 1 ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: now() } : null;
    }
    function onEarlyUp(e) {
      var i = touchIds.indexOf(e.pointerId);
      if (i >= 0) { touchIds.splice(i, 1); }
      if (e.type !== 'pointerup' || !tap || tap.id !== e.pointerId) { tap = null; return; }
      var t = now(), p = tap;
      tap = null;
      if (t - p.t > 300 || Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 12) { lastTap = null; return; }
      if (lastTap && t - lastTap.t < 350 && Math.abs(p.x - lastTap.x) + Math.abs(p.y - lastTap.y) < 40) {
        lastTap = null;
        if (!pickAt(p.x, p.y)) { goHome(); }
        return;
      }
      lastTap = { x: p.x, y: p.y, t: t };
    }
    // Safari на Mac присылает щипок тачпада жестом, а не колесом.
    var g0 = 0;
    function onGesture(e) {
      if (touchIds.length) { return; }                   // на телефоне щипок ведёт OrbitControls
      e.preventDefault();
      if (e.type === 'gesturestart') { stopAuto(); cancelFly(); g0 = radius(); return; }
      if (e.type === 'gesturechange' && g0) { setRadius(g0 / (e.scale || 1)); return; }
      g0 = 0;
    }
    function onDbl(e) {
      if (pickAt(e.clientX, e.clientY)) { return; }
      e.preventDefault();
      goHome();
    }
    // До OrbitControls: слушатели одного узла идут в порядке регистрации.
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onEarlyDown);
    canvas.addEventListener('pointerup', onEarlyUp);
    canvas.addEventListener('pointercancel', onEarlyUp);
    canvas.addEventListener('dblclick', onDbl);
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { canvas.addEventListener(t, onGesture); });

    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, canvas);
      controls.target.copy(target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.minDistance = MIN_R;
      controls.maxDistance = MAX_R;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = MAX_PHI;
      controls.autoRotateSpeed = 0.55;
      controls.update();
      controls.autoRotate = !still;   // после первого update: кадр открытия = ровно «Исходный вид»
    }

    // Панель вида.
    var ctrl = h('div', 'm3d__ctrl');
    ctrl.setAttribute('role', 'toolbar');
    ctrl.setAttribute('aria-label', 'Вид модели');
    BTNS.forEach(function (b) {
      var zoom = b[0] === 'in' || b[0] === 'out';
      var bt = h('button', 'm3d__btn' + (zoom ? ' m3d__btn--zoom' : '') + (b[0] === 'in' ? ' m3d__btn--gap' : ''), null, b[1]);
      bt.type = 'button';
      bt.title = b[2];
      bt.setAttribute('data-view', b[0]);
      if (zoom) { bt.setAttribute('aria-label', b[2]); }
      ctrl.appendChild(bt);
    });
    function onCtrl(e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-view]') : null;
      if (!b) { return; }
      var v = b.getAttribute('data-view');
      if (v === 'in') { zoomStep(1 / 1.4); } else if (v === 'out') { zoomStep(1.4); } else if (VIEWS[v]) { flyTo(VIEWS[v], FLY_MS); }
    }
    ctrl.addEventListener('click', onCtrl);
    view.appendChild(ctrl);

    // Размер.
    function resize() {
      var wd = view.clientWidth || 640, ht = view.clientHeight || Math.round(wd * 0.62);
      renderer.setSize(wd, ht, false);
      camera.aspect = wd / ht;
      camera.updateProjectionMatrix();
    }
    var ro = null;
    if (w.ResizeObserver) {
      ro = new ResizeObserver(function () { if (!state.dead) { resize(); renderNow(); } });
      ro.observe(view);
    }

    function renderNow() { renderer.render(scene, camera); }
    var raf = 0;
    function loop() {
      raf = w.requestAnimationFrame(loop);
      if (fly) { stepFly(now()); return; }
      var moved = controls ? controls.update() : false;
      if (moved) { renderNow(); }
    }

    // Выбор штуцера.
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    function shown(o) {
      for (var p = o; p; p = p.parent) { if (!p.visible) { return false; } }
      return true;
    }
    function pickAt(cx, cy) {
      var rc = canvas.getBoundingClientRect();
      if (!rc.width || !rc.height) { return null; }
      ndc.set(((cx - rc.left) / rc.width) * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      var hitL = raycaster.intersectObjects(labels, false);
      if (hitL.length) { return hitL[0].object.userData.poz; }
      var hits = raycaster.intersectObjects(model.children, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        if (!o.isMesh) { continue; }
        if (o.userData.proxy) {
          if (shown(o.parent)) { return o.userData.poz; }
          continue;
        }
        if (!shown(o)) { continue; }
        return o.userData.poz || null;
      }
      return null;
    }
    var down = null;
    function onDown(e) { down = { x: e.clientX, y: e.clientY }; stopAuto(); }
    function onClick(e) {
      var d = down; down = null;
      stopAuto();
      if (d && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 6) { return; }
      var poz = pickAt(e.clientX, e.clientY);
      if (!poz) { return; }
      api.highlight(poz);
      if (state.onPick) { state.onPick(poz); }
    }
    var hoverRaf = 0, hoverEv = null;
    function onMove(e) {
      hoverEv = e;
      if (hoverRaf) { return; }
      hoverRaf = w.requestAnimationFrame(function () {
        hoverRaf = 0;
        if (state.dead || !hoverEv) { return; }
        canvas.style.cursor = pickAt(hoverEv.clientX, hoverEv.clientY) ? 'pointer' : 'grab';
      });
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('pointermove', onMove);

    setRevGeometry();
    setHighlight();
    resize();
    renderNow();
    raf = w.requestAnimationFrame(loop);

    return {
      kind: '3d',
      apply: function () { setRevGeometry(); setHighlight(); renderNow(); },
      stopAuto: stopAuto,
      destroy: uborka
    };
  }

  /* ---------- Без WebGL: схема торца ---------- */

  var SVGNS = 'http://www.w3.org/2000/svg';
  function makeFallback(view, state, api) {
    var G = VIDY[state.vid];
    var msg = h('div', 'm3d__nogl', null, NO_GL);
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 560 420');
    svg.setAttribute('class', 'm3d__chertezh');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', G.aria);
    view.appendChild(svg);
    view.appendChild(msg);

    var S = 42, X0 = 280, GY = 400;                 // метры → точки схемы
    function px(z) { return X0 + z * S; }
    function py(y) { return GY - y * S; }
    function el(tag, attrs, parent) {
      var n = document.createElementNS(SVGNS, tag);
      for (var k in attrs) { n.setAttribute(k, attrs[k]); }
      (parent || svg).appendChild(n);
      return n;
    }
    var stroke = '#3C4650';
    var chamberFill = '#C6A13E';
    // АВЗ с торца: зигзаг секций над коробом.
    function drawTents() {
      var zig = '';
      for (var k = 0; k < SEC; k++) {
        var zc = secZ(k);
        zig += (k ? ' L' : 'M') + px(zc - TW / 2) + ' ' + py(G.y0) + ' L' + px(zc) + ' ' + py(G.y0 + TH) + ' L' + px(zc + TW / 2) + ' ' + py(G.y0);
      }
      el('path', { d: zig, fill: 'none', stroke: chamberFill, 'stroke-width': 16, 'stroke-linejoin': 'miter' });
      el('path', { d: zig, fill: 'none', stroke: stroke, 'stroke-width': 1.5 });
    }
    // АВГ с торца: три камеры в ряд на ярусе секций, пробки в два ряда.
    function drawFlat() {
      var cw = CW, y1 = G.y0 - CDY + CHH;
      for (var k = 0; k < SEC; k++) {
        var z0 = secZ(k) - cw / 2;
        el('rect', { x: px(z0), y: py(y1), width: cw * S, height: CHH * S, fill: chamberFill, stroke: stroke });
        for (var i = 0; i < 6; i++) {
          for (var j = 0; j < 2; j++) {
            el('circle', { cx: px(z0 + 0.25 + i * (cw - 0.5) / 5), cy: py(y1 - CHH / 2 + (j - 0.5) * 0.26), r: 2.5, fill: '#7E6420' });
          }
        }
      }
    }
    function draw() {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var top = G.top, Y0 = G.y0, c0 = top - G.coneH, c1 = c0 - G.bandH;
      el('line', { x1: 20, y1: GY, x2: 540, y2: GY, stroke: '#9AA3AB', 'stroke-width': 2 });
      [-W / 2, W / 2].forEach(function (z) {
        el('rect', { x: px(z) - 4, y: py(top), width: 8, height: top * S, fill: '#7B858F' });
      });
      el('rect', { x: px(-W / 2), y: py(G.wall), width: W * S, height: (G.wall - top) * S, fill: '#B3BBC2', stroke: stroke });
      var rt = RT * G.coneZ;
      el('path', { d: 'M' + px(-rt) + ' ' + py(top) + ' L' + px(-RB) + ' ' + py(c0) + ' L' + px(-RB) + ' ' + py(c1) +
        ' L' + px(RB) + ' ' + py(c1) + ' L' + px(RB) + ' ' + py(c0) + ' L' + px(rt) + ' ' + py(top) + ' Z',
        fill: '#C4CBD1', stroke: stroke });
      if (state.vid === 'avg') { drawFlat(); } else { drawTents(); }
      if (state.rev === 'B') {
        el('rect', { x: px(-W / 2 - 0.2), y: py(Y0 - 0.12), width: (W + 0.4) * S, height: 6, fill: '#8F99A2' });
        for (var i = 0; i <= 8; i++) {
          el('line', { x1: px(-W / 2 - 0.2 + i * (W + 0.4) / 8), y1: py(Y0 - 0.12), x2: px(-W / 2 - 0.2 + i * (W + 0.4) / 8), y2: py(Y0 + 1), stroke: '#D1A32A', 'stroke-width': 3 });
        }
        el('line', { x1: px(-W / 2 - 0.2), y1: py(Y0 + 1), x2: px(W / 2 + 0.2), y2: py(Y0 + 1), stroke: '#D1A32A', 'stroke-width': 3 });
        var tp = el('text', { x: px(W / 2 + 0.3), y: py(Y0 + 1.25), style: 'font-size:var(--fs-xs,13px)', fill: '#0F2A44', 'text-anchor': 'end' });
        tp.textContent = 'Площадка обслуживания';
      }
      function noz(poz, cx, cy, vertical, title) {
        var on = state.hl === poz;
        var g = el('g', { 'data-poz': poz, style: 'cursor:pointer' });
        var col = on ? '#0B5998' : '#4F5A64';
        if (vertical) {
          el('rect', { x: cx - 6, y: cy - 30, width: 12, height: 30, fill: col }, g);
          el('rect', { x: cx - 12, y: cy - 34, width: 24, height: 6, fill: col }, g);
        } else {
          el('circle', { cx: cx, cy: cy, r: 11, fill: col }, g);
          el('circle', { cx: cx, cy: cy, r: 5, fill: '#F3F5F7' }, g);
        }
        var tx = el('text', { x: cx, y: vertical ? cy - 44 : cy + 30, style: 'font-size:var(--fs-sm,14px)', 'font-weight': 600, fill: col, 'text-anchor': 'middle' }, g);
        tx.textContent = title;
        el('rect', { x: cx - 40, y: cy - 60, width: 80, height: 100, fill: 'transparent' }, g);
      }
      noz('shtucer-A', px(A_POS[state.rev]), py(G.aY), true, 'Штуцер А');
      noz('shtucer-B', px(G.b[2]), py(G.b[1]), false, 'Штуцер Б');
    }
    function onClick(e) {
      var g = e.target && e.target.closest ? e.target.closest('[data-poz]') : null;
      if (!g) { return; }
      var poz = g.getAttribute('data-poz');
      api.highlight(poz);
      if (state.onPick) { state.onPick(poz); }
    }
    svg.addEventListener('click', onClick);
    draw();
    return {
      kind: 'fallback',
      apply: draw,
      stopAuto: function () {},
      destroy: function () { svg.removeEventListener('click', onClick); }
    };
  }

  /* ---------- Публичное ---------- */

  function mount(el, opts) {
    opts = opts || {};
    var state = {
      vid: normVid(opts.vid),
      rev: normRev(opts.rev),
      hl: normPoz(opts.highlight),
      onPick: typeof opts.onPick === 'function' ? opts.onPick : null,
      dead: false
    };
    while (el.firstChild) { el.removeChild(el.firstChild); }
    ensureStyle();
    var root = h('div', 'm3d');
    root.setAttribute('data-vid', state.vid);
    var view = h('div', 'm3d__view');
    var badge = h('div', 'm3d__rev');
    var hint = h('div', 'm3d__hint', null, hintText());
    var cap = h('div', 'm3d__caption', null, CAPTION);
    root.appendChild(view);
    root.appendChild(cap);
    el.appendChild(root);

    var impl = null;
    var api = {
      setRev: function (rev) {
        if (state.dead) { return; }
        state.rev = normRev(rev);
        badge.textContent = 'Рев. ' + state.rev;
        impl.apply();
      },
      highlight: function (poz) {
        if (state.dead) { return; }
        state.hl = normPoz(poz);
        if (state.hl) { impl.stopAuto(); }
        impl.apply();
      },
      destroy: function () {
        if (state.dead) { return; }
        state.dead = true;
        impl.destroy();
        if (root.parentNode) { root.parentNode.removeChild(root); }
      }
    };

    var sink = { uborka: null };
    try {
      impl = make3D(view, state, api, sink);
    } catch (e) {
      if (w.console) { w.console.warn('Model3D: 3D не собралась, показываю схему —', e && e.message); }
      /* та же уборка, что у destroy(): цикл, слушатели, WebGL-контекст */
      if (sink.uborka) { try { sink.uborka(); } catch (e2) { /* уборка после сбоя — лучшее, что можем */ } }
      while (view.firstChild) { view.removeChild(view.firstChild); }
      impl = null;
    }
    if (!impl) {
      impl = makeFallback(view, state, api);
    } else {
      view.appendChild(hint);
    }
    badge.textContent = 'Рев. ' + state.rev;
    view.appendChild(badge);

    return { setRev: api.setRev, highlight: api.highlight, destroy: api.destroy };
  }

  /* Габариты вида в метрах — одни на 3D, схему без WebGL и чертёж карточки.
     Оси как у модели: z — поперёк аппарата (вид с торца коллекторов), y — вверх. Копия:
     правка результата модель не меняет. */
  function gabarity(vid) {
    var v = normVid(vid), G = VIDY[v], zs = [];
    for (var k = 0; k < SEC; k++) { zs.push(secZ(k)); }
    return {
      vid: v, L: L, W: W, sekciy: SEC, TW: TW, sekciiZ: zs,
      shater: v === 'avz' ? TH : 0, SH: SH, CH: CH,
      kamera: v === 'avz' ? { t: KAM_T, konyok: { w: KONYOK.w, h: KONYOK.h, dy: KONYOK.dy } }
        : { w: CW, niz: G.y0 - CDY, h: CHH },
      top: G.top, y0: G.y0, wall: G.wall, coneH: G.coneH, bandH: G.bandH, coneZ: G.coneZ, RT: RT, RB: RB,
      privod: { h: PRIVOD.h, rama: PRIVOD.rama, plita: PRIVOD.plita, motorR: PRIVOD.motorR, motorH: PRIVOD.motorH },
      shtucer: { r: SHTUCER.r, flR: SHTUCER.flR, flH: SHTUCER.flH },
      shtucerA: { y: G.aY, len: SHTUCER.lenA, z: { A: A_POS.A, B: A_POS.B } },
      shtucerB: { y: G.b[1], z: G.b[2], len: SHTUCER.lenB },
      ploshchadka: { y: G.y0 - PLOSH.dy, zapas: PLOSH.zapas, rh: PLOSH.rh, laz: PLOSH.laz, lazW: PLOSH.lazW }
    };
  }

  w.Model3D = { mount: mount, gabarity: gabarity };
})(window);

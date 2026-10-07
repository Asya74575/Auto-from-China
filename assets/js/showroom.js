// 3D-шоурум: машины на фиксированном холсте за страницей (DESIGN.md → «Движение»).
// Источники прогресса: загрузка (свет включается по очереди, фары «здороваются»), прокрутка (ракурсы секций, въезд по маршруту),
// курсор (лёгкий поворот и свет-фонарик), выбор модели (машина уезжает, новая въезжает) и цвета (краска бежит волной).
// Ракурсы задаются атрибутами секций: data-scene='{...,"phone":{...}}' — состояние, когда верх секции у верха экрана;
// data-scene-end='{...}' — когда низ секции у низа экрана. Машины — window.CAR_LIB (assets/models/<id>.js): первая подключена
// в странице (data-car у холста), остальные подгружаются при выборе. Отрисовка идёт, пока что-то движется; «атмосфера зала»
// (луч, туман; пыль убрана в четвёртом пакете правок 2026-10-04) дышит не чаще 30 кадров в секунду и замирает через 20 с без действий посетителя.
// Вторая подача: крупные планы, «окно» холста и карточка, фон страницы по блокам, монтаж планов и «скорость» — по времени,
// пока блок на экране (финал с въездом машины удалён — правка 2026-10-04, четвёртый пакет). Ключи — DEF ниже. Первый экран (правка 2026-10-04) — монтаж
// в «окне»: пока идёт прелоадер (класс hero-wait у html, home.js), холст не рисует; по событию hero:open окно поднимается
// снизу и раскрывается на весь экран (ключ intro), свет включается и монтаж стартует с этого момента.
// Правки 2026-10-04 (второй пакет): у каждого колеса своя ступица в центре шины — колесо крутится без «биения», передние
// поворачиваются по кривизне пути только на ходу (стоя — прямо, седьмой пакет 2026-10-06); суппорты и детали кузова, попавшие в колесо при сборке, не крутятся.
// Фары «зажигаются» как у rideradian.com: ходовой огонь прорисовывается от центра к краям, вспышка с ореолом заливает кадр,
// потом ровный свет (первый экран, заявка, «Оплата»). Реализм: контактная тень под каждой машиной, тонированные стёкла
// с отражениями, полоса горизонта в студии. «Оплата»: силуэт (sil), вспышки фотоотчёта, фары на последнем этапе.
// Без WebGL, без JS или при prefers-reduced-motion страница остаётся законченной (класс no-webgl показывает картинку).
(function () {
  var T = window.THREE, A = window.THREE_ADDONS;
  var canvas = document.querySelector('[data-showroom]');
  if (!canvas) return;
  var html = document.documentElement;
  function fail() { html.classList.add('no-webgl'); }
  var LIB = window.CAR_LIB = window.CAR_LIB || {};
  var firstId = canvas.getAttribute('data-car'), modelsPath = canvas.getAttribute('data-models') || 'assets/models/';
  if (!T || !A || !LIB[firstId]) { fail(); return; }

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phoneMq = matchMedia('(max-width: 900px)');   // как телефонная раскладка в home.css
  var hover = matchMedia('(hover: hover)').matches;
  var still = navigator.webdriver === true;           // снимки проверки (tools/shots.mjs): «атмосфера» замирает — кадры повторяемы
  var lite = phoneMq.matches;                          // телефон: без отражения в полу, меньше пылинок

  var renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { fail(); return; }
  // нейтральное отображение: оттенки лака без «киношного» сдвига ACES
  renderer.toneMapping = T.NeutralToneMapping || T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = T.SRGBColorSpace;

  var scene = new T.Scene();
  var pmrem = new T.PMREMGenerator(renderer);
  // Студия для отражений: тёмный зал и длинные световые полосы (софтбоксы) — дают лаку блики, как в автосалоне.
  function studio() {
    var s = new T.Scene();
    s.add(new T.Mesh(new T.SphereGeometry(30, 32, 16), new T.MeshBasicMaterial({ color: '#07080b', side: T.BackSide })));
    function panel(w, h, pos, rot, k, color) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color || '#ffffff').multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.rotation.set(rot[0], rot[1], rot[2]); s.add(m);
    }
    panel(14, 4, [0, 9, 0], [Math.PI / 2, 0, 0], 4);                 // большой верхний софтбокс
    panel(1.6, 10, [-11, 4, 0], [0, Math.PI / 2, 0], 3);            // боковые полосы — линии бликов вдоль кузова
    panel(1.6, 10, [11, 4, 0], [0, -Math.PI / 2, 0], 3);
    panel(10, 1.2, [0, 3.5, 12], [0, Math.PI, 0], 2.2, '#fff1dc');  // тёплая полоса спереди
    panel(10, 1.2, [0, 3.5, -12], [0, 0, 0], 1.6, '#9db6ff');       // холодная полоса сзади
    panel(30, 30, [0, -0.5, 0], [-Math.PI / 2, 0, 0], 0.04);       // чуть светлый пол — подсветка снизу
    // полоса горизонта по кругу: на дверях и крыльях — мягкая светлая линия, как в фотостудии (машина «стоит в зале», а не в пустоте)
    var ring = new T.Mesh(new T.CylinderGeometry(24, 24, 2.4, 48, 1, true), new T.MeshBasicMaterial({ color: new T.Color('#d8dce4').multiplyScalar(0.32), side: T.BackSide }));
    ring.position.y = 1.4; s.add(ring);
    return pmrem.fromScene(s, 0.015).texture;
  }
  var envMain = studio();
  scene.environment = envMain;
  scene.environmentIntensity = 0;
  var camera = new T.PerspectiveCamera(28, 1, 0.1, 120);
  camera.layers.enable(2);                             // слой 2 — пол, тени, пыль: их не видно в отражении

  var key = new T.SpotLight('#fff4e6', 0, 24, 0.42, 0.75, 1.6);
  key.position.set(0.6, 7.5, 2.2); key.target.position.set(0, 0.4, 0); scene.add(key, key.target);
  // Самозатенение машины от верхнего луча (компьютер): темнеют арки колёс, пороги, места под зеркалами и бамперами —
  // машина перестаёт выглядеть «игрушечной» (правка 2026-10-04). Карта теней пересчитывается, только когда машина движется.
  var shadows = !lite;
  if (shadows) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 3; key.shadow.camera.far = 13;
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  }
  var rim = new T.DirectionalLight('#8fb0ff', 0); rim.position.set(-5, 2.6, -6); scene.add(rim);
  var fill = new T.DirectionalLight('#ffffff', 0); fill.position.set(5, 1.5, 4); scene.add(fill);
  // один точечный свет на два эффекта: свет за курсором (зал, компьютер) и вспышки фотоотчёта («Оплата», этап 2) —
  // вместе они не нужны, а каждый источник утяжеляет все шейдеры
  var torch = new T.PointLight('#fff1de', 0, 0, 2); scene.add(torch);
  var TORCH_C = new T.Color('#fff1de'), PHOTO_C = new T.Color('#f4f7ff');
  var LIGHT = { key: 260, rim: 2.4, fill: 0.25, env: 0.45, torch: 9, photo: 520, bloom: 2 };

  // повторяемые «случайные» числа: пыль и туман одинаковы при каждой загрузке
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  // Сложение света: цвет и прозрачность прибавляются (холст прозрачный — без этого свет «исчезает» на пустом фоне)
  function addLight(m) { m.blending = T.CustomBlending; m.blendEquation = T.AddEquation; m.blendSrc = m.blendDst = m.blendSrcAlpha = m.blendDstAlpha = T.OneFactor; return m; }
  function onFloor(o) { o.traverse(function (x) { x.layers.set(2); }); return o; }
  function radialTexture(stops) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var shadowTex = radialTexture([[0, 'rgba(0,0,0,.92)'], [0.55, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]);
  // мягкое свечение без колец: гауссов спад от центра (s — ширина в долях радиуса), к краю — ровно ноль
  function glowTexture(rgb, s, tail) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), img = g.createImageData(128, 128);
    for (var y = 0; y < 128; y++) for (var x = 0; x < 128; x++) {
      var r = Math.hypot(x - 63.5, y - 63.5) / 63.5, i = (y * 128 + x) * 4;
      var a = (Math.exp(-r * r / (2 * s * s)) + tail * Math.exp(-r * r / 0.18)) / (1 + tail) * (1 - Math.pow(Math.min(1, r), 6));
      img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = Math.round(255 * Math.max(0, a));
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var signalTex = glowTexture([255, 160, 50], 0.22, 0.25);
  // Пятно света на полу под лучом. Было — радиальный градиент из двух отрезков: на изломе (0,45 радиуса) по полу шла
  // заметная граница, «туман обрезается» (правка 2026-10-05). Теперь — гауссов спад до нуля и дизеринг (без полос 8 бит).
  function poolTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (var y = 0; y < 256; y++) for (var x = 0; x < 256; x++) {
      var r = Math.hypot(x - 127.5, y - 127.5) / 127.5, i = (y * 256 + x) * 4;
      var a = 0.55 * (0.62 * Math.exp(-r * r / 0.1) + 0.38 * Math.exp(-r * r / 0.32)) * (1 - Math.pow(Math.min(1, r), 4));
      img.data[i] = 255; img.data[i + 1] = 240; img.data[i + 2] = 220; img.data[i + 3] = Math.round(255 * Math.max(0, a));
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  // Свет на полу гаснет к горизонту: под скользящим взглядом (стык «Почему из Китая» → «Модели») плавный спад пятна
  // сжимался в перспективе в несколько пикселей — у левого края фон «обламывался» ступенькой, над ней висела «тучка»
  // (правка 2026-10-06, седьмой пакет). Яркость умножается на крутизну взгляда на пол: вдали, у горизонта, — ноль.
  function horizonFade(mat) {
    mat.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHzW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvHzW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHzW;')
        .replace('#include <dithering_fragment>', 'gl_FragColor.a *= smoothstep(0.03, 0.3, normalize(cameraPosition - vHzW).y);\n#include <dithering_fragment>');
    };
    mat.customProgramCacheKey = function () { return 'horizon'; };
    return mat;
  }
  var glowMat = horizonFade(new T.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, opacity: 0, dithering: true }));
  var glow = onFloor(new T.Mesh(new T.PlaneGeometry(14, 14), glowMat)); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.002; scene.add(glow);
  // Свет фар на полу: два вытянутых вперёд пятна от левой и правой фары (верх текстуры — у бампера), холодный белый, как у LED
  function headPoolTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (var y = 0; y < 256; y++) for (var x = 0; x < 256; x++) {
      var u = x / 255, v = y / 255, i = (y * 256 + x) * 4, a = 0;
      [0.24, 0.76].forEach(function (cx) {
        var w = 0.07 + 0.16 * v, du = (u - cx) / w, dv = (v - 0.3) / 0.36;   // пятно шире к дальнему краю
        a += Math.exp(-du * du / 2) * Math.exp(-dv * dv / 2) * Math.min(1, v / 0.08);
      });
      a = Math.min(1, a) * 0.42 * (1 - Math.pow(Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2), 6));
      img.data[i] = 236; img.data[i + 1] = 242; img.data[i + 2] = 255; img.data[i + 3] = Math.round(255 * a);
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var beamTex = headPoolTexture();

  // ---------- атмосфера зала: видимый луч и туман у пола ----------
  var keyDir = new T.Vector3().subVectors(key.target.position, key.position);
  var beamLen = key.position.y / -keyDir.clone().normalize().y; keyDir.normalize();
  var shaftGeo = new T.ConeGeometry(beamLen * Math.tan(0.42), beamLen, 48, 1, true); shaftGeo.translate(0, -beamLen / 2, 0);
  var shaftMat = new T.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uLen: { value: beamLen } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY;\nvoid main() { vY = -position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uK; uniform float uLen; varying vec3 vN; varying vec3 vV; varying float vY;\nvoid main() { float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float a = f * smoothstep(0.0, 0.25, vY / uLen) * (1.0 - smoothstep(0.3, 0.85, vY / uLen)) * uK; gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * a, a); }',
    transparent: true, depthWrite: false, side: T.DoubleSide
  });
  addLight(shaftMat);
  var shaft = onFloor(new T.Mesh(shaftGeo, shaftMat));
  shaft.position.copy(key.position); shaft.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), keyDir); scene.add(shaft);

  // Пыль в луче (летающие точки) убрана — правка 2026-10-04, четвёртый пакет: владелец попросил убрать точки во всех блоках.

  // Туман: мягкие облака лежат на полу тонкими слоями (0,02–0,14 м) и медленно плывут.
  // Правка 2026-10-06 (адаптив 1240, «Модели»: «на фоне какой-то баг»): облака были спрайтами — плоскостями, всегда
  // повёрнутыми к камере. Когда камера смотрит на машину сверху, спрайт вставал в воздухе полосой рядом с машиной,
  // а текстура из пятен, растянутая вчетверо, давала горизонтальные штрихи. Теперь облако лежит на полу — сверху
  // это стелющаяся дымка, а не полоса; текстура — гладкий шум с дизерингом (без ступенек 8 бит).
  function cloudTexture() {
    var N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    var g = c.getContext('2d'), img = g.createImageData(N, N), fs = 11;
    function frnd() { fs = (fs * 16807) % 2147483647; return (fs - 1) / 2147483646; }
    // шум значений на решётке 6×6 и 12×12, сглаженная интерполяция
    function lattice(n) { var a = []; for (var k = 0; k < n * n; k++) a.push(frnd()); return function (u, v) {
      var x = u * (n - 1), y = v * (n - 1), i = Math.min(n - 2, Math.floor(x)), j = Math.min(n - 2, Math.floor(y));
      var fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var p = a[j * n + i], q = a[j * n + i + 1], r = a[(j + 1) * n + i], s = a[(j + 1) * n + i + 1];
      return (p + (q - p) * fx) * (1 - fy) + (r + (s - r) * fx) * fy; }; }
    var lo = lattice(6), hi = lattice(12);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var u = x / (N - 1), v = y / (N - 1), du = (u - 0.5) * 2, dv = (v - 0.5) * 2, rr = du * du + dv * dv, i = (y * N + x) * 4;
      var n = 0.65 * lo(u, v) + 0.35 * hi(u, v);
      var a = 0.62 * Math.exp(-rr / 0.22) * (0.45 + 0.75 * n) * (1 - Math.pow(Math.min(1, Math.sqrt(rr)), 6));   // к краю — ровно ноль
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.max(0, Math.min(255, Math.round(255 * a + frnd() - 0.5)));   // дизеринг
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  for (var k = 0; k < 138; k++) rnd();   // прежняя текстура брала 138 случайных чисел — раскладка полос «скорости» ниже не меняется
  var fogTex = cloudTexture(), fogGeo = new T.PlaneGeometry(1, 1), fog = [];
  for (var f = 0; f < 7; f++) {
    var sp = new T.Mesh(fogGeo, horizonFade(new T.MeshBasicMaterial({ map: fogTex, color: '#c9c2b6', transparent: true, depthWrite: false, opacity: 0, dithering: true })));
    sp.userData = { x: -4.5 + f * 1.5 + rnd() * 0.6, z: -2.6 + rnd() * 5.2, s: 4.2 + rnd() * 2.2, ph: rnd() * 6.28, sp: 0.6 + rnd() * 0.6 };
    sp.scale.set(sp.userData.s, sp.userData.s * 0.7, 1); sp.rotation.x = -Math.PI / 2; sp.position.y = 0.02 + f * 0.02;
    sp.layers.set(5); scene.add(sp); fog.push(sp);
  }
  // Туман — отдельным слоем 5, до основного кадра: машина ложится поверх него. Раньше облака-плоскости стояли в сцене
  // вместе с машиной и проходили сквозь кузов — по боку и аркам колёс туман «обрезался» ровной линией по форме машины
  // (правка 2026-10-06, «Модели» и «Оплата»). Теперь он только за машиной и вокруг неё, без линии пересечения.
  // Свет — и на слое тумана: в проходе без источников света у всех материалов менялся набор света, three.js перестраивал
  // их шейдеры, и следующий проход не рисовал машину вовсе (та же причина, что у кадра фар, L43)
  [key, rim, fill, torch].forEach(function (l) { l.layers.enable(5); });
  var fogOn = false;
  function renderScene() {
    if (!fogOn) { renderer.render(scene, camera); return; }
    var mask = camera.layers.mask, ac = renderer.autoClear;
    camera.layers.set(5); renderer.render(scene, camera);
    camera.layers.mask = mask; renderer.autoClear = false; renderer.render(scene, camera); renderer.autoClear = ac;
  }

  // ---------- «на скорости»: мимо пролетают размытые полосы огней, по полу бегут штрихи разметки ----------
  // Машина стоит на месте и крутит колёса, движется мир вокруг (вдоль -Z). Камера в профиль — со стороны +X.
  function streakTexture() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 16;
    var g = c.getContext('2d'), img = g.createImageData(128, 16);
    for (var x = 0; x < 128; x++) for (var y = 0; y < 16; y++) {
      var u = x / 127, v = Math.abs(y - 7.5) / 7.5, i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 1.5) * Math.exp(-v * v * 4));   // хвост длиннее головы
    }
    g.putImageData(img, 0, 0);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var speedFx = new T.Group(); speedFx.visible = false; scene.add(speedFx);
  var streakTex = streakTexture(), streaks = [], dashes = [];
  var streakCols = ['#fff1d8', '#ffe2b8', '#bcd0ff', '#ffffff', '#ff5a40'];
  for (var q = 0; q < (lite ? 22 : 40); q++) {
    var far = rnd() < 0.72;   // большинство — за машиной (огни вдоль дороги), остальные — у камеры, крупные и размытые
    var stm = new T.MeshBasicMaterial({ map: streakTex, color: streakCols[Math.floor(rnd() * (far ? 5 : 4))], transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0, side: T.DoubleSide });
    var st = new T.Mesh(new T.PlaneGeometry(1, 1), stm);
    st.rotation.y = Math.PI / 2;   // плоскость смотрит на камеру (+X), длина — вдоль дороги (Z)
    st.scale.set(far ? 2.5 + rnd() * 6 : 4 + rnd() * 5, far ? 0.035 + rnd() * 0.05 : 0.12 + rnd() * 0.18, 1);
    st.userData = { y: far ? 0.25 + rnd() * 3.6 : 0.15 + rnd() * 1.1, z: -26 + rnd() * 52, k: 0.7 + rnd() * 0.6, a: far ? 0.5 + rnd() * 0.5 : 0.22 + rnd() * 0.25 };
    st.position.set(far ? -3 - rnd() * 12 : 3.2 + rnd() * 2.5, st.userData.y, st.userData.z);
    speedFx.add(st); streaks.push(st);
  }
  var dashMat = new T.MeshBasicMaterial({ color: '#d8d4cc', transparent: true, opacity: 0, depthWrite: false });
  [-2.3, 2.6].forEach(function (x) {
    for (var q = 0; q < 10; q++) {
      var dm = onFloor(new T.Mesh(new T.PlaneGeometry(0.12, 2.2), dashMat));
      dm.rotation.x = -Math.PI / 2; dm.position.set(x, 0.003, -25 + q * 5); dm.userData.z = -25 + q * 5;
      speedFx.add(dm); dashes.push(dm);
    }
  });
  function wrap(v, lo, hi) { var span = hi - lo; return ((v - lo) % span + span) % span + lo; }

  // ---------- монтаж «Появления»: фара вплотную → колесо 3/4 → профиль низко → задний фонарь → анфас целиком ----------
  // Нос машины — +Z, правый бок — +X. drift — сколько градусов камера проплывает за план, dur — длина плана (с),
  // ign — через сколько секунд от начала плана фары «зажигаются» (план начинается в темноте).
  var REEL = [
    { az: 24, el: 3, close: 0.3, lookX: 0.3, lookY: 0.42, lookZ: 0.44, drift: 7, dur: 2.5, ign: 0.25 },
    { az: 62, el: 1, close: 0.36, lookX: 0.46, lookY: 0.22, lookZ: 0.3, drift: -6, dur: 1.9 },
    { az: 90, el: 2, close: 0.78, lookX: 0, lookY: 0.4, lookZ: 0, drift: 5, dur: 1.9 },
    { az: 152, el: 5, close: 0.32, lookX: 0.3, lookY: 0.55, lookZ: -0.45, drift: -7, dur: 1.9 },
    { az: 0, el: 5, close: 0.8, lookX: 0, lookY: 0.42, lookZ: 0, drift: 4, dur: 3.1, ign: 0.35 }
  ], REEL_T = REEL.reduce(function (sum, r) { return sum + r.dur; }, 0);
  var WARM = new T.Color('#fff4e6'), COOL = new T.Color('#c9d4ff');

  // ---------- отражение в глянцевом полу (компьютер) ----------
  // Зеркальный кадр: та же камера снимает сцену, перевёрнутую относительно пола (вместе со светом), в четверть разрешения;
  // пол берёт его по экранным координатам и размывает. Пол, тени, пыль и туман (слой 2) в отражение не попадают.
  // Текстура отражения помечена как «кадр для экрана» (isXRRenderTarget, sRGB): отражение рисуется теми же шейдерами, что
  // и основной кадр. Иначе у каждого материала был второй вариант шейдера — его сборка «на ходу» замораживала страницу
  // на секунды, а переключение вариантов дважды за кадр стоило ~1,5 мс процессора (правка 2026-10-04, третий пакет).
  var mirror = null;
  if (!lite) {
    var mrt = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType });
    mrt.texture.colorSpace = T.SRGBColorSpace; mrt.isXRRenderTarget = true;
    var mMat = new T.ShaderMaterial({
      uniforms: { tMirror: { value: mrt.texture }, uRes: { value: new T.Vector2(1, 1) }, uK: { value: 0 }, uC: { value: new T.Vector2() }, uR: { value: new T.Vector2(2, 3) } },
      vertexShader: 'varying vec2 vXZ;\nvoid main() { vec4 wp = modelMatrix * vec4(position, 1.0); vXZ = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: [
        'uniform sampler2D tMirror; uniform vec2 uRes; uniform float uK; uniform vec2 uC; uniform vec2 uR; varying vec2 vXZ;',
        'void main() {',
        '  vec2 uv = gl_FragCoord.xy / uRes; vec2 px = 0.9 / vec2(textureSize(tMirror, 0)); vec3 c = vec3(0.0);',
        '  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) c += texture2D(tMirror, uv + vec2(float(i), float(j)) * px).rgb * (i == 0 && j == 0 ? 0.2 : (i == 0 || j == 0 ? 0.12 : 0.08));',
        '  float fade = 1.0 - smoothstep(0.2, 1.0, length((vXZ - uC) / uR));',
        '  gl_FragColor = vec4(c * uK * fade, 1.0);',   // отражение уже в цветах экрана — без повторного тонирования
        '  gl_FragColor.a = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));',
        '}'].join('\n'),
      transparent: true, depthWrite: false, toneMapped: false
    });
    addLight(mMat);
    var floor = onFloor(new T.Mesh(new T.PlaneGeometry(30, 30), mMat));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.001;
    floor.renderOrder = 1;   // поверх тени под машиной: отражение видно и на затенённом полу
    scene.add(floor);
    mirror = { rt: mrt, mat: mMat };
  }
  function renderMirror() {
    // карту теней считает только основной кадр: в перевёрнутой сцене она получилась бы зеркальной. Студию отражений
    // переворачиваем поворотом на 180° (параметр шейдера, а не вторая студия — та меняла шейдер каждого материала дважды
    // за кадр): низ машины в отражении смотрит на тёмный пол, а не на верхний софтбокс
    var shadowDue = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false;
    scene.scale.y = -1; scene.environmentRotation.x = Math.PI; camera.layers.set(0);
    renderer.setRenderTarget(mirror.rt); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
    scene.scale.y = 1; scene.environmentRotation.x = 0; camera.layers.enable(2);
    renderer.shadowMap.needsUpdate = shadowDue;
  }
  var tv = new T.Vector3(), tv2 = new T.Vector3();

  // ---------- свечение фар и фонарей (bloom) ----------
  // Правка 2026-10-05: «свечение фар — полная ерунда» (были круглые блики-спрайты на кончиках фар). Как делают в three.js
  // и в конфигураторах машин: светится сама фара, а ореол вокруг — размытие её же картинки, ровно по форме полосы или фары.
  // Кадр только с фарами и фонарями (кузов закрывает то, что за ним: слой 4 — непрозрачные детали, слой 3 — фонари)
  // в половинном разрешении → уменьшения 1/4…1/64 мягким 13-точечным фильтром, с порогом: светит только горящее →
  // обратная сборка «палаткой» (узкое яркое ядро + широкий слабый ореол) → сложение со светом поверх холста.
  // Рисуется, только пока фары или фонари горят. Кадр фар — теми же шейдерами, что основной (isXRRenderTarget, как отражение).
  var bloom = (function () {
    function target(depth) {
      var r = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType, depthBuffer: !!depth, minFilter: T.LinearFilter, magFilter: T.LinearFilter, generateMipmaps: false });
      return r;
    }
    var src = target(true); src.texture.colorSpace = T.SRGBColorSpace; src.isXRRenderTarget = true;
    var down = [], up = [];
    for (var i = 0; i < 5; i++) { down.push(target(false)); up.push(target(false)); }
    var vs = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    var downMat = new T.ShaderMaterial({ uniforms: { tMap: { value: null }, uPx: { value: new T.Vector2() }, uPre: { value: 0 } }, vertexShader: vs,
      fragmentShader: [
        'uniform sampler2D tMap; uniform vec2 uPx; uniform float uPre; varying vec2 vUv;',
        // первый шаг: кадр фар — в цветах экрана, переводим в линейные; порог — светит только горящее, не блики студии на корпусах
        'vec3 tap(vec2 o) { vec3 c = texture2D(tMap, vUv + o * uPx).rgb;',
        '  if (uPre > 0.5) { c = pow(max(c, vec3(0.0)), vec3(2.2)); c *= smoothstep(0.32, 0.9, max(c.r, max(c.g, c.b))); }',
        '  return c; }',
        'void main() {',
        '  vec3 c = tap(vec2(0.0)) * 0.125;',
        '  c += (tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0)) + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0))) * 0.125;',
        '  c += (tap(vec2(-2.0, 2.0)) + tap(vec2(2.0, 2.0)) + tap(vec2(-2.0, -2.0)) + tap(vec2(2.0, -2.0))) * 0.03125;',
        '  c += (tap(vec2(0.0, 2.0)) + tap(vec2(0.0, -2.0)) + tap(vec2(-2.0, 0.0)) + tap(vec2(2.0, 0.0))) * 0.0625;',
        '  gl_FragColor = vec4(c, 1.0); }'].join('\n'),
      depthTest: false, depthWrite: false });
    var upMat = new T.ShaderMaterial({ uniforms: { tLow: { value: null }, tHigh: { value: null }, uPx: { value: new T.Vector2() }, uWide: { value: 1 } }, vertexShader: vs,
      fragmentShader: [
        'uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 uPx; uniform float uWide; varying vec2 vUv;',
        'void main() {',
        '  vec3 c = texture2D(tLow, vUv).rgb * 4.0;',
        '  c += (texture2D(tLow, vUv + vec2(uPx.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(uPx.x, 0.0)).rgb + texture2D(tLow, vUv + vec2(0.0, uPx.y)).rgb + texture2D(tLow, vUv - vec2(0.0, uPx.y)).rgb) * 2.0;',
        '  c += texture2D(tLow, vUv + uPx).rgb + texture2D(tLow, vUv - uPx).rgb + texture2D(tLow, vUv + vec2(uPx.x, -uPx.y)).rgb + texture2D(tLow, vUv + vec2(-uPx.x, uPx.y)).rgb;',
        '  gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + c / 16.0 * uWide, 1.0); }'].join('\n'),
      depthTest: false, depthWrite: false });
    var outMat = new T.ShaderMaterial({ uniforms: { tMap: { value: null }, uK: { value: 0 } }, vertexShader: vs,
      fragmentShader: [
        'uniform sampler2D tMap; uniform float uK; varying vec2 vUv;',
        'void main() { vec3 c = 1.0 - exp(-texture2D(tMap, vUv).rgb * uK);',   // мягкий предел: ядро уходит в белое без ступеньки
        '  c = pow(c, vec3(1.0 / 2.2));',                                        // в цвета экрана
        '  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b))); }'].join('\n'),
      transparent: true, depthTest: false, depthWrite: false });
    addLight(outMat);
    var quad = new T.Mesh(new T.PlaneGeometry(2, 2), downMat); quad.frustumCulled = false;
    var qScene = new T.Scene(); qScene.add(quad);
    return { src: src, down: down, up: up, downMat: downMat, upMat: upMat, outMat: outMat, quad: quad, qScene: qScene,
      depthOnly: new T.MeshBasicMaterial({ colorWrite: false, side: T.DoubleSide }), w: 0, h: 0, cc: new T.Color() };
  })();
  // свет на всех слоях фонарей: иначе в кадре фар другой набор источников — и другой шейдер (сборка «на ходу» замораживала страницу)
  [key, rim, fill, torch].forEach(function (l) { l.layers.enable(3); });
  function renderBloom(k) {
    var b = bloom, W = renderer.domElement.width, H = renderer.domElement.height, i;
    if (b.w !== W || b.h !== H) {
      b.w = W; b.h = H;
      var sw = Math.max(1, W >> 1), sh = Math.max(1, H >> 1); b.src.setSize(sw, sh);
      for (i = 0; i < b.down.length; i++) { var dw = Math.max(1, sw >> (i + 1)), dh = Math.max(1, sh >> (i + 1)); b.down[i].setSize(dw, dh); b.up[i].setSize(dw, dh); }
    }
    var shadowDue = renderer.shadowMap.needsUpdate, autoClear = renderer.autoClear, mask = camera.layers.mask, ca = renderer.getClearAlpha();
    renderer.getClearColor(b.cc);
    renderer.shadowMap.needsUpdate = false; renderer.autoClear = false;
    // кадр фар: сначала кузов — только глубина (закрывает фонари с другой стороны машины), потом сами фары и фонари
    renderer.setRenderTarget(b.src); renderer.setClearColor(0x000000, 0); renderer.clear();
    scene.overrideMaterial = b.depthOnly; camera.layers.set(4); renderer.render(scene, camera);
    scene.overrideMaterial = null; camera.layers.set(3); renderer.render(scene, camera);
    camera.layers.mask = mask;
    var input = b.src;
    b.quad.material = b.downMat;
    for (i = 0; i < b.down.length; i++) {
      b.downMat.uniforms.tMap.value = input.texture; b.downMat.uniforms.uPx.value.set(1 / input.width, 1 / input.height); b.downMat.uniforms.uPre.value = i ? 0 : 1;
      renderer.setRenderTarget(b.down[i]); renderer.render(b.qScene, blurCam);
      input = b.down[i];
    }
    b.quad.material = b.upMat;
    for (i = b.down.length - 2; i >= 0; i--) {
      b.upMat.uniforms.tLow.value = input.texture; b.upMat.uniforms.tHigh.value = b.down[i].texture; b.upMat.uniforms.uPx.value.set(1 / input.width, 1 / input.height);
      renderer.setRenderTarget(b.up[i]); renderer.render(b.qScene, blurCam);
      input = b.up[i];
    }
    b.quad.material = b.outMat; b.outMat.uniforms.tMap.value = input.texture; b.outMat.uniforms.uK.value = k;
    renderer.setRenderTarget(null); renderer.render(b.qScene, blurCam);
    renderer.autoClear = autoClear; renderer.setClearColor(b.cc, ca); renderer.shadowMap.needsUpdate = shadowDue;
  }

  // ---------- машины ----------
  var loader = new A.GLTFLoader(); loader.setMeshoptDecoder(A.MeshoptDecoder);
  var cars = {}, pending = {}, active = null, leaving = [], want = firstId;
  var sizeCam = new T.Vector3(2.7, 1.3, 4.4);
  var paintHex = getComputedStyle(html).getPropertyValue('--paint-default').trim() || '#6e0b10';
  var qSpin = new T.Quaternion(), qSteer = new T.Quaternion(), qNone = new T.Quaternion();
  var AX_X = new T.Vector3(1, 0, 0), AX_Y = new T.Vector3(0, 1, 0), STEER_MAX = 0.12;   // руль на ходу — до ~7°
  var aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Волна краски: новый цвет бежит от носа к корме, по границе — светлая полоса (вставка в стандартный шейдер лака).
  function wavePatch(mat, w) {
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uOld = w.old; sh.uniforms.uFront = w.front; sh.uniforms.uBand = w.band;
      sh.vertexShader = 'varying float vWaveZ;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWaveZ = (modelMatrix * vec4(transformed, 1.0)).z;');
      sh.fragmentShader = 'uniform vec3 uOld;\nuniform float uFront;\nuniform float uBand;\nvarying float vWaveZ;\n' + sh.fragmentShader
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( mix( uOld, diffuse, smoothstep( uFront - 0.16, uFront + 0.16, vWaveZ ) ), opacity );')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3( 1.0, 0.92, 0.8 ) * uBand * exp( -pow( ( vWaveZ - uFront ) / 0.09, 2.0 ) );');
    };
    mat.customProgramCacheKey = function () { return 'paint-wave'; };
    mat.needsUpdate = true;
  }
  // «Зажигание» фары: свечение есть только ближе к середине машины, чем uSweep (доля полуширины), — ходовой огонь
  // прорисовывается от центра к краям (приём rideradian.com). uInv — обратная матрица машины: x считается от её оси.
  // Поворотник — наружный край самой фары или фонаря загорается янтарным (uSig: левая, правая сторона; uOuter — где
  // кончается фонарь, в долях полуширины): огонь — часть машины, а не шар рядом с ней (правка 2026-10-04, третий пакет).
  function lampPatch(mat, c, head) {
    var u = { uSweep: head ? c.sweep : { value: 1.3 }, uInv: c.inv, uHalf: c.half, uSig: c.sig, uOuter: head ? c.outerHead : c.outerTail };
    mat.onBeforeCompile = function (sh) {
      for (var k in u) sh.uniforms[k] = u[k];
      sh.vertexShader = 'uniform mat4 uInv;\nvarying vec3 vLampP;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vLampP = ( uInv * modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      sh.fragmentShader = 'uniform float uSweep;\nuniform float uHalf;\nuniform vec2 uSig;\nuniform float uOuter;\nvarying vec3 vLampP;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  float lampX = abs( vLampP.x ) / uHalf;\n  totalEmissiveRadiance *= 1.0 - smoothstep( uSweep - 0.16, uSweep, lampX );\n' +
        '  totalEmissiveRadiance += vec3( 1.0, 0.42, 0.06 ) * ( vLampP.x < 0.0 ? uSig.x : uSig.y ) * smoothstep( uOuter - 0.17, uOuter - 0.07, lampX );');
    };
    mat.customProgramCacheKey = function () { return 'lamp'; };
    mat.needsUpdate = true;
  }

  // часть сетки по списку треугольников (атрибуты общие — память не удваивается)
  // Рамка — только по своим вершинам: computeBoundingBox берёт весь общий атрибут, и обе половинки колёс оси получали рамку
  // обоих колёс — ступица вставала в середину оси, колесо «выворачивало» при повороте руля (правка 2026-10-04, третий пакет)
  function subGeo(geo, list) {
    var g = new T.BufferGeometry(), pos = geo.attributes.position, b = new T.Box3(), v = new T.Vector3();
    for (var k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(list);
    for (var i = 0; i < list.length; i++) b.expandByPoint(v.fromBufferAttribute(pos, list[i]));
    g.boundingBox = b; g.boundingSphere = b.getBoundingSphere(new T.Sphere());
    return g;
  }
  // вершины сетки, которые реально используются (по индексу), в координатах M — для бликов, поворотников, склейки
  function eachVertex(m, M, fn) {
    var geo = m.geometry, pos = geo.attributes.position, idx = geo.index, v = new T.Vector3(), seen = new Uint8Array(pos.count);
    var n = idx ? idx.count : pos.count;
    for (var i = 0; i < n; i++) {
      var k = idx ? idx.getX(i) : i;
      if (seen[k]) continue; seen[k] = 1;
      fn(v.fromBufferAttribute(pos, k).applyMatrix4(M));
    }
  }

  // Склейка неподвижных деталей одного материала в одну сетку: у Zeekr 146 деталей, у Li L9 — 254, и каждая рисовалась
  // отдельно трижды за кадр (машина, отражение, тень). После склейки вызовов отрисовки в 3–4 раза меньше (правка
  // 2026-10-04, третий пакет: «сайт тяжёлый»). Прозрачные детали не склеиваем — их порядок отрисовки важен.
  function mergeStatic(group) {
    var inv = new T.Matrix4().copy(group.matrixWorld).invert(), M = new T.Matrix4(), N = new T.Matrix3(), buckets = new Map();
    group.traverse(function (o) {
      if (!o.isMesh || o === group || Array.isArray(o.material) || o.material.transparent || o.morphTargetInfluences || o.isSkinnedMesh || !isPlain(o.parent, group)) return;
      var geo = o.geometry, names = Object.keys(geo.attributes).filter(function (k) { return /^(position|normal|uv|uv1|tangent|color)$/.test(k); }).sort();
      if (Object.keys(geo.attributes).length !== names.length) return;
      var key = o.material.uuid + '|' + names.join() + '|' + o.visible + o.castShadow + o.receiveShadow + o.renderOrder;
      (buckets.get(key) || buckets.set(key, []).get(key)).push(o);
    });
    buckets.forEach(function (list) {
      if (list.length < 2 || !list[0].visible) return;
      var names = Object.keys(list[0].geometry.attributes).filter(function (k) { return k !== 'position'; }), parts = [], nv = 0, ni = 0;
      list.forEach(function (o) {
        var geo = o.geometry, idx = geo.index, cnt = idx ? idx.count : geo.attributes.position.count, map = new Map(), order = [];
        for (var i = 0; i < cnt; i++) { var k = idx ? idx.getX(i) : i; if (!map.has(k)) { map.set(k, order.length); order.push(k); } }
        o.updateWorldMatrix(true, false);
        M.multiplyMatrices(inv, o.matrixWorld);
        parts.push({ o: o, map: map, order: order, cnt: cnt, M: M.clone(), flip: M.determinant() < 0 });
        nv += order.length; ni += cnt;
      });
      var P = new Float32Array(nv * 3), A = {}, I = new (nv > 65535 ? Uint32Array : Uint16Array)(ni), v = new T.Vector3(), w = new T.Vector4(), vo = 0, io = 0;
      names.forEach(function (k) { A[k] = new Float32Array(nv * list[0].geometry.attributes[k].itemSize); });
      parts.forEach(function (p) {
        var geo = p.o.geometry, pos = geo.attributes.position, idx = geo.index;
        N.getNormalMatrix(p.M);
        p.order.forEach(function (k, j) {
          v.fromBufferAttribute(pos, k).applyMatrix4(p.M); P.set([v.x, v.y, v.z], (vo + j) * 3);
          names.forEach(function (n) {
            var at = geo.attributes[n], s = at.itemSize, out = A[n], o = (vo + j) * s;
            if (n === 'normal') { v.fromBufferAttribute(at, k).applyNormalMatrix(N); out[o] = v.x; out[o + 1] = v.y; out[o + 2] = v.z; }
            else if (n === 'tangent') { w.fromBufferAttribute(at, k); v.set(w.x, w.y, w.z).transformDirection(p.M); out[o] = v.x; out[o + 1] = v.y; out[o + 2] = v.z; out[o + 3] = p.flip ? -w.w : w.w; }
            else for (var c = 0; c < s; c++) out[o + c] = c === 0 ? at.getX(k) : c === 1 ? at.getY(k) : c === 2 ? at.getZ(k) : at.getW(k);
          });
        });
        for (var i = 0; i < p.cnt; i += 3) {   // зеркальная деталь: при запекании поворот треугольников меняется — разворачиваем
          var a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c2 = idx ? idx.getX(i + 2) : i + 2;
          I[io++] = vo + p.map.get(a); I[io++] = vo + p.map.get(p.flip ? c2 : b); I[io++] = vo + p.map.get(p.flip ? b : c2);
        }
        vo += p.order.length;
        p.o.parent.remove(p.o); p.o.geometry.dispose();
      });
      var g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(P, 3));
      names.forEach(function (n) { var src = list[0].geometry.attributes[n]; g.setAttribute(n, new T.BufferAttribute(A[n], src.itemSize)); });
      g.setIndex(new T.BufferAttribute(I, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
      var mesh = new T.Mesh(g, list[0].material);
      mesh.name = 'merged-' + (list[0].material.name || ''); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.renderOrder = list[0].renderOrder;
      group.add(mesh);
    });
    group.updateMatrixWorld(true);
  }
  // промежуточные узлы без своей логики: детали внутри них тоже можно склеивать
  function isPlain(o, top) { while (o && o !== top) { if (o.isMesh) return false; o = o.parent; } return o === top; }
  // разложить треугольники сетки по признаку: key(x, y, z центра треугольника в координатах M) → 0 / 1
  function sortTris(m, M, key) {
    var geo = m.geometry, pos = geo.attributes.position, idx = geo.index ? geo.index.array : null, n = idx ? idx.length : pos.count, e = M.elements, out = [[], []];
    for (var t = 0; t < n; t += 3) {
      var x = 0, y = 0, z = 0, k;
      for (k = 0; k < 3; k++) {
        var v = idx ? idx[t + k] : t + k, px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
        x += e[0] * px + e[4] * py + e[8] * pz + e[12]; y += e[1] * px + e[5] * py + e[9] * pz + e[13]; z += e[2] * px + e[6] * py + e[10] * pz + e[14];
      }
      var list = out[key(x / 3, y / 3, z / 3) ? 1 : 0];
      for (k = 0; k < 3; k++) list.push(idx ? idx[t + k] : t + k);
    }
    return out;
  }
  // треугольники сетки целиком внутри цилиндра колеса (ось — X, центр C, радиус R, полуширина HW) и остальные;
  // outer — наоборот: треугольники целиком дальше R от оси (кольцо шины)
  function cylSplit(m, C, R, HW, outer) {
    var geo = m.geometry, pos = geo.attributes.position, idx = geo.index ? geo.index.array : null, n = idx ? idx.length : pos.count, e = m.matrixWorld.elements, out = [[], []];
    for (var t = 0; t < n; t += 3) {
      var inside = true, k;
      for (k = 0; k < 3 && inside; k++) {
        var v = idx ? idx[t + k] : t + k, px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
        var x = e[0] * px + e[4] * py + e[8] * pz + e[12], y = e[1] * px + e[5] * py + e[9] * pz + e[13], z = e[2] * px + e[6] * py + e[10] * pz + e[14];
        inside = outer ? Math.hypot(y - C.y, z - C.z) > R : Math.abs(x - C.x) <= HW && Math.hypot(y - C.y, z - C.z) <= R;
      }
      var list = out[inside ? 0 : 1];
      for (k = 0; k < 3; k++) list.push(idx ? idx[t + k] : t + k);
    }
    return out;
  }
  // треугольники из списка, у которых хотя бы одна вершина не ниже оси колеса (C.y)
  function aboveAxle(m, list, C) {
    var pos = m.geometry.attributes.position, e = m.matrixWorld.elements, out = [];
    for (var t = 0; t < list.length; t += 3) {
      var hi = false;
      for (var k = 0; k < 3 && !hi; k++) { var v = list[t + k]; hi = e[1] * pos.getX(v) + e[5] * pos.getY(v) + e[9] * pos.getZ(v) + e[13] >= C.y; }
      if (hi) out.push(list[t], list[t + 1], list[t + 2]);
    }
    return out;
  }
  function twin(m, geo, mat) { var s = new T.Mesh(geo, mat || m.material); s.name = m.name; s.position.copy(m.position); s.quaternion.copy(m.quaternion); s.scale.copy(m.scale); m.parent.add(s); return s; }

  // Фары и фонари, у которых в модели нет своего материала (BYD, Tiggo, Li L9): треугольники внутри коробок (координаты
  // исходника, meta → lampBoxes) уходят в отдельную сетку с материалом lamp-head / lamp-tail — её и зажигаем.
  // shadeBoxes — то же для салона машины без стёкол (Li L9): салон в коробке темнеет, как за тонировкой (lamp: 'cabin').
  // trimBoxes — деталь в чужом материале перекрашивается ({ lamp: 'trim', set: { color, roughness, ... } }): у Li L9
  // полоса внизу переднего бампера была в материале фонарей — красная (правка 2026-10-04, четвёртый пакет).
  function setProps(mat, p) {
    for (var k in p) { if (k === 'color' || k === 'emissive') { if (mat[k]) mat[k].set(p[k]); } else mat[k] = p[k]; }
  }
  function splitLamps(model, groups) {
    var inv = new T.Matrix4().copy(model.matrixWorld).invert(), M = new T.Matrix4(), made = {};
    groups.forEach(function (g) {
      var mr = new RegExp(g.materials), list = [];
      model.traverse(function (o) { if (o.isMesh && mr.test(o.material.name || '')) list.push(o); });
      list.forEach(function (m) {
        M.multiplyMatrices(inv, m.matrixWorld);
        var parts = sortTris(m, M, function (x, y, z) { return g.boxes.some(function (b) { return x > b[0] && y > b[1] && z > b[2] && x < b[3] && y < b[4] && z < b[5]; }); });
        if (!parts[1].length) return;
        var key = g.lamp + m.material.uuid, mat = made[key];
        if (!mat) {
          mat = made[key] = m.material.clone(); mat.name = 'lamp-' + g.lamp;
          // салон без стёкол — чёрный глянец с отражениями студии, как за тонированным стеклом у остальных машин: матовый
          // тёмный салон ловил верхний луч, сиденья и панель были видны (правка 2026-10-04, четвёртый пакет)
          if (g.lamp === 'cabin') { mat.color.set('#000000'); mat.map = null; mat.roughness = 0.12; mat.metalness = 0; mat.envMapIntensity = 1.6; if (mat.emissive) mat.emissive.set(0); }
          if (g.set) setProps(mat, g.set);
        }
        twin(m, subGeo(m.geometry, parts[1]), mat);
        if (parts[0].length) m.geometry = subGeo(m.geometry, parts[0]); else m.visible = false;
      });
    });
    model.updateMatrixWorld(true);
  }

  // Колёса. Сборка моделей кладёт оба колеса оси в один узел и вращает их вокруг общей точки — если колёса модели стоят
  // чуть несимметрично, второе колесо «бьёт»; при сборке «цилиндром» в колесо попадают суппорты, щитки и кусочки кузова.
  // Здесь у каждого колеса — своя ступица в центре шины: крутится только круглое (шина, диск, колпак), суппорты и щитки
  // только поворачиваются вместе с колесом, кузов остаётся на месте. Сетка на оба колеса оси режется по сторонам.
  var calipers = new Map();
  function caliper(m) {   // суппорт был в материале фонарей (Tiggo) — без свечения
    var k = calipers.get(m);
    if (!k) { k = m.clone(); k.name = 'caliper'; if (k.emissive) k.emissive.set(0); k.emissiveIntensity = 0; calipers.set(m, k); }
    return k;
  }
  // резина: матовая, почти без отражений и почти чёрная, как настоящая (отражает 3–5% света) — у Li L9 шины были
  // светло-серыми, у Zeekr и SU7 светлый цвет умножался на текстуру боковины: шины ловили синий контровой свет
  var rubbers = new Map(), wheelMats = new Map();
  function rubber(m) {
    var k = rubbers.get(m);
    if (!k) {
      // Матовая резина без бликов (Ламберт): у «физической» шины даже при шероховатости 1 край ловил отражение под
      // скользящим углом — по контуру шины шла синяя полоса от контрового света (правка 2026-10-06, седьмой пакет)
      k = new T.MeshLambertMaterial({ name: (m.name || '') + '-tire', map: m.map || null, color: m.map ? new T.Color().setScalar(0.16) : new T.Color(0x18181a),
        side: T.DoubleSide });   // у Li L9 часть граней шины развёрнута внутрь — односторонняя шина была «дырявой»
      if (m.normalMap) { k.normalMap = m.normalMap; k.normalScale.copy(m.normalScale); }
      rubbers.set(m, k);
    }
    return k;
  }
  // Диск и тормоза — металл. В моделях диски бывали белым или тёмным глянцевым пластиком (Li L9 — белые «пластиковые»
  // диски, Zeekr и Haval — тёмный пластик, детали тормозов — белые матовые), колёса выглядели недоделанными (правка
  // 2026-10-04, четвёртый пакет). Диск: металл с мягким бликом, цвет модели сохраняется (серебро, графит, хром);
  // белая матовая деталь без текстуры — тормозной диск или ступица: тёмный металл. Тормоза за диском (knuckle) — тёмный
  // металл, цветные суппорты остаются цветными. Материал общий с кузовом (Li L9, Tiggo, BYD) — копия только для колеса.
  function wheelMat(m, round) {
    var key = m.uuid + (round ? 'r' : 'k'), k = wheelMats.get(key);
    if (k) return k;
    k = m.clone(); k.name = (m.name || '') + (round ? '-rim' : '-brake');
    var c = k.color || new T.Color(1, 1, 1), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, red = c.r > c.g * 1.6 && c.r > 0.2;
    if (!red) {
      k.metalness = k.map ? 0.55 : 1;   // диск с текстурой (SU7): при полном металле уходил в чёрное
      if (round) {
        k.roughness = Math.min(0.42, Math.max(0.24, k.roughness || 0));
        if (!k.map && lum > 0.85 && (m.roughness || 0) > 0.8) { c.setHex(0x55585d); k.roughness = 0.45; }   // белая матовая — ступица, тормозной диск
        else if (!k.map) c.setRGB(Math.min(c.r, 0.62), Math.min(c.g, 0.63), Math.min(c.b, 0.65));        // белый «пластик» → серебро
      } else {
        k.roughness = Math.max(0.45, k.roughness || 0);
        if (!k.map) c.setHex(lum > 0.25 ? 0x4a4c50 : 0x2a2b2e);
      }
      k.envMapIntensity = 1;
    }
    wheelMats.set(key, k);
    return k;
  }
  // тормоз в глубине колеса: тёмный металл, без текстуры (на ней бывают надписи марки); цветной суппорт остаётся цветным
  var brakeMats = new Map();
  function brakeMat(m) {
    var k = brakeMats.get(m);
    if (k) return k;
    k = new T.MeshStandardMaterial({ name: (m.name || '') + '-brake', color: '#2c2e32', metalness: 0.8, roughness: 0.55, envMapIntensity: 0.5, side: m.side });
    var c = m.color; if (c && c.r > c.g * 1.6 && c.r > 0.2) k.color.copy(c);
    brakeMats.set(m, k);
    return k;
  }
  // Своя шина вместо шины модели (настройка tireRebuild): у Li L9 шина в исходнике упрощена так, что «дырявая», с
  // приплюснутым наплывом внизу и протектором в материале диска — правили трижды, и каждый раз вылезало новое место
  // (правки 2026-10-06, седьмой пакет: «колёса либо дырявые, либо пятнами блестят»). Теперь шина Li L9 — ровное тело
  // вращения по размерам колеса: протектор, скруглённые плечи, боковины до обода диска; диск остаётся из модели.
  var tireMat = new T.MeshLambertMaterial({ name: 'tire-built', color: 0x1a1a1c, side: T.DoubleSide });
  function rebuildTire(hub, r, hw) {
    var rimR = 0, bb = new T.Box3(), sz = new T.Vector3(), drop = [];
    hub.updateMatrixWorld(true);
    hub.traverse(function (o) {
      if (!o.isMesh) return;
      if (/-tire$/.test(o.material.name || '')) { drop.push(o); return; }
      bb.setFromObject(o).getSize(sz); rimR = Math.max(rimR, Math.max(sz.y, sz.z) / 2);
    });
    drop.forEach(function (o) { o.parent.remove(o); });
    rimR = Math.min(Math.max(rimR, 0.55 * r), 0.82 * r);
    var W = Math.max(0.12, (hw - 0.02) * 2) / 2, k = 0.035, pts = [];
    pts.push(new T.Vector2(rimR * 0.97, -W * 0.82));
    pts.push(new T.Vector2(rimR * 1.04, -W * 0.92));
    var i, a;
    // боковина → скруглённое плечо → протектор → плечо → боковина
    for (i = 0; i <= 6; i++) { a = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new T.Vector2(r - k + Math.cos(a) * k, -W + k + Math.sin(a) * k)); }
    for (i = 0; i <= 6; i++) { a = i / 6 * Math.PI / 2; pts.push(new T.Vector2(r - k + Math.cos(a) * k, W - k + Math.sin(a) * k)); }
    pts.push(new T.Vector2(rimR * 1.04, W * 0.92));
    pts.push(new T.Vector2(rimR * 0.97, W * 0.82));
    var geo = new T.LatheGeometry(pts, 72);
    geo.rotateZ(-Math.PI / 2);   // ось вращения — X, как у колёс
    var mesh = new T.Mesh(geo, tireMat);
    mesh.name = 'tire-built'; hub.add(mesh);
  }
  // Внутренняя арка колеса в цвете кузова (лак с отражениями) блестела светлой дугой над шиной; у настоящих машин
  // подкрылок — чёрный матовый пластик (правка 2026-10-06, седьмой пакет). Треугольники лака у колеса, развёрнутые
  // к оси колеса, — подкрылок (любой непрозрачный материал кузова, кроме фар и фонарей).
  var linerMat = new T.MeshStandardMaterial({ name: 'arch-liner', color: '#0c0d0f', roughness: 0.95, metalness: 0, envMapIntensity: 0.08, side: T.DoubleSide });
  function archLiners(c, model, paintRx) {
    var boxes = c.hubs.map(function (h) { var d = new T.Vector3(h.hw + 0.15, 1.5 * h.r, 1.5 * h.r); return new T.Box3(h.C.clone().sub(d), h.C.clone().add(d)); });
    // днище между колёсами (внутрь от шин, ниже верха колеса): у Li L9 через щель за шиной светлел белый пол салона
    var AX = Math.min.apply(null, c.hubs.map(function (h) { return Math.abs(h.C.x) - h.hw; })), AZ = Math.max.apply(null, c.hubs.map(function (h) { return Math.abs(h.C.z); }));
    var AY = Math.min.apply(null, c.hubs.map(function (h) { return h.C.y + 0.8 * h.r; }));
    var list = [], mb = new T.Box3(), A = new T.Vector3(), B = new T.Vector3(), Cc = new T.Vector3(), n = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3();
    // не только лак: у Li L9 светлая полоса в арке — белый материал отделки (material_1)
    var inW = new Set();
    c.hubs.forEach(function (h) { [h.hub, h.knuckle].forEach(function (g) { g.traverse(function (o) { inW.add(o); }); }); });
    model.traverse(function (o) { if (o.isMesh && o.visible && !inW.has(o) && !o.material.transparent && !/^lamp-(head|tail)$|-tire$|^arch-liner$/.test(o.material.name || '')) list.push(o); });
    list.forEach(function (m) {
      mb.setFromObject(m);
      var near = c.hubs.filter(function (h, k) { return mb.intersectsBox(boxes[k]); });
      if (!near.length && !(mb.min.y < AY && mb.min.x < AX && mb.max.x > -AX)) return;
      var pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal, idx = m.geometry.index ? m.geometry.index.array : null, cnt = idx ? idx.length : pos.count, M = m.matrixWorld, keep = [], lin = [];
      var NM = new T.Matrix3().getNormalMatrix(M), vn = new T.Vector3();
      for (var t = 0; t < cnt; t += 3) {
        A.fromBufferAttribute(pos, idx ? idx[t] : t).applyMatrix4(M); B.fromBufferAttribute(pos, idx ? idx[t + 1] : t + 1).applyMatrix4(M); Cc.fromBufferAttribute(pos, idx ? idx[t + 2] : t + 2).applyMatrix4(M);
        var gx = (A.x + B.x + Cc.x) / 3, gy = (A.y + B.y + Cc.y) / 3, gz = (A.z + B.z + Cc.z) / 3;
        var liner = Math.abs(gx) < AX && Math.abs(gz) < AZ && gy < AY && !paintRx.test(m.material.name || '');
        for (var k = 0; k < near.length && !liner; k++) {
          var h = near[k], dy = h.C.y - gy, dz = h.C.z - gz, dr = Math.hypot(dy, dz);
          // глубина колёсной ниши за шиной (днище, моторный отсек): у Li L9 через щель между шиной и аркой светлел белый
          // материал днища — у настоящей машины там темно
          var ax = Math.abs(h.C.x), gxa = gx * Math.sign(h.C.x);
          if (gxa < ax - 0.9 * h.hw && gxa > ax - 0.5 && Math.abs(dz) < 1.3 * h.r && gy < h.C.y + 1.3 * h.r) { liner = true; break; }
          if (Math.abs(gx - h.C.x) > h.hw + 0.2 || dr < 0.7 * h.r || dr > 1.5 * h.r) continue;
          n.crossVectors(e1.subVectors(B, A), e2.subVectors(Cc, A));
          var len = n.length(); if (len < 1e-12) continue;
          // развёрнут к оси колеса (свод арки) или к середине машины (стенка арки — изнанка крыла, у Li L9 блестела лаком);
          // направление к середине — по нормалям вершин: обход треугольников у двусторонних деталей бывает любым
          var inward = false;
          if (nor) {
            vn.set(0, 0, 0);
            for (var q = 0; q < 3; q++) { var vi = idx ? idx[t + q] : t + q; vn.x += nor.getX(vi); vn.y += nor.getY(vi); vn.z += nor.getZ(vi); }
            vn.applyMatrix3(NM).normalize(); inward = vn.x * Math.sign(h.C.x) < -0.7;
          }
          liner = (Math.abs(gx - h.C.x) < h.hw + 0.12 && dr > 0.8 * h.r && Math.abs((n.y * dy + n.z * dz) / (len * dr)) > 0.55) || inward;
        }
        var L = liner ? lin : keep;
        L.push(idx ? idx[t] : t, idx ? idx[t + 1] : t + 1, idx ? idx[t + 2] : t + 2);
      }
      if (!lin.length) return;
      twin(m, subGeo(m.geometry, lin), linerMat);
      if (keep.length) m.geometry = subGeo(m.geometry, keep); else m.visible = false;
    });
  }
  function setupWheels(c, model, cfg) {
    var tireMats = new Set(), rx = new RegExp(cfg.wheels), paintRx = new RegExp(cfg.paint), lampRx = new RegExp(cfg.head + '|' + cfg.tail), axles = [], radii = [], zf = [], zr = [];
    model.traverse(function (o) { if (rx.test(o.name)) axles.push(o); });
    function boxOf(m) { return new T.Box3().setFromObject(m); }
    var v1 = new T.Vector3(), v2 = new T.Vector3();
    axles.forEach(function (ax) {
      var front = /front/i.test(ax.name), parts = [], list = [];
      ax.traverse(function (o) { if (o.isMesh) parts.push(o); });
      parts.forEach(function (m) {
        var b = boxOf(m);
        if (b.min.x < -0.08 * c.size.x && b.max.x > 0.08 * c.size.x) {
          var halves = sortTris(m, m.matrixWorld, function (x) { return x > 0; });
          halves.forEach(function (h) { if (h.length) list.push(twin(m, subGeo(m.geometry, h))); });
          m.parent.remove(m);
        } else list.push(m);
      });
      c.root.updateMatrixWorld(true);
      [-1, 1].forEach(function (side) {
        var mine = list.filter(function (m) { return Math.sign(boxOf(m).getCenter(v1).x) === side; });
        if (!mine.length) return;
        var tire = mine.reduce(function (a, m) { var s = boxOf(m).getSize(v1), k = s.y * s.z; return !a || k > a.k ? { m: m, k: k } : a; }, null).m;
        // Центр и радиус шины — по её собственным треугольникам, без «прилипших» кусков. Рамка всей сетки шины у Li L9
        // захватывала щитки арки и брызговик того же материала: центр съезжал, а щиток крутился вместе с колесом —
        // шина выглядела «рваной» (правка 2026-10-06, седьмой пакет). Три прохода: рамка → только треугольники целиком
        // внутри шины → рамка по ним.
        var tb = boxOf(tire), C = tb.getCenter(new T.Vector3()), ts = tb.getSize(v2), r = Math.max(ts.y, ts.z) / 2, hw = ts.x / 2 + 0.02;
        for (var it = 0; it < 3; it++) {
          var kept = cylSplit(tire, C, r * 1.02, hw)[0];
          if (!kept.length) break;
          var kb = subGeo(tire.geometry, kept).boundingBox.clone().applyMatrix4(tire.matrixWorld);
          // пустая рамка давала центр (0, 0, 0): у Li L9 правое переднее колесо крутилось вокруг середины машины, а
          // построенная шина вставала под кузовом «призраком» (правка 2026-10-06) — такой шаг не принимаем
          var kc = kb.isEmpty() ? null : kb.getCenter(new T.Vector3()), ks = kc && kb.getSize(new T.Vector3());
          if (!kc || kc.distanceTo(C) > 0.5 * r || Math.max(ks.y, ks.z) < r) break;
          C.copy(kc); ts.copy(ks); r = Math.max(ts.y, ts.z) / 2; hw = ts.x / 2 + 0.02;
        }
        // у стороны оси нет колеса (в узле лишь кусок кузова: у Li L9 правое переднее колесо — отдельный узел) — не колесо
        if (Math.max(ts.y, ts.z) < 0.25 || Math.abs(ts.y - ts.z) > 0.3 * Math.max(ts.y, ts.z)) return;
        var tireSrc = tire.material; tireMats.add(tireSrc);
        var hub = new T.Group(), knuckle = new T.Group();
        hub.position.copy(C); knuckle.position.copy(C); c.root.add(hub, knuckle); c.root.updateMatrixWorld(true);
        mine.forEach(function (m) {
          var n = m.material.name || '';
          if (paintRx.test(n)) return;                                                  // кузов, попавший в колесо при сборке
          // В колесо идут только треугольники целиком внутри шины (цилиндр колеса); щитки, брызговики и куски арки
          // остаются кузовом и стоят на месте — при любом повороте и вращении колеса.
          var parts = cylSplit(m, C, r * 1.03, hw);
          if (!parts[0].length) return;
          // Шина за кругом колеса (у Li L9 низ шины «приплюснут» под весом машины) стоит на месте, но остаётся резиной:
          // с исходным материалом «Metallic» этот край блестел металлом под светом за курсором (правка 2026-10-06, седьмой пакет)
          // Куски материала шины за кругом колеса ниже оси — у Li L9 чёрный «наплыв» внизу шины: стоя на месте при круглой
          // шине, он торчал из-под неё чёрной глыбой (скрин владельца 2026-10-06) — не рисуем; выше оси — подкрылок, резина.
          var outer = m.material === tireSrc ? aboveAxle(m, parts[1], C) : parts[1];
          if (outer.length && !(cfg.tireRebuild && m.material === tireSrc)) twin(m, subGeo(m.geometry, outer), m.material === tireSrc ? rubber(tireSrc) : null);
          if (parts[1].length) m.geometry = subGeo(m.geometry, parts[0]);
          var b = boxOf(m), mc = b.getCenter(v1), s = b.getSize(v2), d = Math.hypot(mc.y - C.y, mc.z - C.z);
          // Другие куски шины — тем же материалом, что протектор: у Li L9 боковина шины — отдельные детали материала
          // «Metallic», они становились металлом диска или тормоза, в них отражался светлый пол — переднее колесо
          // выглядело голым диском без шины (правка 2026-10-06). Шина — вся резина и крутится вместе с диском.
          if (m.material === tireSrc) { m.material = rubber(tireSrc); hub.attach(m); return; }
          // Протектор и боковина в материале диска: у Li L9 протектор — материал диска «Metallic_0», у Xiaomi SU7 боковина
          // с надписями — материал с текстурой диска; на шине блестел металл (правка 2026-10-06, седьмой пакет). Всё, что
          // целиком дальше 0,84 радиуса шины от оси (обод диска кончается раньше), — резина.
          var ring = cylSplit(m, C, 0.84 * r, hw, true);
          if (ring[0].length) {
            hub.attach(twin(m, subGeo(m.geometry, ring[0]), rubber(m.material)));
            if (!ring[1].length) { m.parent.remove(m); return; }
            m.geometry = subGeo(m.geometry, ring[1]);
          }
          var round = d < 0.07 * r && Math.abs(s.y - s.z) < 0.12 * Math.max(s.y, s.z);
          if (!round && lampRx.test(n)) m.material = caliper(m.material);
          if (m !== tire) m.material = wheelMat(m.material, round);
          (round ? hub : knuckle).attach(m);
        });
        c.hubs.push({ hub: hub, knuckle: knuckle, front: front, C: C, r: r, hw: hw });
        radii.push(r); (front ? zf : zr).push(C.z);
      });
    });
    // Своя шина: у Li L9 правое переднее колесо — отдельный узел без шины (шина модели — в кузове), его рамка — по диску.
    // Шины у настоящей машины одного размера — радиус и ширина у всех колёс по самому большому колесу.
    if (cfg.tireRebuild && c.hubs.length) {
      var R = Math.max.apply(null, c.hubs.map(function (h) { return h.r; })), HW = Math.max.apply(null, c.hubs.map(function (h) { return h.hw; }));
      c.hubs.forEach(function (h) { h.r = R; h.hw = HW; rebuildTire(h.hub, R, HW); });
      radii = c.hubs.map(function (h) { return h.r; });
    }
    // Детали колеса вне узлов колёс — у Zeekr тормозной диск («kaqian»), у Haval и Tiggo — тормоза в общем материале:
    // стояли на месте, пока колесо поворачивалось, и за спицами торчала светлая неподвижная «тарелка» — «баг при анимации»
    // колеса (правка 2026-10-05). Треугольники внутри цилиндра колеса (не кузов, не фонари) переходят к поворотному
    // кулаку своего колеса: поворачиваются вместе с ним и становятся тёмным металлом, как тормоза.
    var inWheel = new Set();
    c.hubs.forEach(function (h) { [h.hub, h.knuckle].forEach(function (g) { g.traverse(function (o) { inWheel.add(o); }); }); });
    var loose = [];
    model.traverse(function (o) {
      var n = o.isMesh ? o.material.name || '' : '';
      if (o.isMesh && o.visible && !inWheel.has(o) && !o.material.transparent && !paintRx.test(n) && !lampRx.test(n) && (!/^lamp-/.test(n) || n === 'lamp-cabin')) loose.push(o);
    });
    // один проход по треугольникам и только у деталей, чья рамка задевает колёса: четыре прохода по всему кузову
    // давали задачу до 0,7 с при выезде Li L9 (замер tools/perf.mjs)
    // Шина вне узлов колёс: у Li L9 материал шины «Metallic» есть и в кузове — куски боковины рядом с колесом блестели
    // металлом под светом за курсором (правка 2026-10-06, седьмой пакет). Материал шины в арке колеса (до 1,5 радиуса) — резина.
    var wheelBox = c.hubs.map(function (h) { var d = new T.Vector3(h.hw + 0.15, 1.5 * h.r, 1.5 * h.r); return new T.Box3(h.C.clone().sub(d), h.C.clone().add(d)); });
    var mb = new T.Box3();
    loose.forEach(function (m) {
      mb.setFromObject(m);
      var near = c.hubs.filter(function (h, k) { return mb.intersectsBox(wheelBox[k]); });
      if (!near.length) return;
      var pos = m.geometry.attributes.position, idx = m.geometry.index ? m.geometry.index.array : null, n = idx ? idx.length : pos.count, e = m.matrixWorld.elements;
      // затемнение салона Li L9 (shadeBoxes, чёрный глянец) задевало арки и низ шин — в арке над колесом блестела светлая дуга
      // своя шина (tireRebuild): куски шины модели внутри колеса не рисуем — их заменяет построенная шина
      var isTire = tireMats.has(m.material) || m.material.name === 'lamp-cabin', ownTire = cfg.tireRebuild && tireMats.has(m.material), rest = [], tireRest = [], drop = [], per = near.map(function () { return []; }), hits = 0;
      // в колесо — только треугольник, у которого все три вершины внутри колеса: по центру треугольника к тормозам Tiggo
      // уходила пластина арки длиной 0,6 м — при повороте колеса она торчала из-под кузова (правка 2026-10-06, седьмой пакет)
      for (var t = 0; t < n; t += 3) {
        var list = rest, q, v;
        for (var k = 0; k < near.length && list === rest; k++) {
          var h = near[k], inside = true, close = true, below = true;
          for (q = 0; q < 3 && (inside || close); q++) {
            v = idx ? idx[t + q] : t + q;
            var px = pos.getX(v), py = pos.getY(v), pz = pos.getZ(v);
            var x = e[0] * px + e[4] * py + e[8] * pz + e[12], y = e[1] * px + e[5] * py + e[9] * pz + e[13], z = e[2] * px + e[6] * py + e[10] * pz + e[14];
            var dx = Math.abs(x - h.C.x), dr = Math.hypot(y - h.C.y, z - h.C.z);
            inside = inside && dx < h.hw && dr < 0.9 * h.r;
            close = close && dx < h.hw + 0.15 && dr < 1.5 * h.r;   // вся арка над колесом
            below = below && y < h.C.y;
          }
          if (inside) { list = ownTire ? drop : per[k]; hits++; }
          else if (isTire && close) { list = below ? drop : tireRest; hits++; }   // ниже оси — «наплыв» под шиной, не рисуем
        }
        for (q = 0; q < 3; q++) list.push(idx ? idx[t + q] : t + q);
      }
      if (!hits) return;
      per.forEach(function (l, k) { if (l.length) near[k].knuckle.attach(twin(m, subGeo(m.geometry, l), isTire ? rubber(m.material) : brakeMat(m.material))); });
      if (tireRest.length) twin(m, subGeo(m.geometry, tireRest), linerMat);   // щитки и брызговики в арке — как подкрылок
      if (rest.length) m.geometry = subGeo(m.geometry, rest); else m.parent.remove(m);
    });
    // Подкрылки — только у машин с настройкой archLiners (Li L9): у низкой Xiaomi SU7 капот и крылья лежат близко к
    // колёсам, правило красило их чёрными пятнами — «машину кошки драли» (правка 2026-10-06). Остальные машины не трогаем.
    if (cfg.archLiners) archLiners(c, model, paintRx);
    function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
    c.wheelR = radii.length ? avg(radii) : cfg.wheelRadius * c.scale;
    c.base = zf.length && zr.length ? Math.abs(avg(zf) - avg(zr)) : c.size.z * 0.6;
  }

  // Контактная тень: машину один раз снимают снизу вверх в текстуру (чем ниже деталь, тем темнее — пятна под шинами
  // плотные, под днищем мягкие), текстуру размывают и кладут на пол под машиной. Как пример three.js «contact shadows».
  var blurMat = new T.ShaderMaterial({
    uniforms: { tMap: { value: null }, uDir: { value: new T.Vector2() } },
    vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;\nvoid main() { float w[5]; w[0] = 0.227; w[1] = 0.195; w[2] = 0.122; w[3] = 0.054; w[4] = 0.016;\n  vec4 s = texture2D(tMap, vUv) * w[0];\n  for (int i = 1; i < 5; i++) { s += texture2D(tMap, vUv + uDir * float(i)) * w[i]; s += texture2D(tMap, vUv - uDir * float(i)) * w[i]; }\n  gl_FragColor = s; }',
    depthTest: false, depthWrite: false
  });
  var blurQuad = new T.Mesh(new T.PlaneGeometry(2, 2), blurMat), blurCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  blurQuad.frustumCulled = false;
  var shadowDepth = new T.MeshDepthMaterial({ side: T.DoubleSide });
  shadowDepth.onBeforeCompile = function (sh) {
    sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), pow( 1.0 - fragCoordZ, 1.6 ) );');
  };
  shadowDepth.depthTest = false; shadowDepth.depthWrite = false;
  function contactShadow(c) {
    var N = lite ? 256 : 512, w = c.size.x + 0.5, l = c.size.z + 0.5;
    var rtA = new T.WebGLRenderTarget(N, N), rtB = new T.WebGLRenderTarget(N, N);
    var cam = new T.OrthographicCamera(-w / 2, w / 2, l / 2, -l / 2, 0, c.size.y * 0.42);
    cam.rotation.x = Math.PI / 2;   // смотрит вверх, из-под пола
    var tmp = new T.Scene(), prevAlpha = renderer.getClearAlpha(), prevColor = renderer.getClearColor(new T.Color());
    tmp.overrideMaterial = shadowDepth; tmp.add(c.root); tmp.updateMatrixWorld(true);
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtA); renderer.clear(); renderer.render(tmp, cam);
    tmp.remove(c.root);
    var px = 1 / N;
    [[rtA, rtB, 1.6], [rtB, rtA, 1.6], [rtA, rtB, 0.8], [rtB, rtA, 0.8]].forEach(function (p, i) {
      blurMat.uniforms.tMap.value = p[0].texture; blurMat.uniforms.uDir.value.set(i % 2 ? 0 : px * p[2], i % 2 ? px * p[2] : 0);
      renderer.setRenderTarget(p[1]); renderer.clear(); renderer.render(blurQuad, blurCam);
    });
    renderer.setRenderTarget(null); renderer.setClearColor(prevColor, prevAlpha);
    rtB.dispose();
    var pl = onFloor(new T.Mesh(new T.PlaneGeometry(w, l), new T.MeshBasicMaterial({ map: rtA.texture, transparent: true, depthWrite: false })));
    pl.rotation.x = -Math.PI / 2; pl.scale.y = -1; pl.position.y = 0.005;
    return pl;
  }

  // Где на машине фары (head) и фонари: по вершинам их сеток, отдельно слева и справа. Точка — наружный край: у сплошной
  // полосы (Zeekr) — её конец с фарой, у отдельных фар — сама фара.
  // outer — докуда по ширине доходит фонарь. Раньше точку брали в долях габаритов: блик висел в воздухе слева от
  // машины, огонь поворотника — за бампером (правка 2026-10-04, третий пакет).
  function lampSpots(c, head) {
    var inv = new T.Matrix4().copy(c.root.matrixWorld).invert(), M = new T.Matrix4(), pts = [[], []], minX = 0.02 * c.size.x;
    c.root.traverse(function (o) {
      if (!o.isMesh || !o.visible || !c.lamps.some(function (l) { return l.head === head && l.m === o.material; })) return;
      M.multiplyMatrices(inv, o.matrixWorld);
      eachVertex(o, M, function (v) { if (Math.abs(v.x) > minX) pts[v.x < 0 ? 0 : 1].push(v.x, v.y, v.z); });
    });
    var outer = 0;
    var spots = pts.map(function (a) {
      if (!a.length) return null;
      var maxX = 0, i;
      for (i = 0; i < a.length; i += 3) maxX = Math.max(maxX, Math.abs(a[i]));
      outer = Math.max(outer, maxX);
      // середина кончика фонаря — крайних ~5 см по ширине, по всем трём осям: у полосы, загнутой на бок (Zeekr), самая
      // передняя точка края висела в воздухе перед углом кузова, а широкий срез захватывал отражатели в бампере —
      // огонь вставал между ними, на пустой кузов
      var p = new T.Vector3(), n = 0;
      for (i = 0; i < a.length; i += 3) if (Math.abs(a[i]) > maxX - 0.035 * c.size.x) { p.x += a[i]; p.y += a[i + 1]; p.z += a[i + 2]; n++; }
      return p.divideScalar(n);
    });
    return { spots: spots, outer: outer };
  }

  // Блики-спрайты на кончиках фар убраны (правка 2026-10-05: «свечение фар — ерунда») — ореол даёт свечение (bloom) по форме самой фары.

  function buildCar(id, gltf) {
    var cfg = Object.assign({ paint: '^Paint', wheels: '^Wheel(Front|Rear)[LR]$', head: '^Headlight$', tail: '^Brakelight$', wheelRadius: 0.36, yaw: 0, paintProps: null, lampBase: { head: 0.15, tail: 0.3 } }, LIB[id].model || {});
    var c = { id: id, cfg: cfg, root: new T.Group(), size: new T.Vector3(), paints: [], lamps: [], hubs: [],
      angle: 0, last: null, pos: new T.Vector2(), yaw: 0, lastYaw: 0, steer: 0, anim: null, color: new T.Color(paintHex),
      sweep: { value: 1.3 }, inv: { value: new T.Matrix4() }, half: { value: 1 }, sig: { value: new T.Vector2() }, outerHead: { value: 1 }, outerTail: { value: 1 },
      wave: { old: { value: new T.Color(paintHex) }, front: { value: -1e4 }, band: { value: 0 }, t0: -1 } };
    var model = gltf.scene;
    model.rotation.y = cfg.yaw;            // нос машины — в +Z, как ждут ракурсы секций
    model.updateMatrixWorld(true);
    var box = new T.Box3().setFromObject(model);
    // общий масштаб зала: длина машины в метрах (cfg.length) × 0,717 — как у первой модели (Zeekr 7X: 4,825 м → 3,46)
    c.scale = cfg.length ? cfg.length * 0.717 / (box.max.z - box.min.z) : 1;
    model.scale.multiplyScalar(c.scale); model.updateMatrixWorld(true);
    box.setFromObject(model);
    var ctr = box.getCenter(new T.Vector3());
    box.getSize(c.size);
    c.half.value = c.size.x / 2;
    model.position.set(-ctr.x, -box.min.y, -ctr.z);
    c.root.add(model); c.root.updateMatrixWorld(true);
    if (cfg.lampBoxes) splitLamps(model, cfg.lampBoxes);
    if (cfg.shadeBoxes) splitLamps(model, cfg.shadeBoxes.map(function (g) { return Object.assign({ lamp: 'cabin' }, g); }));
    if (cfg.trimBoxes) splitLamps(model, cfg.trimBoxes.map(function (g) { return Object.assign({ lamp: 'trim' }, g); }));
    setupWheels(c, model, cfg);
    var windows = new Map(), wb = new T.Box3(), paintRx = new RegExp(cfg.paint);
    // matFix — материал целиком другого цвета, чем у настоящей машины: у Xiaomi SU7 отделка окон, полоса над лобовым
    // стеклом, пороги и губа бампера были белыми (у настоящей — чёрные), машина выглядела «игрушечной» (правка 2026-10-04,
    // четвёртый пакет). Колёса уже со своими копиями материалов — их не трогает.
    var fixes = (cfg.matFix || []).map(function (f) { return { rx: new RegExp(f.materials), set: f.set, done: new Map() }; });
    model.traverse(function (o) {
      if (o.isMesh && o.material) {
        fixes.forEach(function (f) {
          if (!f.rx.test(o.material.name || '')) return;
          var fm = f.done.get(o.material);
          if (!fm) { fm = o.material.clone(); setProps(fm, f.set); f.done.set(o.material, fm); f.done.set(fm, fm); }
          o.material = fm;
        });
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach(function (k) { if (o.material[k]) o.material[k].anisotropy = aniso; });
        var n = o.material.name || '';
        // Стёкла. Окна (выше середины кузова) — тёмная тонировка с отражениями студии: салон едва виден, как у настоящей
        // машины на фото (правка 2026-10-04: светлые сиденья за прозрачным стеклом делали машину «игрушечной»).
        // Стекло фар — светлое и прозрачное, чтобы фары было видно. Вместо прохода «пропускания» — обычная полупрозрачность.
        // Окно — стекло выше середины кузова и не у самого носа или кормы: стекло фар Zeekr тоже выше середины, его
        // делали тёмной тонировкой, и фары горели за чёрным стеклом — «неестественные» (правка 2026-10-04, третий пакет).
        var glassy = o.material.transmission > 0 || (o.material.transparent && o.material.opacity < 0.95);
        if (glassy && !paintRx.test(n)) {
          wb.setFromObject(o).getCenter(tv);
          if (tv.y > c.size.y * 0.45 && Math.abs(tv.z) < c.size.z * 0.36) {
            var wm = windows.get(o.material);
            if (!wm) { wm = new T.MeshStandardMaterial({ name: n + '-window', color: '#05070a', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.88, depthWrite: false, side: o.material.side, envMapIntensity: 2.2 }); windows.set(o.material, wm); }
            o.material = wm; return;
          }
          if (o.material.transmission > 0) { o.material.transmission = 0; o.material.transparent = true; o.material.opacity = 0.3; o.material.depthWrite = false; o.material.color.set('#d4dae2'); o.material.roughness = 0.03; o.material.metalness = 0; }
        }
        if (paintRx.test(n)) {
          // лак: металлик под прозрачным верхним слоем (clearcoat) — нужен «физический» материал
          if (cfg.paintProps && !o.material.isMeshPhysicalMaterial) {
            var pm = c.paints.filter(function (m) { return m.name === n; })[0];
            o.material = pm || new T.MeshPhysicalMaterial({ name: n, color: o.material.color, side: o.material.side });   // двусторонний кузов (BYD, Tiggo) остаётся двусторонним
          }
          if (c.paints.indexOf(o.material) < 0) {
            if (cfg.paintProps) Object.assign(o.material, cfg.paintProps);
            o.material.color.set(paintHex); wavePatch(o.material, c.wave); c.paints.push(o.material);
          }
        }
        var isHead = new RegExp(cfg.head).test(n), isTail = new RegExp(cfg.tail).test(n);
        if ((isHead || isTail) && !c.lamps.some(function (l) { return l.m === o.material; })) {
          o.material.emissive = new T.Color(isHead ? '#eef3ff' : '#ff2a1a');   // фары — холодный белый, как у светодиодов
          lampPatch(o.material, c, isHead);
          c.lamps.push({ m: o.material, head: isHead, base: isHead ? cfg.lampBase.head : cfg.lampBase.tail, boost: isHead ? 6 : 3 });
        }
      }
    });
    if (shadows) c.root.traverse(function (o) { if (o.isMesh && o.material && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
    // неподвижные детали кузова и детали каждого колеса — склеить по материалам (меньше вызовов отрисовки)
    c.root.updateMatrixWorld(true);
    mergeStatic(model);
    c.hubs.forEach(function (hb) { mergeStatic(hb.hub); mergeStatic(hb.knuckle); });
    // точки кузова для кадра первого экрана (fitBand): до ~1500 вершин непрозрачных деталей, в координатах машины
    var pts = [], all = 0, inv = new T.Matrix4().copy(c.root.matrixWorld).invert(), PM = new T.Matrix4();
    c.root.traverse(function (o) { if (o.isMesh && o.visible && !o.material.transparent) all += o.geometry.attributes.position.count; });
    var step = Math.max(1, Math.floor(all / 1500));
    c.root.traverse(function (o) {
      if (!o.isMesh || !o.visible || o.material.transparent) return;
      PM.multiplyMatrices(inv, o.matrixWorld);
      var pos = o.geometry.attributes.position;
      for (var i = 0; i < pos.count; i += step) { tv.fromBufferAttribute(pos, i).applyMatrix4(PM); pts.push(tv.x, tv.y, tv.z); }
    });
    c.pts = new Float32Array(pts);
    var heads = lampSpots(c, true), tails = lampSpots(c, false);
    c.outerHead.value = heads.outer / c.half.value || 1; c.outerTail.value = tails.outer / c.half.value || 1;
    // контактная тень (под шинами — плотная) и мягкое пятно вокруг; свет фар на полу и поворотники едут вместе с машиной
    c.root.add(contactShadow(c));
    var sh = onFloor(new T.Mesh(new T.PlaneGeometry(c.size.x + 1.4, c.size.z + 0.8), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 })));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.004; c.root.add(sh);
    c.beam = new T.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, opacity: 0, blending: T.AdditiveBlending });
    var bm = onFloor(new T.Mesh(new T.PlaneGeometry(1, 1), c.beam));
    bm.rotation.x = -Math.PI / 2; bm.position.set(0, 0.006, c.size.z * 0.92); bm.scale.set(c.size.x * 1.5, c.size.z * 0.85, 1); c.root.add(bm);
    // поворотники: светится наружный край фары и фонаря (lampPatch), рядом — небольшой ореол, закрытый кузовом с другой стороны
    c.signals = [];
    [[heads, 1], [tails, -1]].forEach(function (pair) {
      [-1, 1].forEach(function (side, i) {
        var p = pair[0].spots[i] || new T.Vector3(side * c.size.x * 0.42, c.size.y * 0.5, pair[1] * c.size.z * 0.47);
        var s = new T.Sprite(new T.SpriteMaterial({ map: signalTex, transparent: true, depthWrite: false, opacity: 0, blending: T.AdditiveBlending }));
        s.position.set(p.x + side * 0.03, p.y, p.z + pair[1] * 0.02); s.scale.set(0.24, 0.24, 1); s.userData.side = side;
        c.root.add(s); c.signals.push(s);
      });
    });
    // слои для свечения: 3 — фары и фонари, 4 — непрозрачные детали, которые их закрывают (renderBloom)
    c.root.traverse(function (o) {
      if (!o.isMesh || !o.layers.isEnabled(0)) return;
      if (c.lamps.some(function (l) { return l.m === o.material; })) o.layers.enable(3);
      else if (!o.material.transparent) o.layers.enable(4);
    });
    return c;
  }

  function loadCar(id, done, failed) {
    if (cars[id]) { done(cars[id]); return; }
    (pending[id] = pending[id] || []).push({ done: done, failed: failed });
    if (pending[id].length > 1) return;
    function finish(c) { var l = pending[id]; delete pending[id]; l.forEach(function (p) { c ? p.done(c) : p.failed(); }); }
    function parse() {
      var raw = atob(LIB[id].b64), buf = new Uint8Array(raw.length);
      for (var k = 0; k < raw.length; k++) buf[k] = raw.charCodeAt(k);
      loader.parse(buf.buffer, '', function (g) { cars[id] = buildCar(id, g); finish(cars[id]); }, function () { finish(null); });
    }
    fetchLib(id, function () { LIB[id] ? parse() : finish(null); });
  }
  // файл модели (assets/models/<id>.js кладёт данные в LIB) — один раз, без разбора: разбор — в loadCar
  var fetching = {};
  function fetchLib(id, cb) {
    if (LIB[id]) { cb(); return; }
    if (fetching[id]) { fetching[id].push(cb); return; }
    fetching[id] = [cb];
    var s = document.createElement('script'); s.src = modelsPath + id + '.js';
    s.onload = s.onerror = function () { var l = fetching[id]; delete fetching[id]; l.forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }

  function paintTo(c, hex, instant) {
    c.wave.old.value.copy(c.color);
    c.color.set(hex);
    c.paints.forEach(function (m) { m.color.copy(c.color); });
    if (instant || reduce) { c.wave.front.value = -1e4; c.wave.band.value = 0; c.wave.t0 = -1; }
    else c.wave.t0 = performance.now();
  }
  // Смена машины по дуге (x, z на полу; нос — по касательной). Пути строятся от камеры: F — от камеры к машине по полу,
  // R — вправо в кадре. Старая чуть проезжает вперёд и уходит вправо, чуть вглубь (на компьютере — за список моделей);
  // новая заезжает слева из глубины зала и встаёт в луч носом вперёд (+Z). Ни одна не едет на камеру — при ракурсе
  // спереди (правка 2026-10-04) прежний путь «вперёд с поворотом» проносил старую машину через весь кадр.
  function bez(a, b, c, t, out) { var u = 1 - t; return out.set(u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]); }
  function swapAt() {
    var fl = Math.hypot(camera.position.x, camera.position.z) || 1, F = [-camera.position.x / fl, -camera.position.z / fl], R = [-F[1], F[0]];
    return function (r, f) { return [R[0] * r + F[0] * f, R[1] * r + F[1] * f]; };
  }
  // Новая трогается сразу, без паузы (правка 2026-10-07: «задержка, пока выбранное авто выедет»; было +0,6 с): уходящая
  // уезжает быстрее (0,9 с, разгон мягче), новая плавно разгоняется и тормозит (1,8 с). Расчёт по прямоугольникам машин:
  // зазор между ними на всём пути не меньше 2 м (было 0,5 м; шестой пакет — машины проезжали друг сквозь друга).
  // Старая начинает уезжать уже в момент нажатия (beginLeave), пока новая догружается, — отклик мгновенный.
  function beginLeave() {
    if (!active || reduce || (active.anim && active.anim.out) || active.gone) return;
    var L = sizeCam.z, at = swapAt();
    active.anim = { path: [[0, 0], [0, L * 0.6], at(L + 4, L * 0.6)], t0: performance.now(), dur: 900, out: true, ease: easeIn2 };
    start();
  }
  function swapTo(c) {
    var now = performance.now(), L = sizeCam.z, at = swapAt();
    if (active && active !== c) {
      if (reduce || active.gone) scene.remove(active.root);
      else {
        if (!(active.anim && active.anim.out)) active.anim = { path: [[0, 0], [0, L * 0.6], at(L + 4, L * 0.6)], t0: now, dur: 900, out: true, ease: easeIn2 };
        leaving.push(active);
      }
    }
    leaving = leaving.filter(function (x) { return x !== c; });
    var arriving = !!active && !reduce;
    c.gone = false; c.root.visible = true;
    c.anim = arriving ? { path: [at(-(L + 3), L * 1.2), [0, -L * 0.8], [0, 0]], t0: now, dur: 1800, ease: easeInOut } : null;
    c.pos.set(0, 0); c.yaw = 0; c.last = null;
    if (c.anim) bez(c.anim.path[0], c.anim.path[1], c.anim.path[2], 0, c.pos);
    if (!c.root.parent) scene.add(c.root);
    active = c;
    start();
  }

  // ---------- ключевые состояния секций ----------
  // Вторая подача (DESIGN.md): close — доля обычного расстояния камеры (крупный план < 1), lookX/lookZ — точка взгляда на кузове
  // (доли размера машины); cT/cR/cB/cL — «окно» холста (доли экрана от краёв), cRad — скругление окна; bg — фон страницы
  // за холстом, sky1/sky2 и skyK — фон самого холста (центр → края); reel — монтаж планов по времени; speed — машина «на скорости»;
  // cool — холодный свет; pool — пятно света на полу; carZ — сдвиг машины вперёд-назад (в длинах машины).
  // intro — вес «окна» первого экрана (1 — окно поднимается и раскрывается по времени после прелоадера, см. frame).
  // Второй пакет правок 2026-10-04: sil — «силуэт»: свет
  // зала гаснет, остаётся контровой (машину ещё ищут — «Оплата», этап 1); ignite — когда блок встал на экран, фары
  // «зажигаются» (заявка). route больше 1 — машина проехала конец линии на (route − 1) своих длин: уезжает за кадр.
  var DEF = { az: 38, el: 6, fit: 0.6, fitH: 0.5, shiftX: 0, shiftY: 0, lookY: 0.45, dim: 1, lights: 0, amb: 1, route: null, intro: 0,
    close: 1, lookX: 0, lookZ: 0, cT: 0, cR: 0, cB: 0, cL: 0, cRad: 0, reel: 0, speed: 0, cool: 0, pool: 1, carZ: 0, skyK: 0,
    sil: 0, ignite: 0, bandK: 0, bandT: 0, bandB: 1, bg: '#0b0e16', sky1: '#000000', sky2: '#000000' };
  var NUM = ['el', 'fit', 'fitH', 'shiftX', 'shiftY', 'lookY', 'dim', 'lights', 'amb', 'close', 'lookX', 'lookZ', 'cT', 'cR', 'cB', 'cL', 'cRad', 'reel', 'speed', 'cool', 'pool', 'carZ', 'skyK', 'intro', 'sil', 'ignite', 'bandK', 'bandT', 'bandB'];
  var COLORS = ['bg', 'sky1', 'sky2'];
  function rgbOf(hex) { var n = parseInt(String(hex).replace('#', ''), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function withColors(v) { COLORS.forEach(function (k) { v[k + 'C'] = rgbOf(v[k]); }); return v; }
  var keys = [];
  function parseAttr(el, attr) { try { return JSON.parse(el.getAttribute(attr)); } catch (e) { return {}; } }
  function collect() {
    keys = [];
    var prev = Object.assign({}, DEF), phone = phoneMq.matches;
    document.querySelectorAll('[data-scene]').forEach(function (el) {
      var r = el.getBoundingClientRect(), top = r.top + scrollY;
      [['data-scene', top], ['data-scene-end', top + r.height - innerHeight]].forEach(function (p) {
        if (!el.hasAttribute(p[0])) return;
        var o = parseAttr(el, p[0]), v = Object.assign({}, prev, o, phone && o.phone ? o.phone : {});
        delete v.phone;
        // at: [[ширина, {...}], …] — ракурс для компьютера не шире заданной ширины (правка 2026-10-07, адаптивы 1366–1100:
        // машину на средних экранах меняем, не трогая принятые 1520–1920); идут по порядку, более узкий — последним
        if (!phone && o.at) o.at.forEach(function (a) { if (innerWidth <= a[0]) Object.assign(v, a[1]); });
        delete v.at;
        // band: [верхний, нижний] — машина вписывается в свободную полосу между двумя элементами секции (на любом экране)
        // Только у своей секции: band не наследуется следующими (раньше наследовался, но в чужих секциях его элементы
        // не находились; с поиском шапки по всей странице он стал двигать камеру во всех блоках — правка 2026-10-06).
        var band = v.band; delete v.band;
        v.bandK = 0;   // полоса — только у своей секции: bandK тоже не наследуется (иначе машину поднимало в «45–60 дней», правка 2026-10-06)
        if (band && (o.band || (phone && o.phone && o.phone.band)) && p[0] === 'data-scene') {
          // элемент ищется в секции, иначе на странице: шапка сайта — общий закреплённый блок вне секции, её край — от верха
          // экрана, а не секции (иначе полоса зависела бы от прокрутки в момент пересчёта)
          var ta = el.querySelector(band[0]) || document.querySelector(band[0]), tb = el.querySelector(band[1]) || document.querySelector(band[1]);
          if (ta && tb) {
            var edge = function (e, side) { var b = e.getBoundingClientRect()[side]; return el.contains(e) ? b - r.top : b; };
            var vh = innerHeight, top = edge(ta, 'bottom') + Math.max(16, 0.04 * vh), bot = edge(tb, 'top') - 16;
            v = Object.assign({}, v, { fitH: Math.min(v.fitH, Math.max(0.15, (bot - top) / vh * 0.92)), shiftY: ((top + bot) / 2 - vh / 2) / vh, lookY: 0.5,
              bandK: 1, bandT: top / vh, bandB: bot / vh });
          }
        }
        if (!('route' in o)) v.route = null;
        withColors(v);
        keys.push({ y: Math.max(0, p[1]), s: v, el: el });
        prev = v;
      });
    });
    keys.sort(function (a, b) { return a.y - b.y; });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAngle(a, b, t) { var d = ((b - a) % 360 + 540) % 360 - 180; return a + d * t; }
  function smooth(e0, e1, x) { x = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return x * x * (3 - 2 * x); }
  function stateAt(y) {
    if (!keys.length) return withZ(withColors(Object.assign({}, DEF)));
    if (y <= keys[0].y) return withZ(keys[0].s);
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (y < b.y) {
        var raw = (y - a.y) / Math.max(1, b.y - a.y);
        var drive = a.s.route != null && b.s.route != null;
        var t = drive ? raw : smooth(0.3, 1, raw);   // держим ракурс, пока секция читается; меняем на подходе следующей
        var s = {};
        NUM.forEach(function (k) { s[k] = lerp(a.s[k], b.s[k], t); });
        COLORS.forEach(function (k) { var ca = a.s[k + 'C'], cb = b.s[k + 'C']; s[k + 'C'] = [lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)]; });
        s.az = lerpAngle(a.s.az, b.s.az, t);
        s.z = lerp(zFor(a.s), zFor(b.s), t);
        s.driving = drive;
        return s;
      }
    }
    return withZ(keys[keys.length - 1].s);
  }
  function withZ(s) { var o = Object.assign({}, s); o.z = zFor(s); o.driving = false; return o; }

  // ---------- маршрут: машина едет по линии вместе с прокруткой ----------
  var routeStage = document.querySelector('[data-route-stage]');
  var routeMap = { z0: 0, z1: 1 };   // z машины, когда она у первой и у последней остановки
  // route 0 — машина целиком в кадре, корма у начала линии; route 1 — нос у конца линии (Минск); больше 1 — проехала дальше
  // на (route − 1) своих длин и ушла за край кадра (правка 2026-10-04)
  function zFor(s) {
    if (s.route == null) return 0;
    var dir = Math.sign(routeMap.z1 - routeMap.z0) || 1, a = routeMap.z0 + dir * sizeCam.z / 2, b = routeMap.z1 - dir * sizeCam.z / 2;
    return s.route <= 1 ? lerp(a, b, s.route) : b + dir * (s.route - 1) * sizeCam.z;
  }
  function measureRoute() {
    if (!routeStage) return;
    var rk = keys.filter(function (k) { return k.s.route != null; })[0];
    if (!rk) return;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    applyCamera(Object.assign({}, rk.s, { z: 0 }), 0, w, h);
    camera.updateMatrixWorld();
    var p0 = new T.Vector3(0, 0, 0).project(camera), p1 = new T.Vector3(0, 0, 1).project(camera);
    // линия — под шинами ближнего к зрителю борта, с зазором: по середине машины (x = 0) в перспективе она проходила
    // через нижнюю часть ближних колёс — «подними авто над линией» (правка 2026-10-06)
    var pn = new T.Vector3(Math.sign(camera.position.x || 1) * sizeCam.x / 2, 0, 0).project(camera);
    var x0 = (p0.x + 1) / 2 * w, x1 = (p1.x + 1) / 2 * w, floorY = Math.max((1 - p0.y) / 2 * h, (1 - pn.y) / 2 * h) + 8;
    var line = routeStage.querySelector('[data-route-line]');
    routeStage.style.setProperty('--floor-y', Math.round(floorY) + 'px');
    if (!line) return;
    var lr = line.getBoundingClientRect(), from = lr.left + 4, to = lr.right - 4;
    var dx = (x1 - x0) || 1;
    routeMap.z0 = (from - x0) / dx; routeMap.z1 = (to - x0) / dx;
  }

  // ---------- камера ----------
  function applyCamera(s, extraAz, w, h) {
    var size = sizeCam;
    camera.aspect = w / h;
    var a = (s.az + extraAz) * Math.PI / 180, e = s.el * Math.PI / 180;
    var span = Math.abs(Math.sin(a)) * size.z + Math.abs(Math.cos(a)) * size.x;
    var vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    // расстояние: машина занимает долю ширины кадра (fit) и не больше доли высоты (fitH) — на низких окнах не наезжает на текст
    var depth = Math.abs(Math.cos(a)) * size.z + Math.abs(Math.sin(a)) * size.x;
    var vspan = size.y * Math.cos(e) + depth * Math.sin(Math.abs(e));
    var d = (Math.max((span / s.fit) / 2 / Math.tan(hfov / 2), (vspan / (s.fitH || 0.5)) / 2 / Math.tan(vfov / 2)) + size.z * 0.25) * (s.close || 1);
    camera.setViewOffset(w, h, -w * s.shiftX, -h * s.shiftY, w, h);
    camera.updateProjectionMatrix();
    // крупный план: камера подходит к точке на кузове (lookX/lookZ) и опускается к её высоте; при close = 1 и нулевых
    // lookX/lookZ — прежний облёт вокруг центра машины
    var lx = size.x * (s.lookX || 0), ly = size.y * s.lookY, lz = size.z * (s.lookZ || 0), near = 1 - Math.min(1, s.close || 1);
    camera.position.set(lx + Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d + 0.3 + (ly - 0.3) * near, lz + Math.cos(a) * Math.cos(e) * d);
    camera.lookAt(lx, ly, lz);
  }

  // Машина в полосе первого экрана (band) — по тому, что видно на самом деле: если машина целиком помещается в полосу,
  // она стоит колёсами на её нижнем крае (над заголовком, на телефоне — над панелью); крупный план, который больше
  // полосы, начинается крышей под шапкой и уходит вниз за заголовок. Прежде полоса ставила в свой центр точку взгляда:
  // на крупных планах крыша уходила под шапку и за край экрана, целая машина висела под шапкой — «машина слишком
  // высоко, иногда не помещается в экран» (правка 2026-10-06, седьмой пакет). Высота — по вершинам кузова, видимым в кадре.
  var vp = new T.Vector3();
  function fitBand(s, w, h) {
    if (!(s.bandK > 0.001) || !active || !active.pts) return;
    var P = active.pts, M = active.root.matrixWorld, minY = 1e9, maxY = -1e9;
    active.root.updateMatrixWorld();
    for (var i = 0; i < P.length; i += 3) {
      vp.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(M).applyMatrix4(camera.matrixWorldInverse);
      if (vp.z > -camera.near) continue;                 // за камерой (крупный план)
      vp.applyMatrix4(camera.projectionMatrix);
      if (vp.x < -1.05 || vp.x > 1.05) continue;           // за краем кадра по бокам — на высоту в кадре не влияет
      var y = (1 - vp.y) / 2;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (maxY < minY) return;
    var dy = (Math.max(s.bandT, s.bandB - (maxY - minY)) - minY) * s.bandK;
    if (Math.abs(dy) < 1e-5) return;
    s.shiftY += dy;
    camera.setViewOffset(w, h, -w * s.shiftX, -h * s.shiftY, w, h);
    camera.updateProjectionMatrix();
  }

  // Качество под видеокарту: если кадры подряд идут дольше ~24 мс (меньше ~42 кадров в секунду), картинка рисуется
  // в меньшем разрешении, со второй ступени — без отражения в полу. Только вниз и не чаще раза в 2,5 с; снимки проверки
  // и reduce — без подстройки (правка 2026-10-04, третий пакет: «сайт тяжёлый, зависает»).
  // Первые 4 с после раскрытия не считаем (страница ещё догружается), ступень вниз — после двух медленных отрезков подряд.
  var quality = { level: 0, scale: 1, n: 0, sum: 0, prev: 0, at: 0, slow: 0 }, QSCALE = [1, 0.85, 0.72, 0.6];
  function govern(now, continuous) {
    if (still || reduce || quality.level >= QSCALE.length - 1 || !openT || now - openT < 4000) return;
    var d = now - quality.prev; quality.prev = now;
    if (!continuous || d > 120 || d <= 0 || away()) { quality.n = quality.sum = 0; return; }   // пауза, фоновая вкладка, сборка шейдера
    quality.n++; quality.sum += d;
    if (quality.n < 50) return;
    var avg = quality.sum / quality.n; quality.n = quality.sum = 0;
    quality.slow = avg > 24 ? quality.slow + 1 : 0;
    if (quality.slow >= 2 && now - quality.at > 2500) { quality.slow = 0; quality.level++; quality.scale = QSCALE[quality.level]; quality.at = now; layout(); }
  }

  function layout() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    // плотность ≤2 (телефон ≤1,5) и не больше ~4,5 млн пикселей на кадр (2560×1760) — защита от огромных окон и мониторов
    var pr = Math.min(devicePixelRatio, phoneMq.matches ? 1.5 : 2, Math.sqrt(4.5e6 / Math.max(1, w * h))) * quality.scale;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    if (mirror) { mirror.rt.setSize(Math.max(16, Math.round(w * pr / 4)), Math.max(16, Math.round(h * pr / 4))); renderer.getDrawingBufferSize(mirror.mat.uniforms.uRes.value); }
    collect();
    measureRoute();
  }

  // ---------- эффекты света: «зажигание» и моргание фар, вспышки фотоотчёта, поворотник перед маршрутом, стоп-сигналы ----------
  // ign — момент «зажигания» (мс): ходовой огонь прорисовывается от центра к краям 0,7 с, на 0,55–0,8 с — вспышка с ореолом,
  // дальше ровный свет; photo — серия вспышек фотоотчёта («Оплата», этап 2)
  var fx = { blink: -1e4, ign: -1e4, ignited: false, photo: -1e4, signal: -1e4, brakeUntil: 0, brake: 0, speed: 0, wasDriving: false, prevZ: null, blinkV: 0, signalV: 0, shot: -2 };
  var PHOTO = [0, 0.34, 0.58, 1.08, 1.3];   // моменты вспышек, с
  var reel = { on: false, t: 0 }, speedT = 0;

  // фон страницы за холстом, фон холста и «окно» — меняются только при изменении (без лишней перерисовки страницы).
  // Фон — отдельный закреплённый слой под холстом: смена цвета у body перерисовывала всю видимую страницу каждый кадр перехода.
  var css = { bg: '', sky: '', clip: '', op: '' };
  var bgLayer = document.createElement('div');
  bgLayer.className = 'showroom-bg'; bgLayer.setAttribute('aria-hidden', 'true');
  canvas.parentNode.insertBefore(bgLayer, canvas);
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a.toFixed(3) + ')'; }
  function pc(v) { return (v * 100).toFixed(2) + '%'; }
  function applyCss(s) {
    var bg = rgba(s.bgC, 1);
    if (bg !== css.bg) bgLayer.style.backgroundColor = css.bg = bg;
    var sky = s.skyK > 0.004 ? 'radial-gradient(120% 95% at 50% 40%, ' + rgba(s.sky1C, s.skyK) + ', ' + rgba(s.sky2C, s.skyK) + ')' : '';
    if (sky !== css.sky) canvas.style.background = css.sky = sky;
    var clip = s.cT + s.cR + s.cB + s.cL > 0.0004 ? 'inset(' + pc(s.cT) + ' ' + pc(s.cR) + ' ' + pc(s.cB) + ' ' + pc(s.cL) + ' round ' + s.cRad.toFixed(1) + 'px)' : '';
    if (clip !== css.clip) canvas.style.clipPath = css.clip = clip;
  }
  function blinkAt(ms) { return (ms >= 0 && ms < 230) || (ms >= 420 && ms < 650) ? 1 : 0; }               // двойное моргание
  function signalAt(ms) { return ms >= 0 && ms < 2400 && (ms % 800) < 420 ? 1 : 0; }                         // три мигания поворотника
  function flashLights() { var now = performance.now(); if (!reduce && ready && now - fx.blink > 1500) { fx.blink = now; start(); } }

  // ---------- цикл: работает, пока есть движение; «атмосфера» — до 30 кадров в секунду ----------
  var ease = function (t) { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeIn = function (t) { t = Math.min(1, Math.max(0, t)); return t * t * t; };
  var easeOut = function (t) { t = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - t, 3); };
  var easeIn2 = function (t) { t = Math.min(1, Math.max(0, t)); return t * t; };
  var easeInOut = function (t) { t = Math.min(1, Math.max(0, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2; };
  var dbg = {};
  var ready = false, t0 = 0, last = 0, lastDraw = 0, running = false, ys = scrollY, ambT = 10;
  // прелоадер первого экрана: до hero:open холст не рисует; openT — момент раскрытия окна
  var opened = !html.classList.contains('hero-wait'), openT = 0;
  // отражение плавно гаснет и проявляется при смене качества (quality)
  var mirrorK = 1;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0, seen: false }, torchK = 0, lastInput = performance.now(), scrollT = -1e4;

  function frame(now) {
    // анкета «Рассчитать под ключ» открыта — сцена под ней не рисуется вовсе (правка 2026-10-06: монтаж первого экрана
    // рисовался под выезжающим листом и сбивал его кадры); закрытие анкеты продолжает сцену (brief.js → relayout)
    if (html.classList.contains('has-brief')) { running = false; last = 0; return; }
    if (!t0) t0 = now;
    var dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    var t = reduce ? 99 : (now - t0) / 1000;
    // инерция прокрутки ~0,25 с; с плавной прокруткой страницы (Lenis, smooth.js) колесо уже сглажено — догоняем быстрее
    var k = reduce ? 1 : 1 - Math.exp(-dt / (html.classList.contains('lenis') ? 0.06 : 0.16));
    ys += (scrollY - ys) * k;
    if (Math.abs(scrollY - ys) < 0.5) ys = scrollY;
    var km = reduce ? 1 : 1 - Math.exp(-dt / 0.2);
    mouse.x += (mouse.tx - mouse.x) * km; mouse.y += (mouse.ty - mouse.y) * km;

    var s = stateAt(ys);
    var fixed = reduce || still;   // снимки проверки и reduce: монтаж стоит на одном плане, полосы скорости не движутся

    // монтаж планов («Появление»): пока блок на экране, камера меняет планы по времени; смена — короткий провал в темноту
    var reelW = s.reel, shotI = -1, cutK = 1, R = null;
    // Монтаж режет планы, только пока первый экран стоит целиком и страницу не крутят: смена плана посреди прокрутки
    // к «Почему из Китая» перескакивала камерой на другой план — «скачок в анимации» (правка 2026-10-05). Пока крутят,
    // план держится, «провал в темноту» гаснет, и камера плавно уходит в профиль.
    var reelRun = !fixed && !away() && reelW > 0.999 && now - scrollT > 300;
    if (reelW > 0.001) {
      if (!reel.on) { reel.on = true; reel.t = 0; reel.cut = 1; }   // каждый вход в блок — с первого плана
      if (reelRun) reel.t += dt;
      var ts;
      if (fixed) { shotI = REEL.length - 1; ts = REEL[shotI].dur / 2; }
      else { ts = reel.t % REEL_T; shotI = 0; while (ts >= REEL[shotI].dur) { ts -= REEL[shotI].dur; shotI++; } }
      R = REEL[shotI];
      var D = R.dur, sp = ts / D;
      s.az = lerpAngle(s.az, R.az + R.drift * (sp - 0.5), reelW);
      s.el = lerp(s.el, R.el, reelW);
      s.close = lerp(s.close, R.close * (1.04 - 0.08 * sp), reelW);   // медленный наезд внутри плана
      s.lookX = lerp(s.lookX, R.lookX, reelW); s.lookY = lerp(s.lookY, R.lookY, reelW); s.lookZ = lerp(s.lookZ, R.lookZ, reelW);
      if (!fixed) {
        reel.cut = reelRun ? Math.min(ease(ts / 0.22), 1 - ease((ts - (D - 0.14)) / 0.14)) : reel.cut + (1 - reel.cut) * (1 - Math.exp(-dt / 0.15));
        cutK = lerp(1, reel.cut, reelW);
      }
      // фары и фонари разгораются в каждом плане; в планах с «зажиганием» (фара, анфас) — темно, пока фары не зажглись
      s.lights = R.ign && !fixed ? (ts >= R.ign || now >= fx.ign ? reelW : 0) : Math.max(s.lights, reelW * (fixed ? 1 : 0.25 + 0.75 * Math.max(ease(ts / 0.7), reelRun ? 0 : 1)));
    } else reel.on = false;
    // окно первого экрана: поднимается снизу с полями по бокам (1,2 с) и раскрывается на весь экран (1,0–1,9 с)
    var introMoving = false;
    if (s.intro > 0.001) {
      var ot = fixed ? 99 : (now - openT) / 1000, rise = ease(ot / 1.2), full = ease((ot - 1) / 0.9), side = (phoneMq.matches ? 0.04 : 0.09) * (1 - full);
      s.cT = lerp(s.cT, 1 - rise, s.intro); s.cR = lerp(s.cR, side, s.intro); s.cL = lerp(s.cL, side, s.intro); s.cRad = lerp(s.cRad, 8 * (1 - full), s.intro);
      introMoving = ot < 1.95;
    }
    if (shotI !== fx.shot) {
      fx.shot = shotI; document.dispatchEvent(new CustomEvent('showroom:shot', { detail: { i: shotI, n: REEL.length } }));
      // руль нового плана — сразу, в «провале в темноту»: прежде колесо на глазах поворачивалось само в начале плана
      // «Колёса и шины» и обратно в «профиле» — «баг при анимации» колеса (правка 2026-10-05)
      if (reelW > 0.5) fx.snapSteer = true;
      if (R && R.ign && !fixed && reelW > 0.5) fx.ign = now + R.ign * 1000;
    }

    // включение света: контровой → луч → пол; cool — холодный свет «Появления»
    // sil — «силуэт»: свет зала гаснет, остаётся контровой по краю кузова
    var kRim = ease(t / 0.9), kKey = ease((t - 0.5) / 1.3), kFloor = ease((t - 1.1) / 1.3), sil = s.sil;
    rim.intensity = LIGHT.rim * kRim * (1 + 1.3 * s.cool) * (1 + 0.6 * sil); key.intensity = LIGHT.key * kKey * (1 - 0.99 * sil); fill.intensity = LIGHT.fill * kKey * (1 - sil);
    key.color.copy(WARM).lerp(COOL, s.cool);
    scene.environmentIntensity = LIGHT.env * kKey * (1 - 0.96 * sil); glowMat.opacity = kFloor * s.pool * (1 - 0.85 * sil);

    // «на скорости»: полосы огней и разметка бегут назад, колёса крутятся
    var spdRun = fixed || away() ? 0 : s.speed;
    speedFx.visible = s.speed > 0.01;
    if (speedFx.visible) {
      speedT += dt * spdRun;
      streaks.forEach(function (st) {
        var u = st.userData, z = wrap(u.z - speedT * 24 * u.k, -26, 26);
        st.position.z = z; st.material.opacity = u.a * s.speed * (1 - smooth(18, 26, Math.abs(z)));
      });
      dashes.forEach(function (dm) { dm.position.z = wrap(dm.userData.z - speedT * 24, -25, 25); });
      dashMat.opacity = 0.32 * s.speed;
    }
    var dolly = (1 - ease(t / 2.6)) * 1.6;

    // «зажигание» фар (как у rideradian.com): ходовой огонь прорисовывается от центра к краям, вспышка с ореолом заливает
    // кадр, потом ровный свет. Первый экран — в планах «фара» и «анфас»; заявка — когда блок встал на экран (ignite),
    // пока посетитель здесь — фары время от времени моргают; «Оплата» — на последнем этапе (событие pay:stage).
    if (s.ignite > 0.95 && s.dim > 0.6) { if (!fx.ignited) { fx.ignited = true; if (!fixed) fx.ign = now + 120; } }
    else if (s.ignite < 0.5) fx.ignited = false;
    if (fx.ignited && !fixed && now - lastInput < 20000 && now - fx.blink > 6500 && now - fx.ign > 6500) fx.blink = now;
    var ig = (now - fx.ign) / 1000, igOn = !reduce && ig > -0.8 && ig < 2.4;
    var igSweep = !igOn || ig >= 0.75 ? 1 : ig < 0 ? 0 : ease(ig / 0.75);
    var igFlash = igOn && ig > 0.5 ? (ig < 0.78 ? ease((ig - 0.5) / 0.28) : Math.exp(-(ig - 0.78) / 0.4)) : 0;
    // вспышки фотоотчёта — с разных сторон от камеры, как у фотографа, который обходит машину
    var ph = (now - fx.photo) / 1000, photoV = 0, photoI = 0;
    if (!reduce && ph > 0 && ph < 1.8) PHOTO.forEach(function (tk, i) { if (ph >= tk) { var v = Math.exp(-(ph - tk) / 0.07); if (v > photoV) { photoV = v; photoI = i; } } });

    // размер машины для кадра — плавно к новой машине
    var kz = reduce ? 1 : 1 - Math.exp(-dt / 0.35), sizeMoving = false;
    if (active) { sizeCam.lerp(active.size, kz); sizeMoving = sizeCam.distanceTo(active.size) > 0.002; if (!sizeMoving) sizeCam.copy(active.size); }
    if (sizeMoving) measureRoute();

    // смена машины: старая уезжает, новая заезжает в луч (по дуге — swapTo)
    var swapping = false;
    [active].concat(leaving).forEach(function (c) {
      if (!c || !c.anim) return;
      var p = Math.max(0, (now - c.anim.t0) / c.anim.dur), q = c.anim.ease ? c.anim.ease(p) : c.anim.out ? easeIn(p) : easeOut(p), P = c.anim.path;
      bez(P[0], P[1], P[2], Math.min(1, q), c.pos);
      var dx = 2 * (1 - q) * (P[1][0] - P[0][0]) + 2 * q * (P[2][0] - P[1][0]), dz = 2 * (1 - q) * (P[1][1] - P[0][1]) + 2 * q * (P[2][1] - P[1][1]);
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) c.yaw = Math.atan2(dx, dz);
      // уехавшая раньше, чем готова новая (beginLeave), — прячется за кадром, пока её не сменит новая
      if (p >= 1 && c.anim.out && c === active) { c.anim = null; c.gone = true; c.root.visible = false; }
      else if (p >= 1) { c.anim = null; c.pos.set(0, 0); c.yaw = 0; if (c === active) fx.blink = now; } else swapping = true;
    });
    leaving = leaving.filter(function (c) { if (!c.anim) { scene.remove(c.root); return false; } return true; });

    // фары и фонари
    var raw = blinkAt(now - fx.blink), kb = 1 - Math.exp(-dt / 0.045);
    fx.blinkV += (raw - fx.blinkV) * kb;
    if (s.driving && !fx.wasDriving && scrollY > ys - 1) fx.signal = now;   // въехали в маршрут сверху — мигнуть поворотником
    fx.wasDriving = s.driving;
    fx.signalV += (signalAt(now - fx.signal) - fx.signalV) * (1 - Math.exp(-dt / 0.06));
    var speed = fx.prevZ == null || !dt ? 0 : Math.abs(s.z - fx.prevZ) / dt; fx.prevZ = s.z;
    var sm = 1 - Math.exp(-dt / 0.12), prevSpeed = fx.speed; fx.speed += (speed - fx.speed) * sm;
    if (s.driving && dt && (prevSpeed - fx.speed) / dt > 0.35 && prevSpeed > 0.15) fx.brakeUntil = now + 900;   // тормозит — горят стоп-сигналы
    fx.brake += ((now < fx.brakeUntil ? 1 : 0) - fx.brake) * (1 - Math.exp(-dt / 0.12));
    var sideCam = camera.position.x >= 0 ? 1 : -1, glowK = 0;

    [active].concat(leaving).forEach(function (c) {
      if (!c) return;
      var mine = c === active, moving = !!c.anim;
      // кузов на «скорости» больше не трясётся вверх-вниз: машина «подпрыгивала» (правка 2026-10-04, третий пакет)
      c.root.position.set(c.pos.x, 0, s.z + c.pos.y + s.carZ * sizeCam.z); c.root.rotation.y = c.yaw;
      if (mine && spdRun) c.angle += spdRun * 14 * dt;
      // колёса: вращение — на пройденный путь (вперёд — плюс), вокруг центра своей шины; передние поворачиваются по
      // кривизне пути (угол = атан(база × рыскание на единицу пути)), стоя — прямо
      var ds = c.last ? Math.sin(c.yaw) * (c.root.position.x - c.last.x) + Math.cos(c.yaw) * (c.root.position.z - c.last.z) : 0;
      c.angle += ds / c.wheelR;
      var dyaw = ((c.yaw - c.lastYaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; c.lastYaw = c.yaw;
      // Руль — только на ходу и не больше ~7°; стоящая машина — колёса прямо, как на студийном фото. Арки у моделей тесные:
      // повёрнутое на 13–24° колесо вылезало из арки или уходило в кузов — в «Моделях», «Оплате», заявке и на первом
      // экране колёса выглядели сломанными (правки 2026-10-05 и 2026-10-06, седьмой пакет: «в одном месте чиним, в другом ломаются»)
      var steerTo = Math.abs(ds) > 1e-4 ? Math.max(-STEER_MAX, Math.min(STEER_MAX, Math.atan(c.base * dyaw / ds))) : moving ? c.steer : 0;
      c.steer += (steerTo - c.steer) * (reduce || (mine && fx.snapSteer) ? 1 : 1 - Math.exp(-dt / (moving ? 0.24 : 0.14)));
      c.last = (c.last || new T.Vector3()).copy(c.root.position);
      qSteer.setFromAxisAngle(AX_Y, c.steer); qSpin.setFromAxisAngle(AX_X, c.angle);
      c.hubs.forEach(function (hb) { var q = hb.front ? qSteer : qNone; hb.knuckle.quaternion.copy(q); hb.hub.quaternion.copy(q).multiply(qSpin); });
      // фары: во время «зажигания» — по его программе (до начала — погашены), иначе — сцена, моргание, движение
      var ignK = mine && igOn ? (ig < 0 ? 0 : 1 + 2.6 * igFlash) : -1;
      var head = ignK >= 0 ? ignK : Math.max(s.lights, mine ? fx.blinkV : 0, moving ? 0.55 : 0);
      var tail = Math.max(s.lights, mine ? fx.brake * 1.4 : 0, moving ? 0.6 : 0);
      c.sweep.value = mine && igOn ? lerp(-0.2, 1.3, igSweep) : 1.3;
      c.lamps.forEach(function (l) { l.m.emissiveIntensity = (l.head && ignK === 0 ? 0 : l.base) + l.boost * (l.head ? head : tail); });
      // свечение (bloom): горят фары или фонари; во время «зажигания» — вспышка ореола
      glowK = Math.max(glowK, Math.min(1.6, head) * (1 + 1.8 * (mine ? igFlash : 0)), 0.8 * Math.min(1.6, tail));
      c.beam.opacity = Math.max(s.lights, mine ? fx.blinkV * 0.7 : 0, moving ? 0.45 : 0, mine ? igFlash : 0);
      // поворотник — со стороны камеры: янтарный край фары и фонаря (lampPatch) и небольшой ореол
      c.sig.value.set(mine && sideCam < 0 ? 2.6 * fx.signalV : 0, mine && sideCam > 0 ? 2.6 * fx.signalV : 0);
      c.signals.forEach(function (sp) { sp.material.opacity = mine && sp.userData.side === sideCam ? 0.75 * fx.signalV : 0; });
      // волна краски
      if (c.wave.t0 >= 0) {
        var wp = (now - c.wave.t0) / 1300, we = ease(wp), nose = c.root.position.z + c.size.z / 2 + 0.3;
        c.wave.front.value = nose - we * (c.size.z + 0.6);
        c.wave.band.value = 2.4 * Math.sin(Math.PI * Math.min(1, wp));
        if (wp >= 1) { c.wave.t0 = -1; c.wave.front.value = -1e4; c.wave.band.value = 0; }
      }
    });
    glow.position.z = s.z;
    fx.snapSteer = false;

    // атмосфера зала: луч, пыль, туман — в зале, но не на маршруте
    var amb = s.amb * kKey;
    var ambOn = !reduce && !still && !away() && now - lastInput < 20000 && amb * s.dim > 0.02;
    if (ambOn) ambT += dt;
    shaftMat.uniforms.uK.value = 0.07 * amb;
    fog.forEach(function (sp, n) {
      var u = sp.userData;
      sp.position.x = u.x + Math.sin(ambT * 0.05 * u.sp + u.ph) * 0.9; sp.position.z = u.z + Math.cos(ambT * 0.04 * u.sp + u.ph) * 0.5;
      sp.rotation.z = Math.sin(ambT * 0.03 + n) * 0.08;
      sp.material.opacity = 0.18 * amb * kFloor;
    });
    fogOn = 0.18 * amb * kFloor > 0.003;

    // свет за курсором: блик скользит по кузову (компьютер, пока машина в зале и не едет)
    var torchTarget = hover && !reduce && mouse.seen ? kKey * smooth(0.6, 1, s.dim) * (1 - smooth(0, 0.5, 1 - s.amb)) : 0;
    torchK += (torchTarget - torchK) * (reduce ? 1 : 1 - Math.exp(-dt / 0.3));

    var heroWeight = Math.max(0, 1 - ys / Math.max(1, innerHeight));
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var cs = Object.assign({}, s, { fit: s.fit / (1 + dolly * 0.08) });
    applyCamera(cs, mouse.x * 5 * heroWeight, w, h);
    camera.updateMatrixWorld();
    fitBand(cs, w, h);
    // контровой — всегда за машиной относительно камеры (на 20° в сторону), в «силуэте» — точно за ней: светятся только края
    // кузова. Раньше он стоял на месте сзади-слева, и в блоке моделей (камера спереди-слева) холодный свет заливал весь бок
    // кузова и колёса синим — машины выглядели «игрушечными» (правка 2026-10-04, четвёртый пакет)
    var rimA = Math.atan2(camera.position.x, camera.position.z) + Math.PI + 0.35 * (1 - sil);
    rim.position.set(Math.sin(rimA) * 7.8, 2.6, Math.cos(rimA) * 7.8);
    if (torchK > 0.002) {
      tv.set(mouse.x, -mouse.y, 0.5).unproject(camera).sub(camera.position).normalize();
      var dist = camera.position.length() * 0.82;
      torch.position.copy(camera.position).addScaledVector(tv, dist);
      tv2.set(0, sizeCam.y * 0.5, s.z); torch.position.lerp(tv2, 0.25);
    }
    torch.intensity = LIGHT.torch * torchK * (1 - sil);
    torch.color.copy(TORCH_C);
    if (photoV > 0.002) {   // вспышка фотоотчёта важнее света за курсором
      tv.set(photoI % 2 ? 1.1 : -1.1, 0.4 + 0.2 * (photoI % 3), 0).applyQuaternion(camera.quaternion); torch.position.copy(camera.position).add(tv);
      torch.intensity = LIGHT.photo * photoV; torch.color.copy(PHOTO_C);
    }
    // uInv для «зажигания» — по текущему положению машины
    [active].concat(leaving).forEach(function (c) {
      if (!c) return;
      c.root.updateMatrixWorld(true);
      c.inv.value.copy(c.root.matrixWorld).invert();
    });
    // смена плана монтажа — «провал в темноту» только у машины (экспозиция), фон и текст на месте: раньше гас весь холст
    // вместе с фоном, и экран целиком мигал чёрным (правка 2026-10-04, третий пакет)
    renderer.toneMappingExposure = 0.05 + 0.95 * cutK;
    var op = s.dim.toFixed(3);
    if (op !== css.op) canvas.style.opacity = css.op = op;
    applyCss(s);

    var moving = t < 3.6 || introMoving || ys !== scrollY || Math.abs(mouse.tx - mouse.x) + Math.abs(mouse.ty - mouse.y) > 0.001 || swapping || sizeMoving ||
      (active && active.wave.t0 >= 0) || now - fx.blink < 900 || now - fx.signal < 2600 || fx.brake > 0.01 || Math.abs(torchTarget - torchK) > 0.003 ||
      igOn || (ph > 0 && ph < 1.8) || Math.abs(active ? active.steer : 0) > 0.002;
    // монтаж и скорость идут сами, пока блок на экране: компьютер — каждый кадр, телефон — до 30 кадров в секунду
    var auto = !fixed && !away() && s.dim > 0.01 && (reelW > 0.001 || s.speed > 0.01);
    // карта теней — заново, только если машина сдвинулась, повернулась или повернули колёса (вращение колёс тень
    // не меняет: на «скорости» карта теней больше не пересчитывается каждый кадр)
    if (shadows) {
      var shKey = [active].concat(leaving).map(function (c) { return c ? [c.id, c.root.position.x.toFixed(3), c.root.position.z.toFixed(3), c.yaw.toFixed(3), c.steer.toFixed(3)].join() : ''; }).join('|');
      if (shKey !== fx.shKey) { fx.shKey = shKey; renderer.shadowMap.needsUpdate = true; }
    }
    // отражение в полу; при слабой видеокарте (quality) плавно гаснет
    var mirrorOn = !!mirror && quality.level < 2;
    mirrorK += ((mirrorOn ? 1 : 0) - mirrorK) * (reduce || still ? 1 : 1 - Math.exp(-dt / 0.5));
    var r0 = performance.now(), drawn = false;
    if (s.dim > 0.01 && (moving || (auto && !lite) || now - lastDraw > 32)) {
      if (mirror) {
        // отражение слабее (0,9 → 0,55): яркое зеркало под машиной выглядело «катком» и игрушечно (правка 2026-10-04, четвёртый пакет)
        var mk = 0.55 * kFloor * Math.min(1, s.pool) * mirrorK;   // светлая студия (pool 0) — без отражения
        mirror.mat.uniforms.uK.value = mk;
        mirror.mat.uniforms.uC.value.set(0, s.z);
        mirror.mat.uniforms.uR.value.set(sizeCam.x * 2.4, sizeCam.z * 1.3);
        if (mirrorOn && mk > 0.005) renderMirror();
      }
      renderScene(); lastDraw = now; drawn = true;
      fx.calls = renderer.info.render.calls; fx.tris = renderer.info.render.triangles;   // основной кадр — до проходов свечения
      fx.glow = glowK > 0.02;
      if (fx.glow) renderBloom(LIGHT.bloom * glowK);
      govern(now, moving || (auto && !lite));   // телефон в монтаже и «скорости» рисует до 30 кадров в секунду — это не перегрузка
    }
    var renderMs = performance.now() - r0;
    dbg = { renderMs: renderMs, drawn: drawn, calls: fx.calls, tris: fx.tris, glow: fx.glow, t: t, ys: ys, sy: scrollY, dim: s.dim, car: active && active.id, ambient: ambOn, shot: shotI, speed: s.speed, auto: auto,
      quality: quality.level, pr: renderer.getPixelRatio(), mirror: mirrorOn ? +mirrorK.toFixed(2) : 0, programs: renderer.info.programs ? renderer.info.programs.length : 0 };
    if (moving) { delete canvas.dataset.ready; requestAnimationFrame(frame); }
    else {
      canvas.dataset.ready = '1';
      if (ambOn || auto) requestAnimationFrame(frame); else { running = false; last = 0; }
    }
  }
  function start() { if (ready && opened && !running) { running = true; requestAnimationFrame(frame); } }
  function open() { if (opened) return; opened = true; openT = performance.now(); t0 = 0; reel.on = false; start(); }
  document.addEventListener('hero:open', open);
  // «Оплата»: этап 2 — вспышки фотоотчёта, этап 3 — машина в Минске, фары «зажигаются» (home.js)
  document.addEventListener('pay:stage', function (e) {
    var n = e.detail && e.detail.n, now = performance.now();
    if (reduce || still || !ready) return;
    if (n === 2) fx.photo = now;
    if (n === 3) fx.ign = now + 150;
    start();
  });
  function poke() { lastInput = performance.now(); start(); }
  // фоновая вкладка или открытая анкета «Рассчитать под ключ» (brief.js) — сцена по времени замирает: её не видно
  function away() { return document.hidden || document.documentElement.classList.contains('has-brief'); }

  // ---------- шейдеры и текстуры — заранее ----------
  // На встроенной видеокарте (Intel Iris Xe) сборка одной программы шейдера занимает 0,3–0,6 с, и если она случалась
  // посреди прокрутки (первое отражение в полу, выезд новой машины, блок «скорость»), страница замирала на секунды
  // (правка 2026-10-04, третий пакет). Теперь программы собираются в фоне (KHR_parallel_shader_compile), до показа:
  // основной кадр, текстуры и карта теней — пока идёт прелоадер; новая машина выезжает, когда её шейдеры собраны.
  // Отражение в полу рисуется теми же программами (см. «отражение в глянцевом полу»).
  function compileFor(obj) {
    return renderer.compileAsync ? renderer.compileAsync(obj, camera, obj === scene ? null : scene) : Promise.resolve();
  }
  function uploadTextures(obj) {
    obj.traverse(function (o) {
      [].concat(o.material || []).forEach(function (m) {
        for (var k in m) { var t = m[k]; if (t && t.isTexture && !t.isRenderTargetTexture && t.image) renderer.initTexture(t); }
      });
    });
  }
  function prepare(c) {
    return c.prepared || (c.prepared = compileFor(c.root).then(function () { uploadTextures(c.root); }, function () {}));
  }

  // ---------- первая машина ----------
  loadCar(firstId, function (c) {
    sizeCam.copy(c.size);
    swapTo(c);
    ready = true;
    layout();
    // пока идёт прелоадер — шейдеры основного кадра, текстуры и карта теней: окно раскрывается без рывка первой
    // отрисовки (прелоадер ждёт has-webgl)
    function shown() { c.prepared = Promise.resolve(); html.classList.add('has-webgl'); start(); }
    if (opened || !renderer.compileAsync) { shown(); return; }
    camera.layers.enable(5);   // туман (слой 5) — тоже заранее
    compileFor(scene).then(function () {
      uploadTextures(scene);
      renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);   // холст ещё скрыт: собрать тени, загрузить всё
      camera.layers.disable(5);
      renderBloom(0.001);   // и шейдеры свечения фар (маленькие, собираются сразу)
      shown();
    }, function () { camera.layers.disable(5); shown(); });
  }, fail);

  // ---------- события ----------
  addEventListener('scroll', function () { scrollT = performance.now(); poke(); }, { passive: true });
  addEventListener('pointerdown', poke, { passive: true });
  addEventListener('keydown', poke);
  document.addEventListener('visibilitychange', poke);
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (ready) { layout(); start(); } }, 120); });
  addEventListener('load', function () { if (ready) { layout(); start(); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ready) { layout(); start(); } });
  if (hover && !reduce) {
    addEventListener('pointermove', function (e) { mouse.tx = (e.clientX / innerWidth - 0.5) * 2; mouse.ty = (e.clientY / innerHeight - 0.5) * 2; mouse.seen = true; poke(); }, { passive: true });
    document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) { mouse.seen = false; poke(); } });
    // наведение на «Рассчитать под ключ» — машина моргает фарами
    document.addEventListener('pointerover', function (e) { if (e.target.closest && e.target.closest('[data-brief], a[href$="#brief"]')) flashLights(); });
  }

  // Цвет кузова: кнопки data-paint="#hex" (data-name — подпись) и вызов из блока моделей.
  function label(hex, name) {
    document.querySelectorAll('[data-paint]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-paint') === hex)); });
    document.querySelectorAll('[data-paint-name]').forEach(function (l) { if (name) l.textContent = name; });
  }
  function setPaint(hex, name) {
    paintHex = hex; label(hex, name);
    if (active) paintTo(active, hex);
    start();
  }
  // Модель: машина в зале меняется (файл assets/models/<id>.js). Нет файла — меняется только цвет.
  function setCar(id, hex, name) {
    want = id;
    if (!ready || (active && active.id === id && !active.gone && !(active.anim && active.anim.out))) { if (hex) setPaint(hex, name); return; }
    if (!active || active.id !== id) {
      beginLeave();
      // страховка: видеокарта иногда отвечает «шейдеры готовы» через 10–25 с (Iris Xe, см. STATUS.md) — чтобы зал не стоял
      // пустым, через 1,6 с прежняя машина возвращается, а новая выезжает, когда будет готова
      setTimeout(function () { if (want === id && active && active.id !== id && active.gone) swapTo(active); }, 1600);
    }
    var btns = document.querySelectorAll('[data-model-pick="' + id + '"]');
    btns.forEach(function (b) { b.setAttribute('data-loading', ''); });
    loadCar(id, function (c) {
      prepare(c).then(function () {   // кружок в строке пульсирует, пока собираются шейдеры новой машины
        btns.forEach(function (b) { b.removeAttribute('data-loading'); });
        if (want !== id) return;
        if (hex) { paintHex = hex; label(hex, name); }
        paintTo(c, paintHex, true);
        swapTo(c);
      });
    }, function () {
      btns.forEach(function (b) { b.removeAttribute('data-loading'); });
      if (want === id && active && (active.gone || (active.anim && active.anim.out))) swapTo(active);   // не загрузилась — прежняя возвращается
      if (want === id && hex) setPaint(hex, name);
    });
  }
  document.querySelectorAll('[data-paint]').forEach(function (b) {
    b.addEventListener('click', function () { setPaint(b.getAttribute('data-paint'), b.getAttribute('data-name')); });
  });

  // Без задержки при выборе модели (правка 2026-10-07): файлы моделей скачиваются заранее, по одному, когда блок моделей
  // подъезжает к экрану (только сеть — разбор и шейдеры здесь не трогаем, L26); курсор задержался на строке или палец
  // коснулся её — машина разбирается и готовится, к нажатию она уже готова и выезжает сразу.
  var picks = [].slice.call(document.querySelectorAll('[data-model-pick]'));
  var modelsSec = picks.length && picks[0].closest('section');
  // телефон — не качаем заранее 8–10 МБ по мобильной сети: там машина готовится с касания строки
  if (modelsSec && !phoneMq.matches && 'IntersectionObserver' in window && !(navigator.connection && navigator.connection.saveData)) {
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      var ids = picks.map(function (b) { return b.getAttribute('data-model-pick'); }).filter(function (id, i, a) { return a.indexOf(id) === i; });
      (function next() { var id = ids.shift(); if (id) fetchLib(id, function () { setTimeout(next, 60); }); })();
    }, { rootMargin: '100% 0px' });
    io.observe(modelsSec);
  }
  picks.forEach(function (b) {
    var id = b.getAttribute('data-model-pick'), timer = 0;
    function warm() { if (ready && !cars[id]) loadCar(id, function (c) { prepare(c); }, function () {}); }
    b.addEventListener('pointerenter', function () { clearTimeout(timer); timer = setTimeout(warm, 140); });
    b.addEventListener('pointerleave', function () { clearTimeout(timer); });
    b.addEventListener('focus', warm);
    b.addEventListener('touchstart', warm, { passive: true });
  });

  // Остальные машины заранее не готовим: на встроенной видеокарте сборка шейдеров во время прокрутки останавливала
  // отрисовку всей вкладки на 8–10 с (замер tools/perf.mjs, третий пакет правок 2026-10-04). По клику, когда страница
  // стоит, новая машина выезжает через 0,2–0,7 с, кружок в строке в это время пульсирует.
  window.SHOWROOM = {
    setPaint: setPaint, setCar: setCar, flash: flashLights,
    state: function () { return Object.assign({ running: running }, dbg); },
    relayout: function () { if (ready) { layout(); start(); } },
    debug: function () { return { car: active, scene: scene, camera: camera, renderer: renderer, T: T, light: LIGHT }; },   // для скриптов проверки
    open: open
  };
})();

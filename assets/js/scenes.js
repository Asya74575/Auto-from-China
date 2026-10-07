// Вторая подача (DESIGN.md → «Вторая подача»): линия маршрута-карты «Путь машины по документам» и суммы из расчёта на её
// документах (событие calc:update). 3D — окно холста, скорость — ведёт showroom.js по data-scene. «Появление» стало первым
// экраном — home.js; «Финал» удалён (правка 2026-10-04, четвёртый пакет).
// Без JS документы видны сразу; prefers-reduced-motion — линия маршрута нарисована целиком, без догоняния.
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  function clamp(v) { return Math.min(1, Math.max(0, v)); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function setText(sel, text) { document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; }); }

  // ---------- модель и суммы из калькулятора: декларация на карте, кадры фотоотчёта выбранной модели ----------
  var shots = [].slice.call(document.querySelectorAll('[data-report-shot]')), shotCar = 'zeekr-7x';
  function showShots(id) {
    if (id === shotCar || !shots.length) return;
    shotCar = id;
    shots.forEach(function (img) {
      var src = 'img/report/' + id + '-' + img.getAttribute('data-report-shot') + '.webp';
      if (reduce) { img.src = src; return; }
      img.classList.add('is-swap');   // старый кадр гаснет, новый проявляется, когда загрузится
      setTimeout(function () { img.onload = function () { img.classList.remove('is-swap'); }; img.src = src; }, 260);
    });
  }
  document.addEventListener('calc:update', function (e) {
    var d = e.detail, m = d.model, line = {};
    d.lines.forEach(function (l) { line[l.key] = l; });
    setText('[data-map-model]', m.name);
    if (line.duty) { setText('[data-map-duty-label]', line.duty.label); setText('[data-map-duty]', fmt.format(line.duty.value) + ' BYN'); }
    if (line.fees) setText('[data-map-fees]', fmt.format(line.fees.value) + ' BYN');
    showShots(m.id);
  });
  // ---------- маршрут-карта: линия через узлы документов дорисовывается за прокруткой ----------
  // Плавная кривая «как маршрут на карте» от узла к узлу; документы лежат поверх неё. В каждый узел линия входит слева,
  // к соседу в том же ряду — дугой над подписями, в следующий ряд — вниз «под документ» и к узлу слева. Прежняя ломаная считала,
  // что каждый следующий документ ниже предыдущего: у пары в одном ряду петляла вверх и перечёркивала место под заголовком
  // (правка 2026-10-04, четвёртый пакет). Пунктир — весь путь, сплошная — пройденный, точка — где машина сейчас.
  var map = (function () {
    var field = $('[data-map-field]');
    if (!field) return null;
    // пунктир всего пути — своя неподвижная картинка, линия и точка — свой слой: на каждом кадре перерисовывается только он.
    // Только слои линии (.map__svg): прежде размеры поля получали все SVG внутри — QR-код ЭПТС, ключ и печать декларации
    // становились пустым белым квадратом (правка 2026-10-05)
    var svgs = [].slice.call(field.querySelectorAll('.map__svg')), done = $('[data-map-done]', field), plan = $('[data-map-plan]', field), head = $('[data-map-head]', field);
    var stops = [].slice.call(field.querySelectorAll('[data-map-stop]'));
    var dots = stops.map(function (s) { return $('.map__node i', s); });
    // пройденная линия — отдельный отрезок на каждый участок: за прокруткой меняется один отрезок, и браузер
    // перерисовывает только его, а не линию через весь блок (на встроенной видеокарте кадры доходили до 67–183 мс)
    var samples = [], total = 1, nodeLen = [], anchors = [], parts = [], cur = 0, target = 0, raf = 0, last = 0, fieldTop = 0;

    function bez(p, t) {
      var u = 1 - t;
      return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
        u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]];
    }
    function build() {
      var box = field.getBoundingClientRect(), W = box.width, H = box.height;
      fieldTop = box.top + scrollY;
      var pts = dots.map(function (d) { var r = d.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
      var column = pts.every(function (p) { return Math.abs(p[0] - pts[0][0]) < 12; });   // телефон: узлы друг под другом
      var segs = [], p0 = pts[0];
      segs.push(column ? [[p0[0], p0[1] - 70], [p0[0], p0[1] - 45], [p0[0], p0[1] - 20], p0]
        : [[-16, p0[1] + 84], [10, p0[1] + 84], [p0[0] - 110, p0[1] + 10], p0]);
      for (var i = 1; i < pts.length; i++) {
        var A = pts[i - 1], B = pts[i], dx = B[0] - A[0], dy = B[1] - A[1];
        if (column || Math.abs(dx) < 12) segs.push([A, [A[0], A[1] + dy / 3], [B[0], B[1] - dy / 3], B]);
        else if (Math.abs(dy) < 20) segs.push([A, [A[0] + dx * 0.22, A[1] - 78], [B[0] - dx * 0.22, B[1] - 78], B]);
        else segs.push([A, [A[0] + 30, A[1] + dy * 0.55], [B[0] - 110, B[1] + 10], B]);   // вниз «под документ», в узел — слева
      }
      // маршрут кончается в последнем узле (Минск · выдача): хвост линии ниже последнего документа торчал из-под карточки
      // в пустое место (правка 2026-10-05)
      samples = []; nodeLen = []; parts = []; done.textContent = '';
      var len = 0, prev = null, d = '';
      segs.forEach(function (sg, k) {
        var c3 = [sg[1], sg[2], sg[3]].map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' '), from = len;
        d += (k ? ' C ' : 'M ' + sg[0][0].toFixed(1) + ' ' + sg[0][1].toFixed(1) + ' C ') + c3;
        for (var j = k ? 1 : 0; j <= 32; j++) {
          var q = bez(sg, j / 32);
          if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
          samples.push([len, q[0], q[1]]); prev = q;
        }
        var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', 'M ' + sg[0][0].toFixed(1) + ' ' + sg[0][1].toFixed(1) + ' C ' + c3);
        el.style.strokeDasharray = (len - from + 1).toFixed(1); done.appendChild(el);
        parts.push({ el: el, from: from, len: len - from, v: -1 });
        if (k < pts.length) nodeLen.push(len);
      });
      total = len || 1;
      // прокрутка → длина линии: узел «достигнут», когда он на 62% высоты экрана; соседи в одном ряду — через 160 px
      anchors = [[fieldTop + pts[0][1] - 200, 0]];
      pts.forEach(function (p, i) { anchors.push([Math.max(fieldTop + p[1], anchors[anchors.length - 1][0] + 160), nodeLen[i]]); });
      svgs.forEach(function (sv) { sv.setAttribute('viewBox', '0 0 ' + W.toFixed(1) + ' ' + H.toFixed(1)); });
      plan.setAttribute('d', d);
      measure(); if (reduce) cur = target; paint();
    }
    function lenAt(y) {
      if (y <= anchors[0][0]) return 0;
      for (var k = 1; k < anchors.length; k++) if (y <= anchors[k][0]) return anchors[k - 1][1] + (anchors[k][1] - anchors[k - 1][1]) * clamp((y - anchors[k - 1][0]) / (anchors[k][0] - anchors[k - 1][0]));
      return total;
    }
    function pointAt(l) {
      for (var k = 1; k < samples.length; k++) if (samples[k][0] >= l) {
        var a = samples[k - 1], b = samples[k], t = (l - a[0]) / ((b[0] - a[0]) || 1);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      }
      return samples.length ? [samples[samples.length - 1][1], samples[samples.length - 1][2]] : [-20, -20];
    }
    function measure() { target = reduce ? total : lenAt(scrollY + innerHeight * 0.62); }
    function paint() {
      parts.forEach(function (p) {
        var v = Math.round(Math.min(p.len, Math.max(0, cur - p.from)) * 2) / 2;
        if (v !== p.v) { p.v = v; p.el.style.strokeDashoffset = (p.len + 1 - v).toFixed(1); }
      });
      var p = pointAt(cur), on = cur > 1 && cur < total - 1;
      head.setAttribute('cx', p[0].toFixed(1)); head.setAttribute('cy', p[1].toFixed(1)); head.style.opacity = on ? 1 : 0;
      stops.forEach(function (s, i) { s.classList.toggle('is-on', cur >= nodeLen[i] - 1); });
    }
    function step(now) {
      var dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      cur += (target - cur) * (1 - Math.exp(-dt / 0.25));   // линия догоняет прокрутку с инерцией
      if (Math.abs(target - cur) < 0.5) cur = target;
      paint();
      if (cur !== target) raf = requestAnimationFrame(step); else { raf = 0; last = 0; }
    }
    return {
      build: build,
      scroll: function () { measure(); if (reduce) { cur = target; paint(); } else if (!raf && cur !== target) raf = requestAnimationFrame(step); }
    };
  })();

  // ---------- прокрутка: линия маршрута ----------
  // положение блоков меряем при перестройке, а не на каждом шаге прокрутки (правка 2026-10-04, третий пакет: «сайт тяжёлый»)
  var queued = false;
  function update() { queued = false; if (map) map.scroll(); }
  function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  addEventListener('scroll', request, { passive: true });
  function rebuild() { if (map) map.build(); update(); }
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(rebuild, 120); });
  if (window.ResizeObserver) new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(rebuild, 60); }).observe(document.body);
  addEventListener('load', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  rebuild();
})();

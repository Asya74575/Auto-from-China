// Главная: прелоадер первого экрана и подписи планов монтажа, счётчик дней и текущий этап на маршруте, стопка карточек
// «Оплаты», горизонтальная лента «Что не привезём». 3D (окно, монтаж, машина на маршруте) ведёт showroom.js.
// Каждый блок — в своей функции: общая переменная двух блоков однажды увела счётчик дней маршрута в «Оплату» (LESSONS.md, L10).
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  function clamp(v) { return Math.min(1, Math.max(0, v)); }
  function smooth(a, b, x) { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); }
  // Положение блока на странице меряем при изменении размеров страницы, а не на каждом шаге прокрутки: чтение
  // getBoundingClientRect после того, как другой блок записал стили, заставляло браузер пересчитывать раскладку
  // несколько раз за кадр (правка 2026-10-04, третий пакет: «сайт тяжёлый»). box.top — от верха документа.
  function tracker(el, after) {
    var box = { top: 0, height: 0, measure: measure };
    function measure() { var r = el.getBoundingClientRect(); box.top = r.top + scrollY; box.height = r.height; if (after) after(); }
    measure();
    if (window.ResizeObserver) new ResizeObserver(function () { measure(); }).observe(document.body);
    addEventListener('load', measure);
    return box;
  }

  // ---------- 1. Первый экран: прелоадер → окно с монтажом ----------
  // Пока грузятся three.js и машина — чёрный экран со строкой «Сначала проверка — потом оплата» и линией загрузки: счёт
  // «фото и видео» идёт до 100+ не быстрее 1,8 с и держится на 92, пока машина не готова. Потом снимаем класс hero-wait
  // и шлём hero:open — showroom.js поднимает окно и запускает монтаж, CSS проявляет шапку, заголовок и панель.
  // Без прелоадера (класса нет): reduce, снимки проверки, страховка 9 с из <head>.
  (function () {
    var hero = document.querySelector('[data-hero]');
    if (!hero) return;
    var html = document.documentElement, countOut = hero.querySelector('[data-hero-count]');
    var MIN = 1800, t0 = performance.now(), opened = !html.classList.contains('hero-wait');
    function sceneReady() { return html.classList.contains('has-webgl') || html.classList.contains('no-webgl'); }
    function open() {
      if (opened) return;
      opened = true;
      hero.style.setProperty('--load', '1');
      if (countOut) countOut.textContent = '100+';
      html.classList.remove('hero-wait');
      document.dispatchEvent(new Event('hero:open'));
    }
    if (!opened) {
      (function tick(now) {
        if (opened) return;
        if (scrollY > 40) { open(); return; }          // перезагрузка посреди страницы — браузер вернул прокрутку
        var k = clamp((now - t0) / MIN), load = 1 - (1 - k) * (1 - k);
        if (!sceneReady()) load = Math.min(load, 0.92);
        hero.style.setProperty('--load', load.toFixed(3));
        if (countOut) countOut.textContent = String(Math.round(load * 100));
        if (load >= 1) setTimeout(open, 280); else requestAnimationFrame(tick);
      })(t0);
      addEventListener('scroll', function () { if (scrollY > 40) open(); }, { passive: true });   // посетитель не ждёт — сразу к странице
    }

    // подписи планов монтажа: что проверяем на площадке (событие showroom:shot приходит в начале плана, в «провале
    // в темноту»). Подпись не гаснет: текст меняется сразу и чуть доезжает снизу (правка 2026-10-04, третий пакет —
    // гаснущая каждые 2 с подпись и чёрный экран между планами выглядели как мигающий текст)
    var SHOTS = ['Фары и оптика', 'Колёса и шины', 'Кузов: зазоры и краска', 'Задние фонари и багажник', 'VIN и комплектация'];
    var shotBox = hero.querySelector('.hero__shot');
    document.addEventListener('showroom:shot', function (e) {
      var i = e.detail.i;
      if (!shotBox || i < 0) return;
      shotBox.querySelector('[data-shot-n]').textContent = 'Проверка 0' + (i + 1) + '/0' + e.detail.n;
      shotBox.querySelector('[data-shot-label]').textContent = SHOTS[i] || '';
      shotBox.classList.remove('is-new'); void shotBox.offsetWidth; shotBox.classList.add('is-new');
    });
  })();

  // ---------- 1а. Затемнение низа первого экрана уходит с началом прокрутки (правка 2026-10-07, адаптив 1366) ----------
  // Затемнение привязано к низу блока и при прокрутке ехало вверх поверх неподвижной 3D-сцены — между блоками была тёмная
  // полоса, под ней светлел пол. Теперь --shade (1 → 0 за первые полэкрана прокрутки) гасит его и продолжение в
  // «Почему из Китая»; в покое первый экран — как был. Пишем только в эти две секции и только пока они рядом.
  (function () {
    var hero = document.querySelector('.hero'), why = document.getElementById('why');
    if (!hero || !why) return;
    var last = -1, queued = false;
    function update() {
      queued = false;
      var k = 1 - smooth(0, 0.5 * innerHeight, scrollY);
      k = Math.round(k * 200) / 200;
      if (k === last) return;
      last = k;
      hero.style.setProperty('--shade', k); why.style.setProperty('--shade', k);
    }
    addEventListener('scroll', function () { if (!queued && (scrollY < innerHeight || last !== 0)) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  })();

  // ---------- 5. Путь 45–60 дней: день пути и текущий этап за прокруткой закреплённой секции ----------
  // Машину по линии ведёт showroom.js; здесь — число дней, отметки на линии и подпись этапа (номер, название, срок).
  // К доле прокрутки data-route-arrive машина у Минска (день 60), дальше стоит и уезжает за кадр (правка 2026-10-04).
  (function () {
    var route = document.querySelector('[data-route]');
    if (!route) return;
    var stage = route.querySelector('[data-route-stage]');
    var stops = [].slice.call(route.querySelectorAll('[data-stop]'));
    var dayOut = route.querySelector('[data-route-day]'), now = route.querySelector('[data-route-now]');
    var ends = stops.map(function (s) { return Number(s.getAttribute('data-stop')); });   // день окончания этапа (максимум)
    var arrive = Number(route.getAttribute('data-route-arrive')) || 1;
    var last = -1, queued = false, swapT = 0, box = tracker(route, function () { request(); });
    function caption(k) {
      var src = stops[k];
      now.querySelector('[data-route-now-n]').textContent = 'Этап ' + (k + 1) + ' из ' + stops.length;
      now.querySelector('[data-route-now-b]').textContent = src.querySelector('b').textContent;
      now.querySelector('[data-route-now-s]').textContent = src.querySelector('span').textContent;
    }
    function update() {
      queued = false;
      var span = Math.max(1, box.height - innerHeight);
      var p = clamp((scrollY - box.top) / span / arrive), n = stops.length;
      var k = Math.min(n - 1, Math.floor(p * n)), local = p * n - k;
      var from = k ? ends[k - 1] : 0, day = Math.round(from + (ends[k] - from) * local);
      if (dayOut) dayOut.textContent = String(day);
      if (k !== last) {
        stops.forEach(function (s, i) { s.classList.toggle('is-active', i === k); s.classList.toggle('is-done', i < k); });
        if (now) {
          clearTimeout(swapT);
          if (last < 0 || reduce) caption(k);
          else {
            now.classList.add('is-swap');
            swapT = setTimeout(function () { caption(k); now.classList.remove('is-swap'); }, 200);
          }
        }
        last = k;
      }
      if (stage) stage.style.setProperty('--progress', p.toFixed(4));
    }
    function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    update();
  })();

  // ---------- 6. Оплата: стопка карточек ----------
  // Прокрутка закреплённой секции (с инерцией) ведёт стопку: каждый следующий этап наезжает снизу на предыдущий, нижние
  // карточки уменьшаются и темнеют (--in, --depth). Этап «оплачен», когда его карточка почти легла: счётчик «Оплачено»
  // досчитывает, доля полосы заливается. Суммы этапов — из расчёта выбранной модели (событие calc:update от calc.js).
  // Машина справа меняется вместе с этапом (правка 2026-10-04): у секции data-stage, подпись над машиной, событие pay:stage
  // для showroom.js (этап 2 — вспышки фотоотчёта, этап 3 — фары).
  (function () {
    var pay = document.querySelector('[data-pay]');
    if (!pay) return;
    var stage = pay.querySelector('.pay__stage');
    var cards = [].slice.call(pay.querySelectorAll('[data-pay-step]'));
    var segs = [].slice.call(pay.querySelectorAll('[data-pay-seg]'));
    var amounts = cards.map(function (li) { return Number(li.querySelector('[data-pay-amount]').textContent.replace(/[^\d]/g, '')); });
    var sumOut = pay.querySelector('[data-pay-sum]'), nOut = pay.querySelector('[data-pay-n]');
    var totalOut = pay.querySelector('[data-pay-total]'), modelOut = pay.querySelector('[data-pay-model]');
    var tag = pay.querySelector('.pay__tag'), tagT = 0;
    var TAGS = ['Ищем машину под ваш запрос\u00a0— пока виден только силуэт', 'Фотоотчёт с площадки: больше 100 фото и видео, VIN сверен', 'Машина в Минске: таможня пройдена, осталось забрать ключи'];
    function stageTo(n) {
      pay.setAttribute('data-stage', String(n));
      document.dispatchEvent(new CustomEvent('pay:stage', { detail: { n: n } }));
      if (!tag) return;
      tag.classList.add('is-swap');
      clearTimeout(tagT);
      tagT = setTimeout(function () {
        tag.querySelector('[data-pay-tag-n]').textContent = 'Этап ' + n;
        tag.querySelector('[data-pay-tag]').textContent = TAGS[n - 1] || '';
        tag.classList.remove('is-swap');
      }, reduce ? 0 : 220);
    }
    var p = 1, pTarget = 1, paidN = -1, shown = 0, tween = null, running = false, last = 0;
    var seg = 0.84 / Math.max(1, cards.length - 1);   // этап i ≥ 1 наезжает на отрезке прокрутки [0,08 + (i−1)·seg; … + 0,8·seg]

    function sumOf(n) { return amounts.slice(0, n).reduce(function (a, b) { return a + b; }, 0); }
    var pinned = false, inited = false, box = tracker(pay, function () { pinned = getComputedStyle(stage).position === 'sticky'; if (inited) request(); });
    function target() {
      if (!pinned) return 1;                          // не закреплена (нет места по высоте) — все этапы списком, всё оплачено
      return clamp((scrollY - box.top) / Math.max(1, box.height - innerHeight));
    }
    function inOf(i) { if (!i) return 1; var a = 0.08 + (i - 1) * seg; return smooth(a, a + seg * 0.8, p); }
    function setSum(v) { sumOut.textContent = fmt.format(Math.round(v)) + ' BYN'; }
    function sumTo(v, now) { if (reduce) { tween = null; shown = v; setSum(v); } else tween = { from: shown, to: v, t0: now }; }
    function frame(now) {
      var dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      p += (pTarget - p) * (reduce ? 1 : 1 - Math.exp(-dt / 0.16));
      if (Math.abs(pTarget - p) < 0.0005) p = pTarget;
      var ins = cards.map(function (c, i) { return inOf(i); });
      cards.forEach(function (c, i) {
        var depth = ins.slice(i + 1).reduce(function (s, v) { return s + v; }, 0);
        c.style.setProperty('--in', ins[i].toFixed(4));
        c.style.setProperty('--depth', depth.toFixed(4));
      });
      var n = ins.filter(function (v) { return v > 0.6; }).length;
      if (n !== paidN) {
        paidN = n;
        cards.forEach(function (c, i) { c.classList.toggle('is-top', i === n - 1); });
        segs.forEach(function (s, i) { s.classList.toggle('is-paid', i < n); });
        if (nOut) nOut.textContent = String(n);
        sumTo(sumOf(n), now);
        stageTo(Math.max(1, n));
      }
      if (tween) {
        var t = Math.min(1, (now - tween.t0) / 800);
        shown = tween.from + (tween.to - tween.from) * (1 - Math.pow(1 - t, 3)); setSum(shown);
        if (t >= 1) tween = null;
      }
      if (p !== pTarget || tween) requestAnimationFrame(frame); else { running = false; last = 0; }
    }
    function request() { pTarget = target(); if (!running) { running = true; requestAnimationFrame(frame); } }
    document.addEventListener('calc:update', function (e) {
      var d = e.detail, car = d.lines.filter(function (l) { return l.key === 'car'; })[0].value;
      amounts = [amounts[0], car, d.total - car - amounts[0]];   // депозит засчитывается в итог: третий платёж — остаток
      cards.forEach(function (li, i) { li.querySelector('[data-pay-amount]').textContent = fmt.format(amounts[i]) + ' BYN'; });
      segs.forEach(function (s, i) { s.style.setProperty('--share', (amounts[i] / d.total * 100).toFixed(2)); });
      if (totalOut) totalOut.textContent = fmt.format(d.total);
      if (modelOut) modelOut.textContent = d.model.name;
      if (paidN >= 0) sumTo(sumOf(paidN), performance.now());
      request();
    });
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    p = pTarget = target();
    shown = sumOf(cards.filter(function (c, i) { return inOf(i) > 0.6; }).length); setSum(shown);
    request(); inited = true;
  })();

  // ---------- 7. Что не привезём: горизонтальная лента ----------
  // Секция закрепляется, её высота = экран + длина ленты; прокрутка вниз двигает карточки влево. Текущая карточка — тёмная,
  // её крест прорисовывается; счётчик «01 / 05» и полоса прогресса. reduce и низкий экран (< 560px) — лента не закрепляется.
  // Слайдер (правка 2026-10-06, адаптив 1240: на невысоком окне лента стояла, мышью её было не пролистать): стрелки у счётчика
  // листают по карточке — в закреплённом блоке прокручивают страницу до этой карточки, иначе — саму ленту; незакреплённую
  // ленту можно тянуть мышью; счётчик, полоса и тёмная текущая карточка работают в обоих случаях.
  (function () {
    var cant = document.querySelector('[data-cant]');
    if (!cant) return;
    var track = cant.querySelector('[data-cant-track]'), view = cant.querySelector('.cant__viewport');
    var cards = [].slice.call(track.children), nOut = cant.querySelector('[data-cant-n]'), bar = cant.querySelector('.cant__progress');
    var arrows = [].slice.call(cant.querySelectorAll('[data-cant-step]'));
    var low = matchMedia('(max-width: 900px) and (max-height: 560px), (max-height: 500px)'), dist = 0, span = 0, active = -1, queued = false, pinned = false, box = tracker(cant, function () { request(); });
    // не закрепляется: телефон ниже 560px (лёжа) и любое окно ниже 500px; компьютер с невысоким окном — закрепляется,
    // карточки ужимаются (правка 2026-10-07, адаптив 1366: на окне ~1366×550 лента стояла, а выше — ехала сама)
    var A = 0.06, B = 0.94;   // в начале и в конце закреплённого блока — короткая пауза
    function layout() {
      cant.classList.add('is-pinned');                 // меряем ленту в том виде, в каком она поедет
      var cs = getComputedStyle(view);
      dist = Math.max(0, track.scrollWidth - (view.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
      pinned = !reduce && !low.matches && dist > 0;
      cant.classList.toggle('is-pinned', pinned);
      cant.style.height = pinned ? Math.round(innerHeight + dist * 1.3) + 'px' : '';
      span = Math.max(0, view.scrollWidth - view.clientWidth);
      box.measure();
      active = -1;
      update();
    }
    // 0…1 — насколько лента проехала: за прокруткой страницы (закреплённый блок) или за прокруткой самой ленты
    function progress() {
      if (pinned) return smooth(A, B, clamp((scrollY - box.top) / Math.max(1, box.height - innerHeight)));
      return span > 1 ? clamp(view.scrollLeft / span) : 0;
    }
    function update() {
      queued = false;
      var k = progress();
      if (pinned) track.style.setProperty('--x', (k * dist).toFixed(1));
      if (bar) bar.style.setProperty('--p', k.toFixed(4));
      // тёмный фон — за прокруткой: у карточки, к которой подъехала лента, --on = 1, у соседних плавно спадает
      var pos = k * (cards.length - 1);
      cards.forEach(function (c, j) { var on = smooth(0, 1, 1 - Math.abs(pos - j) * 1.25); if (c._on !== on) { c._on = on; c.style.setProperty('--on', on.toFixed(3)); } });
      var i = Math.round(pos);
      if (i !== active) {
        active = i;
        cards.forEach(function (c, j) { c.classList.toggle('is-on', j === i); c.classList.toggle('is-seen', j <= i); });
        if (nOut) nOut.textContent = (i < 9 ? '0' : '') + (i + 1);
      }
      arrows.forEach(function (b) { var d = +b.getAttribute('data-cant-step'); b.disabled = d < 0 ? k < 0.005 : k > 0.995; });
    }
    function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    // стрелка: к соседней карточке. В закреплённом блоке ищем прокрутку страницы, при которой лента стоит на ней
    // (обратная функция плавного хода — делением пополам)
    function go(i) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      if (pinned) {
        var k = i / (cards.length - 1), lo = A, hi = B;
        for (var n = 0; n < 24; n++) { var mid = (lo + hi) / 2; if (smooth(A, B, mid) < k) lo = mid; else hi = mid; }
        var y = box.top + (lo + hi) / 2 * Math.max(1, box.height - innerHeight);
        if (window.LENIS) LENIS.scrollTo(y, { duration: 1.1 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      } else {
        // незакреплённая лента — те же пять остановок: текущая карточка i, лента прокручена на i / 4 своего хода
        view.scrollTo({ left: i / (cards.length - 1) * span, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    function nearest() { return Math.round(progress() * (cards.length - 1)); }
    arrows.forEach(function (b) {
      b.addEventListener('click', function () { go(nearest() + +b.getAttribute('data-cant-step')); });
    });
    // незакреплённая лента тянется мышью; отпустили — встаёт на ближайшую карточку
    var drag = null;
    view.addEventListener('pointerdown', function (e) {
      if (pinned || e.pointerType !== 'mouse' || e.button !== 0 || span < 2) return;
      drag = { x: e.clientX, left: view.scrollLeft, moved: false, id: e.pointerId, from: nearest() };
      e.preventDefault();
    });
    view.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; view.classList.add('is-drag'); try { view.setPointerCapture(drag.id); } catch (err) {} }
      if (drag.moved) view.scrollLeft = drag.left - dx;
    });
    function dragEnd() {
      if (!drag) return;
      var moved = drag.moved, dir = view.scrollLeft - drag.left, from = drag.from;
      drag = null; view.classList.remove('is-drag');
      if (!moved) return;
      var i = nearest();   // короткий рывок тоже листает: потянули больше чем на 40px — к соседней в ту же сторону
      if (Math.abs(dir) > 40 && i === from) i += dir > 0 ? 1 : -1;
      go(i);
    }
    view.addEventListener('pointerup', dragEnd);
    view.addEventListener('pointercancel', dragEnd);
    view.addEventListener('lostpointercapture', dragEnd);
    view.addEventListener('scroll', request, { passive: true });
    addEventListener('scroll', request, { passive: true });
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 120); });
    addEventListener('load', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    layout();
  })();

  // ---------- 8а. Отзывы — слайдер на экране до 1100px (правка 2026-10-07, адаптив 1100) ----------
  // Лента листается сама (палец, колесо, тачпад); стрелки — к соседней карточке, счётчик и полоса — по ближайшей карточке.
  (function () {
    var list = document.querySelector('.reviews'), foot = document.querySelector('.reviews__foot');
    if (!list || !foot) return;
    var cards = [].slice.call(list.children), nOut = foot.querySelector('[data-rev-n]'), bar = foot.querySelector('.cant__progress');
    var arrows = [].slice.call(foot.querySelectorAll('[data-rev-step]')), queued = false;
    function span() { return Math.max(0, list.scrollWidth - list.clientWidth); }
    function nearest() {
      var x = list.scrollLeft, best = 0, d = 1e9;
      cards.forEach(function (c, i) { var dd = Math.abs(c.offsetLeft - cards[0].offsetLeft - x); if (dd < d) { d = dd; best = i; } });
      return list.scrollLeft >= span() - 2 ? cards.length - 1 : best;
    }
    function update() {
      queued = false;
      var s = span(), k = s > 1 ? list.scrollLeft / s : 0, i = nearest();
      if (bar) bar.style.setProperty('--p', Math.min(1, Math.max(0, k)).toFixed(4));
      if (nOut) nOut.textContent = (i < 9 ? '0' : '') + (i + 1);
      arrows.forEach(function (b) { var d = +b.getAttribute('data-rev-step'); b.disabled = d < 0 ? list.scrollLeft < 2 : list.scrollLeft > s - 2; });
    }
    function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    arrows.forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Math.max(0, Math.min(cards.length - 1, nearest() + +b.getAttribute('data-rev-step')));
        list.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    list.addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    update();
  })();

  // ---------- 8. Отзывы: фото машины на весь экран (правка 2026-10-05) ----------
  // Фото вырастает из карточки до размера экрана (приём FLIP: настоящий размер сразу, сдвиг и масштаб — анимацией),
  // сначала — уже загруженное превью, потом подменяется крупным файлом. Закрывается нажатием в любом месте, крестиком
  // или Esc — фото уезжает обратно в карточку. Без <dialog> и без JS ссылка открывает сам файл фото.
  (function () {
    var dlg = document.querySelector('[data-lightbox-dialog]');
    var links = [].slice.call(document.querySelectorAll('[data-lightbox]'));
    if (!dlg || !links.length || typeof dlg.showModal !== 'function') return;
    var img = dlg.querySelector('.lightbox__img'), cap = dlg.querySelector('.lightbox__cap'), html = document.documentElement;
    var thumb = null, closing = false, closeT = 0;
    function flip(r0, r1) { return 'translate(' + (r0.left - r1.left).toFixed(1) + 'px,' + (r0.top - r1.top).toFixed(1) + 'px) scale(' + (r0.width / r1.width).toFixed(4) + ',' + (r0.height / r1.height).toFixed(4) + ')'; }
    function done() {
      clearTimeout(closeT);
      if (dlg.open) dlg.close();
      if (thumb) thumb.style.visibility = '';
      thumb = null; closing = false; img.style.transform = '';
      html.classList.remove('has-lightbox');
      if (window.LENIS) LENIS.start();
    }
    function open(a) {
      if (thumb) done();
      var t = a.querySelector('img'), full = new Image();
      thumb = t;
      img.src = t.currentSrc || t.src; img.alt = t.alt; cap.textContent = a.getAttribute('data-caption') || '';
      full.onload = function () { if (thumb === t) img.src = full.src; };
      full.src = a.href;
      html.classList.add('has-lightbox');
      if (window.LENIS) LENIS.stop();
      dlg.classList.remove('is-shown');
      dlg.showModal();
      if (reduce) { dlg.classList.add('is-shown'); return; }
      img.style.transition = 'none';
      img.style.transform = flip(t.getBoundingClientRect(), img.getBoundingClientRect());
      t.style.visibility = 'hidden';
      void img.offsetWidth;   // начальное положение — в карточке; дальше переход к месту на экране
      img.style.transition = '';
      img.style.transform = '';
      dlg.classList.add('is-shown');
    }
    function close() {
      if (!dlg.open || closing) return;
      closing = true;
      dlg.classList.remove('is-shown');
      if (reduce || !thumb) { done(); return; }
      img.style.transform = flip(thumb.getBoundingClientRect(), img.getBoundingClientRect());
      closeT = setTimeout(done, 800);
    }
    links.forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); open(a); }); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });   // Esc
    dlg.addEventListener('click', close);
    img.addEventListener('transitionend', function (e) { if (closing && e.propertyName === 'transform') done(); });
  })();
})();

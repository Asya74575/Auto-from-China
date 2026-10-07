// «Сборка» текста (приём референса artemlysenko.com): буквы перебирают случайные символы и встают на место слева направо.
// Атрибут data-scramble у заголовка или крупной цифры. Срабатывает один раз, когда элемент появился на экране.
// Ширина строки не прыгает: настоящая буква остаётся в потоке прозрачной, случайный символ рисуется поверх (::after).
// Без JS, при prefers-reduced-motion и на снимках проверки (webdriver — кадры повторяемы) текст сразу на месте.
// Для чтения с экрана текст не меняется.
(function () {
  var els = [].slice.call(document.querySelectorAll('[data-scramble]'));
  if (!els.length || matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.webdriver || !('IntersectionObserver' in window)) return;
  var GLYPHS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789';
  function rnd() { return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]; }

  function prepare(el) {
    var chars = [];
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split('').forEach(function (ch) {
            if (/\s/.test(ch)) { frag.append(ch); return; }
            var s = document.createElement('span'); s.className = 'sc'; s.textContent = ch;
            frag.append(s); chars.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    return chars;
  }

  // Сразу при загрузке буквы заменяются символами (переход — плавный, см. .sc в home.css), сборка — при появлении.
  els.forEach(function (el) {
    var chars = prepare(el), step = Math.min(45, 900 / Math.max(1, chars.length));
    chars.forEach(function (c, i) { c.classList.add('is-scr'); c.setAttribute('data-g', rnd()); c._at = 150 + i * step; });
    el._chars = chars;
  });

  function run(el) {
    var chars = el._chars || [], t0 = performance.now();
    el.classList.add('is-scrambling');
    function tick(now) {
      var t = now - t0, left = 0;
      chars.forEach(function (c) {
        if (!c.classList.contains('is-scr')) return;
        if (t >= c._at) c.classList.remove('is-scr');
        else { left++; if (Math.random() < 0.3) c.setAttribute('data-g', rnd()); }
      });
      if (left) requestAnimationFrame(tick); else el.classList.remove('is-scrambling');
    }
    requestAnimationFrame(tick);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

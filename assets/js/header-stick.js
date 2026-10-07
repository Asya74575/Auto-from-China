// Шапка закреплена сверху (base.css). Пока страница в самом верху — без фона и линии (класс is-clear).
// Если у первого экрана есть атрибут data-header-clear — шапка прозрачная, пока он закрывает экран целиком
// (например, закреплённая сцена). Без JS шапка всегда с фоном. Работает только по прокрутке, без постоянного цикла.
(function () {
  var mount = document.querySelector('[data-include="header"]');
  if (!mount) return;
  var hero = document.querySelector('[data-header-clear]');
  // низ первого экрана меряем при изменении размеров, а не на каждом шаге прокрутки — без лишнего пересчёта раскладки
  var queued = false, heroBottom = 0;
  function measure() { if (hero) { heroBottom = hero.getBoundingClientRect().bottom + window.scrollY; } request(); }
  function update() {
    queued = false;
    var clear = hero ? heroBottom - window.scrollY >= window.innerHeight - 1 : window.scrollY < 4;
    mount.classList.toggle('is-clear', clear);
  }
  function request() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(document.body);
  measure();
  update();
})();

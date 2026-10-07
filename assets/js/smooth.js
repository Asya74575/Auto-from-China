// Плавная прокрутка всей страницы (DESIGN.md → «Вторая подача»): Lenis догоняет колесо мыши с инерцией.
// Только компьютер с мышью; телефон и сенсорные экраны, prefers-reduced-motion и снимки проверки (webdriver) — обычная прокрутка.
// Переход по меню — тоже через Lenis, с отступом под закреплённую шапку (--header-offset).
(function () {
  if (!window.Lenis) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches || navigator.webdriver) return;
  var off = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-offset')) || 0;
  window.LENIS = new Lenis({ lerp: 0.1, anchors: { offset: -off }, autoRaf: true });
})();

// Общая шапка из config.js. Работает с диска, с сервера и со страниц во вложенных папках.
(function () {
  var mount = document.querySelector('[data-include="header"]');
  if (!mount || !window.SITE) return;
  var ROOT = new URL('../../', document.currentScript.src);
  var site = window.SITE;
  function safeUrl(value) {
    var raw = String(value || '').trim();
    if (!raw || /\s/.test(raw)) return '';
    if (/^(https?:|mailto:|tel:|viber:|tg:)/i.test(raw)) return raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
    if (raw.charAt(0) === '#') return raw;
    return new URL(raw, ROOT).href;
  }
  function link(text, href, className) {
    var a = document.createElement('a');
    a.textContent = text || '';
    var url = safeUrl(href);
    if (url) a.href = url;
    if (className) a.className = className;
    return a;
  }
  var header = document.createElement('header');
  header.className = 'site-header';
  header.append(link(site.name, 'index.html', 'site-header__name'));
  var nav = document.createElement('nav');
  nav.className = 'site-header__nav';
  nav.setAttribute('aria-label', 'Основное меню');
  (site.menu || []).forEach(function (item) { nav.append(link(item.title, item.href)); });
  header.append(nav);
  // Меню телефона и планшета (≤1023px, до 2026-10-07 — ≤900px; правка 2026-10-06 по итогам проверки — без него с телефона разделы были недоступны):
  // кнопка с двумя полосками открывает список разделов под шапкой; закрывают ссылка, Esc, нажатие мимо и та же кнопка
  var tog = document.createElement('button');
  tog.type = 'button'; tog.className = 'site-header__toggle';
  tog.setAttribute('aria-expanded', 'false'); tog.setAttribute('aria-label', 'Меню');
  nav.id = 'site-nav'; tog.setAttribute('aria-controls', 'site-nav');
  tog.innerHTML = '<i></i><i></i>';
  function setOpen(on) {
    header.classList.toggle('is-open', on); tog.setAttribute('aria-expanded', String(on));
    mount.classList.toggle('is-menu', on);
    document.documentElement.classList.toggle('is-menu-open', on);   // меню на весь экран — страница под ним стоит
    if (window.LENIS) { if (on) LENIS.stop(); else LENIS.start(); }
  }
  tog.addEventListener('click', function () { setOpen(!header.classList.contains('is-open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); tog.focus(); } });
  document.addEventListener('click', function (e) { if (header.classList.contains('is-open') && !header.contains(e.target)) setOpen(false); });
  matchMedia('(min-width: 1024px)').addEventListener('change', function () { setOpen(false); });
  header.append(tog);
  if (site.cta && safeUrl(site.cta.href)) {
    var cta = link(site.cta.label, site.cta.href, 'button button--small');
    // Короткая подпись для телефона (cta.short): обе версии в разметке, видимость — в base.css
    if (site.cta.short) { cta.textContent = ''; var l = document.createElement('span'); l.className = 'cta-long'; l.textContent = site.cta.label; var s = document.createElement('span'); s.className = 'cta-short'; s.textContent = site.cta.short; cta.append(l, s); }
    header.append(cta);
  }
  mount.replaceChildren(header);
})();

// Анкета «Рассчитать под ключ» (правка 2026-10-06, образец — only.digital/#brief). Любая ссылка на #brief или кнопка
// с data-brief открывает страницу-анкету поверх сайта: она выезжает снизу (0,9 с), у неё своя шапка с названием
// и крестиком, вопросы разделены линиями. Адрес — …#brief: «назад» в браузере, Esc и крестик закрывают анкету,
// по ссылке с #brief она открыта сразу. Модель и сумма — из калькулятора (событие calc:update) или по ценам models-data.js.
// Форма показательная: ничего не отправляет и честно об этом говорит. Без JS кнопка первого экрана ведёт к форме внизу главной.
(function () {
  if (!window.SITE || typeof HTMLDialogElement !== 'function') return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement, ROOT = new URL('../../', document.currentScript.src);
  var models = (window.CAR_DATA && window.CAR_DATA.models) || [];
  var fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  var calc = null, pushed = false, closing = false, closeT = 0, lastFocus = null, touched = false;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chip(name, value, text) { return '<label class="brief-chip"><input type="radio" name="' + name + '" value="' + esc(value) + '"><span>' + esc(text) + '</span></label>'; }
  function row(n, title, body) {
    return '<div class="brief__row" role="group" aria-labelledby="brief-h' + n + '" style="--i:' + n + '">' +
      '<h3 class="brief__h" id="brief-h' + n + '"><span class="brief__n">0' + n + '</span>' + title + '</h3><div class="brief__fields">' + body + '</div></div>';
  }

  var carChips = models.map(function (m) { return chip('car', m.id, m.name); }).join('') + chip('car', 'other', 'Другая модель') + chip('car', 'pick', 'Подберите за меня');
  var dlg = document.createElement('dialog');
  dlg.className = 'brief';
  dlg.setAttribute('aria-labelledby', 'brief-title');
  dlg.setAttribute('autofocus', '');   // фокус при открытии — на само окно, не на кнопку в ещё не выехавшем листе
  dlg.innerHTML =
    '<div class="brief__bg" aria-hidden="true"></div>' +
    '<div class="brief__sheet" data-lenis-prevent>' +
      '<div class="brief__head"><span class="brief__logo">' + esc(window.SITE.name || '') + '</span>' +
        '<button class="brief__close" type="button" aria-label="Закрыть анкету" data-brief-close></button></div>' +
      '<div class="brief__body">' +
        '<div class="brief__intro" style="--i:0">' +
          '<h2 class="brief__title" id="brief-title"><span class="brief__t1">Рассчитаем вашу машину</span> <span class="brief__t2">под ключ</span></h2>' +
          '<p class="brief__lead">Ответьте на четыре вопроса&nbsp;— пришлём расчёт по строкам: машина, доставка, таможня, сборы и наша услуга. И проверим, есть ли машина на площадках в Китае.</p>' +
        '</div>' +
        '<form class="brief__form" method="post" novalidate>' +
          row(1, 'Машина',
            '<div class="brief__chips">' + carChips + '</div>' +
            '<p class="brief__est" data-brief-est hidden></p>' +
            '<label class="brief-field"><span>Комплектация, цвет, пожелания</span><textarea name="wish" rows="3" placeholder="Например: полный привод, светлый салон, не старше 2025 года"></textarea></label>') +
          row(2, 'Бюджет под ключ',
            '<div class="brief__chips">' + chip('budget', '<90', 'до 90 тыс. BYN') + chip('budget', '90-120', '90–120 тыс. BYN') + chip('budget', '120-180', '120–180 тыс. BYN') +
              chip('budget', '>180', 'больше 180 тыс. BYN') + chip('budget', '?', 'пока не знаю') + '</div>') +
          row(3, 'Когда нужна машина',
            '<div class="brief__chips">' + chip('when', 'asap', 'как можно скорее') + chip('when', '3m', 'в ближайшие 3 месяца') + chip('when', 'look', 'пока присматриваюсь') + '</div>') +
          row(4, 'Контакты',
            '<div class="brief__pair">' +
              '<label class="brief-field"><span>Имя</span><input name="name" autocomplete="name" required></label>' +
              '<label class="brief-field"><span>Телефон</span><span class="brief-tel"><b aria-hidden="true">+375</b><input name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="00 000-00-00" required></span></label>' +
            '</div>' +
            '<p class="brief__sub">Как удобнее связаться</p>' +
            '<div class="brief__chips">' + chip('via', 'call', 'звонок') + chip('via', 'telegram', 'Telegram') + chip('via', 'viber', 'Viber') + chip('via', 'whatsapp', 'WhatsApp') + '</div>') +
          '<div class="brief__row brief__row--send" style="--i:5"><div class="brief__fields">' +
            '<label class="brief__consent"><input type="checkbox" name="consent" required> <span>Даю <a href="' + new URL('legal/consent.html', ROOT).href + '">согласие на обработку персональных данных</a> и ознакомлен(а) с <a href="' + new URL('legal/privacy.html', ROOT).href + '">политикой конфиденциальности</a></span></label>' +
            '<p class="brief__error" data-brief-error role="alert" hidden></p>' +
            '<div class="brief__send"><button class="button button--arrow" type="submit"><span>Отправить заявку</span><i aria-hidden="true">↘</i></button>' +
            '</div>' +
          '</div></div>' +
        '</form>' +
        '<div class="brief__done" data-brief-done tabindex="-1" hidden>' +
          '<h3 class="brief__h">Заявка не отправлена</h3>' +
          '<p>Это демонстрационная форма: сайт&nbsp;— концепт для портфолио, компания «Восток Драйв» условная. Ваши данные никуда не ушли.</p>' +
          '<button class="button button--ghost" type="button" data-brief-close>Вернуться на сайт</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.append(dlg);

  var sheet = dlg.querySelector('.brief__sheet'), form = dlg.querySelector('form'), est = dlg.querySelector('[data-brief-est]');
  var done = dlg.querySelector('[data-brief-done]'), err = dlg.querySelector('[data-brief-error]');

  // Модель из калькулятора: выбранная в анкете машина получает ориентировочный итог под ключ
  document.addEventListener('calc:update', function (e) { calc = e.detail; });
  function estimate() {
    var r = form.querySelector('[name="car"]:checked'), m = r && models.filter(function (x) { return x.id === r.value; })[0];
    if (!m) { est.hidden = true; return; }
    var total = calc && calc.model && calc.model.id === m.id ? calc.total : (window.calcTurnkey ? window.calcTurnkey(m, m.priceCny, false).total : 0);
    if (!total) { est.hidden = true; return; }
    est.innerHTML = 'По нашему калькулятору&nbsp;— <b>≈ ' + fmt.format(total) + '&nbsp;BYN</b> под ключ. Приложим расчёт к заявке.';
    est.hidden = false;
  }
  form.addEventListener('change', function (e) { if (e.target.name === 'car') { touched = true; estimate(); } if (!err.hidden) check(false); });
  function prefill() {
    if (!touched && calc && calc.model) {
      var r = form.querySelector('[name="car"][value="' + calc.model.id + '"]'); if (r) r.checked = true;
    }
    estimate();
  }

  function check(show) {
    var bad = [].filter.call(form.querySelectorAll('[required]'), function (f) { return f.type === 'checkbox' ? !f.checked : !f.value.trim(); });
    [].forEach.call(form.querySelectorAll('[required]'), function (f) { f.toggleAttribute('aria-invalid', bad.indexOf(f) >= 0); });
    var names = bad.map(function (f) { return { name: 'имя', phone: 'телефон', consent: 'согласие' }[f.name]; });
    err.hidden = !bad.length;
    if (bad.length) err.textContent = 'Заполните: ' + names.join(', ') + '.';
    if (bad.length && show) bad[0].focus();
    return !bad.length;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!check(true)) return;
    form.hidden = true; done.hidden = false;
    done.focus({ preventScroll: true });
    sheet.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });

  function open(push) {
    if (dlg.open && !closing) return;
    clearTimeout(closeT); closing = false;
    if (push && location.hash !== '#brief') { history.pushState({ brief: 1 }, '', '#brief'); pushed = true; }
    if (!dlg.open) {
      lastFocus = document.activeElement;
      if (!done.hidden) { form.reset(); touched = false; err.hidden = true; }   // после «отправки» — чистая анкета, согласие снято
      form.hidden = false; done.hidden = true;   // после «отправки» анкета снова открывается с формой
      prefill();
      root.classList.add('has-brief');
      if (window.LENIS) window.LENIS.stop();
      dlg.classList.remove('is-shown');
      dlg.showModal();
      sheet.scrollTop = 0;
      dlg.querySelector('.brief__close').focus({ preventScroll: true });
      // начальное положение — за нижним краем; выезд — со следующего кадра, когда анкета уже разложена и нарисована
      // (иначе первый кадр раскладки съедает начало движения)
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (dlg.open && !closing) dlg.classList.add('is-shown'); }); });
      return;
    }
    dlg.classList.add('is-shown');
  }
  function finish() {
    closing = false;
    if (dlg.open) dlg.close();
    root.classList.remove('has-brief');
    if (window.LENIS) window.LENIS.start();
    if (window.SHOWROOM) window.SHOWROOM.relayout();   // 3D-сцена под анкетой стояла — продолжить
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function close() {
    if (!dlg.open || closing) return;
    closing = true;
    dlg.classList.remove('is-shown');
    closeT = setTimeout(finish, reduce ? 0 : 800);
  }
  function requestClose() {
    if (pushed) { pushed = false; history.back(); return; }   // popstate закроет анкету
    if (location.hash === '#brief') history.replaceState(null, '', location.pathname + location.search);
    close();
  }

  addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#brief"], [data-brief]');
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); e.stopPropagation();   // раньше плавной прокрутки к якорю
    open(true);
  }, true);
  dlg.addEventListener('click', function (e) { if (e.target.closest('[data-brief-close]')) requestClose(); });
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); requestClose(); });   // Esc
  addEventListener('popstate', function () { if (location.hash === '#brief') open(false); else { pushed = false; close(); } });
  if (location.hash === '#brief') open(false);
})();

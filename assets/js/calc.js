// Калькулятор «под ключ» и выбор модели (данные — models-data.js). Выбор модели меняет машину в 3D-зале,
// каждый пересчёт сообщает событием calc:update (суммы этапов в блоке «Оплата»).
// Без JS в разметке остаётся готовый пример расчёта. Суммы меняются плавно (0,8 с), при reduce — сразу.
(function () {
  var D = window.CAR_DATA, form = document.querySelector('[data-calc]');
  if (!D || !form || !window.calcTurnkey) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  var select = form.querySelector('[name="model"]'), price = form.querySelector('[name="price"]');
  var quotaGroup = form.querySelector('[data-quota-group]'), typeOut = form.querySelector('[data-model-type]');
  var shown = {}, anim = null, current = null;

  function model() { return D.models.filter(function (m) { return m.id === select.value; })[0] || D.models[0]; }
  function quota() { var r = form.querySelector('[name="quota"]:checked'); return !!r && r.value === 'in'; }

  function render(values) {
    Object.keys(values).forEach(function (k) {
      var el = form.querySelector('[data-value="' + k + '"]');
      if (el) el.textContent = fmt.format(values[k]) + (k === 'usd' ? ' $' : ' BYN');
    });
  }
  function animateTo(target) {
    var from = Object.assign({}, shown), t0 = performance.now();
    if (anim) cancelAnimationFrame(anim);
    function step(now) {
      var t = reduce ? 1 : Math.min(1, (now - t0) / 800), e = 1 - Math.pow(1 - t, 3), v = {};
      Object.keys(target).forEach(function (k) { v[k] = (from[k] == null ? target[k] : from[k]) + (target[k] - (from[k] == null ? target[k] : from[k])) * e; });
      render(v); shown = v;
      if (t < 1) anim = requestAnimationFrame(step); else anim = null;
    }
    anim = requestAnimationFrame(step);
  }
  // Цена вне 10 000…5 000 000 ¥ (пока её набирают, например «5») — в чеке прочерки и поле подсвечено, а не молчаливый
  // расчёт по минимуму; уход с поля возвращает цену модели (правка 2026-10-06 по итогам проверки)
  function outOfRange() { var v = Number(price.value); return price.value.trim() !== '' && !(v >= 10000 && v <= 5000000); }
  function update() {
    var m = model(), bad = outOfRange();
    price.toggleAttribute('aria-invalid', bad);
    if (bad) {
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      form.querySelectorAll('[data-value]').forEach(function (el) { el.textContent = '—'; });
      shown = {};
      return;
    }
    var p = Number(price.value) || m.priceCny;
    var r = window.calcTurnkey(m, p, quota()), target = { total: r.total, usd: r.totalUsd };
    r.lines.forEach(function (l) {
      target[l.key] = l.value;
      var lab = form.querySelector('[data-label="' + l.key + '"]'); if (lab) lab.textContent = l.label;
    });
    if (typeOut) typeOut.textContent = m.typeLabel + (m.cc ? ', ' + fmt.format(m.cc) + ' см³' : '') + ' · ' + m.body;
    if (quotaGroup) quotaGroup.hidden = m.type !== 'ev';
    current = { model: m, total: r.total };
    document.dispatchEvent(new CustomEvent('calc:update', { detail: { model: m, lines: r.lines, total: r.total } }));
    animateTo(target);
  }
  function pick(id, fromCalc) {
    var m = D.models.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    select.value = m.id; price.value = m.priceCny;
    document.querySelectorAll('[data-model-pick]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-model-pick') === id)); });
    if (window.SHOWROOM) window.SHOWROOM.setCar(m.id, m.paint, m.paintName);   // машина в зале меняется на выбранную
    update();
  }

  // начальные значения — как в разметке, чтобы первая анимация не прыгала с нуля
  form.querySelectorAll('[data-value]').forEach(function (el) { shown[el.getAttribute('data-value')] = Number(el.textContent.replace(/[^\d]/g, '')) || 0; });
  select.addEventListener('change', function () { pick(select.value, true); });
  price.addEventListener('input', update);
  price.addEventListener('change', function () { if (outOfRange()) { price.value = model().priceCny; update(); } });
  form.querySelectorAll('[name="quota"]').forEach(function (r) { r.addEventListener('change', update); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  document.querySelectorAll('[data-model-pick]').forEach(function (b) {
    b.addEventListener('click', function () { pick(b.getAttribute('data-model-pick')); });
  });

  // «Отправить расчёт» — переносит модель и сумму в форму заявки
  var send = form.querySelector('[data-calc-send]');
  if (send) send.addEventListener('click', function () {
    var lead = document.getElementById('contacts'), field = lead && lead.querySelector('[name="car"]');
    if (field && current) field.value = current.model.name + '\u00a0— ≈ ' + fmt.format(current.total) + ' BYN под ключ (пример расчёта)';
    if (lead) {
      lead.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      var name = lead.querySelector('[name="name"]'); if (name) setTimeout(function () { name.focus({ preventScroll: true }); }, reduce ? 0 : 900);
    }
  });
  update();
})();

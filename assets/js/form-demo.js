// Демонстрационная форма: ничего не отправляет и честно об этом говорит.
// В HTML кнопка отправки выключена (disabled) — без JS форму не отправить и данные не попадут в адрес.
(function () {
  document.querySelectorAll('form[data-form="demo"]').forEach(function (form) {
    var status = form.querySelector('[data-form-status]');
    form.querySelectorAll('[type="submit"]').forEach(function (b) { b.disabled = false; });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (status) status.textContent = 'Это демонстрационная форма: заявка не отправлена. Сайт\u00a0— концепт для портфолио, компания «Восток Драйв» условная.';
    });
  });
})();

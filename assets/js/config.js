// Один источник для всех страниц: название, контакты, мессенджеры, аналитика, меню.
// Правится здесь — меняется на каждой странице. Относительные ссылки — от папки site/.
window.SITE = {
  name: "Восток Драйв",
  tagline: "Новые автомобили из Китая под ключ: подбор, проверка на площадке, доставка, растаможка в Минске.",
  phone: "",            // "+375 29 000-00-00"; пусто — не показывается
  email: "",            // пусто — не показывается
  // Условные контакты портфолио: показываются текстом, без звонка и письма по клику.
  contactsText: ["+375 00 000-00-00", "info@example.com", "Минск"],
  messengers: {         // полные ссылки; пустые не показываются
    telegram: "",       // https://t.me/username
    whatsapp: "",       // https://wa.me/375290000000 (только цифры номера)
    viber: "",          // viber://chat?number=%2B375290000000
    instagram: "",      // https://instagram.com/username
    max: ""             // ссылка «Поделиться профилем» из приложения MAX
  },
  // Показательные кнопки мессенджеров: ведут к форме заявки (компания условная).
  messengerStubs: { labels: ["Telegram", "Viber", "WhatsApp", "Instagram"], href: "index.html#contacts" },
  // Подвал внизу — только копирайт (правка 2026-10-05: пометка концепта и авторы 3D-моделей и фото убраны по решению владельца).
  metrikaId: "",        // номер счётчика Яндекс.Метрики; пусто — Метрика не подключается и баннер не показывается
  cookieBanner: false,   // true — баннер; Метрика только после «Принять все». false — баннера нет и аналитика не загружается
  cookiePolicy: "legal/cookies.html",
  menu: [
    { title: "Модели", href: "index.html#models" },
    { title: "Расчёт", href: "index.html#calc" },
    { title: "Путь машины", href: "index.html#route" },
    { title: "Оплата", href: "index.html#pay" },
    { title: "Вопросы", href: "index.html#faq" }
  ],
  cta: { label: "Рассчитать под ключ", short: "Рассчитать", href: "index.html#brief" },   // открывает анкету (brief.js, правка 2026-10-06)
  legal: [
    { title: "Политика конфиденциальности", href: "legal/privacy.html" },
    { title: "Согласие на обработку данных", href: "legal/consent.html" },
    { title: "Cookie", href: "legal/cookies.html" }
  ]
};

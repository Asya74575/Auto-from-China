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
  // Авторы 3D-моделей и фото — мелким шрифтом в конце подвала (правка 2026-10-07, решение владельца; лицензии CC BY требуют
  // указать автора). Источники — materials/3d/pipeline/*-meta.json, materials/media/reviews/SOURCES.md
  credits: [
    { label: "3D-модели — Sketchfab, изменены: убраны логотипы, надписи и номера.", items: [
      { text: "Zeekr 7X 2025 — ItsDiyor", href: "https://sketchfab.com/3d-models/zeekr-7x-2025-665a30d4c74048e4aec4749411844062", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" },
      { text: "Xiaomi SU7 — Car2022", href: "https://sketchfab.com/3d-models/xiaomi-su7-ca2cda599f5341068c992c9f44551bf9", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" },
      { text: "Lixiang L9 — playmode280513", href: "https://sketchfab.com/3d-models/lixiang-l9-274ee627b32c4dd8997469e0bdcf47b3", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" },
      { text: "2023 BYD Song Plus — NazhDesign", href: "https://sketchfab.com/3d-models/2023-byd-song-plus-46546075cf4a40d4b75f010685168b9f", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" },
      { text: "Haval II Big Dog 2024 — ItsDiyor", href: "https://sketchfab.com/3d-models/haval-ii-big-dog-2024-e147e86ccad6405dbb3b1a6ed67889cf", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" },
      { text: "2023 Chery Tiggo 8 Pro — NazhDesign", href: "https://sketchfab.com/3d-models/2023-chery-tiggo-8-pro-b8d34fba89ca45918e851eaab3b5b679", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" }
    ] },
    { label: "Фото машин в отзывах — Wikimedia Commons, изменены: кадрирование, размыты значки и номера; это иллюстрации моделей, не машины клиентов.", items: [
      { text: "Zeekr 7X — Retired electrician", href: "https://commons.wikimedia.org/wiki/File:Moscow,_Zeekr_7X,_May_2026_01.jpg", license: "CC0 1.0", licenseHref: "https://creativecommons.org/publicdomain/zero/1.0/deed.ru" },
      { text: "Li Auto L6 — S5A-0043", href: "https://commons.wikimedia.org/wiki/File:(CHN-Shanghai)_Showcar_Li_L6_No-plate_2024-12-11.jpg", license: "CC BY 4.0", licenseHref: "https://creativecommons.org/licenses/by/4.0/deed.ru" },
      { text: "Geely Monjaro — Milhouse35", href: "https://commons.wikimedia.org/wiki/File:Geely_Monjaro.jpg", license: "CC BY-SA 4.0, изменённое фото — под той же лицензией", licenseHref: "https://creativecommons.org/licenses/by-sa/4.0/deed.ru" }
    ] }
  ],
  legal: [
    { title: "Политика конфиденциальности", href: "legal/privacy.html" },
    { title: "Согласие на обработку данных", href: "legal/consent.html" },
    { title: "Cookie", href: "legal/cookies.html" }
  ]
};

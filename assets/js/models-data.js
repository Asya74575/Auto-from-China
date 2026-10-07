// Модели и условия расчёта — один источник для блока «Модели» и калькулятора.
// Цены в Китае и курсы условные (портфолио). Ставки таможни — реальные для РБ на сентябрь 2026 (materials/texts/konkurenty.md).
window.CAR_DATA = {
  rates: { cny: 0.416, usd: 3.0, eur: 3.45 },   // BYN за 1 ¥ / $ / € — условно
  delivery: { usd: 2800, text: "ж/д-контейнер до Минска, страховка в пути" },
  fees: { util: 624.92, customs: 120, svh: 450 }, // утильсбор (до 3 лет), таможенный сбор, СВХ + декларант + ЭПТС
  service: 1500,
  // Пошлина ЕАЭС для личного пользования, авто до 3 лет: доля от стоимости, но не меньше € за 1 см³.
  duty: [
    { upTo: 8500, pct: 0.54, perCc: 2.5 },
    { upTo: 16700, pct: 0.48, perCc: 3.5 },
    { upTo: 42300, pct: 0.48, perCc: 5.5 },
    { upTo: 84500, pct: 0.48, perCc: 7.5 },
    { upTo: 169000, pct: 0.48, perCc: 15 },
    { upTo: Infinity, pct: 0.48, perCc: 20 }
  ],
  evOverQuota: 0.15,  // электромобиль сверх льготной квоты; в квоте пошлины нет; НДС 0% до 31.12.2028
  models: [
    { id: "zeekr-7x", name: "Zeekr 7X", type: "ev", typeLabel: "Электро", body: "кроссовер", cc: 0, priceCny: 229900, paint: "#cfcac0", paintName: "Перламутр" },
    { id: "xiaomi-su7", name: "Xiaomi SU7", type: "ev", typeLabel: "Электро", body: "седан", cc: 0, priceCny: 215900, paint: "#13254a", paintName: "Ночной синий" },
    { id: "li-l9", name: "Li Auto L9", type: "erev", typeLabel: "Гибрид с запасом хода", body: "большой кроссовер", cc: 1496, priceCny: 409800, paint: "#1f2227", paintName: "Графит" },
    { id: "byd-song-plus", name: "BYD Song Plus DM-i", type: "phev", typeLabel: "Подключаемый гибрид", body: "кроссовер", cc: 1498, priceCny: 149800, paint: "#6e0b10", paintName: "Кармин" },
    { id: "haval-dargo", name: "Haval Dargo", type: "ice", typeLabel: "Бензин 2.0T", body: "кроссовер", cc: 1967, priceCny: 139900, paint: "#7d8087", paintName: "Серебро" },
    { id: "chery-tiggo-8-pro", name: "Chery Tiggo 8 Pro", type: "ice", typeLabel: "Бензин 1.6T", body: "кроссовер, 7 мест", cc: 1598, priceCny: 119900, paint: "#0c0d10", paintName: "Чёрный" }
  ]
};

// Расчёт под ключ: строки в BYN. model — из списка, priceCny — можно поправить, quota — электромобиль в льготной квоте.
window.calcTurnkey = function (model, priceCny, quota) {
  var d = window.CAR_DATA, r = d.rates;
  var car = priceCny * r.cny;
  var delivery = d.delivery.usd * r.usd;
  var duty = 0;
  if (model.type === "ev") {
    duty = quota ? 0 : car * d.evOverQuota;
  } else {
    var eur = car / r.eur, band = d.duty.filter(function (b) { return eur <= b.upTo; })[0];
    duty = Math.max(eur * band.pct, model.cc * band.perCc) * r.eur;
  }
  var fees = d.fees.util + d.fees.customs + d.fees.svh;
  var lines = [
    { key: "car", label: "Машина в Китае", value: car },
    { key: "delivery", label: "Доставка в Минск", value: delivery },
    { key: "duty", label: model.type === "ev" ? (quota ? "Пошлина\u00a0— 0 в льготной квоте" : "Пошлина 15% сверх квоты") : "Таможенная пошлина", value: duty },
    { key: "fees", label: "Утильсбор, сбор, СВХ, ЭПТС", value: fees },
    { key: "service", label: "Услуга «Восток Драйв»", value: d.service }
  ];
  lines.forEach(function (l) { l.value = Math.round(l.value); });   // итог = сумма видимых округлённых строк
  var total = lines.reduce(function (s, l) { return s + l.value; }, 0);
  return { lines: lines, total: total, totalUsd: total / r.usd };
};

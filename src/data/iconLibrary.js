// Sélection organisée d'icônes Tabler (open-source, MIT) pour la
// personnalisation des catégories et actifs. ~140 icônes pertinentes,
// regroupées par thème pour faciliter la recherche visuelle.
export const ICON_LIBRARY = [
  {
    theme: "Maison & vie quotidienne",
    icons: [
      "ti-home", "ti-building", "ti-bed", "ti-armchair", "ti-bath",
      "ti-bulb", "ti-plug", "ti-droplet", "ti-flame", "ti-wash",
      "ti-iron", "ti-trash", "ti-tools", "ti-hammer", "ti-paint",
      "ti-plant", "ti-flower", "ti-key", "ti-door", "ti-window",
    ],
  },
  {
    theme: "Nourriture & boissons",
    icons: [
      "ti-tools-kitchen-2", "ti-coffee", "ti-pizza", "ti-burger", "ti-cup",
      "ti-bottle", "ti-bread", "ti-apple", "ti-ice-cream", "ti-soup",
      "ti-salad", "ti-cheese", "ti-meat", "ti-fish", "ti-glass-full",
    ],
  },
  {
    theme: "Transport",
    icons: [
      "ti-car", "ti-bike", "ti-bus", "ti-train", "ti-plane",
      "ti-ship", "ti-walk", "ti-rocket", "ti-gas-station", "ti-parking",
      "ti-road", "ti-steering-wheel", "ti-motorbike", "ti-scooter",
    ],
  },
  {
    theme: "Santé & bien-être",
    icons: [
      "ti-heart", "ti-heartbeat", "ti-pill", "ti-stethoscope", "ti-vaccine",
      "ti-tooth", "ti-eye", "ti-yoga", "ti-run", "ti-barbell",
      "ti-massage", "ti-first-aid-kit", "ti-mood-smile", "ti-brain",
    ],
  },
  {
    theme: "Argent & finance",
    icons: [
      "ti-coin", "ti-cash", "ti-credit-card", "ti-wallet", "ti-receipt",
      "ti-chart-line", "ti-chart-candle", "ti-pig-money", "ti-building-bank",
      "ti-currency-bitcoin", "ti-currency-dollar", "ti-currency-euro",
      "ti-receipt-tax", "ti-percentage",
    ],
  },
  {
    theme: "Travail & éducation",
    icons: [
      "ti-briefcase", "ti-school", "ti-book", "ti-books", "ti-pencil",
      "ti-certificate", "ti-presentation", "ti-device-laptop", "ti-printer",
      "ti-paperclip", "ti-folder", "ti-clipboard",
    ],
  },
  {
    theme: "Loisirs & culture",
    icons: [
      "ti-movie", "ti-music", "ti-device-gamepad", "ti-camera", "ti-palette",
      "ti-ticket", "ti-mask", "ti-disc", "ti-microphone", "ti-confetti",
      "ti-puzzle", "ti-chess", "ti-photo", "ti-headphones",
    ],
  },
  {
    theme: "Shopping & objets",
    icons: [
      "ti-shopping-bag", "ti-shopping-cart", "ti-shirt", "ti-shoe", "ti-gift",
      "ti-device-mobile", "ti-device-desktop", "ti-watch", "ti-glasses",
      "ti-diamond", "ti-tag", "ti-package",
    ],
  },
  {
    theme: "Famille & animaux",
    icons: [
      "ti-baby-carriage", "ti-users", "ti-paw", "ti-dog", "ti-cat",
      "ti-friends", "ti-heart-handshake",
    ],
  },
  {
    theme: "Voyage & nature",
    icons: [
      "ti-plane", "ti-luggage", "ti-map", "ti-compass", "ti-tent",
      "ti-beach", "ti-mountain", "ti-sun", "ti-world", "ti-anchor",
    ],
  },
  {
    theme: "Sport & fitness",
    icons: [
      "ti-run", "ti-barbell", "ti-ball-football", "ti-ball-basketball",
      "ti-swimming", "ti-bike", "ti-trophy", "ti-target",
    ],
  },
  {
    theme: "Symboles génériques",
    icons: [
      "ti-star", "ti-tag", "ti-dots", "ti-sparkles", "ti-flag",
      "ti-bookmark", "ti-bell", "ti-calendar", "ti-clock", "ti-map-pin",
    ],
  },
];

// Liste plate de toutes les icônes (utile pour validation / fallback)
export const ALL_ICONS = ICON_LIBRARY.flatMap((group) => group.icons);

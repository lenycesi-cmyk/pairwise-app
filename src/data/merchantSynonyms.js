// Table de synonymes / marchands courants → catégorie (et sous-catégorie) par
// défaut, utilisée par parseNaturalTransaction quand aucun nom de catégorie
// explicite n'est reconnu dans la phrase. 100% heuristique, client-side.
//
// - `categoryId` vise les catégories PAR DÉFAUT (src/data/categories.js). Si le
//   couple a supprimé/renommé cette catégorie, l'entrée est simplement ignorée.
// - `subcategory` est validée à l'usage : si elle n'existe plus dans la
//   catégorie, on retombe sur la première sous-catégorie disponible.
// - Les entrées les plus spécifiques (ex. "uber eats") doivent précéder les
//   plus génériques (ex. "uber") car la recherche s'arrête à la 1re qui matche.
// - Les mots-clés sont en minuscules sans accents (comparés à un texte
//   normalisé via normalizeText), et matchés avec des frontières de mot.
export const MERCHANT_SYNONYMS = [
  // Livraison de repas (avant "uber" seul → VTC)
  { kw: ["uber eats", "ubereats", "deliveroo", "just eat", "justeat", "livraison repas"], categoryId: "food", subcategory: "Livraison de repas" },
  // Courses / supermarchés
  { kw: ["carrefour", "leclerc", "auchan", "lidl", "aldi", "monoprix", "franprix", "intermarche", "casino", "supermarche", "grocery", "groceries"], categoryId: "food", subcategory: "Courses" },
  { kw: ["starbucks"], categoryId: "food", subcategory: "Café à emporter" },
  { kw: ["boulangerie", "patisserie"], categoryId: "food", subcategory: "Boulangerie / pâtisserie" },
  // Restaurants & fast-food
  { kw: ["resto", "restaurant", "restau", "mcdo", "mcdonald", "mcdonalds", "burger king", "kfc", "subway", "domino", "pizza", "pizzeria", "brasserie", "bistrot"], categoryId: "leisure", subcategory: "Restaurants" },
  { kw: ["bar", "pub", "biere"], categoryId: "leisure", subcategory: "Bars" },
  { kw: ["cinema", "ugc", "pathe", "gaumont"], categoryId: "leisure", subcategory: "Cinéma" },
  // Abonnements / streaming
  { kw: ["netflix", "disney", "canal", "prime video", "ocs"], categoryId: "subscriptions", subcategory: "Streaming vidéo" },
  { kw: ["spotify", "deezer", "apple music"], categoryId: "subscriptions", subcategory: "Streaming musical" },
  { kw: ["icloud", "google one", "dropbox"], categoryId: "subscriptions", subcategory: "Cloud storage" },
  // Transport
  { kw: ["uber", "bolt", "heetch", "taxi", "vtc"], categoryId: "transport", subcategory: "VTC / taxi" },
  { kw: ["essence", "shell", "esso", "gazole", "diesel", "carburant", "station service"], categoryId: "transport", subcategory: "Essence" },
  { kw: ["parking"], categoryId: "transport", subcategory: "Parking" },
  { kw: ["peage"], categoryId: "transport", subcategory: "Péage" },
  { kw: ["metro", "ratp", "navigo", "tram", "tramway", "bus"], categoryId: "transport", subcategory: "Transports en commun" },
  // Voyages
  { kw: ["sncf", "tgv", "ouigo", "train", "trainline"], categoryId: "travel", subcategory: "Train" },
  { kw: ["ryanair", "easyjet", "air france", "avion"], categoryId: "travel", subcategory: "Billets d'avion" },
  { kw: ["airbnb", "booking", "hotel"], categoryId: "travel", subcategory: "Hôtels" },
  // Santé / beauté
  { kw: ["pharmacie"], categoryId: "health", subcategory: "Pharmacie" },
  { kw: ["coiffeur", "coiffure", "barbier"], categoryId: "beauty", subcategory: "Coiffeur" },
  // Sport
  { kw: ["basic fit", "basicfit", "fitness park", "gym", "salle de sport"], categoryId: "sport", subcategory: "Abonnement salle" },
  { kw: ["decathlon"], categoryId: "sport", subcategory: "Équipement sportif" },
  // Vêtements
  { kw: ["zara", "uniqlo", "zalando", "nike", "adidas"], categoryId: "clothing", subcategory: "Vêtements du quotidien" },
  // Animaux
  { kw: ["veterinaire", "veto"], categoryId: "pets", subcategory: "Vétérinaire" },
];

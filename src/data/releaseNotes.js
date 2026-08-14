// Notes de version — ÉCRITES À LA MAIN, et c'est délibéré.
//
// Une génération automatique à partir des commits ne serait pas lisible : elle
// dirait « corrige la zone morte temporelle » là où l'utilisateur doit lire
// « l'ajout de transaction remarche ». Le prix est un entretien : sans quelques
// lignes ajoutées ici à chaque lot livré, la feuille se tait.
//
// Ordre : le plus RÉCENT en premier. `version` sert de clé de comparaison — on
// prend la date au format `AAAA.MM.JJ`, qui se trie comme une chaîne et se lit
// comme une date, l'app n'ayant par ailleurs aucun numéro de version.
//
// `icon` est un emoji : le fichier est du contenu, pas de l'interface, et une
// classe d'icône y ferait entrer une dépendance de rendu.

export const RELEASE_NOTES = [
  {
    version: "2026.08.15.1",
    date: "2026-08-15",
    items: [
      {
        icon: "\ud83c\udfe0",
        fr: { title: "L'accueil du site, c'est l'app", body: "pairwise.finance affiche d\u00e9sormais le m\u00eame \u00e9cran d'accueil que l'app. Ta premi\u00e8re saisie te suit : tu ne la retapes plus en arrivant." },
        en: { title: "The site's home is the app", body: "pairwise.finance now shows the same home screen as the app. Your first entry follows you across \u2014 no retyping on arrival." },
      },
    ],
  },
  {
    version: "2026.08.15",
    date: "2026-08-15",
    items: [
      {
        icon: "🎙",
        fr: { title: "Dictée : « payé par » et « pour »", body: "Dis « 20 € resto payé par Nicolas pour nous deux » et l'attribution se remplit toute seule." },
        en: { title: "Voice: “paid by” and “for”", body: "Say “€20 dinner paid by Nicolas for both of us” and the attribution fills itself in." },
      },
      {
        icon: "🧹",
        fr: { title: "Description enfin propre", body: "Ce que la dictée a compris — tag, membre, catégorie — ne traîne plus dans la description. Sauf si c'était le seul mot dit : mieux vaut une redondance qu'un champ vide." },
        en: { title: "A clean description at last", body: "Whatever voice entry understood — tag, member, category — no longer lingers in the description. Unless it was the only word said: better redundant than empty." },
      },
    ],
  },
  {
    version: "2026.08.14.6",
    date: "2026-08-14",
    items: [
      {
        icon: "⌨️",
        fr: { title: "Ajout d'actif : le champ touché monte vraiment", body: "Toucher « Nom » dégage désormais « Valeur actuelle » et « Montant investi » sous le champ, sans faire défiler." },
        en: { title: "Add asset: the focused field really moves up", body: "Tapping “Name” now clears “Current value” and “Amount invested” below the field, with no scrolling." },
      },
    ],
  },
  {
    version: "2026.08.14.5",
    date: "2026-08-14",
    items: [
      {
        icon: "⌨️",
        fr: { title: "Saisie de transaction : le champ touché monte en haut", body: "Toucher « Description » remonte l'écran jusqu'à dégager les catégories, sans avoir à faire défiler. Le titre de la section reste visible." },
        en: { title: "Transaction entry: the focused field goes up", body: "Tapping “Description” scrolls up far enough to clear the categories, with no manual scrolling. The section title stays visible." },
      },
    ],
  },
  {
    version: "2026.08.14.4",
    date: "2026-08-14",
    items: [
      {
        icon: "⌨️",
        fr: { title: "Le champ touché monte vraiment en haut", body: "Même en bas du formulaire d'actif : la place manquante pour défiler est ajoutée le temps de la saisie, puis rendue." },
        en: { title: "The focused field really goes to the top", body: "Even at the bottom of the asset form: the missing scroll room is added while you type, then given back." },
      },
    ],
  },
  {
    version: "2026.08.14.3",
    date: "2026-08-14",
    items: [
      {
        icon: "⌨️",
        fr: { title: "Champs de saisie et clavier", body: "Dans l'ajout d'un actif, toucher un champ de texte remonte l'écran une fois le clavier ouvert, au lieu de laisser le champ coincé au milieu." },
        en: { title: "Text fields and keyboard", body: "In the add-asset form, tapping a text field scrolls the screen once the keyboard is up, instead of leaving the field stuck mid-screen." },
      },
    ],
  },
  {
    version: "2026.08.14.2",
    date: "2026-08-14",
    items: [
      {
        icon: "⚡",
        fr: { title: "Défilement automatique partout", body: "Budgets, actifs, objectifs et récurrences suivent la saisie de transaction : les panneaux qu'on ouvre remontent d'eux-mêmes à l'écran." },
        en: { title: "Auto-scroll everywhere", body: "Budgets, assets, goals and recurring rules now behave like transaction entry: panels scroll themselves into view when opened." },
      },
    ],
  },
  {
    version: "2026.08.14.1",
    date: "2026-08-14",
    items: [
      {
        icon: "✨",
        fr: { title: "Cette fenêtre, au bon moment", body: "Les nouveautés s'affichent maintenant à l'ouverture de l'app après une mise à jour, et plus seulement depuis les Réglages." },
        en: { title: "This sheet, at the right time", body: "What's new now appears when you open the app after an update, not only from Settings." },
      },
    ],
  },
  {
    version: "2026.08.14",
    date: "2026-08-14",
    items: [
      {
        icon: "🗂",
        fr: { title: "Archiver plutôt que supprimer", body: "Budgets, objectifs, tags et actifs se rangent dans une section « Archivés » au lieu de disparaître. Un budget archivé garde son historique de périodes." },
        en: { title: "Archive instead of deleting", body: "Budgets, goals, tags and assets move to an “Archived” section instead of vanishing. An archived budget keeps its period history." },
      },
      {
        icon: "🙈",
        fr: { title: "Masquer les montants", body: "Un œil dans l'en-tête du Patrimoine remplace les chiffres par des points — de quoi montrer un écran sans montrer ce qu'on possède." },
        en: { title: "Hide amounts", body: "An eye in the Wealth header replaces figures with dots — show a screen without showing what you own." },
      },
      {
        icon: "↩️",
        fr: { title: "Retour plus juste", body: "Le bouton retour ramène à l'onglet d'où l'on vient, à l'endroit exact où on l'avait laissé, au lieu de renvoyer à l'Accueil tout en haut." },
        en: { title: "Better back button", body: "Back returns to the tab you came from, at the exact spot you left it, instead of jumping to Home at the top." },
      },
      {
        icon: "⚡",
        fr: { title: "Saisie sans faire défiler", body: "Catégorie, sous-catégorie, membres, récurrence et tags remontent d'eux-mêmes à l'écran quand on les ouvre." },
        en: { title: "Entry without scrolling", body: "Category, subcategory, members, recurrence and tags scroll themselves into view when opened." },
      },
      {
        icon: "🗓",
        fr: { title: "Sélecteur de période", body: "Flèches et choix du mois réunis en un seul bouton, mois abrégés pour une largeur stable, et période personnalisée qui affiche enfin les bonnes dates." },
        en: { title: "Period selector", body: "Arrows and month picker merged into one control, abbreviated months for a stable width, and a custom period that finally shows the right dates." },
      },
      {
        icon: "👤",
        fr: { title: "Espace solo", body: "Seul, tout ce qui suppose deux personnes disparaît — suivi des dettes, « payé par », propriétaire d'un actif. Au passage, les dépenses ne sont plus comptées pour moitié dans les budgets personnels." },
        en: { title: "Solo space", body: "On your own, everything that assumes two people is hidden — debt tracking, “paid by”, asset ownership. Personal budgets also stop counting only half of your spending." },
      },
    ],
  },
];

// Version la plus récente publiée, ou null si le fichier est vide.
export const LATEST_RELEASE = RELEASE_NOTES[0]?.version || null;

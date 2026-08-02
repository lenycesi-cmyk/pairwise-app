// Suggestions cliquables de l'écran d'accueil de l'onboarding.
//
// Chaque exemple porte son `kind`, qui donne SA COULEUR — le code couleur de
// l'app : sage pour ce qui entre, tang pour ce qui sort, lavande pour ce qui
// est placé. Les trois natures d'écriture sont ainsi annoncées avant même le
// premier clic.
//
// Le `kind` n'est PAS transmis au parseur : le type doit rester ce que le texte
// seul produit, sinon la pastille promettrait une couleur que l'aperçu
// démentirait aussitôt. Les libellés sont donc écrits pour être reconnus tels
// quels (« Loyer perçu », « ETF », « Assurance Vie » — voir INVEST_WORDS et
// INCOME_WORDS dans utils/parseNaturalTransaction.js). C'est exactement ce que
// vérifie tests/unit/onboardingChips.test.js : une retouche du vocabulaire ou
// d'un libellé qui casserait l'accord se voit tout de suite.
//
// L'emoji vit à part du texte : il illustre la pastille mais n'est jamais tapé
// dans le champ, où il ne serait qu'un caractère de plus à analyser.
//
// Module de données pur (aucun React) : il est aussi lu par les tests.

export const KIND_COLOR = { income: "sage", expense: "tang", investment: "lavi" };

export const CHIPS = {
  fr: [
    { em: "💰", text: "2400€ salaire Juillet", kind: "income" },
    { em: "🛒", text: "60€ course hier", kind: "expense" },
    { em: "🍽️", text: "30€ Déjeuner", kind: "expense" },
    { em: "🏠", text: "800€ Crédit Immo", kind: "expense" },
    { em: "🔑", text: "400€ Loyer perçu Studio", kind: "income" },
    { em: "📱", text: "20€ Abonnement Téléphone", kind: "expense" },
    { em: "📈", text: "ETF 250 €", kind: "investment" },
    { em: "🛡️", text: "300 € Assurance Vie", kind: "investment" },
  ],
  en: [
    { em: "💰", text: "$2400 July salary", kind: "income" },
    { em: "🛒", text: "$60 groceries yesterday", kind: "expense" },
    { em: "🍽️", text: "$30 lunch", kind: "expense" },
    { em: "🏠", text: "$800 mortgage", kind: "expense" },
    { em: "🔑", text: "$400 studio rent collected", kind: "income" },
    { em: "📱", text: "$20 phone plan", kind: "expense" },
    { em: "📈", text: "ETF $250", kind: "investment" },
    { em: "🛡️", text: "$300 life insurance", kind: "investment" },
  ],
};

// Exemples qui défilent dans le champ tant que l'utilisateur n'a rien tapé.
// Même code couleur, appliqué au texte de substitution : un sous-ensemble des
// pastilles, choisi pour que les trois natures passent dans la rotation.
export const PLACEHOLDERS = {
  fr: [CHIPS.fr[0], CHIPS.fr[1], CHIPS.fr[6], CHIPS.fr[3], CHIPS.fr[4]],
  en: [CHIPS.en[0], CHIPS.en[1], CHIPS.en[6], CHIPS.en[3], CHIPS.en[4]],
};

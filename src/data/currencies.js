// Catalogue de devises.
//
// `CURRENCIES` = les quelques devises proposées d'emblée à un nouveau couple.
// `ALL_CURRENCIES` = le catalogue complet dans lequel on peut piocher via
// « Gérer les devises » : toutes les devises en circulation couvertes par
// open.er-api.com, l'API de taux utilisée par l'app.
//
// POURQUOI UNE LISTE COMPLÈTE. La conversion (utils/currencyConversion.js et
// hooks/useExchangeRates.js) est déjà générique : elle interroge
// `open.er-api.com/v6/latest/{code}` et lit `rates[cible]`, sans aucune liste
// blanche. Le catalogue n'est donc qu'un annuaire d'affichage (symbole + nom) ;
// le restreindre n'apportait aucune sécurité, cela empêchait seulement
// l'utilisateur de choisir sa propre devise. Ajouter une devise ici suffit à la
// rendre pleinement utilisable.
//
// ATTENTION en revanche à la table de repli hors-ligne
// (`FALLBACK_RATES_EUR_BASE`) : elle ne couvre qu'une poignée de devises. Pour
// toutes les autres, aucun taux n'est inventé — la conversion est refusée
// plutôt que fausse (cf. currencyConversion.js).

// Devises proposées par défaut (le couple peut en activer d'autres).
export const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "Dollar US" },
  { code: "VND", symbol: "₫", name: "Dong vietnamien" },
  { code: "GBP", symbol: "£", name: "Livre sterling" },
  { code: "JPY", symbol: "¥", name: "Yen japonais" },
  { code: "THB", symbol: "฿", name: "Baht thaïlandais" },
  { code: "CHF", symbol: "Fr", name: "Franc suisse" },
];

// Toutes les autres devises du catalogue, par ordre alphabétique de code.
const OTHER_CURRENCIES = [
  { code: "AED", symbol: "د.إ", name: "Dirham des Émirats arabes unis" },
  { code: "AFN", symbol: "؋", name: "Afghani afghan" },
  { code: "ALL", symbol: "L", name: "Lek albanais" },
  { code: "AMD", symbol: "֏", name: "Dram arménien" },
  { code: "ANG", symbol: "ƒ", name: "Florin antillais" },
  { code: "AOA", symbol: "Kz", name: "Kwanza angolais" },
  { code: "ARS", symbol: "$", name: "Peso argentin" },
  { code: "AUD", symbol: "A$", name: "Dollar australien" },
  { code: "AWG", symbol: "ƒ", name: "Florin arubais" },
  { code: "AZN", symbol: "₼", name: "Manat azerbaïdjanais" },
  { code: "BAM", symbol: "KM", name: "Mark convertible de Bosnie-Herzégovine" },
  { code: "BBD", symbol: "$", name: "Dollar barbadien" },
  { code: "BDT", symbol: "৳", name: "Taka bangladais" },
  { code: "BGN", symbol: "лв", name: "Lev bulgare" },
  { code: "BHD", symbol: ".د.ب", name: "Dinar bahreïni" },
  { code: "BIF", symbol: "FBu", name: "Franc burundais" },
  { code: "BMD", symbol: "$", name: "Dollar bermudien" },
  { code: "BND", symbol: "$", name: "Dollar de Brunei" },
  { code: "BOB", symbol: "Bs.", name: "Boliviano bolivien" },
  { code: "BRL", symbol: "R$", name: "Real brésilien" },
  { code: "BSD", symbol: "$", name: "Dollar bahaméen" },
  { code: "BTN", symbol: "Nu.", name: "Ngultrum bhoutanais" },
  { code: "BWP", symbol: "P", name: "Pula botswanais" },
  { code: "BYN", symbol: "Br", name: "Rouble biélorusse" },
  { code: "BZD", symbol: "$", name: "Dollar bélizien" },
  { code: "CAD", symbol: "C$", name: "Dollar canadien" },
  { code: "CDF", symbol: "FC", name: "Franc congolais" },
  { code: "CLP", symbol: "$", name: "Peso chilien" },
  { code: "CNY", symbol: "¥", name: "Yuan chinois" },
  { code: "COP", symbol: "$", name: "Peso colombien" },
  { code: "CRC", symbol: "₡", name: "Colón costaricien" },
  { code: "CUP", symbol: "$", name: "Peso cubain" },
  { code: "CVE", symbol: "$", name: "Escudo cap-verdien" },
  { code: "CZK", symbol: "Kč", name: "Couronne tchèque" },
  { code: "DJF", symbol: "Fdj", name: "Franc djiboutien" },
  { code: "DKK", symbol: "kr", name: "Couronne danoise" },
  { code: "DOP", symbol: "$", name: "Peso dominicain" },
  { code: "DZD", symbol: "د.ج", name: "Dinar algérien" },
  { code: "EGP", symbol: "£", name: "Livre égyptienne" },
  { code: "ERN", symbol: "Nfk", name: "Nakfa érythréen" },
  { code: "ETB", symbol: "Br", name: "Birr éthiopien" },
  { code: "FJD", symbol: "$", name: "Dollar fidjien" },
  { code: "FKP", symbol: "£", name: "Livre des Malouines" },
  { code: "FOK", symbol: "kr", name: "Couronne féroïenne" },
  { code: "GEL", symbol: "₾", name: "Lari géorgien" },
  { code: "GGP", symbol: "£", name: "Livre de Guernesey" },
  { code: "GHS", symbol: "₵", name: "Cedi ghanéen" },
  { code: "GIP", symbol: "£", name: "Livre de Gibraltar" },
  { code: "GMD", symbol: "D", name: "Dalasi gambien" },
  { code: "GNF", symbol: "FG", name: "Franc guinéen" },
  { code: "GTQ", symbol: "Q", name: "Quetzal guatémaltèque" },
  { code: "GYD", symbol: "$", name: "Dollar guyanien" },
  { code: "HKD", symbol: "HK$", name: "Dollar de Hong Kong" },
  { code: "HNL", symbol: "L", name: "Lempira hondurien" },
  { code: "HRK", symbol: "kn", name: "Kuna croate" },
  { code: "HTG", symbol: "G", name: "Gourde haïtienne" },
  { code: "HUF", symbol: "Ft", name: "Forint hongrois" },
  { code: "IDR", symbol: "Rp", name: "Roupie indonésienne" },
  { code: "ILS", symbol: "₪", name: "Shekel israélien" },
  { code: "IMP", symbol: "£", name: "Livre de l'île de Man" },
  { code: "INR", symbol: "₹", name: "Roupie indienne" },
  { code: "IQD", symbol: "ع.د", name: "Dinar irakien" },
  { code: "IRR", symbol: "﷼", name: "Rial iranien" },
  { code: "ISK", symbol: "kr", name: "Couronne islandaise" },
  { code: "JEP", symbol: "£", name: "Livre de Jersey" },
  { code: "JMD", symbol: "$", name: "Dollar jamaïcain" },
  { code: "JOD", symbol: "د.ا", name: "Dinar jordanien" },
  { code: "KES", symbol: "KSh", name: "Shilling kényan" },
  { code: "KGS", symbol: "с", name: "Som kirghize" },
  { code: "KHR", symbol: "៛", name: "Riel cambodgien" },
  { code: "KID", symbol: "$", name: "Dollar de Kiribati" },
  { code: "KMF", symbol: "CF", name: "Franc comorien" },
  { code: "KRW", symbol: "₩", name: "Won sud-coréen" },
  { code: "KWD", symbol: "د.ك", name: "Dinar koweïtien" },
  { code: "KYD", symbol: "$", name: "Dollar des îles Caïmans" },
  { code: "KZT", symbol: "₸", name: "Tenge kazakh" },
  { code: "LAK", symbol: "₭", name: "Kip laotien" },
  { code: "LBP", symbol: "ل.ل", name: "Livre libanaise" },
  { code: "LKR", symbol: "Rs", name: "Roupie srilankaise" },
  { code: "LRD", symbol: "$", name: "Dollar libérien" },
  { code: "LSL", symbol: "L", name: "Loti lesothan" },
  { code: "LYD", symbol: "ل.د", name: "Dinar libyen" },
  { code: "MAD", symbol: "د.م.", name: "Dirham marocain" },
  { code: "MDL", symbol: "L", name: "Leu moldave" },
  { code: "MGA", symbol: "Ar", name: "Ariary malgache" },
  { code: "MKD", symbol: "ден", name: "Denar macédonien" },
  { code: "MMK", symbol: "K", name: "Kyat birman" },
  { code: "MNT", symbol: "₮", name: "Tugrik mongol" },
  { code: "MOP", symbol: "P", name: "Pataca macanaise" },
  { code: "MRU", symbol: "UM", name: "Ouguiya mauritanienne" },
  { code: "MUR", symbol: "₨", name: "Roupie mauricienne" },
  { code: "MVR", symbol: ".ރ", name: "Rufiyaa maldivienne" },
  { code: "MWK", symbol: "MK", name: "Kwacha malawien" },
  { code: "MXN", symbol: "$", name: "Peso mexicain" },
  { code: "MYR", symbol: "RM", name: "Ringgit malaisien" },
  { code: "MZN", symbol: "MT", name: "Metical mozambicain" },
  { code: "NAD", symbol: "$", name: "Dollar namibien" },
  { code: "NGN", symbol: "₦", name: "Naira nigérian" },
  { code: "NIO", symbol: "C$", name: "Córdoba nicaraguayen" },
  { code: "NOK", symbol: "kr", name: "Couronne norvégienne" },
  { code: "NPR", symbol: "₨", name: "Roupie népalaise" },
  { code: "NZD", symbol: "NZ$", name: "Dollar néo-zélandais" },
  { code: "OMR", symbol: "ر.ع.", name: "Rial omanais" },
  { code: "PAB", symbol: "B/.", name: "Balboa panaméen" },
  { code: "PEN", symbol: "S/", name: "Sol péruvien" },
  { code: "PGK", symbol: "K", name: "Kina papou-néo-guinéen" },
  { code: "PHP", symbol: "₱", name: "Peso philippin" },
  { code: "PKR", symbol: "₨", name: "Roupie pakistanaise" },
  { code: "PLN", symbol: "zł", name: "Zloty polonais" },
  { code: "PYG", symbol: "₲", name: "Guarani paraguayen" },
  { code: "QAR", symbol: "ر.ق", name: "Rial qatari" },
  { code: "RON", symbol: "lei", name: "Leu roumain" },
  { code: "RSD", symbol: "дин.", name: "Dinar serbe" },
  { code: "RUB", symbol: "₽", name: "Rouble russe" },
  { code: "RWF", symbol: "FRw", name: "Franc rwandais" },
  { code: "SAR", symbol: "ر.س", name: "Riyal saoudien" },
  { code: "SBD", symbol: "$", name: "Dollar des îles Salomon" },
  { code: "SCR", symbol: "₨", name: "Roupie seychelloise" },
  { code: "SDG", symbol: "ج.س.", name: "Livre soudanaise" },
  { code: "SEK", symbol: "kr", name: "Couronne suédoise" },
  { code: "SGD", symbol: "S$", name: "Dollar de Singapour" },
  { code: "SHP", symbol: "£", name: "Livre de Sainte-Hélène" },
  { code: "SLE", symbol: "Le", name: "Leone sierra-léonais" },
  { code: "SOS", symbol: "Sh", name: "Shilling somalien" },
  { code: "SRD", symbol: "$", name: "Dollar surinamais" },
  { code: "SSP", symbol: "£", name: "Livre sud-soudanaise" },
  { code: "STN", symbol: "Db", name: "Dobra santoméenne" },
  { code: "SYP", symbol: "£", name: "Livre syrienne" },
  { code: "SZL", symbol: "L", name: "Lilangeni swazi" },
  { code: "TJS", symbol: "ЅМ", name: "Somoni tadjik" },
  { code: "TMT", symbol: "m", name: "Manat turkmène" },
  { code: "TND", symbol: "د.ت", name: "Dinar tunisien" },
  { code: "TOP", symbol: "T$", name: "Pa'anga tongien" },
  { code: "TRY", symbol: "₺", name: "Livre turque" },
  { code: "TTD", symbol: "$", name: "Dollar de Trinité-et-Tobago" },
  { code: "TVD", symbol: "$", name: "Dollar tuvaluan" },
  { code: "TWD", symbol: "NT$", name: "Dollar taïwanais" },
  { code: "TZS", symbol: "TSh", name: "Shilling tanzanien" },
  { code: "UAH", symbol: "₴", name: "Hryvnia ukrainienne" },
  { code: "UGX", symbol: "USh", name: "Shilling ougandais" },
  { code: "UYU", symbol: "$", name: "Peso uruguayen" },
  { code: "UZS", symbol: "so'm", name: "Sum ouzbek" },
  { code: "VES", symbol: "Bs.", name: "Bolívar vénézuélien" },
  { code: "VUV", symbol: "VT", name: "Vatu vanuatuan" },
  { code: "WST", symbol: "T", name: "Tala samoan" },
  { code: "XAF", symbol: "FCFA", name: "Franc CFA (Afrique centrale)" },
  { code: "XCD", symbol: "$", name: "Dollar des Caraïbes orientales" },
  { code: "XDR", symbol: "SDR", name: "Droits de tirage spéciaux" },
  { code: "XOF", symbol: "CFA", name: "Franc CFA (Afrique de l'Ouest)" },
  { code: "XPF", symbol: "₣", name: "Franc Pacifique" },
  { code: "YER", symbol: "﷼", name: "Rial yéménite" },
  { code: "ZAR", symbol: "R", name: "Rand sud-africain" },
  { code: "ZMW", symbol: "ZK", name: "Kwacha zambien" },
  { code: "ZWL", symbol: "$", name: "Dollar zimbabwéen" },
];

// Superset de CURRENCIES : les devises par défaut d'abord (elles restent en
// tête du sélecteur), puis tout le reste par ordre alphabétique.
export const ALL_CURRENCIES = [...CURRENCIES, ...OTHER_CURRENCIES];

// Index code → devise, pour retrouver symbole et nom sans balayer le tableau.
const BY_CODE = new Map(ALL_CURRENCIES.map((c) => [c.code, c]));

export function findCurrency(code) {
  return BY_CODE.get(code) || null;
}

// Symbole d'une devise, avec repli sur le code lui-même : une devise inconnue
// (donnée héritée, code retiré du catalogue) doit rester lisible plutôt que
// s'afficher vide.
export function currencySymbolOf(code) {
  return BY_CODE.get(code)?.symbol || code;
}

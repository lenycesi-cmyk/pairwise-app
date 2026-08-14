// Masquage des montants — « montrer l'écran Patrimoine à quelqu'un sans lui
// montrer combien on a ».
//
// Deux choix qui gouvernent tout le reste :
//
//   - C'est un réglage D'APPAREIL (localStorage), pas du couple. Masquer sur son
//     téléphone ne doit rien masquer chez son/sa partenaire, et ce n'est pas une
//     préférence à synchroniser : c'est un geste du moment.
//   - Le masque n'est PAS un zéro. Un zéro est une valeur, et se lirait comme
//     une information — fausse. Des points ne prétendent rien.
const KEY = "pw_hide_amounts";

export const AMOUNT_MASK = "••••";

export function readHideAmounts() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHideAmounts(on) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* stockage indisponible : le masquage vaut alors pour la session */
  }
}

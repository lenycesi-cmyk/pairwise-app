import { useViewportWidth } from "./useViewportWidth";

// Largeur à laquelle la barre [menu | période | actions] est DESSINÉE.
const HEADER_DESIGN_W = 390;

// Facteur de réduction de l'en-tête mobile. La barre est dessinée à une largeur
// de référence puis réduite proportionnellement — boutons ET police — sur les
// téléphones plus étroits, au lieu de déborder : sur les appareils de moins de
// ~390 px, les boutons devise et personnaliser sortaient de l'écran et le
// bouton ☰ chevauchait le sélecteur de période.
//
// Ce calcul vivait dans le seul écran d'Accueil, si bien que Rapports et Flux,
// qui ont repris la même barre, ont gardé le débordement. Il est ici pour que
// les trois en-têtes se réduisent ensemble : un quatrième écran qui reprend la
// barre n'a plus qu'une ligne à écrire.
//
// `headerAvail` retire le padding horizontal du conteneur collant (1,25 rem de
// chaque côté = 40 px) ; la largeur est plafonnée à la coque de 480 px.
export function useHeaderScale() {
  const viewportWidth = useViewportWidth();
  const headerAvail = Math.min(viewportWidth || HEADER_DESIGN_W + 40, 480) - 40;
  return Math.min(1, headerAvail / HEADER_DESIGN_W);
}

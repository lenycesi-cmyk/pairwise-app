// Grille bento desktop à 12 colonnes (refonte 1B), partagée entre les onglets
// (Accueil, Patrimoine…). Le LAYOUT est FIXE : la largeur d'un widget découle de
// sa POSITION dans la liste visible, pas d'un réglage. On glisse-dépose (l'ordre
// change la largeur) et on affiche/masque. Motif de spans par rangée de 3 :
//   - rangée 1 : 5 · 4 · 3  (héros large, puis deux plus étroits)
//   - rangées suivantes : 4 · 5 · 3
// Chaque rangée fait bien 12. Une dernière rangée incomplète laisse des colonnes
// vides à droite (pas de hauteur fixe → aucun trou vertical).
export function slotSpan12(index) {
  if (index < 3) return [5, 4, 3][index];
  return [4, 5, 3][(index - 3) % 3];
}

// Hauteur maximale d'une cellule bento (calée sur la maquette) : la cellule est
// plafonnée pour qu'`align-items: stretch` ne puisse pas allonger une rangée
// au-delà quand une carte a beaucoup de contenu. Le trop-plein défile DANS la
// carte, en-tête figé (voir WidgetCard : header flexShrink 0 + corps overflow-y
// auto). Les rangées au contenu plus court restent naturellement plus basses.
export const BENTO_MAX_HEIGHT = 420;

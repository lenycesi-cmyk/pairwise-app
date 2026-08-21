// Géométrie de la marque PairWise, sur une grille 100 × 100.
//
// Ce fichier existe pour qu'il n'y ait qu'un seul jeu de nombres. Deux
// consommateurs le lisent :
//   • [Logo.jsx](./Logo.jsx), qui en fabrique du JSX pour l'app ;
//   • [scripts/build-icons.js](../../scripts/build-icons.js), qui en fabrique une
//     chaîne SVG pour rendre icon-192.png et icon-512.png.
// Les deux assemblent les mêmes formes à partir des mêmes valeurs : le dessin
// peut différer dans sa syntaxe, jamais dans ses proportions.

/** La barre — « la personne ». Le fût du P. */
export const BAR = { x: 28, y: 13, w: 18, h: 74, r: 1.5 };

/**
 * La pièce, qui passe DERRIÈRE la barre.
 * `r` est le rayon du TRACÉ et `w` son épaisseur : extérieur 23, intérieur 9.
 * 51 − 23 = 28 = le bord gauche de la barre. Rien ne dépasse à gauche, donc la
 * silhouette reste un P franc au lieu d'un anneau posé à côté d'un fût.
 */
export const COIN = { cx: 51, cy: 36, r: 16, w: 14 };

/**
 * Le liseré : la bande de vide qui entoure la barre et creuse le passage de la
 * pièce. C'est LUI qui dit « derrière », et non un contraste de couleur — ce qui
 * laisse la marque fonctionner en monochrome, au tampon comme en découpe.
 * 2,6 unités : à 1,8 le trait se referme dès 48 px, à 3,6 la barre paraît flotter.
 */
export const KEYLINE = 2.6;

/**
 * Réduction de la marque à l'intérieur d'une tuile.
 * Le manifeste déclare les icônes `purpose: "any maskable"` : Android recadre
 * dans un cercle et ne garantit que les 80 % centraux, soit un rayon de 40. À
 * taille pleine le coin de la marque tombe à 44,1 du centre — le pied et la tête
 * du P seraient rognés. 0,78 laisse en plus l'air qu'attend une icône d'app.
 */
export const TILE_SCALE = 0.78;

/** Arrondi de la tuile DANS l'app. Une icône exportée reste carrée : le système
 *  applique son propre masque, et un coin déjà arrondi s'y verrait rogné deux fois. */
export const TILE_RADIUS = 28;

/**
 * Rend la marque en une chaîne SVG autonome (sans dépendance à React).
 * Utilisé par le script d'icônes ; l'app passe par `LogoMark`.
 */
export function logoSvg({
  size = 512,
  tile = true,
  tileRadius = 0,
  markColor = "#ffffff",
  tileColor = "#e9673f",
} = {}) {
  const k = KEYLINE;
  const mask = `
    <mask id="pw-bar" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <!-- userSpaceOnUse : sans ça la région du masque se cale sur la boîte
           englobante du cercle, qui ignore l'épaisseur du tracé, et l'anneau
           se fait rogner aux quatre coins. -->
      <rect x="0" y="0" width="100" height="100" fill="#fff"/>
      <rect x="${BAR.x - k}" y="${BAR.y - k}" width="${BAR.w + k * 2}" height="${BAR.h + k * 2}" rx="${BAR.r + k}" fill="#000"/>
    </mask>`;
  const mark = `
    <g mask="url(#pw-bar)">
      <circle cx="${COIN.cx}" cy="${COIN.cy}" r="${COIN.r}" fill="none" stroke="${markColor}" stroke-width="${COIN.w}"/>
    </g>
    <rect x="${BAR.x}" y="${BAR.y}" width="${BAR.w}" height="${BAR.h}" rx="${BAR.r}" fill="${markColor}"/>`;

  const body = tile
    ? `<rect x="0" y="0" width="100" height="100" rx="${tileRadius}" fill="${tileColor}"/>
    <g transform="translate(50 50) scale(${TILE_SCALE}) translate(-${COIN.cx} -50)">${mark}</g>`
    : mark;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>${mask}</defs>
  ${body}
</svg>`;
}

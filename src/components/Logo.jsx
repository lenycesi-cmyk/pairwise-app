import { useId } from "react";
import { BAR, COIN, KEYLINE, TILE_SCALE, TILE_RADIUS } from "./logoGeometry";

// Logo PairWise — une barre (la personne) et une pièce qui passe DERRIÈRE elle.
//
// Géométrie verrouillée, grille 100 × 100 :
//   barre  x 28 → 46, y 13 → 87, angles 1,5
//   pièce  centre (51, 36), rayon de tracé 16, épaisseur 14
//          → extérieur 23, intérieur 9
//   liseré 2,6 unités tout autour de la barre
//
// Le rayon extérieur n'est pas choisi à l'œil : 51 − 23 = 28, soit exactement le
// bord gauche de la barre. Rien ne dépasse à gauche, donc la silhouette reste un
// P franc — c'est ce qui distingue cette construction d'un anneau simplement posé
// à côté du fût.
//
// LE LISERÉ EST UN MASQUE, pas un rectangle peint de la couleur du fond. C'est ce
// qui permet à la marque de se poser sur n'importe quel fond — tuile corail, crème,
// thème sombre — sans qu'on ait à lui dire lequel. Un rectangle opaque aurait exigé
// une prop `background` à tenir à jour à chaque endroit d'appel, et le premier
// oubli aurait laissé une barre de la mauvaise couleur au milieu de la marque.
// Les nombres vivent dans [logoGeometry.js](./logoGeometry.js), partagé avec le
// script qui rend les icônes PNG. Un seul jeu de valeurs, deux consommateurs.

export function LogoMark({ size = 64, tile = false, className, style }) {
  // useId() produit des « : » que url(#…) ne sait pas toujours relire.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const maskId = `pw-bar-${uid}`;
  const k = KEYLINE;

  const mark = (
    <>
      {/* La pièce, amputée de la bande qu'occupe la barre : c'est ce trou qui
          la fait passer derrière. */}
      <g mask={`url(#${maskId})`}>
        <circle
          cx={COIN.cx}
          cy={COIN.cy}
          r={COIN.r}
          fill="none"
          stroke="currentColor"
          strokeWidth={COIN.w}
        />
      </g>
      <rect
        x={BAR.x}
        y={BAR.y}
        width={BAR.w}
        height={BAR.h}
        rx={BAR.r}
        fill="currentColor"
      />
    </>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="PairWise"
      className={className}
      style={{ display: "block", flex: "none", ...style }}
    >
      <defs>
        {/* userSpaceOnUse : sans ça la région du masque se cale sur la boîte
            englobante du cercle, qui ignore l'épaisseur du tracé, et l'anneau
            se fait rogner aux quatre coins. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill="#fff" />
          <rect
            x={BAR.x - k}
            y={BAR.y - k}
            width={BAR.w + k * 2}
            height={BAR.h + k * 2}
            rx={BAR.r + k}
            fill="#000"
          />
        </mask>
      </defs>

      {tile ? (
        <>
          <rect x="0" y="0" width="100" height="100" rx={TILE_RADIUS} fill="var(--tang)" />
          <g
            color="#fff"
            transform={`translate(50 50) scale(${TILE_SCALE}) translate(-${COIN.cx} -50)`}
          >
            {mark}
          </g>
        </>
      ) : (
        <g color="var(--tang)">{mark}</g>
      )}
    </svg>
  );
}

// Marque + mot-symbole « Pair·Wise ». `stacked` empile au lieu d'aligner.
export default function Logo({ size = 64, showWordmark = true, stacked = false, tile = false }) {
  const wordmark = (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: size * 0.5,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        color: "var(--ink)",
      }}
    >
      Pair<span style={{ color: "var(--tang)" }}>Wise</span>
    </span>
  );

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: "center",
        gap: size * 0.22,
      }}
    >
      <LogoMark size={size} tile={tile} />
      {showWordmark && wordmark}
    </div>
  );
}

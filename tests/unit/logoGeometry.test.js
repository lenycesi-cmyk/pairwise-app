import { describe, it, expect } from "vitest";
import {
  BAR,
  COIN,
  KEYLINE,
  TILE_SCALE,
  logoSvg,
} from "../../src/components/logoGeometry.js";

// La marque n'est pas testable « à l'œil » par une suite automatique, mais les
// quelques RELATIONS entre ses nombres le sont — et ce sont elles qui, si on les
// casse, abîment le dessin sans que rien ne le signale. On teste donc les
// invariants, pas les valeurs : régler la pièce autrement reste permis tant que
// les rapports tiennent.

const coinOuter = COIN.r + COIN.w / 2; // 23
const coinInner = COIN.r - COIN.w / 2; // 9

describe("la pièce se cale sur la barre", () => {
  it("ne dépasse pas à gauche de la barre", () => {
    // C'est CE nombre qui fait que la silhouette reste un P plutôt qu'un anneau
    // posé à côté d'un fût. Agrandir la pièce sans déplacer son centre la ferait
    // saillir à gauche, et la lettre disparaîtrait.
    expect(COIN.cx - coinOuter).toBe(BAR.x);
  });

  it("s'aligne en haut sur la barre", () => {
    expect(COIN.cy - coinOuter).toBe(BAR.y);
  });

  it("garde une contre-forme ouverte", () => {
    // Sans vide au centre du bol, ce n'est plus une lettre mais un drapeau.
    expect(coinInner).toBeGreaterThan(0);
  });

  it("laisse dépasser le bol à droite de la barre", () => {
    // Sinon la pièce serait entièrement masquée par la barre et le liseré.
    expect(COIN.cx + coinOuter).toBeGreaterThan(BAR.x + BAR.w + KEYLINE);
  });
});

describe("tuile d'icône", () => {
  it("tient dans la zone sûre d'un masque circulaire", () => {
    // Le manifeste déclare `purpose: "any maskable"` : Android recadre en cercle
    // et ne garantit que les 80 % centraux, soit un rayon de 40 sur la grille.
    // À taille pleine le coin de la marque tombe au-delà — d'où TILE_SCALE.
    const halfW = coinOuter; // la marque est recentrée sur COIN.cx
    const halfH = (BAR.y + BAR.h - BAR.y) / 2;
    const corner = Math.hypot(halfW, halfH) * TILE_SCALE;
    expect(corner).toBeLessThanOrEqual(40);
  });
});

describe("logoSvg", () => {
  it("borne le masque en userSpaceOnUse", () => {
    // Par défaut, la région d'un <mask> se cale sur la boîte englobante de
    // l'élément masqué — laquelle IGNORE l'épaisseur du tracé. L'anneau, large
    // de 14, s'y faisait rogner aux quatre coins. Le bug a été livré une fois
    // dans une icône ; ce test est là pour qu'il ne revienne pas.
    expect(logoSvg()).toContain('maskUnits="userSpaceOnUse"');
  });

  it("rend une tuile à fond perdu par défaut", () => {
    // Un coin déjà arrondi ici se ferait rogner une seconde fois par le masque
    // du système.
    expect(logoSvg()).toContain('rx="0"');
  });

  it("honore la taille demandée", () => {
    expect(logoSvg({ size: 192 })).toContain('width="192" height="192"');
    // Le viewBox ne bouge JAMAIS : c'est lui qui rend les proportions
    // indépendantes de la taille d'export.
    expect(logoSvg({ size: 192 })).toContain('viewBox="0 0 100 100"');
  });
});

// Répartition dans un espace à UN SEUL membre.
//
// Le piège est réel et il était en production : `split` vaut "50/50" par défaut
// sur toute transaction, y compris celles d'un utilisateur seul — l'écran de
// saisie ne pose même plus la question depuis qu'on masque la carte
// « Payé par / Pour » en solo. `memberShareFraction` lisait ce "50/50" et
// n'attribuait que la MOITIÉ de ses dépenses au membre unique, ce qui divisait
// par deux la consommation de tout budget personnel, sans le moindre signe
// visible à l'écran.
//
// Les cas ci-dessous verrouillent l'invariant qui compte : quel que soit ce qui
// est ÉCRIT dans la transaction, un espace à un membre lui attribue tout.
import { describe, expect, it } from "vitest";
import { memberShareFraction, assetMemberShareFraction } from "../../src/utils/members.js";

const SEUL = [{ uid: "u1", memberId: "u1", name: "Nicolas" }];
const A_DEUX = [
  { uid: "u1", memberId: "u1", name: "Nicolas" },
  { uid: "u2", memberId: "u2", name: "Jessica" },
];

describe("memberShareFraction — un seul membre", () => {
  it("attribue tout malgré un split « 50/50 » hérité", () => {
    expect(memberShareFraction({ split: "50/50", paidBy: "u1" }, "u1", SEUL)).toBe(1);
  });

  it("attribue tout même sans rien de renseigné", () => {
    expect(memberShareFraction({}, "u1", SEUL)).toBe(1);
  });

  it("attribue tout malgré un partage avancé résiduel", () => {
    const tx = { split: "50/50", splitDetails: { mode: "custom", unit: "percent", a: 30, b: 70 } };
    expect(memberShareFraction(tx, "u1", SEUL)).toBe(1);
  });

  it("ne donne rien à une clé qui n'est pas celle du membre", () => {
    expect(memberShareFraction({ split: "50/50" }, "u2", SEUL)).toBe(0);
  });

  it("laisse le couple entier à 1 (memberKey nul)", () => {
    expect(memberShareFraction({ split: "50/50" }, null, SEUL)).toBe(1);
  });
});

describe("memberShareFraction — à deux, rien ne change", () => {
  it("coupe toujours « 50/50 » en deux", () => {
    expect(memberShareFraction({ split: "50/50" }, "u1", A_DEUX)).toBe(0.5);
    expect(memberShareFraction({ split: "50/50" }, "u2", A_DEUX)).toBe(0.5);
  });

  it("respecte toujours un partage avancé", () => {
    const tx = { splitDetails: { unit: "percent", a: 30, b: 70 } };
    expect(memberShareFraction(tx, "u1", A_DEUX)).toBeCloseTo(0.3, 10);
    expect(memberShareFraction(tx, "u2", A_DEUX)).toBeCloseTo(0.7, 10);
  });

  it("rattache au payeur ce qui n'est pas partagé", () => {
    expect(memberShareFraction({ paidBy: "u2" }, "u2", A_DEUX)).toBe(1);
    expect(memberShareFraction({ paidBy: "u2" }, "u1", A_DEUX)).toBe(0);
  });
});

describe("invariant : les parts somment toujours à 1", () => {
  // C'est ce qui garantit que les colonnes du widget Résumé s'additionnent
  // bien à la cellule qui les surmonte — aucun euro perdu entre les deux
  // étages de la carte.
  const CAS = [
    { split: "50/50" },
    { split: "u1" },
    { split: "u2" },
    { paidBy: "u1" },
    { split: "50/50", splitDetails: { unit: "percent", a: 30, b: 70 } },
    { split: "50/50", splitDetails: { unit: "amount", a: 40, b: 60 } },
  ];

  it("à deux", () => {
    for (const tx of CAS) {
      const somme = memberShareFraction(tx, "u1", A_DEUX) + memberShareFraction(tx, "u2", A_DEUX);
      expect(somme).toBeCloseTo(1, 10);
    }
  });

  it("seul", () => {
    for (const tx of CAS) {
      expect(memberShareFraction(tx, "u1", SEUL)).toBe(1);
    }
  });
});

describe("assetMemberShareFraction — un seul membre", () => {
  it("donne 100 % d'un actif resté « partagé »", () => {
    expect(assetMemberShareFraction({ ownership: "shared" }, "u1", SEUL)).toBe(1);
  });

  it("donne 100 % malgré un sharePct hérité", () => {
    expect(assetMemberShareFraction({ ownership: "shared", sharePct: 70 }, "u1", SEUL)).toBe(1);
  });

  it("donne 100 % d'un actif sans propriétaire", () => {
    expect(assetMemberShareFraction({}, "u1", SEUL)).toBe(1);
  });

  it("à deux, applique toujours sharePct au premier membre", () => {
    const actif = { ownership: "shared", sharePct: 70 };
    expect(assetMemberShareFraction(actif, "u1", A_DEUX)).toBeCloseTo(0.7, 10);
    expect(assetMemberShareFraction(actif, "u2", A_DEUX)).toBeCloseTo(0.3, 10);
  });
});

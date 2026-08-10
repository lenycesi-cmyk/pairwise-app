// Format canonique d'export/import : c'est le pivot de la réversibilité entre
// le mode connecté et le mode Local, donc le morceau par lequel une migration
// perdra des données si elle doit en perdre. Les assertions portent sur des
// INVARIANTS — l'aller-retour ne perd rien, la liste blanche tient, un fichier
// ne peut pas s'octroyer l'accès au couple.
import { describe, expect, it } from "vitest";
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  COUPLE_FIELDS,
  IMPORT_SKIP_FIELDS,
  buildExportDocument,
  parseExportDocument,
  buildCouplePatch,
  mergeById,
  summarizeImport,
} from "../../src/utils/canonicalData";

const COUPLE = {
  coupleName: "Team T&T",
  defaultCurrency: "USD",
  members: [{ id: "m1", memberId: "u1", uid: "u1", name: "Nicolas" }],
  assets: [{ id: "a1", name: "Livret A", value: 4200 }],
  budgets: [{ id: "b1", label: "Courses", amount: 500 }],
  // Champs qui ne DOIVENT jamais sortir.
  memberUids: ["u1", "u2"],
  fcmTokens: { u1: { "jeton-secret": 1 } },
  inviteExpiresAt: 999,
};

const TRANSACTIONS = [
  { id: "t1", amount: 12, currency: "USD" },
  { id: "t2", amount: 30, currency: "EUR" },
];

function exportFixture() {
  return buildExportDocument({
    couple: COUPLE,
    transactions: TRANSACTIONS,
    memberKey: "u1",
    omittedPrivate: 2,
  });
}

describe("buildExportDocument", () => {
  it("s'annonce avec un format et une version reconnaissables", () => {
    const doc = exportFixture();
    expect(doc.format).toBe(EXPORT_FORMAT);
    expect(doc.version).toBe(EXPORT_VERSION);
  });

  it("n'exporte AUCUN champ hors de la liste blanche", () => {
    const doc = exportFixture();
    for (const field of Object.keys(doc.couple)) {
      expect(COUPLE_FIELDS, `champ inattendu : ${field}`).toContain(field);
    }
  });

  it("laisse dehors les jetons d'appareil et les identifiants d'appartenance", () => {
    const doc = exportFixture();
    expect(doc.couple.fcmTokens).toBeUndefined();
    expect(doc.couple.memberUids).toBeUndefined();
    expect(doc.couple.inviteExpiresAt).toBeUndefined();
    // Vérification par le texte : un fichier ne doit contenir aucun jeton.
    expect(JSON.stringify(doc)).not.toContain("jeton-secret");
  });

  it("garde le compte des éléments privés absents du fichier", () => {
    expect(exportFixture().scope.omittedPrivate).toBe(2);
  });
});

describe("aller-retour", () => {
  it("exporter, relire et réexporter redonne le même document", () => {
    const first = exportFixture();
    const parsed = parseExportDocument(JSON.stringify(first));
    const second = buildExportDocument({
      couple: parsed.couple,
      transactions: parsed.transactions,
      memberKey: parsed.scope.memberKey,
      omittedPrivate: parsed.scope.omittedPrivate,
    });
    // `exportedAt` est le seul champ qui bouge, par construction.
    expect({ ...second, exportedAt: null }).toEqual({ ...first, exportedAt: null });
  });

  it("accepte indifféremment une chaîne ou un objet déjà lu", () => {
    const doc = exportFixture();
    expect(parseExportDocument(JSON.stringify(doc))).toEqual(parseExportDocument(doc));
  });
});

describe("parseExportDocument — refus", () => {
  const cas = [
    ["pas du JSON", "{{{", "import_error_not_json"],
    ["autre format", { format: "autre-app", version: 1 }, "import_error_wrong_format"],
    ["version absente", { format: EXPORT_FORMAT }, "import_error_wrong_format"],
    [
      "version future",
      { format: EXPORT_FORMAT, version: EXPORT_VERSION + 1, couple: {}, transactions: [] },
      "import_error_version_too_new",
    ],
    [
      "sans couple",
      { format: EXPORT_FORMAT, version: 1, transactions: [] },
      "import_error_no_couple",
    ],
    [
      "sans transactions",
      { format: EXPORT_FORMAT, version: 1, couple: {} },
      "import_error_no_transactions",
    ],
  ];

  for (const [label, input, code] of cas) {
    it(`refuse : ${label}`, () => {
      expect(() => parseExportDocument(input)).toThrow(code);
    });
  }

  it("écarte les champs bricolés à la main hors liste blanche", () => {
    const parsed = parseExportDocument({
      format: EXPORT_FORMAT,
      version: 1,
      couple: { defaultCurrency: "EUR", memberUids: ["intrus"] },
      transactions: [],
    });
    expect(parsed.couple.memberUids).toBeUndefined();
    expect(parsed.couple.defaultCurrency).toBe("EUR");
  });

  it("écarte les transactions sans identifiant, qu'on ne saurait pas où écrire", () => {
    const parsed = parseExportDocument({
      format: EXPORT_FORMAT,
      version: 1,
      couple: {},
      transactions: [{ id: "t1", amount: 1 }, { amount: 2 }, null],
    });
    expect(parsed.transactions).toHaveLength(1);
  });
});

describe("mergeById", () => {
  it("fait l'union, l'entrant l'emportant sur l'existant", () => {
    const merged = mergeById(
      [{ id: "a", v: 1 }, { id: "b", v: 1 }],
      [{ id: "b", v: 2 }, { id: "c", v: 2 }]
    );
    expect(merged).toHaveLength(3);
    expect(merged.find((x) => x.id === "b").v).toBe(2);
  });

  it("n'oublie jamais un élément existant absent du fichier", () => {
    const merged = mergeById([{ id: "a" }], [{ id: "b" }]);
    expect(merged.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("renvoie null si un élément n'a pas d'identifiant — pas de règle inventée", () => {
    expect(mergeById([{ id: "a" }], [{ nom: "sans id" }])).toBeNull();
  });
});

describe("buildCouplePatch", () => {
  it("ne réécrit JAMAIS la liste des membres — un fichier ne s'octroie pas l'accès", () => {
    const patch = buildCouplePatch(
      { members: [{ id: "m1", uid: "u1" }] },
      { members: [{ id: "m1", uid: "u1" }, { id: "m9", uid: "intrus" }] }
    );
    expect(patch.members).toBeUndefined();
    expect(IMPORT_SKIP_FIELDS).toContain("members");
  });

  it("fusionne les collections identifiées au lieu de les remplacer", () => {
    const patch = buildCouplePatch(
      { assets: [{ id: "a1", value: 1 }] },
      { assets: [{ id: "a2", value: 2 }] }
    );
    expect(patch.assets.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("remplace les champs simples par la valeur du fichier", () => {
    const patch = buildCouplePatch({ defaultCurrency: "EUR" }, { defaultCurrency: "THB" });
    expect(patch.defaultCurrency).toBe("THB");
  });

  it("ne touche pas aux champs absents du fichier", () => {
    const patch = buildCouplePatch({ defaultCurrency: "EUR", language: "fr" }, { language: "en" });
    expect(patch).not.toHaveProperty("defaultCurrency");
  });
});

describe("summarizeImport", () => {
  it("compte ce qui sera écrit, et rien de ce qui sera ignoré", () => {
    const parsed = parseExportDocument(JSON.stringify(exportFixture()));
    const counts = summarizeImport(parsed);
    expect(counts.transactions).toBe(TRANSACTIONS.length);
    expect(counts.assets).toBe(1);
    expect(counts.members).toBeUndefined();
  });
});

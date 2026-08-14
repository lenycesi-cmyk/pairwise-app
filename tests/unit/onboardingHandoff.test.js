import { describe, it, expect, beforeEach, vi } from "vitest";
import { consumeHandoff, HANDOFF_PARAM } from "../../src/utils/onboardingDraft.js";

// Le relais est la seule pièce qui traverse la frontière d'origine entre
// pairwise.finance et app.pairwise.finance. S'il casse, rien ne le signale :
// l'app s'ouvre simplement à vide et l'utilisateur retape sa saisie.

const store = new Map();

function setUrl(search) {
  global.window = {
    location: { search, href: `https://app.pairwise.finance/${search}`, pathname: "/", hash: "" },
    history: { state: null, replaceState: vi.fn() },
  };
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  // Pas de stub de `navigator` : il est en lecture seule sous Node, et
  // `consumeHandoff` reçoit sa devise en argument plutôt que de la déduire.
}

beforeEach(() => {
  store.clear();
  setUrl("");
});

describe("consumeHandoff", () => {
  it("sans paramètre, rend le brouillon local inchangé", () => {
    store.set("pw_onb_draft", JSON.stringify([{ id: "a", amount: 10 }]));
    expect(consumeHandoff("fr", "EUR")).toEqual([{ id: "a", amount: 10 }]);
  });

  it("transforme la saisie transmise en entrée de brouillon", () => {
    setUrl(`?${HANDOFF_PARAM}=60%E2%82%AC%20course%20hier`);
    const draft = consumeHandoff("fr", "EUR");
    expect(draft).toHaveLength(1);
    expect(draft[0].amount).toBe(60);
    expect(draft[0].type).toBe("expense");
  });

  // Un formulaire GET encode les espaces en « + », jamais en « %20 ». Tester
  // uniquement la forme %20 laisserait passer un relais cassé en production.
  it("décode les espaces encodés en « + » par le formulaire", () => {
    setUrl(`?${HANDOFF_PARAM}=60%E2%82%AC+course+hier`);
    const draft = consumeHandoff("fr", "EUR");
    expect(draft).toHaveLength(1);
    expect(draft[0].amount).toBe(60);
    expect(draft[0].description).toBe("Course");
  });

  it("reconnaît un revenu et un placement comme le ferait la saisie locale", () => {
    setUrl(`?${HANDOFF_PARAM}=2400%E2%82%AC%20salaire%20Juillet`);
    expect(consumeHandoff("fr", "EUR")[0].type).toBe("income");
    setUrl(`?${HANDOFF_PARAM}=ETF%20250%20%E2%82%AC`);
    expect(consumeHandoff("fr", "EUR")[0].type).toBe("investment");
  });

  // Un brouillon écrasé serait une perte de données invisible : quelqu'un qui
  // revient sur l'apex et retape une ligne doit la voir S'AJOUTER.
  it("ajoute au brouillon existant sans l'écraser", () => {
    store.set("pw_onb_draft", JSON.stringify([{ id: "a", amount: 10 }]));
    setUrl(`?${HANDOFF_PARAM}=30%20d%C3%A9jeuner`);
    const draft = consumeHandoff("fr", "EUR");
    expect(draft).toHaveLength(2);
    expect(draft[0].id).toBe("a");
  });

  it("ignore un texte sans montant plutôt que d'inventer une entrée", () => {
    setUrl(`?${HANDOFF_PARAM}=bonjour`);
    expect(consumeHandoff("fr", "EUR")).toEqual([]);
  });

  it("ignore un paramètre vide", () => {
    setUrl(`?${HANDOFF_PARAM}=%20%20`);
    expect(consumeHandoff("fr", "EUR")).toEqual([]);
  });

  // Sans ce nettoyage, un rafraîchissement rejouerait la saisie et créerait un
  // doublon — et le bouton « retour » aussi.
  it("retire le paramètre de l'URL après l'avoir consommé", () => {
    setUrl(`?${HANDOFF_PARAM}=60%E2%82%AC%20course`);
    consumeHandoff("fr", "EUR");
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it("ne touche pas à l'URL quand il n'y a rien à consommer", () => {
    setUrl("?utm_source=x");
    consumeHandoff("fr", "EUR");
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});

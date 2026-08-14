import { describe, it, expect, beforeEach, vi } from "vitest";

// `releaseSeen` lit localStorage au moment de l'appel : un faux suffit, et il
// évite d'avoir à monter un DOM pour une logique qui n'en demande pas.
function installFakeStorage(initial = {}) {
  const store = { ...initial };
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    // `length` et `key()` sont indispensables : c'est par eux que le module
    // reconnaît une installation déjà utilisée. Un faux qui les omet laisserait
    // ce chemin sans test.
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
  return store;
}

const KEY = "pw:lastSeenRelease";

async function loadModule() {
  vi.resetModules();
  return import("../../src/utils/releaseSeen.js");
}

describe("releaseSeen", () => {
  beforeEach(() => {
    installFakeStorage();
  });

  it("ne montre RIEN à la première ouverture, et retient la version courante", async () => {
    const { seedReleasesIfFirstRun, unseenReleases } = await loadModule();
    const { LATEST_RELEASE } = await import("../../src/data/releaseNotes.js");

    expect(seedReleasesIfFirstRun()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(LATEST_RELEASE);
    // Dérouler l'historique à quelqu'un qui découvre l'app n'aurait aucun sens.
    expect(unseenReleases()).toEqual([]);
  });

  it("ne sème PAS sur une installation deja utilisée, et lui montre tout", async () => {
    // Cas de toute installation en place le jour où la fonctionnalité paraît :
    // aucune clé de version, mais l'app a manifestement déjà servi. La traiter
    // comme une première ouverture lui aurait fait perdre la première note.
    installFakeStorage({ "pw:boot:theme": "pairwise-dark" });
    const { seedReleasesIfFirstRun, unseenReleases } = await loadModule();
    const { RELEASE_NOTES } = await import("../../src/data/releaseNotes.js");

    expect(seedReleasesIfFirstRun()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe(null);
    expect(unseenReleases()).toHaveLength(RELEASE_NOTES.length);
  });

  it("sème sur une installation vraiment neuve (aucune autre clé PairWise)", async () => {
    installFakeStorage({ "autre-app:truc": "1" });
    const { seedReleasesIfFirstRun, unseenReleases } = await loadModule();
    const { LATEST_RELEASE } = await import("../../src/data/releaseNotes.js");

    expect(seedReleasesIfFirstRun()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(LATEST_RELEASE);
    expect(unseenReleases()).toEqual([]);
  });

  it("ne resème pas une installation déjà connue", async () => {
    installFakeStorage({ [KEY]: "2000.01.01" });
    const { seedReleasesIfFirstRun } = await loadModule();
    expect(seedReleasesIfFirstRun()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("2000.01.01");
  });

  it("renvoie TOUT ce qui a été manqué, pas seulement la dernière version", async () => {
    installFakeStorage({ [KEY]: "2000.01.01" });
    const { unseenReleases } = await loadModule();
    const { RELEASE_NOTES } = await import("../../src/data/releaseNotes.js");
    // Revenir après plusieurs lots ne doit pas en cacher.
    expect(unseenReleases()).toHaveLength(RELEASE_NOTES.length);
  });

  it("ne renvoie rien quand la dernière version a déjà été vue", async () => {
    const { LATEST_RELEASE } = await import("../../src/data/releaseNotes.js");
    installFakeStorage({ [KEY]: LATEST_RELEASE });
    const { unseenReleases } = await loadModule();
    expect(unseenReleases()).toEqual([]);
  });

  it("marque comme vue la version la plus récente", async () => {
    installFakeStorage({ [KEY]: "2000.01.01" });
    const { markReleasesSeen, unseenReleases } = await loadModule();
    const { LATEST_RELEASE } = await import("../../src/data/releaseNotes.js");

    markReleasesSeen();
    expect(localStorage.getItem(KEY)).toBe(LATEST_RELEASE);
    expect(unseenReleases()).toEqual([]);
  });

  it("survit à un localStorage indisponible sans rejouer la feuille", async () => {
    // Navigation privée : lever ici ne doit ni casser le démarrage, ni faire
    // réapparaître la feuille à chaque ouverture.
    globalThis.localStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => {},
    };
    const { unseenReleases, markReleasesSeen, seedReleasesIfFirstRun } = await loadModule();
    expect(() => markReleasesSeen()).not.toThrow();
    expect(seedReleasesIfFirstRun()).toBe(false);
    expect(unseenReleases()).toEqual([]);
  });
});

describe("RELEASE_NOTES", () => {
  it("est ordonné du plus récent au plus ancien", async () => {
    const { RELEASE_NOTES } = await import("../../src/data/releaseNotes.js");
    const versions = RELEASE_NOTES.map((r) => r.version);
    expect([...versions].sort().reverse()).toEqual(versions);
  });

  it("porte les deux langues sur chaque entrée", async () => {
    const { RELEASE_NOTES } = await import("../../src/data/releaseNotes.js");
    for (const rel of RELEASE_NOTES) {
      expect(rel.items.length).toBeGreaterThan(0);
      for (const item of rel.items) {
        // Une entrée sans anglais s'afficherait en français dans l'app anglaise,
        // sans que rien ne le signale.
        expect(item.fr?.title, `${rel.version} fr`).toBeTruthy();
        expect(item.en?.title, `${rel.version} en`).toBeTruthy();
      }
    }
  });

  it("utilise des versions au format AAAA.MM.JJ, qui se trient comme des chaînes", async () => {
    const { RELEASE_NOTES } = await import("../../src/data/releaseNotes.js");
    for (const rel of RELEASE_NOTES) {
      // AAAA.MM.JJ, avec un rang optionnel quand deux lots paraissent le même
      // jour. La comparaison reste une comparaison de chaînes.
      expect(rel.version).toMatch(/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/);
      expect(Number.isNaN(new Date(rel.date).getTime())).toBe(false);
    }
  });
});

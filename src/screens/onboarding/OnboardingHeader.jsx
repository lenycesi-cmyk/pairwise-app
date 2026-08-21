import { useState } from "react";
import { LogoMark } from "../../components/Logo";

// En-tête marketing de la page d'accueil (onboarding). Barre + méga-menu
// « Fonctionnalités » + menu « Pour qui » + Connexion. Maquette validée.
//
// Volontairement SANS destinations pour l'instant : les pages de présentation
// (pairwise.finance/fonctionnalites/*, /pour/*, /comparatifs/*) seront
// construites une par une ensuite, et chaque item sera alors relié. Cliquer un
// item ferme simplement le menu — aucun lien mort, aucun 404. Le seul lien
// actif est « Connexion » (→ onSignIn). Pas de bouton « C'est parti » ici : le
// CTA « C'est parti » du hero, juste en dessous, fait déjà le travail.

// Couleur d'accent par item (mêmes tokens que l'app).
const mic = (c) => ({
  width: 34,
  height: 34,
  borderRadius: 9,
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `var(--${c}-light)`,
  color: `var(--${c})`,
});

const MEGA = [
  {
    title: { fr: "Suivre son argent", en: "Track your money" },
    items: [
      { icon: "ti-sparkles", c: "tang", fr: ["Saisie en langage naturel", "« 60€ course hier » et c'est rempli"], en: ["Natural-language entry", "“$60 groceries” and it's filled in"] },
      { icon: "ti-list-details", c: "sky", fr: ["Transactions & reçus", "Historique, photos, recherche"], en: ["Transactions & receipts", "History, photos, search"] },
      { icon: "ti-tag", c: "amber", fr: ["Catégories & tags", "Rangement automatique"], en: ["Categories & tags", "Sorted automatically"] },
      { icon: "ti-repeat", c: "lavi", fr: ["Charges fixes & récurrentes", "Loyer, abonnements, crédits"], en: ["Fixed & recurring charges", "Rent, subscriptions, loans"] },
      { icon: "ti-world", c: "sage", fr: ["Multi-devises", "Idéal voyageurs & nomades"], en: ["Multi-currency", "Great for travelers & nomads"] },
      { icon: "ti-building-bank", c: "sky", fr: ["Synchronisation bancaire", "Comptes reliés, en temps réel"], en: ["Bank sync", "Linked accounts, in real time"] },
    ],
  },
  {
    title: { fr: "Analyser", en: "Analyze" },
    items: [
      { icon: "ti-chart-pie", c: "amber", fr: ["Budgets", "Par catégorie, avec alertes"], en: ["Budgets", "Per category, with alerts"] },
      { icon: "ti-chart-line", c: "sky", fr: ["Rapports & insights", "Ce qui bouge, mois par mois"], en: ["Reports & insights", "What moves, month by month"] },
      { icon: "ti-diamond", c: "lavi", fr: ["Patrimoine & investissements", "Actifs, crédits, évolution — un seul endroit"], en: ["Net worth & investments", "Assets, debts, trends — one place"] },
      { icon: "ti-heart-rate-monitor", c: "sage", fr: ["Score de santé financière", "Une note, des conseils"], en: ["Financial health score", "A score, with guidance"] },
    ],
  },
  {
    title: { fr: "Aller plus loin", en: "Go further" },
    items: [
      { icon: "ti-users", c: "tang", fr: ["Dépenses partagées", "Qui doit quoi, à deux"], en: ["Shared expenses", "Who owes what, together"] },
      { icon: "ti-target-arrow", c: "sage", fr: ["Objectifs d'épargne", "Seul ou en commun"], en: ["Savings goals", "Solo or together"] },
      { icon: "ti-bell", c: "amber", fr: ["Rappels & notifications", "Ne rien oublier"], en: ["Reminders & notifications", "Never forget"] },
      { icon: "ti-shield-lock", c: "sky", fr: ["Sécurité", "Chiffré, lecture seule"], en: ["Security", "Encrypted, read-only"] },
    ],
  },
];

const AUDIENCE = [
  { icon: "ti-user", c: "sky", fr: ["En solo", "Gérer ses finances personnelles"], en: ["Solo", "Manage your personal finances"] },
  { icon: "ti-users", c: "tang", fr: ["À deux", "Dépenses partagées, budgets communs"], en: ["As a couple", "Shared expenses, joint budgets"] },
  { icon: "ti-plane-tilt", c: "sage", fr: ["Voyageurs & nomades", "Le multi-devises comme atout"], en: ["Travelers & nomads", "Multi-currency as a strength"] },
  { icon: "ti-world", c: "lavi", fr: ["Expatriés", "Revenus ici, charges là-bas"], en: ["Expats", "Income here, bills there"] },
];

const NAV = {
  fr: { features: "Fonctionnalités", audience: "Pour qui", compare: "Comparatifs", pricing: "Tarifs", security: "Sécurité", login: "Connexion", all: "Voir toutes les fonctionnalités" },
  en: { features: "Features", audience: "Who it's for", compare: "Compare", pricing: "Pricing", security: "Security", login: "Log in", all: "See all features" },
};

export default function OnboardingHeader({ language, onSignIn, isDesktop }) {
  const lg = language === "en" ? "en" : "fr";
  const nav = NAV[lg];
  const [open, setOpen] = useState(null); // "features" | "audience" | null

  const toggle = (m) => setOpen((cur) => (cur === m ? null : m));

  const navLink = (key, hasMenu) => (
    <button
      onClick={() => (hasMenu ? toggle(key) : setOpen(null))}
      aria-expanded={hasMenu ? open === key : undefined}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 14.5,
        fontWeight: 600,
        color: open === key ? "var(--tang)" : "var(--ink-2)",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 0",
      }}
    >
      {nav[key === "features" ? "features" : key === "audience" ? "audience" : key]}
      {hasMenu && (
        <i className={`ti ti-chevron-${open === key ? "up" : "down"}`} style={{ fontSize: 14 }} />
      )}
    </button>
  );

  const item = (it) => (
    <button
      key={it.fr[0]}
      onClick={() => setOpen(null)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 10px",
        margin: "0 -10px",
        borderRadius: 10,
        border: "none",
        background: "none",
        cursor: "pointer",
        textAlign: "left",
        width: "calc(100% + 20px)",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--ink) 5%, transparent)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      <span style={mic(it.c)}>
        <i className={`ti ${it.icon}`} style={{ fontSize: 16 }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{it[lg][0]}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)" }}>{it[lg][1]}</span>
      </span>
    </button>
  );

  return (
    <div style={{ flex: "none", position: "relative", zIndex: 30 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          height: 62,
          padding: "0 20px",
          borderBottom: "0.5px solid var(--rule)",
          background: "var(--bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)" }}>
          <LogoMark size={28} tile />
          PairWise
        </div>

        {isDesktop && (
          <nav style={{ display: "flex", alignItems: "center", gap: 20, marginLeft: 6 }}>
            {navLink("features", true)}
            {navLink("audience", true)}
            {navLink("compare", false)}
            {navLink("pricing", false)}
            {navLink("security", false)}
          </nav>
        )}

        <button
          onClick={onSignIn}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}
        >
          {nav.login}
        </button>
      </div>

      {/* Overlay de fermeture au clic extérieur */}
      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 1 }} />
      )}

      {/* Méga-menu Fonctionnalités */}
      {open === "features" && isDesktop && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 2,
            background: "var(--bg-card)",
            borderBottom: "0.5px solid var(--rule)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.16)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26, padding: "22px 24px 18px" }}>
            {MEGA.map((col) => (
              <div key={col.title.fr}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>{col.title[lg]}</div>
                {col.items.map(item)}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "0.5px solid var(--rule)", padding: "12px 0", textAlign: "center" }}>
            <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--tang)", fontWeight: 700, fontSize: 14 }}>
              {nav.all} →
            </button>
          </div>
        </div>
      )}

      {/* Menu Pour qui */}
      {open === "audience" && isDesktop && (
        <div
          style={{
            position: "absolute",
            left: 150,
            top: "calc(100% - 4px)",
            zIndex: 2,
            width: 320,
            background: "var(--bg-card)",
            border: "0.5px solid var(--rule)",
            borderRadius: 14,
            boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
            padding: 8,
          }}
        >
          {AUDIENCE.map(item)}
        </div>
      )}
    </div>
  );
}

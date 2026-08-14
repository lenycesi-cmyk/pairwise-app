#!/usr/bin/env node
// Génère l'en-tête du site marketing dans TOUTES les pages, depuis la source
// unique ci-dessous.
//
// POURQUOI un script plutôt qu'un include. Le site est du HTML statique sans
// étape de construction, et l'en-tête était donc recopié à la main dans chaque
// page : six copies, qui avaient déjà divergé (l'accueil avait gagné un
// méga-menu que les pages de fonctionnalités n'avaient pas, et sur lesquelles
// « Fonctionnalités » n'était même pas cliquable). Injecter l'en-tête en
// JavaScript aurait réglé la duplication mais privé les moteurs de recherche
// des liens internes — or c'est exactement ce que ce site existe pour porter.
// Donc : une source unique ici, du HTML statique en sortie, régénéré à la
// demande et commité.
//
//   node scripts/build-marketing-header.js          # réécrit les pages
//   node scripts/build-marketing-header.js --check  # échoue si un écart existe
//
// Le mode --check permet de vérifier en CI qu'aucune page n'a été retouchée à
// la main sans repasser par ici.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "marketing");

// ── Source unique de la navigation ───────────────────────────────────────
//
// `href: null` ⇒ rubrique INERTE (page pas encore écrite). On ne pose jamais de
// lien mort : chaque 404 coûte en référencement, et le méga-menu promettrait
// une douzaine de pages dont trois existent.
const FEATURES = [
  {
    title: "Suivre son argent",
    items: [
      { icon: "ti-sparkles", tone: "tang", label: "Saisie en langage naturel", desc: "« 60€ course hier » et c'est rempli", href: "/fonctionnalites/saisie-langage-naturel" },
      { icon: "ti-list-details", tone: "sky", label: "Transactions &amp; reçus", desc: "Historique, photos, recherche", href: "/fonctionnalites/transactions-recus" },
      { icon: "ti-tag", tone: "amber", label: "Catégories &amp; tags", desc: "Rangement automatique", href: null },
      { icon: "ti-world", tone: "sage", label: "Multi-devises", desc: "Idéal voyageurs &amp; nomades", href: null },
    ],
  },
  {
    title: "Analyser",
    items: [
      { icon: "ti-chart-pie", tone: "amber", label: "Budgets", desc: "Par catégorie, avec alertes", href: null },
      { icon: "ti-chart-line", tone: "sky", label: "Rapports &amp; insights", desc: "Ce qui bouge, mois par mois", href: null },
      { icon: "ti-diamond", tone: "lavi", label: "Patrimoine &amp; investissements", desc: "Actifs, crédits, évolution", href: null },
    ],
  },
  {
    title: "Aller plus loin",
    items: [
      { icon: "ti-users", tone: "tang", label: "Dépenses partagées", desc: "Qui doit quoi, à deux", href: null },
      { icon: "ti-target-arrow", tone: "lavi", label: "Objectifs &amp; projets", desc: "Seul ou en commun", href: "/fonctionnalites/objectifs" },
      { icon: "ti-shield-lock", tone: "sky", label: "Sécurité", desc: "Chiffré, lecture seule", href: "/securite" },
    ],
  },
];

const AUDIENCES = [
  {
    title: null,
    items: [
      { icon: "ti-user", tone: "sky", label: "En solo", desc: "Gérer ses finances personnelles", href: null },
      { icon: "ti-users", tone: "tang", label: "À deux", desc: "Dépenses partagées, budgets communs", href: null },
      { icon: "ti-plane-tilt", tone: "sage", label: "Voyageurs &amp; nomades", desc: "Le multi-devises comme atout", href: null },
      { icon: "ti-world", tone: "lavi", label: "Expatriés", desc: "Revenus ici, charges là-bas", href: null },
    ],
  },
];

// Les pages à réécrire, et la rubrique à marquer comme courante.
const PAGES = [
  { file: "index.html", active: null },
  { file: "securite.html", active: "/securite" },
  { file: "fonctionnalites/objectifs.html", active: "/fonctionnalites/objectifs" },
  { file: "fonctionnalites/saisie-langage-naturel.html", active: "/fonctionnalites/saisie-langage-naturel" },
  { file: "fonctionnalites/transactions-recus.html", active: "/fonctionnalites/transactions-recus" },
];

// ── Rendu ────────────────────────────────────────────────────────────────
function renderItem(it, active) {
  const mi = `<span class="mi" style="background:var(--${it.tone}-light);color:var(--${it.tone})"><i class="ti ${it.icon}"></i></span>`;
  const body = `<span><b>${it.label}</b><small>${it.desc}</small></span>`;
  if (!it.href) return `<span class="mm-it dim">${mi}${body}</span>`;
  const cur = it.href === active ? ' aria-current="page"' : "";
  return `<a class="mm-it" href="${it.href}"${cur}>${mi}${body}</a>`;
}

function renderMenu(id, label, cols, active) {
  // Le libellé de colonne n'est délibérément PAS un <h5> : des titres de menu
  // apparaîtraient avant le <h1> et abîmeraient la hiérarchie de la page.
  const inner = cols
    .map(
      (c) =>
        `          <span class="mm-col">\n` +
        (c.title ? `            <span class="mm-h5">${c.title}</span>\n` : "") +
        c.items.map((i) => `            ${renderItem(i, active)}`).join("\n") +
        `\n          </span>`
    )
    .join("\n");
  const one = cols.length === 1 ? " one" : "";
  // `data-open` est posé dès le HTML : sans lui, la toute première ouverture
  // doit d'abord créer l'attribut, et le sélecteur CSS ne s'applique pas.
  return (
    `      <span class="mm" data-mm data-menu="${id}" data-open="0">\n` +
    `        <button type="button" aria-expanded="false">${label} <i class="ti ti-chevron-down"></i></button>\n` +
    `        <span class="mm-panel">\n` +
    `          <span class="mm-cols${one}">\n${inner}\n          </span>\n` +
    `        </span>\n` +
    `      </span>`
  );
}

function renderHeader(active) {
  // « Fonctionnalités » se colore quand on est SUR une page de fonctionnalité,
  // sinon rien n'indiquerait où l'on se trouve — c'était le cas avant.
  const inFeatures = active && active.startsWith("/fonctionnalites/");
  const featBtn = inFeatures ? ' class="on"' : "";
  const secCur = active === "/securite" ? ' class="active" aria-current="page"' : "";
  return (
    `<header class="site">\n` +
    `  <div class="bar">\n` +
    `    <a href="/" class="logo"><span class="p">P</span> PairWise</a>\n` +
    `    <!-- ⚠ GÉNÉRÉ — ne pas modifier à la main.\n` +
    `         Source : scripts/build-marketing-header.js · régénérer avec\n` +
    `         \`node scripts/build-marketing-header.js\`. -->\n` +
    `    <nav${featBtn ? ' data-in-features="1"' : ""}>\n` +
    renderMenu("features", "Fonctionnalités", FEATURES, active) + "\n" +
    renderMenu("audiences", "Pour qui", AUDIENCES, active) + "\n" +
    `      <span class="soon">Comparatifs</span>\n` +
    `      <span class="soon">Tarifs</span>\n` +
    `      <a href="/securite"${secCur}>Sécurité</a>\n` +
    `    </nav>\n` +
    `    <a href="https://app.pairwise.finance/" class="login">Connexion</a>\n` +
    `  </div>\n` +
    `</header>`
  );
}

const MENU_SCRIPT = '<script src="/assets/menu.js" defer></script>';

function apply(html, active) {
  let out = html.replace(
    /<header class="site">[\s\S]*?<\/header>/,
    () => renderHeader(active)
  );
  // Le script partagé doit être présent une fois et une seule.
  if (!out.includes('src="/assets/menu.js"')) {
    out = out.replace("</body>", `${MENU_SCRIPT}\n\n</body>`);
  }
  return out;
}

const check = process.argv.includes("--check");
let changed = 0;
let drift = [];

for (const page of PAGES) {
  const path = join(SITE, page.file);
  const before = readFileSync(path, "utf8");
  if (!/<header class="site">/.test(before)) {
    console.error(`✗ ${page.file} : pas d'en-tête <header class="site"> à remplacer`);
    process.exitCode = 1;
    continue;
  }
  const after = apply(before, page.active);
  if (after === before) continue;
  if (check) {
    drift.push(page.file);
    continue;
  }
  writeFileSync(path, after);
  changed++;
  console.log(`✓ ${relative(ROOT, path)}`);
}

if (check && drift.length) {
  console.error(
    `✗ ${drift.length} page(s) désynchronisée(s) de la source :\n  ` +
      drift.join("\n  ") +
      `\n  → lance \`node scripts/build-marketing-header.js\` et commite le résultat.`
  );
  process.exit(1);
}
if (!check) console.log(changed ? `\n${changed} page(s) mise(s) à jour.` : "\nDéjà à jour.");

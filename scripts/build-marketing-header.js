#!/usr/bin/env node
// Génère l'en-tête ET le pied de page du site marketing dans TOUTES les pages,
// depuis la source unique ci-dessous.
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
      { icon: "ti-tag", tone: "amber", label: "Catégories &amp; tags", desc: "Rangement automatique", href: "/fonctionnalites/categories-tags" },
      { icon: "ti-world", tone: "sage", label: "Multi-devises", desc: "Idéal voyageurs &amp; nomades", href: "/fonctionnalites/multi-devises" },
      { icon: "ti-repeat", tone: "lavi", label: "Charges fixes &amp; récurrentes", desc: "Ce qui tombe chaque mois", href: "/fonctionnalites/charges-recurrentes" },
    ],
  },
  {
    title: "Analyser",
    items: [
      { icon: "ti-chart-pie", tone: "amber", label: "Budgets", desc: "Par catégorie, avec alertes", href: "/fonctionnalites/budgets" },
      { icon: "ti-chart-line", tone: "sky", label: "Rapports &amp; insights", desc: "Ce qui bouge, mois par mois", href: "/fonctionnalites/rapports" },
      { icon: "ti-diamond", tone: "lavi", label: "Patrimoine &amp; investissements", desc: "Actifs, crédits, évolution", href: "/fonctionnalites/patrimoine" },
    ],
  },
  {
    title: "Aller plus loin",
    items: [
      { icon: "ti-users", tone: "tang", label: "Dépenses partagées", desc: "Qui doit quoi, à deux", href: "/fonctionnalites/depenses-partagees" },
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
//
// `cta: true` ajoute le bouton « C'est parti » à côté de « Connexion ». Il n'est
// PAS partout : sur les pages de contenu, le bouton vit dans le corps de la page
// (bande de clôture), où il conclut un argumentaire. La page de présentation,
// elle, n'a pas de corps à elle — cinq actes en occupent toute la hauteur — donc
// c'est l'en-tête qui doit porter l'appel à l'action.
const PAGES = [
  { file: "index.html", active: null, cta: true },
  { file: "presentation.html", active: null },
  { file: "securite.html", active: "/securite" },
  { file: "fonctionnalites/objectifs.html", active: "/fonctionnalites/objectifs" },
  { file: "fonctionnalites/saisie-langage-naturel.html", active: "/fonctionnalites/saisie-langage-naturel" },
  { file: "fonctionnalites/transactions-recus.html", active: "/fonctionnalites/transactions-recus" },
  { file: "fonctionnalites/categories-tags.html", active: "/fonctionnalites/categories-tags" },
  { file: "fonctionnalites/multi-devises.html", active: "/fonctionnalites/multi-devises" },
  { file: "fonctionnalites/charges-recurrentes.html", active: "/fonctionnalites/charges-recurrentes" },
  { file: "fonctionnalites/budgets.html", active: "/fonctionnalites/budgets" },
  { file: "fonctionnalites/rapports.html", active: "/fonctionnalites/rapports" },
  { file: "fonctionnalites/patrimoine.html", active: "/fonctionnalites/patrimoine" },
  { file: "fonctionnalites/depenses-partagees.html", active: "/fonctionnalites/depenses-partagees" },
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

function renderHeader(active, cta) {
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
    (cta
      ? `    <a href="https://app.pairwise.finance/" class="hcta">C'est parti <i class="ti ti-arrow-right"></i></a>\n`
      : "") +
    `  </div>\n` +
    `</header>`
  );
}

/* ── Pied de page ─────────────────────────────────────────────────────────
   Il est genere ICI, depuis la meme source que le menu, pour la raison qui a
   fait naitre ce script : recopie a la main dans chaque page, il avait DEJA
   diverge — quatre versions differentes pour six pages, et une colonne
   « Fonctionnalites » qui listait six entrees quand le menu en annonçait dix.
   Le pied de page est le second jeu de liens internes du site ; le laisser
   derriver revient a decider au hasard quelles pages sont maillees.

   La colonne « Fonctionnalites » se deduit de FEATURES, Securite exceptee :
   elle a sa place dans la colonne PairWise, et y figurer deux fois n'ajoute
   rien. Meme regle que le menu pour les pages qui n'existent pas encore : un
   <span> inerte, jamais un lien mort. */
function renderFooterLink(it) {
  return it.href
    ? `      <a href="${it.href}">${it.label}</a>\n`
    : `      <span class="soon">${it.label}</span>\n`;
}

function renderFooter() {
  const feats = FEATURES.flatMap((c) => c.items).filter((it) => it.href !== "/securite");
  const auds = AUDIENCES.flatMap((c) => c.items);
  return (
    `<footer class="site">\n` +
    `  <!-- ⚠ GÉNÉRÉ — ne pas modifier à la main.\n` +
    `       Source : scripts/build-marketing-header.js · régénérer avec\n` +
    `       \`node scripts/build-marketing-header.js\`. -->\n` +
    `  <div class="wrap cols">\n` +
    `    <div>\n` +
    `      <a href="/" class="logo"><span class="p">P</span> PairWise</a>\n` +
    `      <p class="intro">Une seule app pour tes dépenses, ton budget et ton patrimoine — seul ou à deux.</p>\n` +
    `    </div>\n` +
    `    <div>\n` +
    `      <h4>Fonctionnalités</h4>\n` +
    feats.map(renderFooterLink).join("") +
    `    </div>\n` +
    `    <div>\n` +
    `      <h4>Pour qui</h4>\n` +
    auds.map(renderFooterLink).join("") +
    `    </div>\n` +
    `    <div>\n` +
    `      <h4>PairWise</h4>\n` +
    `      <a href="https://app.pairwise.finance/">Ouvrir l'app</a>\n` +
    `      <a href="/presentation">Tout ce que fait PairWise</a>\n` +
    `      <span class="soon">Tarifs</span>\n` +
    `      <a href="/securite">Sécurité</a>\n` +
    `      <span class="soon">FAQ</span>\n` +
    `    </div>\n` +
    `  </div>\n` +
    `  <div class="wrap copy">© 2026 PairWise · Fait avec soin · Tes données t'appartiennent</div>\n` +
    `</footer>`
  );
}

const MENU_SCRIPT = '<script src="/assets/menu.js" defer></script>';

function apply(html, active, cta) {
  let out = html.replace(
    /<header class="site">[\s\S]*?<\/header>/,
    () => renderHeader(active, cta)
  );
  out = out.replace(/<footer class="site">[\s\S]*?<\/footer>/, () => renderFooter());
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
  const after = apply(before, page.active, page.cta);
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

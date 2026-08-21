#!/usr/bin/env node
// Génère les icônes de l'app à partir de la SEULE définition de la marque,
// src/components/logoGeometry.js.
//
//   node scripts/build-icons.js
//
// Produit :
//   public/icon.svg      — la source vectorielle, servie telle quelle en favicon
//   public/icon-192.png  — icône du manifeste
//   public/icon-512.png  — icône du manifeste
//
// Pourquoi un script plutôt qu'un fichier dessiné à la main : les deux PNG
// étaient jusqu'ici LE MÊME fichier de 1024 × 1024 (390 Ko servis deux fois,
// aux deux tailles déclarées), et rien ne signalait la dérive. Ici les trois
// fichiers descendent des mêmes nombres, donc ils ne peuvent plus se contredire.
//
// La rastérisation demande un navigateur. Le dépôt ne dépend PAS de Playwright —
// ce script n'est pas dans le chemin de build, il ne se rejoue qu'au changement
// de la marque. Sans Playwright installé, le SVG est quand même écrit et le
// script explique comment obtenir les PNG.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logoSvg } from "../src/components/logoGeometry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

// DEUX jeux d'icônes, et c'est nécessaire :
//
//   • `maskable` — à fond perdu (rayon 0). Le système applique SON masque au
//     lanceur ; un coin déjà arrondi s'y ferait rogner une seconde fois.
//   • `any` — arrondie. C'est celle que Chrome affiche TELLE QUELLE sur l'écran
//     de démarrage, sans masque : à fond perdu elle y apparaît en carré à angles
//     vifs, ce qui a l'air d'un défaut plutôt que d'un choix.
//
// Un seul fichier déclaré « any maskable » doit servir les deux usages et rate
// forcément l'un des deux.
const BASE = { tile: true, markColor: "#ffffff", tileColor: "#e9673f" };
const VARIANTS = [
  { suffix: "", tileRadius: 0, label: "maskable" },
  { suffix: "-any", tileRadius: 22, label: "any" },
];

const svg = logoSvg({ size: 512, ...BASE, tileRadius: 22 });
writeFileSync(join(PUBLIC, "icon.svg"), svg + "\n");
console.log("écrit  public/icon.svg");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log(
    "\nPlaywright absent : les PNG ne sont pas régénérés." +
      "\nInstallez-le le temps du rendu, puis relancez :" +
      "\n  npm i -D playwright && npx playwright install chromium" +
      "\n  node scripts/build-icons.js"
  );
  process.exit(0);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
try {
  for (const { suffix, tileRadius, label } of VARIANTS)
  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    // `background: transparent` sur la page : la tuile du SVG fournit elle-même
    // son fond, et une couleur de page se glisserait sous les bords antialiasés.
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>` +
        logoSvg({ size, ...BASE, tileRadius }),
      { waitUntil: "load" }
    );
    await page.screenshot({
      path: join(PUBLIC, `icon${suffix}-${size}.png`),
      omitBackground: true,
    });
    await page.close();
    console.log(`écrit  public/icon${suffix}-${size}.png  (${size} × ${size}, ${label})`);
  }
} finally {
  await browser.close();
}

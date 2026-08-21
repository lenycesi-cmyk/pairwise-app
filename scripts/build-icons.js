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

// Les icônes sont déclarées `purpose: "any maskable"` dans le manifeste : le
// système applique SON masque, donc la tuile est à fond perdu (rayon 0). Un coin
// déjà arrondi ici se ferait rogner une seconde fois.
const TILE = { tile: true, tileRadius: 0, markColor: "#ffffff", tileColor: "#e9673f" };

const svg = logoSvg({ size: 512, ...TILE });
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
  for (const size of [192, 512]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    // `background: transparent` sur la page : la tuile du SVG fournit elle-même
    // son fond, et une couleur de page se glisserait sous les bords antialiasés.
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>` +
        logoSvg({ size, ...TILE }),
      { waitUntil: "load" }
    );
    await page.screenshot({
      path: join(PUBLIC, `icon-${size}.png`),
      omitBackground: true,
    });
    await page.close();
    console.log(`écrit  public/icon-${size}.png  (${size} × ${size})`);
  }
} finally {
  await browser.close();
}

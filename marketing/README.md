# Site marketing (`pairwise.finance`)

Pages **HTML statiques** servies sur l'apex `pairwise.finance` — distinct de l'app (SPA) sur
`app.pairwise.finance`. Raison d'être : le référencement naturel. La SPA n'a qu'une URL et sert un vrai
404, donc son potentiel SEO est quasi nul ; le SEO vient de ces pages statiques, pré-rendues, une par
fonctionnalité. Voir `docs/marketing-site-seo.md` pour la stratégie et l'inventaire complet.

## Structure

```
marketing/
  assets/site.css                     Feuille partagée (tokens de l'app, thème clair + nuit)
  fonctionnalites/
    saisie-langage-naturel.html       1ʳᵉ page livrée
  README.md
```

Chaque page est **autonome** : un `<head>` complet (title, meta description, canonical, hreflang fr/en,
Open Graph) + des données structurées JSON-LD (`SoftwareApplication` + `BreadcrumbList` + `FAQPage`),
et référence `/assets/site.css`. Polices et icônes = les mêmes CDN que l'app (Google Fonts Poppins +
Nunito Sans, Tabler Icons).

## Conventions

- **Tutoiement** partout (comme l'app).
- Le bouton **« C'est parti »** et **« Connexion »** pointent vers `https://app.pairwise.finance/` :
  le moment interactif (onboarding « valeur d'abord ») vit dans l'app, pas ici.
- Gabarit d'une page de fonctionnalité : Hero (H1 bénéfice + mot-clé dans les 100 premiers mots) →
  Comment ça marche (captures) → Pour qui → FAQ (→ `FAQPage`) → bande CTA « C'est parti ». Court.
- **Liens internes vers des pages non encore construites** (`/fonctionnalites/multi-devises`, `/pour/*`…) :
  ils renvoient 404 tant que la page n'existe pas. On ne met le site en ligne qu'une fois un socle de
  pages prêt ; on relie au fur et à mesure. Ne pas déployer une page isolée avec des liens morts.
- Les « captures d'interface » sont pour l'instant des **reproductions fidèles en CSS** (mêmes tokens).
  À remplacer par de vrais screenshots de l'app au moment voulu.

## Déploiement

`scripts/deploy.js --marketing --site=<id>` publie ce dossier sur le site Hosting `<id>` : source
`marketing/`, `cleanUrls: true` (sert `/fonctionnalites/x` depuis `x.html`), **pas** de catch-all `**`
(les chemins inconnus tombent sur `404.html` avec un vrai code 404), HTML non caché, `assets/**` en
cache court. `--marketing` **exige** `--site` : impossible de publier par erreur sur le site de l'app.

**En CI (recommandé, automatique) :** `deploy.yml` a une étape « Deploy marketing site » qui tourne à
chaque push sur `main` touchant `marketing/`, **à condition** que la variable de dépôt
`MARKETING_SITE_ID` soit définie (Settings → Variables). Absente ⇒ l'étape est ignorée, l'app n'est pas
affectée. La CI a déjà les identifiants (`GCP_SERVICE_ACCOUNT_KEY`).

**À la main (depuis une machine avec la clé de service) :**
```bash
npm run deploy:marketing -- --site=<id-du-site-marketing>
# ou
FIREBASE_HOSTING_SITE=<id> npm run deploy:marketing
```

**Prérequis, une fois :** le 2ᵉ site Hosting doit exister dans le projet `pairwise-12df2` et le domaine
`pairwise.finance` y être rattaché. L'`<id>` du site (slug visible dans la console Firebase → Hosting,
distinct du domaine) est ce qu'on passe à `--site` / met dans `MARKETING_SITE_ID`.

**À faire au fil des pages :** un `sitemap.xml` + `robots.txt` à la racine.

Itération locale sans déployer : ouvrir le `.html`, ou `npx serve marketing`.

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

## Déploiement (à câbler)

Le pipeline hosting existant (`scripts/deploy.js`) sait déjà cibler un autre site Hosting du même projet
via `--site=<id>` (ou `FIREBASE_HOSTING_SITE`). Étapes pour mettre ce dossier en ligne sur l'apex :

1. **Créer le 2ᵉ site Hosting** dans le projet Firebase (`pairwise-12df2`) — p. ex. site id
   `pairwise-marketing` — et y rattacher le domaine `pairwise.finance`. Étape console/CLI, une fois.
2. **Adapter `scripts/deploy.js`** pour publier le dossier `marketing/` (au lieu de `dist/`) quand
   `--site=pairwise-marketing` : servir les fichiers tels quels, avec des rewrites « propres »
   (`/fonctionnalites/saisie-langage-naturel` → le `.html`) et **pas** de catch-all `**` (même règle
   que l'app : un catch-all crée des soft-404). Prévoir `public/404.html`.
3. Générer un **`sitemap.xml`** + `robots.txt` à la racine du site marketing au fil des pages.

Tant que l'étape 1 n'est pas faite, on itère les pages en local (ouvrir le `.html`, ou `npx serve marketing`).

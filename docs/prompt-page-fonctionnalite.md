# Prompt à coller dans Claude (design) — page de fonctionnalité PairWise

Prompt réutilisable pour produire une page du site marketing. La **partie 1 est fixe**
(système de design, gabarit, règles) ; seule la **partie 2** change d'une page à l'autre.
Une fois la page validée dans Claude, on la reverse dans `marketing/fonctionnalites/`.

La partie 2 ci-dessous est déjà remplie pour **Transactions & reçus**. Pour les pages
suivantes, remplacer uniquement ce bloc (voir « Pages suivantes » en bas).

---

## ▼▼▼ COPIER À PARTIR D'ICI ▼▼▼

Tu es designer web. Produis **une page HTML complète et autonome** (un seul fichier,
CSS inline dans une balise `<style>`, aucune dépendance externe autre que les polices et
les icônes indiquées) pour le site marketing de **PairWise**.

### Le produit

PairWise est une application de finances personnelles : dépenses, budgets, charges fixes,
dépenses partagées à deux, investissements et patrimoine — **au même endroit**, dans
n'importe quelle devise. Elle remplace le trio « une appli pour voir ses comptes + une
appli pour partager les frais + un tableur ». Elle s'utilise **en solo, à deux, ou en
voyage** (le multi-devises est un atout fort pour les voyageurs, nomades et expatriés).

Le site marketing vit sur `pairwise.finance`, l'application sur `app.pairwise.finance`.

### Règles de ton et de rédaction

- **Français, tutoiement** (« tu », jamais « vous »). Comme dans l'app.
- **Page courte et dense.** Pas de remplissage, pas de sections décoratives. On préfère
  quatre sections utiles à huit sections tièdes.
- Écrire du point de vue de l'utilisateur : nommer les choses comme il les reconnaît.
- Rien d'inventé : ne décris que les fonctionnalités listées en partie 2.

### Système de design (à respecter strictement)

Polices, chargées via ces balises :

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
```

- Titres : **Poppins** (`letter-spacing: -0.02em`). Texte courant : **Nunito Sans**, 17 px.
- Icônes : **Tabler Icons** uniquement, jamais d'emoji — `<i class="ti ti-nom-icone"></i>`.

Jetons de couleur — les définir tels quels, et **styler uniquement via les variables** :

```css
:root {
  --ink:#2b2621; --ink-2:#6e665d; --ink-3:#a69c8f; --ink-4:#c9c0b4;
  --bg:#fbf7f1; --bg-card:#ffffff; --rule:rgba(43,38,33,.12);
  --panel:#f3ede3; --band:#f0e7d8;
  --tang:#e9673f; --tang-light:color-mix(in srgb,var(--tang) 15%,#fff); --tang-deep:#cf5730;
  --sage:#7fa98a; --sage-light:color-mix(in srgb,var(--sage) 15%,#fff);
  --lavi:#9c8fc6; --lavi-light:color-mix(in srgb,var(--lavi) 15%,#fff);
  --sky:#6aa0cc;  --sky-light:color-mix(in srgb,var(--sky) 15%,#fff);
  --amber:#e0952e;--amber-light:color-mix(in srgb,var(--amber) 15%,#fff);
  --shadow:0 14px 40px rgba(43,38,33,.10); --shadow-lg:0 30px 70px rgba(43,38,33,.16);
}
:root[data-theme="dark"] {
  --ink:#eef2f6; --ink-2:#b4bec8; --ink-3:#8b95a0; --ink-4:#5b6670;
  --bg:#0a1520; --bg-card:#14202d; --rule:#2b3540; --panel:#101c28; --band:#0f1d2b;
  --tang:#ff7458; --tang-light:#3e2f35; --tang-deep:#ff8a71;
  --sage:#5abb88; --sage-light:#213c3d;
  --lavi:#7aa8e0; --lavi-light:#1b334a;
  --sky:#2ea4dc;  --sky-light:#19384d;
  --amber:#fcb452;--amber-light:#3e3b34;
  --shadow:0 14px 40px rgba(0,0,0,.4); --shadow-lg:0 30px 70px rgba(0,0,0,.5);
}
```

Reprendre le **même bloc de valeurs sombres** sous
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
pour que la page suive le thème du système **et** le sélecteur manuel.

Codes couleur porteurs de sens, à respecter :
`--sage` = revenu / positif · `--tang` = dépense et couleur d'action (boutons) ·
`--lavi` = investissement et voix/micro · `--sky` = information · `--amber` = alerte douce.

Conteneur : `max-width: 1060px`, `padding: 0 24px`. Coins arrondis 12–22 px.
Responsive obligatoire (colonnes qui passent en pile sous 820 px, jamais de scroll
horizontal). Respecter `prefers-reduced-motion`.

### Gabarit de la page (dans cet ordre)

1. **Header collant** : logo (carré `--tang` avec un « P » blanc + « PairWise »), une nav de
   rubriques *non cliquables* (Fonctionnalités, Pour qui, Comparatifs, Tarifs, Sécurité —
   la rubrique courante en `--tang`), et « Connexion » à droite pointant vers
   `https://app.pairwise.finance/`.
2. **Fil d'Ariane** : Accueil › Fonctionnalités › *nom de la page*.
3. **Hero** en deux colonnes : à gauche, un sur-titre (`--tang`, majuscules, `letter-spacing`),
   un `<h1>` orienté bénéfice contenant le mot-clé, un paragraphe d'intro, un bouton
   **« C'est parti »** vers `https://app.pairwise.finance/` et une micro-réassurance.
   À droite, **une reproduction de l'interface** (voir ci-dessous).
4. **« Comment ça marche »** (fond `--panel`) : 2 ou 3 étapes numérotées, chacune avec un
   texte et une **capture d'interface** en vis-à-vis, alternées gauche/droite.
5. **« Pour qui »** : quatre cartes *non cliquables* — En solo, À deux, Voyageurs & nomades,
   Expatriés — avec une phrase courte reliant la fonctionnalité à chaque profil.
6. **FAQ** (fond `--panel`) : 4 à 6 questions en `<details>`/`<summary>`, avec un « + » qui
   pivote à l'ouverture. Ce sont ces questions qui alimentent le JSON-LD.
7. **Bande CTA** (fond `--band`) : sur-titre, un grand titre, le bouton **« C'est parti »**,
   et trois réassurances (sans compte pour commencer · données sur l'appareil · gratuit).
   Quelques icônes Tabler en fond, très discrètes (opacité ~0.15).
8. **Footer** (fond `--panel`) : logo + phrase de présentation, puis trois colonnes
   (Fonctionnalités, Pour qui, PairWise). **Seuls** « Ouvrir l'app » et
   `/fonctionnalites/saisie-langage-naturel` sont des liens ; le reste est du texte inerte
   (les pages n'existent pas encore — aucun lien mort sur ce site).

### Les « captures d'interface »

Il n'y a **pas** d'images à disposition : reproduis les écrans **en HTML/CSS**, avec les
jetons ci-dessus, pour qu'ils soient nets et suivent le thème clair/sombre.

- **Mobile** : un cadre de téléphone (largeur ~300 px, fond `#0d0d10`, rayon 40 px,
  padding 10 px, écran `--bg` en rayon 31 px, petite encoche).
- **Desktop** : un cadre de navigateur (barre `--panel` avec trois pastilles et une barre
  d'adresse affichant `app.pairwise.finance`).

Ces reproductions doivent être **crédibles et spécifiques** : de vrais libellés en français,
des montants plausibles en euros, les bonnes icônes Tabler, la bonne couleur sémantique.
Marque-les `aria-hidden="true"`.

### SEO (obligatoire, c'est la raison d'être de la page)

Dans le `<head>` :
- `<title>` de 55–60 caractères contenant le mot-clé, terminé par ` | PairWise`.
- `<meta name="description">` d'environ 150 caractères, avec le mot-clé et un bénéfice concret.
- `<link rel="canonical">` vers l'URL de la page, et `hreflang` `fr` / `en` / `x-default`
  (le miroir anglais vit sous `https://pairwise.finance/en/features/<slug-en>`).
- Open Graph : `og:type`, `og:site_name`, `og:locale`, `og:title`, `og:description`, `og:url`,
  `og:image`, plus `twitter:card = summary_large_image`.
- **JSON-LD** dans un `<script type="application/ld+json">` avec un `@graph` contenant
  `SoftwareApplication` (PairWise, `FinanceApplication`, gratuit), `BreadcrumbList`
  (Accueil › Fonctionnalités › la page) et `FAQPage` reprenant **mot pour mot** les questions
  et réponses de la FAQ affichée.

Le mot-clé cible doit apparaître dans le `<h1>` et dans les 100 premiers mots.

---

## ▶ PARTIE 2 — LA PAGE À PRODUIRE

**Page : Transactions & reçus**

- **URL** : `https://pairwise.finance/fonctionnalites/transactions-recus`
- **Miroir anglais** : `https://pairwise.finance/en/features/transactions-receipts`
- **Mot-clé cible** : *suivi des dépenses* (variantes : historique de dépenses,
  application pour suivre ses dépenses, photo de ticket de caisse)
- **Sur-titre** : Transactions & reçus
- **Angle** : l'historique n'est utile que si on y **retrouve** quelque chose. Ici, chaque
  dépense est classée, cherchable, photographiée et discutable — six mois plus tard, la
  question « c'était quoi ce paiement ? » a une réponse.

**Fonctionnalités à présenter (toutes réelles, ne rien ajouter) :**

1. **Un historique groupé par jour** — les transactions s'empilent par date, avec pour
   chacune la catégorie et son icône de couleur, la description, le montant, et un point
   de couleur indiquant **qui a payé**.
2. **Recherche instantanée** — un champ qui cherche dans la description, la sous-catégorie
   et les tags. Taper `#` cible directement un tag (ex. `#vacances`).
3. **Filtres repliés derrière une icône entonnoir** — pour ne pas encombrer l'écran. On
   filtre par membre, par période, par catégorie, par sous-catégorie et par tag ; chaque
   dimension ouvre son propre sélecteur. Une pastille signale qu'un filtre est actif.
4. **Photo du reçu** — on prend le ticket en photo au moment de saisir la dépense. L'image
   est **compressée sur l'appareil** avant l'envoi (redimensionnée à 1200 px, qualité 75 %)
   pour économiser données et stockage. Une vignette apparaît sur la ligne, et un tap
   l'affiche en plein écran.
5. **Partage à deux** — une transaction peut être partagée (50/50 ou une répartition
   personnalisée en pourcentage ou en montant), et la ligne montre la part de chacun.
6. **Discussion sur une transaction** — une bulle sur chaque ligne ouvre un fil de
   discussion, pour demander « c'était quoi ? » sans quitter l'app.
7. **Export CSV** — un bouton exporte **la sélection filtrée** (pas seulement tout) avec
   date, type, catégorie, sous-catégorie, description, montant, devise, montant converti,
   qui a payé et le partage. Utile pour la compta ou un tableur.

**Captures à reproduire :**
- *Hero* : la liste de transactions sur mobile — un en-tête de date (« Aujourd'hui »),
  deux ou trois lignes avec icône de catégorie colorée, libellé, montant, et **une ligne
  portant une vignette de reçu**.
- *Étape 1* : le champ de recherche avec `#vacances` saisi, et la liste filtrée en dessous.
- *Étape 2* : le panneau de filtres ouvert (les puces Membre et Période, et les trois
  boutons Catégorie / Sous-catégorie / Tag).
- *Étape 3* : le reçu affiché en plein écran par-dessus la liste.

**FAQ à rédiger (5 questions) :** comment retrouver une dépense précise ; peut-on joindre
la photo d'un ticket ; les photos de reçus sont-elles privées (oui — accès réservé aux
membres du couple, et l'image est compressée sur l'appareil avant l'envoi) ; peut-on
exporter ses transactions ; peut-on partager une dépense à deux.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

## Pages suivantes

Pour la page d'après, ne remplacer que la **partie 2** : URL, mot-clé, sur-titre, angle,
liste des fonctionnalités réelles, captures et FAQ. Le reste du prompt ne bouge pas — c'est
ce qui garantit que toutes les pages se ressemblent.

Ordre de production prévu (cf. `docs/marketing-site-seo.md`) : Multi-devises · Dépenses
partagées · Budgets · Patrimoine & investissements · Charges récurrentes · Synchronisation
bancaire · Rapports & insights · Sécurité.

**Après validation dans Claude :** enregistrer la page sous
`marketing/fonctionnalites/<slug>.html`, remplacer le `<style>` inline par
`<link rel="stylesheet" href="/assets/site.css">` si les styles sont déjà couverts (sinon
ajouter les nouvelles règles à `site.css`), puis rebrancher le lien de la rubrique dans le
header et les footers des autres pages. La CI déploie au merge sur `main`.

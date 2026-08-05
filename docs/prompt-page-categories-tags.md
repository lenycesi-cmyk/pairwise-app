# Prompt à coller dans Claude (design) — page « Catégories & tags »

Prompt complet et autonome. La **partie 1 est identique** à celle des autres pages de
fonctionnalité (c'est ce qui garantit que le site reste cohérent) ; la **partie 2** décrit
cette page-ci.

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
- Rien d'inventé : ne décris que ce qui est listé en partie 2.

### Système de design (à respecter strictement)

Polices et icônes, chargées via ces balises :

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
```

- Titres : **Poppins** (`letter-spacing: -0.02em`). Texte courant : **Nunito Sans**, 17 px.
- Icônes : **Tabler Icons** — `<i class="ti ti-nom-icone"></i>`. Pas d'emoji dans l'interface
  ni dans les titres. **Exception unique** : les tags préréglés portent un emoji dans l'app
  (voir partie 2), donc les afficher avec leur emoji est correct et voulu.

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

Codes couleur porteurs de sens : `--sage` = revenu / positif · `--tang` = dépense et couleur
d'action (boutons) · `--lavi` = investissement, et ici **la couleur des tags** ·
`--sky` = information · `--amber` = alerte douce.

Conteneur : `max-width: 1060px`, `padding: 0 24px`. Coins arrondis 12–22 px.
Responsive obligatoire (colonnes empilées sous 820 px, jamais de scroll horizontal).
Respecter `prefers-reduced-motion`.

### Ossature commune

- **Header collant** : logo (carré `--tang`, « P » blanc + « PairWise »), nav de rubriques
  *non cliquables* (Fonctionnalités — en `--tang` car c'est la rubrique courante —, Pour qui,
  Comparatifs, Tarifs, Sécurité), et « Connexion » à droite vers `https://app.pairwise.finance/`.
- **Fil d'Ariane** : Accueil › Fonctionnalités › Catégories & tags.
- **Bande CTA** avant le pied de page (fond `--band`) : sur-titre, grand titre, bouton
  **« C'est parti »** vers `https://app.pairwise.finance/`, et trois réassurances (sans compte
  pour commencer · données sur l'appareil · gratuit). Quelques icônes Tabler en fond très
  discrètes (opacité ~0.15).
- **Footer** (fond `--panel`) : logo + phrase de présentation, puis trois colonnes
  (Fonctionnalités, Pour qui, PairWise). **Seuls** « Ouvrir l'app » et
  `/fonctionnalites/saisie-langage-naturel` sont des liens ; tout le reste est du texte inerte
  — les pages n'existent pas encore, et on ne pose aucun lien mort sur ce site.

### Les « captures d'interface »

Il n'y a **pas** d'images : reproduis les écrans **en HTML/CSS** avec les jetons ci-dessus,
pour qu'ils restent nets et suivent le thème clair/sombre.

- **Mobile** : cadre de téléphone (largeur ~300 px, fond `#0d0d10`, rayon 40 px, padding 10 px,
  écran `--bg` en rayon 31 px, petite encoche).
- **Desktop** : cadre de navigateur (barre `--panel`, trois pastilles, barre d'adresse
  affichant `app.pairwise.finance`).

Ces reproductions doivent être **crédibles et spécifiques** : vrais libellés français, montants
plausibles en euros, bonnes icônes Tabler, bonne couleur sémantique. Les marquer `aria-hidden="true"`.

### SEO (obligatoire, c'est la raison d'être de la page)

Dans le `<head>` : `<title>` de 55–60 caractères contenant le mot-clé et finissant par
` | PairWise` · `<meta name="description">` d'environ 150 caractères · `<link rel="canonical">` ·
`hreflang` `fr` / `en` / `x-default` (miroir anglais sous
`https://pairwise.finance/en/features/categories-tags`) · Open Graph complet (`og:type`,
`og:site_name`, `og:locale`, `og:title`, `og:description`, `og:url`, `og:image`) et
`twitter:card = summary_large_image`.

**JSON-LD** dans un `<script type="application/ld+json">` avec un `@graph` contenant
`SoftwareApplication` (PairWise, `FinanceApplication`, gratuit), `BreadcrumbList`
(Accueil › Fonctionnalités › Catégories & tags) et `FAQPage` reprenant **mot pour mot** les
questions et réponses affichées.

Le mot-clé cible doit figurer dans le `<h1>` et dans les 100 premiers mots.

---

## ▶ PARTIE 2 — LA PAGE À PRODUIRE

**Page : Catégories & tags**

- **URL** : `https://pairwise.finance/fonctionnalites/categories-tags`
- **Miroir anglais** : `https://pairwise.finance/en/features/categories-tags`
- **Mot-clé cible** : *catégoriser ses dépenses* (variantes : classer ses dépenses,
  catégories de budget, savoir où part son argent)
- **Sur-titre** : Catégories & tags
- **Angle** : une dépense se range sur **deux axes indépendants**. La **catégorie** dit *ce que
  c'est*. Le **tag** dit *pourquoi tu l'as faite*. Le premier axe répond à « où part mon
  argent ? », le second à des questions que les catégories ne savent pas poser — « combien m'a
  coûté ce voyage ? », « combien je dépense sur des coups de tête ? ».

### L'objectif pédagogique de cette page

C'est une page qui **explique**, pas seulement qui liste. Elle doit faire comprendre :

1. **Pourquoi classer par catégorie** — sans classement, un relevé bancaire n'est qu'une liste
   de commerçants : on voit les débits, pas les habitudes. La catégorie transforme la liste en
   réponse (« l'alimentation, c'est 420 € ce mois-ci »).
2. **Pourquoi une sous-catégorie** — « Alimentation : 420 € » n'est pas actionnable. Le second
   niveau montre *quoi couper* : Courses 260 €, Livraison de repas 90 €, Café à emporter 40 €,
   Boulangerie 30 €. C'est la livraison et le café qu'on peut décider de réduire, pas « manger ».
3. **Pourquoi les tags** — la catégorie est **une seule** par dépense et décrit sa nature. Le
   tag est **transversal** : plusieurs par dépense, il traverse les catégories. Un week-end à
   Lisbonne, ce n'est pas une catégorie — c'est un vol (Transport), un logement (Voyages), des
   restaurants (Alimentation) et un musée (Loisirs). Seul un tag peut les rassembler.

### Ce qui existe réellement (ne rien inventer, ne rien omettre d'important)

**Catégories**
- **18 catégories de dépense fournies d'origine**, plus Revenus et Investissements. Chacune a
  son **icône** et sa **couleur**. Exemples : Logement, Alimentation, Transport, Santé,
  Loisirs & sorties, Abonnements & médias, Voyages, Éducation & formation, Enfants,
  Beauté & bien-être, Sport, Vêtements, Animaux, Cadeaux & dons, Impôts & taxes,
  Banque & assurances, Frais professionnels, Divers / Shopping.
- **Chaque catégorie contient des sous-catégories prêtes à l'emploi.** Exemples réels :
  - *Logement* : Loyer, Crédit immobilier, Charges de copropriété, Électricité, Gaz, Eau,
    Internet, Entretien & réparations, Taxe foncière, Assurance habitation, Mobilier &
    électroménager, Décoration, Jardinage, Bricolage, Travaux / rénovation.
  - *Alimentation* : Courses, Take away, Livraison de repas, Snacks, Café à emporter,
    Boulangerie / pâtisserie, Petit-déjeuner.
  - *Transport* : Essence, Parking, Entretien véhicule, Assurance auto, Crédit auto,
    VTC / taxi, Transports en commun, Péage.
- **Tout est modifiable** : créer ou supprimer une catégorie, choisir son icône et sa couleur,
  ajouter ou retirer une sous-catégorie, réordonner la liste par glisser-déposer.
- **Une dépense n'a qu'une seule catégorie** (et une sous-catégorie).
- La catégorie est **devinée automatiquement** à la saisie (voir la page « Saisie en langage
  naturel »), et PairWise **apprend** : une description déjà classée retrouve sa catégorie.

**Tags**
- Un tag **étiquette une dépense transversalement aux catégories**. Une dépense peut en porter
  **plusieurs**.
- **Tags préréglés proposés**, regroupés par intention (les afficher avec leur emoji) :
  - *Prise de conscience* : 🙈 inutile · ⚡ impulsif · 😔 regret
  - *Assumé* : 😎 yolo · 🎁 plaisir
  - *Subi mais nécessaire* : 🚨 urgence · ❤️‍🩹 santé
  - *Administratif* : ↩️ remboursable · 💼 pro · 🎀 cadeau
  - *Projet / événement* : 🏖️ vacances
- On peut **créer ses propres tags** librement (ils sont normalisés : minuscules, sans « # »,
  espaces remplacés par des tirets — un emoji en tête est conservé).
- Les tags se saisissent aussi **en langage naturel** : écrire « resto pro » pose le tag
  `pro` tout seul.
- On peut **filtrer** l'historique par tag, et **chercher** avec `#vacances`.
- **On peut créer un budget sur un tag** (et pas seulement sur une catégorie) — c'est ce qui
  permet de se fixer une limite sur les achats impulsifs, chose impossible avec des catégories.
- Les rapports donnent un **total par tag** sur une période.

**À souligner comme bénéfice concret :** les sous-catégories de Revenus peuvent être
**reliées à un compte du patrimoine**, pour qu'un salaire enregistré crédite directement le
compte correspondant.

### L'exemple à dérouler (le cœur de la page)

Consacre-lui une **section entière et visuelle** : *un week-end à Lisbonne*.

Montre **cinq dépenses réelles**, chacune avec sa catégorie (icône + couleur) et son montant,
toutes portant le tag `🏖️ vacances` :

| Dépense | Catégorie › Sous-catégorie | Montant |
|---|---|---|
| Vol Paris–Lisbonne | Transport › Transports en commun | 180 € |
| Appartement 3 nuits | Voyages › Hébergement | 240 € |
| Dîner Time Out Market | Alimentation › Take away | 46 € |
| Tramway & métro | Transport › Transports en commun | 18 € |
| Musée du Fado | Loisirs & sorties › Musées | 12 € |

Puis la démonstration en deux temps, montrée côte à côte :

- **Vu par catégories** : les montants se dispersent dans quatre catégories différentes,
  noyés au milieu des dépenses du mois. Le voyage est invisible.
- **Vu par le tag `#vacances`** : **496 €**, le coût réel du week-end, reconstitué d'un seul
  filtre — et cela sans avoir rien classé différemment.

Formule la conclusion en une phrase du genre : *la catégorie répond à « où part mon argent ? »,
le tag à « combien m'a coûté ce truc-là ? »*.

Ajoute un second exemple, plus court, en une ou deux phrases : un déjeuner client reste une
dépense **Alimentation › Take away**, mais le tag `💼 pro` (ou `↩️ remboursable`) permet de
sortir la note de frais à la fin du mois sans avoir à créer une catégorie « professionnel »
artificielle.

### Structure suggérée pour cette page

1. Hero — h1 + intro + bouton « C'est parti », et à droite une capture montrant une transaction
   avec sa catégorie, sa sous-catégorie et ses deux tags.
2. **« Pourquoi classer »** (fond `--panel`) — le passage du relevé brut à la réponse, puis le
   niveau sous-catégorie qui rend la chose actionnable. Illustre avec la ventilation
   Alimentation → Courses / Livraison / Café / Boulangerie (barres de progression colorées).
3. **« Catégorie ou tag ? »** — les deux axes en vis-à-vis, dans deux cartes : *Catégorie —
   ce que c'est · une seule par dépense · deux niveaux* face à *Tag — pourquoi tu l'as faite ·
   autant que tu veux · traverse les catégories*.
4. **« L'exemple : un week-end à Lisbonne »** — la section décrite ci-dessus.
5. **« Ce que tu peux régler »** — court : créer/renommer une catégorie, icône et couleur,
   sous-catégories, réordonner par glisser-déposer, tags personnalisés, budget sur un tag.
6. **« Pour qui »** — quatre cartes *non cliquables* : En solo (savoir où part l'argent),
   À deux (un langage commun pour classer), Voyageurs & nomades (un tag par voyage),
   Expatriés (séparer les dépenses d'ici et de là-bas).
7. **FAQ** (fond `--panel`), 5 questions en `<details>`/`<summary>` avec un « + » qui pivote :
   quelle différence entre une catégorie et un tag ; peut-on créer ses propres catégories ;
   combien de tags par dépense ; faut-il tout classer à la main (non — c'est deviné à la saisie,
   et PairWise apprend) ; peut-on suivre un budget sur un tag (oui).
8. Bande CTA, puis footer.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation dans Claude :** enregistrer sous
`marketing/fonctionnalites/categories-tags.html`, remplacer le `<style>` inline par
`<link rel="stylesheet" href="/assets/site.css">` (en versant les règles nouvelles dans
`site.css`), puis rebrancher le lien dans les footers des autres pages. La CI déploie au
merge sur `main`.

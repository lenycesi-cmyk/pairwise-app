# Site marketing & SEO — état du chantier

> Sauvegarde de contexte (sujet : **nouveau header + présentation des fonctionnalités + insertion d'éléments SEO**).
> Sert de point de reprise entre sessions. Mise à jour au fil de l'avancement.

## Objectif

Acquérir des utilisateurs via le **référencement naturel (SEO)**. L'app (`app.pairwise.finance`)
est une SPA à une seule URL qui sert un vrai 404 — **potentiel SEO quasi nul par conception**.
Le SEO vient donc d'un **site marketing statique** sur l'apex `pairwise.finance` (le 2ᵉ site Firebase
Hosting prévu dans le projet ; `scripts/deploy.js` gère déjà `--site=<id>`).

## Décisions actées

1. **Modèle Lunch Money** : on garde la page d'onboarding, on lui ajoute un **header** avec un
   méga-menu « Fonctionnalités » ; chaque fonctionnalité = une **page de présentation** qui porte
   le SEO. Les pages « Pour qui » et comparatifs complètent.
2. **Positionnement élargi** : plus « couple only ». Trois audiences — **Solo · Couple · Voyageurs
   & nomades** (+ Expatriés). Le **multi-devises** est l'atout mis en avant pour les nomades.
3. **Le site tutoie** (comme l'app), pas de « vous ».
4. **Frontière app / marketing** : le pitch + le SEO vivent sur `pairwise.finance` ; le bouton
   « C'est parti » mène à `app.pairwise.finance` où commence l'onboarding « valeur d'abord ».
   Option « simple » retenue : le moment interactif reste **dans l'app** (pas dupliqué sur la home).
5. **Header sur l'onboarding = SANS bouton « C'est parti »** (le CTA du hero suffit). Le bouton
   « C'est parti » ne sera que sur les pages marketing (pas de CTA central là-bas).
6. **Contrainte SEO non négociable** : les pages de fonctionnalités ne rapportent du référencement
   **que si ce sont de vraies pages HTML statiques/pré-rendues** — pas des vues internes de la SPA.

## Livré (dans le code)

- **PR #386 — fusionnée** : `src/screens/onboarding/OnboardingHeader.jsx` (nouveau) + intégration
  dans l'état ACCUEIL de `src/screens/onboarding/OnboardingEntry.jsx`.
  - Barre : logo + nav (Fonctionnalités [méga-menu], Pour qui, Comparatifs, Tarifs, Sécurité) + Connexion.
  - Icônes Tabler, bilingue FR/EN (strings dans le composant), thème clair/nuit, responsive
    (nav masquée < 760px → logo + Connexion).
  - **Liens sans destination pour l'instant** (choix utilisateur) : cliquer un item referme le menu,
    aucun 404. Seul « Connexion » est actif.
  - Vérifié en navigateur réel (desktop + mobile).

## Maquettes (artefacts de référence)

- Header — **maquette finale** (3 états) : https://claude.ai/code/artifact/54fed28e-8352-4ab0-b9b4-c03bca4f59b8
- Header sur l'onboarding (contextuel) : https://claude.ai/code/artifact/14895f17-0092-4943-82b5-7b2680fa43b3
- **Plan de pages SEO v2 + gabarit + exemple Multi-devises** : https://claude.ai/code/artifact/703d413d-5aa7-4a5f-be63-bd2a3e81fa71
- Plan SEO v1 (stratégie initiale, piliers) : https://claude.ai/code/artifact/b3a32b1a-feda-4690-8f1d-cd2ea9aa4c58
- Homepage marketing (option NON retenue — page vitrine séparée) : https://claude.ai/code/artifact/534b50be-3003-465a-a227-1b687b882f60

## Inventaire des pages (méga-menu = ces pages)

Sous `pairwise.finance/fonctionnalites/…`, avec mot-clé cible et priorité (volumes à valider en
Search Console) :

| Page | Mot-clé cible | Prio |
|---|---|---|
| Multi-devises (`/multi-devises`) | application budget multi-devises | **1** |
| Dépenses partagées (`/depenses-partagees`) | application partage de dépenses | **1** |
| Synchronisation bancaire (`/synchronisation-bancaire`) | application synchronisation bancaire | 2 |
| Budgets (`/budgets`) | application budget | 2 |
| Patrimoine & investissements (`/patrimoine`) | application suivi patrimoine (+ portefeuille bourse/crypto) | 2 |
| Transactions & reçus (`/transactions`) | application suivi des dépenses | 2 |
| Charges récurrentes (`/charges-recurrentes`) | suivre ses abonnements & charges fixes | 2 |
| Rapports & insights (`/rapports`) | analyser ses dépenses | 3 |
| Saisie langage naturel (`/saisie-rapide`) | ajouter une dépense rapidement | 3 |
| Catégories & tags (`/categories-tags`) | catégoriser ses dépenses | 3 |
| Objectifs d'épargne (`/objectifs`) | application objectif épargne | 3 |
| Score de santé financière (`/sante-financiere`) | score de santé financière | 3 |
| Rappels & notifications (`/rappels`) | rappel paiement / budget | 3 |
| Sécurité (`/securite`) | sécurité données bancaires app (page confiance) | 2 |

**Note :** « Suivi du patrimoine » et « Investissements » ont été **fusionnés** en un seul item
« Patrimoine & investissements » (sous-titre : « Actifs, crédits, évolution — un seul endroit »)
→ une seule page `/fonctionnalites/patrimoine`.

### Pages « Pour qui » (`/pour/…`)
- `/pour/solo` — application gestion budget personnel — **1**
- `/pour/couples` — application budget couple — **1**
- `/pour/voyageurs-nomades` — gérer son argent en voyage / digital nomad — **1**
- `/pour/expatries` — gérer ses comptes expatrié multi-devises — 2

### Comparatifs (`/comparatifs/…`) — forte intention d'achat
- `/alternative-tricount` — **1**
- `/alternative-splitwise` — **1**
- `/alternative-bankin` — 2
- `/pairwise-vs-ynab` — 2
- `/pairwise-vs-finary` — 3

### Outils gratuits (`/outils/…`) — aimants à liens & emails
- `/modele-budget` (modèle tableur) · `/calculateur-repartition` · `/calculateur-patrimoine-net`

### Socle
Accueil, `/tarifs`, `/faq`, `/a-propos`, `/securite`. Chaque page a son miroir `/en/…` avec `hreflang`.

## Gabarit d'une page de fonctionnalité

Meta title (≤60c, mot-clé + marque) · meta description (~150c) · H1 orienté bénéfice ·
intro (mot-clé dans les 100 premiers mots) · H2 « Comment ça marche » (2-3 étapes + capture) ·
H2 « Pourquoi c'est utile » (puces reliées aux 3 audiences) · H2 « Pour qui » (liens `/pour/*`) ·
H2 FAQ (3-5 Q/R → `FAQPage`) · liens internes + CTA « C'est parti » ·
données structurées `SoftwareApplication` + `BreadcrumbList` + `FAQPage` · `hreflang`/`canonical`.
Exemple entièrement rédigé (Multi-devises) dans l'artefact du plan v2.

## Positionnement (fil conducteur)

Une seule app remplace le trio **Bankin' (vue d'ensemble) + Tricount (qui doit quoi) +
compte commun (charges fixes)**. Concurrents : Bankin', Linxo, Tricount, Splitwise, Finary, YNAB.

## Prochaines étapes

1. **Décider le socle technique du site marketing** (générateur statique vs pages HTML servies) et
   l'hébergement sur le 2ᵉ site Firebase (`--site=`). Rappel : hosting piloté par `scripts/deploy.js`
   (config REST, PAS `firebase.json`) → tenir les deux synchronisés.
2. **Rédiger la 1ʳᵉ page de fonctionnalité** (recommandé : *Multi-devises* ou *Dépenses partagées*),
   d'après le gabarit.
3. **Relier les liens du header** au fur et à mesure que les pages existent (aujourd'hui sans destination).
4. Ordre de production Phase 1 (bas de tunnel) : Multi-devises, Dépenses partagées, les 3 pages
   « Pour qui » prioritaires, comparatifs Tricount & Splitwise, 2 outils.
5. Déployer le **miroir EN** une fois le FR qui performe.

## À trancher (mineurs)

- **Double logo** sur la page d'accueil (header + hero) : garder, ou retirer celui du hero ?
- Emojis des **pastilles de suggestion** de l'onboarding : garder (contenu produit réel) ou passer
  en icônes ?

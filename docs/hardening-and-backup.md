# PairWise — Roadmap de durcissement & stratégie de sauvegarde

> Document de référence, à reprendre plus tard. Deux parties indépendantes :
> 1. **Roadmap de durcissement** — passer aux standards de l'industrie, sans réécriture.
> 2. **Stratégie de sauvegarde / backup** — code, config et données utilisateurs.
>
> Rappel de contexte : app de finances de couple. Front **React 19 + Vite 8 (Rolldown)**,
> JavaScript (pas de TS). Backend **serverless Firebase** (Auth, Firestore, Storage,
> Cloud Functions, FCM, Plaid). Hébergement **Firebase Hosting**. Modèle de données
> « couple-centric » : presque tout sur un seul document `couples/{coupleId}`,
> transactions en sous-collection. Détails dans `CLAUDE.md`.

---

## Partie 1 — Roadmap de durcissement

Principe directeur : **chaque chantier est additif et se rembourse indépendamment.**
Aucun n'exige de repartir de zéro ; le seul « big bang » possible (quitter Firebase)
n'est **pas** recommandé.

Légende — Effort : 🟢 faible · 🟡 moyen · 🔴 élevé (mais étalable). Risque idem.

### P1 — Durcir les règles de sécurité Firestore/Storage 🟢 effort · 🟢 risque · ⭐ impact fort
- **Pourquoi** : aujourd'hui `firestore.rules` est volontairement permissif (tout
  utilisateur authentifié peut lire/écrire n'importe quel couple). Acceptable en usage
  privé à deux, **bloquant dès qu'un 2e couple utilise l'app**.
- **Quoi** : restreindre l'accès au(x) `coupleId` de l'utilisateur (`users/{uid}.coupleId`),
  valider les champs en écriture, protéger la sous-collection `transactions`.
- **Comment sans réécriture** : `firestore.rules` + `storage.rules` sont des fichiers
  **à part**, déployables seuls. On durcit **progressivement** et on teste avec
  l'émulateur Firestore (`firebase emulators`) + `@firebase/rules-unit-testing`.
- **Déclencheur** : à faire **avant** toute ouverture au-delà des deux utilisateurs actuels.

### P2 — Tests automatisés sur la logique critique 🟡 · 🟢 · ⭐ impact fort
- **Pourquoi** : app **financière**, aucun test aujourd'hui ; chaque refonte se vérifie
  à la main.
- **Quoi d'abord** (le cœur métier, pur et testable) :
  - conversion de devises figée (`utils/currencyConversion.js`, `hooks/useExchangeRates.js`) ;
  - calculs budget (`hooks/useBudgetProgress.js`, `utils/budgetStatus.js`) ;
  - plages de période (`utils/periodRange.js`) ;
  - santé financière / insights.
- **Comment** : **Vitest** (natif Vite, zéro config lourde) + Testing Library pour
  quelques composants clés. Ajout **pur**, aucun impact sur l'existant. Brancher sur la CI
  (`.github/workflows`) en plus du lint.

### P3 — TypeScript, en continu 🔴 (étalé) · 🟢 · ⭐ impact structurant
- **Pourquoi** : documente le modèle de données, attrape des bugs, facilite l'onboarding.
- **Comment sans big bang** : Vite gère **JS et TS côte à côte**. Activer TS en mode
  permissif (`allowJs`, `strict` progressif), puis renommer `.jsx → .tsx`
  **fichier par fichier**. Ordre conseillé :
  1. typer le **modèle de données** (Transaction, Budget, Asset, Couple, Member…) dans un
     `src/types.ts` — le plus rentable, sert de doc vivante ;
  2. les **contexts** (`AuthContext`, `FinanceContext`) ;
  3. les **hooks** et `utils` ;
  4. les écrans, au fil des évolutions.
- Peut s'étaler sur des mois ; l'app tourne pendant toute la transition.

### P4 — Routing (URLs par écran) 🟡 · 🟡 · impact moyen
- **Pourquoi** : aujourd'hui la navigation est un `useState` dans `App.jsx` → pas d'URL
  partageable, pas de deep-link, bouton « précédent » du navigateur limité.
- **Comment** : introduire **React Router** en enveloppant les onglets existants (chaque
  onglet = une route). Migration **écran par écran**, les composants ne changent pas.
- **Déclencheur** : quand le partage de lien / deep-link devient utile.

### P5 — i18n via librairie 🟢 · 🟢 · impact faible
- **Pourquoi** : le `t(key)` maison suffit pour FR/EN simples, mais limité (pluriels,
  interpolation, formats de dates/nombres, nouvelles langues).
- **Comment** : `useTranslation()` a **la même signature** qu'i18next → on réimplémente le
  hook derrière **i18next**, les ~1000 appels `t()` ne bougent pas. Transparent.

### P6 — Découpage du modèle de données 🔴 · 🟡 · impact = dette long terme
- **Pourquoi** : presque tout vit sur un seul doc `couples/{coupleId}`, écrit en
  *read-modify-merge* complet côté client. Deux limites à terme :
  - **1 Mo max par document** Firestore ;
  - **conflits d'écriture concurrents** (deux membres qui écrivent en même temps) ;
  - coût des writes (tout le doc réécrit à chaque changement).
- **Comment sans « stop the world »** : migrer **un sous-objet à la fois** vers une
  sous-collection (ex. `budgets`, `assets`, `recurringTx`), avec un script de migration
  ponctuel et une **lecture rétro-compatible** (lire ancien ET nouveau format) le temps de
  la bascule.
- **Déclencheur** : si un couple approche la limite de taille de doc, ou en cas de conflits
  d'écriture observés.

### P7 — Outillage de déploiement 🟢 · 🟢 · impact faible
- **État** : `firebase-tools` est cassé sur Node 24 → déploiement via scripts maison
  (`scripts/deploy.js` en REST, `scripts/deploy-functions.js`).
- **Cible** : rebasculer sur le **CLI officiel** dès qu'il refonctionne sur la version de
  Node utilisée. Le script maison est un **contournement temporaire**, pas une dette
  structurelle.

### Ce qu'on ne fait PAS
- **Quitter Firebase** pour un backend classique (Node/Postgres) ou Supabase : seul vrai
  chantier de réécriture. **Non justifié** — Firebase scale largement pour ce type d'app.
  À réévaluer uniquement si un besoin produit incompatible avec Firebase apparaît.

### Ordre recommandé
1. **P1 Règles de sécurité** (avant toute ouverture multi-couples)
2. **P2 Tests** logique financière
3. **P3 TypeScript** (en continu, démarrer par les types du modèle)
4. **P4 Routing** (quand deep-links utiles)
5. **P6 Découpage data** (si limite de doc approchée)
6. **P5 i18n** / **P7 Déploiement** (opportunistes)

Message de synthèse : **« la dette est choisie, pas subie, et chaque poste se rembourse
indépendamment sans réécriture. »**

---

## Partie 2 — Stratégie de sauvegarde / backup

Objectif : pouvoir **tout reconstruire** (code, config, données) après une perte
accidentelle (suppression, corruption, erreur de déploiement, compromission de compte).
On distingue trois périmètres : **code & config**, **données utilisateurs**, **secrets**.

### A. Code & configuration (frontend + backend)

Le code EST déjà sauvegardé — il vit sur **GitHub** (`lenycesi-cmyk/pairwise-app`).
Tout le backend « infra-as-code » y est aussi : `firestore.rules`, `storage.rules`,
`firebase.json`, `functions/`, `scripts/`. Pour renforcer :

- **Protéger `main`** : activer la *branch protection* (pas de force-push, PR obligatoire) —
  évite l'écrasement accidentel de l'historique.
- **Tags / releases versionnés** : taguer chaque déploiement significatif
  (`git tag v2026.07`) → on peut **redéployer une version connue-bonne** en cas de régression.
- **Miroir hors GitHub** (optionnel, résilience fournisseur) : un `git push --mirror` vers
  un second remote (GitLab, Bitbucket, ou stockage privé) via un cron. Le code étant
  distribué (chaque clone est une copie complète), le risque de perte est déjà faible.
- **Reproductibilité du build** : `package-lock.json` est versionné → `npm ci` reconstruit
  un build identique. ✅ déjà en place.

➡️ **Restauration** : `git clone` + `npm ci` + `npm run build` + `node scripts/deploy.js`.
Le frontend est **stateless** (SPA statique) : aucune donnée à sauvegarder côté hosting,
il se régénère depuis le code.

### B. Données utilisateurs — le vrai enjeu

C'est la partie **irremplaçable** : Firestore + Storage. Plusieurs couches, du plus
automatique au plus manuel.

#### B1. Point-in-Time Recovery (PITR) Firestore — *filet court terme*
- Firestore propose le **PITR** (récupération à la seconde près sur une **fenêtre de 7
  jours**). À **activer** (une commande `gcloud firestore databases update --enable-pitr`).
- Couvre : suppression/corruption récente. Ne couvre pas : perte > 7 jours, suppression du
  projet entier.

#### B2. Exports Firestore planifiés — *backup long terme* ⭐ recommandé
- **Quoi** : export managé Firestore (`gcloud firestore export`) vers un **bucket Cloud
  Storage dédié** (ex. `gs://pairwise-backups`).
- **Automatisation** : une Cloud Function `onSchedule` (même pattern que
  `syncAllBalances`/`monthlySummary` déjà en place) qui déclenche l'export **quotidiennement**.
- **Rétention** : politique de cycle de vie du bucket (ex. garder 30 jours de daily +
  12 mensuels). Bucket idéalement dans une **région différente** de la base + en
  **classe Coldline/Archive** (coût minimal).
- **Restauration** : `gcloud firestore import gs://pairwise-backups/<date>`.

#### B3. Sauvegarde du Storage (fichiers : images de commentaires, etc.)
- **Object Versioning** activé sur le bucket Storage → toute suppression/écrasement est
  récupérable.
- **Copie inter-bucket** planifiée (`gsutil rsync` ou Storage Transfer Service) vers le
  bucket de backup, même rétention que B2.

#### B4. Export utilisateur « mes données » (RGPD + backup perçu) — *bonus produit*
- **Quoi** : un bouton dans **Réglages** « Exporter mes données » qui génère un **JSON**
  (couple doc + transactions) téléchargeable, voire un CSV des transactions.
- **Pourquoi** : donne à l'utilisateur une copie autonome (utile en cas de départ,
  conformité RGPD « portabilité »), et sert de **backup applicatif** indépendant de l'infra.
- **Effort** : faible — les données sont déjà chargées côté client via `FinanceContext`.
  On sérialise et on déclenche un download. Un futur bouton « Importer » fermerait la boucle.

### C. Secrets & accès

- **Clé de compte de service** de déploiement (`pairwise-deploy@…`) : la sauvegarder dans
  un **gestionnaire de secrets** (1Password, Bitwarden, ou GCP Secret Manager), **jamais**
  dans le repo. Documenter les **rôles IAM requis** (déjà partiellement dans `CLAUDE.md` :
  Hosting Admin, Rules Admin, FCM API Admin).
- **Secrets GitHub Actions** (`FIREBASE_VAPID_KEY`, credentials de deploy) : noter leur
  liste et leur source dans un coffre, car ils ne sont pas récupérables une fois posés.
- **Récupération de compte** : activer la 2FA sur les comptes Google/GitHub propriétaires,
  et garder les codes de secours au coffre. La perte du **compte** est un risque aussi réel
  que la perte des données.

### D. Tester les restaurations (souvent oublié)
Un backup non testé n'est pas un backup. Prévoir **1× par trimestre** :
- importer un export Firestore dans un **projet Firebase de test** et vérifier l'intégrité ;
- redéployer une release taguée sur l'environnement de test.

### Récapitulatif — quoi, où, comment restaurer

| Périmètre | Sauvegarde | Fréquence | Restauration |
|---|---|---|---|
| Frontend (code) | GitHub + tags + miroir | continu | `git clone` → `npm ci` → build → deploy |
| Backend (functions, rules, config) | GitHub (infra-as-code) | continu | redéploiement depuis le repo |
| Firestore (données) | PITR (7 j) + export planifié vers bucket | quotidien | `gcloud firestore import` |
| Storage (fichiers) | Versioning + copie inter-bucket | quotidien | restauration de version / rsync inverse |
| Données par utilisateur | Export JSON in-app | à la demande | ré-import (à construire) |
| Secrets / accès | Gestionnaire de secrets + 2FA | à chaque rotation | depuis le coffre |

### Priorités de mise en place (backup)
1. **Activer le PITR Firestore** — 1 commande, filet immédiat.
2. **Export Firestore quotidien** vers bucket dédié (Cloud Function `onSchedule` + rétention).
3. **Versioning + copie du bucket Storage.**
4. **Branch protection + tags** sur GitHub.
5. **Export « mes données » in-app** (bonus produit + RGPD).
6. **Coffre à secrets + 2FA + drill de restauration trimestriel.**

> Les points 1–4 sont réalisables rapidement et couvrent l'essentiel du risque de perte.
> Le point 5 est un chantier applicatif à part entière (mais utile et pas urgent).

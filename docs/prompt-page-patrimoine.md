# Prompt à coller dans Claude (design) — page « Patrimoine & investissements »

Suite de la conversation : Claude reprend le système de design, le gabarit, le ton et les
exigences SEO déjà établis.

---

## ▼▼▼ COPIER À PARTIR D'ICI ▼▼▼

Page suivante du site marketing PairWise. **Reprends exactement le même système de design, le
même gabarit et les mêmes exigences SEO que la page précédente** (jetons de couleur clair +
nuit, Poppins/Nunito Sans, icônes Tabler, header collant à rubriques inertes, fil d'Ariane,
captures d'interface reproduites en HTML/CSS, bande CTA « C'est parti », footer sans lien mort,
JSON-LD `SoftwareApplication` + `BreadcrumbList` + `FAQPage`). Tutoiement, français.

Cette page compte **six blocs de contenu** au lieu de quatre : garde donc chaque section
**resserrée** (un titre, deux ou trois phrases, une illustration) plutôt que d'en développer
certaines au détriment des autres.

**Page : Patrimoine & investissements**

- **URL** : `https://pairwise.finance/fonctionnalites/patrimoine`
- **Miroir anglais** : `https://pairwise.finance/en/features/net-worth`
- **Mot-clé cible** : *suivi de patrimoine* (variantes : calculer son patrimoine net, suivre ses
  investissements, application patrimoine)
- **Sur-titre** : Patrimoine & investissements
- **Angle** : ton patrimoine, ce n'est pas ce qu'il y a sur ton compte courant. C'est **ce que
  tu possèdes moins ce que tu dois** — et surtout **comment ça bouge**. Un chiffre unique ne
  sert à rien ; ce qui compte, c'est de savoir ce qui l'a fait monter, ce qui l'a fait
  descendre, et à quoi tu es exposé.

### Les six choses à mettre en avant (une section chacune)

**1. Mes actifs**
Dix familles d'actifs : comptes bancaires, liquide, **actions**, **crypto**, assurance vie,
obligations, immobilier, véhicules, épargne retraite, et divers. Les comptes se déclinent en
sous-types français reconnaissables — **Compte courant, Livret A, LDDS, PEL, CEL, PEA,
PEA-PME**. Chaque actif a **sa propre devise**.
Les **actions et la crypto sont cotées automatiquement** : leur valeur suit le marché sans que
tu la saisisses. Pour le reste, tu renseignes la valeur quand elle change. PairWise affiche
aussi la **plus-value depuis l'achat** quand tu as indiqué ton montant investi.

**2. Mes passifs**
Crédit immobilier, prêt auto, crédit à la consommation, prêt étudiant, prêt personnel. Tu
saisis le capital, le taux et la durée, et PairWise en déduit la **mensualité** et le **capital
restant dû**, qui se déduit de ton patrimoine net. Un **calculateur d'échéance** permet de
simuler un prêt **avant** de s'engager : mensualité estimée et coût total des intérêts.

**3. Évolution mensuelle**
Un tableau mois par mois : **total des actifs**, **total des passifs**, crédits, et la
**variation**. Pas une courbe vague — des lignes que tu peux lire. Il se remplit à partir de
**deux mois enregistrés**.

**4. Ce qui a bougé**
La question qui suit toujours « pourquoi ça a changé ? ». PairWise sépare **ce qui a porté le
mois** de **ce qui a pesé**, actif par actif, et signale ce qui est **inchangé**, ce qui est
**nouveau** et ce qui a été **retiré**. Tu ne vois pas seulement que tu as gagné 2 400 € : tu
vois d'où ils viennent.
*Ces deux widgets reposent sur un enregistrement de ton patrimoine **chaque soir** — c'est ce
qui rend l'historique fiable, à mentionner en une phrase.*

**5. Exposition par devise**
Combien tu détiens **dans chaque monnaie**. Un expatrié ou un nomade a des soldes répartis sur
plusieurs devises sans jamais en avoir la vue d'ensemble : ici, elle tient en un graphique.
*(Précision honnête à conserver : ce widget porte sur les soldes détenus, hors actions et
crypto.)*

**6. « Et si j'avais investi mes dépenses superflues ? »**
Le simulateur qui fait réfléchir. Tu choisis une **période** (3 mois, 6 mois, 1 an) et,
facultativement, une **catégorie ou une sous-catégorie** de dépense — ou bien tout. PairWise
prend ce que tu as réellement dépensé et calcule, **à partir des cours historiques réels**, ce
que cette somme vaudrait aujourd'hui si tu l'avais placée dans l'un de tes actifs suivis.
*(Précision à conserver : cette comparaison nécessite d'avoir dans ton patrimoine un actif
suivi automatiquement — par exemple Bitcoin.)*

### L'exemple à dérouler (pour le simulateur, section 6)

Sur les **6 derniers mois**, tu as dépensé **540 €** en livraison de repas. Placés en Bitcoin
sur la même période, ces 540 € vaudraient **environ 710 €** aujourd'hui. Ce n'est pas un
reproche — c'est un ordre de grandeur, et il change la façon dont on regarde une habitude.
Formule-le sans culpabilisation : PairWise informe, il ne fait pas la morale.

### Captures à reproduire

- *Hero* : la carte « Patrimoine net » — un grand total, et en dessous deux colonnes
  **Actifs** / **Passifs** avec quelques lignes chacune (Compte courant, Livret A, PEA,
  Bitcoin, Appartement / Crédit immobilier, Prêt auto), plus la variation du mois en
  `--sage` ou `--tang`.
- *Section « Ce qui a bougé »* : deux petits blocs côte à côte — **Ce qui a porté le mois**
  (PEA +1 240 €, Bitcoin +680 €) et **Ce qui a pesé** (Appartement −400 €), avec les bonnes
  couleurs sémantiques.
- *Section « Exposition par devise »* : un graphique en anneau ou des barres horizontales —
  par exemple EUR 68 %, USD 22 %, THB 10 % — chacune avec sa couleur et son montant.
- *Section « Et si j'avais investi »* : la carte du simulateur, avec le poste choisi, la
  période, le montant dépensé et le résultat en gros.

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro posant « ce que tu possèdes moins
   ce que tu dois », bouton « C'est parti », carte Patrimoine net à droite.
2. **« Mes actifs »** (fond `--panel`) — section 1.
3. **« Mes passifs »** — section 2.
4. **« Comment ça bouge »** (fond `--panel`) — sections 3 et 4 **réunies** : le tableau mensuel
   puis « ce qui a porté / ce qui a pesé ». Elles racontent la même histoire, autant les
   présenter ensemble.
5. **« Exposition par devise »** — section 5, courte, avec son graphique.
6. **« Et si j'avais investi mes dépenses superflues ? »** (fond `--panel`) — section 6 et son
   exemple. C'est le point d'orgue de la page : donne-lui de l'air.
7. **« Pour qui »** — quatre cartes non cliquables : En solo (un patrimoine complet, pas juste
   un solde), À deux (le patrimoine du foyer, et la part de chacun), Voyageurs & nomades
   (des avoirs dans plusieurs devises), Expatriés (des comptes ici et là-bas).
8. **FAQ** (fond `--panel`), 5 à 6 questions : comment calculer son patrimoine net ; quels
   types d'actifs peut-on suivre ; les actions et la crypto sont-elles mises à jour toutes
   seules ; comment savoir ce qui a fait varier son patrimoine ; peut-on suivre ses crédits et
   leur capital restant dû ; à partir de quand voit-on une évolution (deux mois enregistrés).
9. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/patrimoine.html`, brancher
sur `/assets/site.css`, rebrancher le lien dans les footers. La CI déploie au merge sur `main`.

**Vérifié dans le code** (`WealthScreen`, `data/assetTypes.js`, `utils/loan.js`,
`InvestmentCalculatorScreen`, `functions/netWorthSnapshots.js`, `translations.js`) : widgets
« Évolution », « Répartition par type », « Exposition par devise » (libellé exact : *« Soldes
détenus par devise (hors actions et crypto) »*), « Crédits », « Évolution mensuelle » (colonnes
Poste / Total actifs / Total passifs / Crédits / Variation, **2 mois minimum**), « Ce qui a
bougé » (*« Ce qui a porté le mois »* / *« Ce qui a pesé »* / *« Inchangé »*, badges
*nouveau* / *retiré*) · 10 types d'actifs dont actions et crypto avec `hasApiPrice: true` ·
sous-types Livret A / LDDS / PEL / CEL / PEA / PEA-PME · prêts : immobilier, auto, conso,
étudiant, personnel · calculateur d'échéance (mensualité + coût total des intérêts) ·
instantané de patrimoine enregistré **chaque soir** par une fonction planifiée · simulateur
« Et si j'avais investi ? » : périodes 3 mois / 6 mois / 1 an, catégorie et sous-catégorie
facultatives, **nécessite un actif suivi par API**.

**Ne pas écrire** que tous les actifs sont valorisés automatiquement : seuls les actifs cotés
(actions, crypto) le sont ; les autres reposent sur une valeur saisie.

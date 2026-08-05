# Prompt à coller dans Claude (design) — page « Budgets »

Suite de la conversation : Claude reprend le système de design, le gabarit, le ton et les
exigences SEO déjà établis.

---

## ▼▼▼ COPIER À PARTIR D'ICI ▼▼▼

Page suivante du site marketing PairWise. **Reprends exactement le même système de design, le
même gabarit et les mêmes exigences SEO que la page précédente** (jetons de couleur clair +
nuit, Poppins/Nunito Sans, icônes Tabler, header collant à rubriques inertes, fil d'Ariane,
captures d'interface reproduites en HTML/CSS, bande CTA « C'est parti », footer sans lien mort,
JSON-LD `SoftwareApplication` + `BreadcrumbList` + `FAQPage`). Tutoiement, français, page
courte et dense.

**Page : Budgets**

- **URL** : `https://pairwise.finance/fonctionnalites/budgets`
- **Miroir anglais** : `https://pairwise.finance/en/features/budgets`
- **Mot-clé cible** : *application budget* (variantes : faire un budget mensuel, budget par
  catégorie, suivre son budget à deux)
- **Sur-titre** : Budgets
- **Angle** : un budget ne sert à rien s'il ne colle pas à ta vraie vie. La plupart des applis
  n'offrent qu'une case : un montant, par mois civil, pour tout le monde. Or on n'est pas payé
  le 1er, on ne part pas en vacances au mois civil, et ce qui est *à moi* n'est pas ce qui est
  *à nous*. Dans PairWise, un budget se règle sur **quoi**, **quand** et **pour qui** — et il
  te prévient avant que ce soit trop tard.

### Les fonctionnalités à présenter (toutes réelles, ne rien inventer)

**1. Sur quoi porte le budget**
- **Global** : tout ce que tu dépenses, toutes catégories confondues.
- **Par catégorie** : une ou **plusieurs** catégories à la fois (ex. « Sorties » = Loisirs +
  Alimentation).
- **Par tag** : un budget sur une étiquette transversale — par exemple limiter les achats
  `impulsif`, ce qu'aucune catégorie ne saurait faire.

**2. Sur quelle période**
- **Mensuel**, au mois civil…
- …ou **mois ancré** sur un jour précis : si tu es payé le 25, la période va du **25 au 24**.
  Ton budget suit ta paie, pas le calendrier.
- **Hebdomadaire** (lundi → dimanche), **trimestriel**, **annuel**.
- **Fenêtre glissante** : les N derniers jours (30 par défaut), qui avance avec toi.
- **Enveloppe d'événement** : un montant fixe entre **deux dates**, pour un voyage, un
  déménagement, un mariage. Elle se termine toute seule.

**3. Pour qui**
- Un budget peut être **commun au couple** ou **personnel**. Un budget personnel ne compte que
  **ta part** des dépenses (y compris quand une dépense est partagée 50/50 ou selon une
  répartition personnalisée) — et il **ne notifie jamais** ton/ta partenaire.
- Sur un budget commun, on peut voir **qui a dépensé quoi** à l'intérieur du budget.

**4. Le report du reliquat (façon YNAB), optionnel**
- Ce qu'il te reste à la fin d'une période **s'ajoute** à la suivante. Tu as dépensé 160 € sur
  un budget de 200 € ? Le mois suivant, tu as 240 €.
- Le dépassement se reporte aussi, en négatif — c'est ce qui rend le mécanisme honnête.
- Le report ne s'applique pas aux fenêtres glissantes ni aux enveloppes d'événement, qui n'ont
  pas de « période précédente ».

**5. Les alertes, à deux niveaux**
- Une alerte au **seuil** que tu choisis (**80 %** par défaut), puis une seconde au
  **dépassement** (100 %).
- Elles arrivent **même application fermée** (notification push) et ne concernent que les
  membres du budget.
- **Jamais deux fois** la même alerte pour la même période.

**6. La projection « à ce rythme »**
- En cours de période, PairWise projette où tu finiras si tu continues au même rythme. On sait
  qu'on va déraper **avant** d'avoir dérapé.

**7. L'historique des périodes closes**
- À la clôture d'une période, le résultat est **figé** et conservé. On peut comparer les mois
  entre eux, et un chiffre passé n'est jamais réécrit.

**8. Multi-devises**
- Un budget a **sa propre devise**, et les dépenses faites dans d'autres monnaies y sont
  converties.

### Les trois exemples concrets à dérouler (le cœur de la page)

Consacre-leur une section, en trois cartes ou trois blocs successifs, chacun **montrant une
barre de progression** avec un montant dépensé / un montant prévu, dans les couleurs du système
(`--sage` quand ça va, `--amber` près du seuil, `--tang` au dépassement).

**Exemple 1 — « Courses », mensuel ancré sur la paie**
Tu es payé le 25. Ton budget Courses de **500 €** court **du 25 au 24**, pas du 1er au 30. Au
14 du mois, tu es à **410 €** : la barre est ambre, l'alerte à 80 % est déjà passée, et la
projection annonce **environ 540 €** à ce rythme. Tu lèves le pied avant la fin, pas après.
→ *Illustre : le mois ancré, l'alerte au seuil, la projection.*

**Exemple 2 — « Vacances d'été », enveloppe d'événement**
Une enveloppe de **1 200 €** du **1er au 15 août**. Vols, logement, restaurants et sorties s'y
imputent quelle que soit leur catégorie. À mi-séjour tu as consommé **680 €** : tu sais
exactement ce qu'il te reste pour la seconde moitié. L'enveloppe se referme toute seule le 15.
→ *Illustre : l'enveloppe à durée fixe, et le fait qu'un budget peut suivre un projet plutôt
qu'une catégorie.*

**Exemple 3 — « Mes sorties », personnel avec report**
**150 € par mois**, budget **personnel** : seule **ta part** des sorties compte, même quand
l'addition est partagée en deux — et ton/ta partenaire ne reçoit aucune alerte dessus. Le mois
dernier tu n'as dépensé que **110 €** : le report ajoute les **40 €** restants, tu démarres
donc avec **190 €**.
→ *Illustre : le budget personnel, la part sur une dépense partagée, le report du reliquat.*

### Captures à reproduire

- *Hero* : la liste des budgets sur mobile — trois lignes avec libellé, montant dépensé /
  prévu, barre de progression colorée (une verte, une ambre, une rouge en dépassement) et le
  pourcentage. Un badge « perso » sur l'un d'eux.
- *Section périodes* : le formulaire de création montrant le choix de fréquence (Mensuel /
  Hebdo / Trimestriel / Annuel / Glissant / Événement) et, en dessous, le réglage du jour
  d'ancrage (« la période démarre le 25 »).
- *Section alertes* : une notification système « Courses — 80 % de ton budget atteint
  (410 € / 500 €) ».

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro, bouton « C'est parti », capture
   de la liste de budgets à droite.
2. **« Sur quoi, quand, pour qui »** (fond `--panel`) — les trois axes de réglage (points 1, 2
   et 3 ci-dessus) présentés de façon compacte, en trois colonnes. C'est la promesse de la page.
3. **« Trois budgets, trois vies »** — les trois exemples ci-dessus.
4. **« Tu es prévenu avant, pas après »** — les alertes à deux niveaux et la projection, avec
   la capture de notification. Court.
5. **« Ce qui est passé reste vrai »** — une ou deux phrases sur l'historique figé à la clôture,
   plus le report du reliquat en une ligne.
6. **« Pour qui »** — quatre cartes non cliquables : En solo (un budget qui suit ta paie),
   À deux (ce qui est commun et ce qui est perso), Voyageurs & nomades (une enveloppe par
   voyage), Expatriés (des budgets dans plusieurs devises).
7. **FAQ** (fond `--panel`), 5 à 6 questions : comment créer un budget mensuel ; peut-on caler
   son budget sur sa date de paie ; peut-on avoir un budget perso sans que l'autre le voie
   passer ; que devient l'argent non dépensé à la fin du mois ; à quel moment est-on prévenu ;
   peut-on faire un budget pour un voyage ou un projet.
8. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/budgets.html`, brancher sur
`/assets/site.css`, rebrancher le lien dans les footers. La CI déploie au merge sur `main`.

**Vérifié dans le code** (`useBudgetProgress`, `utils/budgetPeriods`, `useBudgetAlerts`,
`useBudgetSnapshots`, `BudgetScreen`) : portées global / catégorie(s) / tag · périodes monthly
(civil ou ancré) / weekly / quarterly / yearly / rolling (30 j par défaut) / event · `rollover`
optionnel, une seule période en arrière, négatif possible, indisponible en glissant et
événement · `alertThreshold` à 80 % par défaut + alerte de dépassement à 100 %, dédupliquées
par budget + période + niveau · projection au-delà de 15 % de période écoulée · budget
`memberUid` (« couple » ou un membre) avec calcul de la part via `memberShareFraction` ·
historique figé à la clôture, jamais réécrit.

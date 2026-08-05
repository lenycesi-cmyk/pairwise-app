# Prompt à coller dans Claude (design) — page « Charges fixes & récurrentes »

Suite de la conversation : Claude reprend le système de design, le gabarit, les règles de
ton et les exigences SEO déjà établis pour les pages précédentes.

---

## ▼▼▼ COPIER À PARTIR D'ICI ▼▼▼

Page suivante du site marketing PairWise. **Reprends exactement le même système de design,
le même gabarit et les mêmes exigences SEO que la page précédente** (jetons de couleur clair
+ nuit, Poppins/Nunito Sans, icônes Tabler, header collant avec rubriques inertes, fil
d'Ariane, captures d'interface reproduites en HTML/CSS, bande CTA « C'est parti », footer sans
lien mort, JSON-LD `SoftwareApplication` + `BreadcrumbList` + `FAQPage`). Tutoiement, français,
page courte et dense.

**Page : Charges fixes & récurrentes**

- **URL** : `https://pairwise.finance/fonctionnalites/charges-recurrentes`
- **Miroir anglais** : `https://pairwise.finance/en/features/recurring-charges`
- **Mot-clé cible** : *suivre ses abonnements* (variantes : charges fixes, dépenses
  récurrentes, combien me coûtent mes abonnements)
- **Sur-titre** : Charges fixes & récurrentes
- **Angle** : tes charges fixes sont **déjà dépensées avant même que le mois commence**. Loyer,
  assurances, abonnements, mensualité de crédit : tant que tu ne connais pas leur total, tu ne
  sais pas ce qui te reste vraiment. PairWise les saisit une fois, les rejoue tout seul, et te
  donne le seul chiffre qui compte : **ce qu'il te faut chaque mois**.

### Ce qui existe réellement (ne rien inventer)

**Créer une charge, une fois**
- Une règle porte : le type (**dépense ou revenu** — un salaire ou un loyer perçu se
  programment aussi), le montant, la **devise**, la catégorie et la sous-catégorie, une
  description, la **fréquence** (hebdomadaire, mensuelle, annuelle), le **jour du mois** pour
  les mensuelles, qui paie, et le **partage** (50/50 ou une répartition personnalisée).
- Une règle peut être **désactivée** sans être supprimée (un abonnement suspendu).

**Elle se rejoue toute seule**
- À l'échéance, la transaction est **créée automatiquement** — rien à ressaisir chaque mois.
- **Jamais de doublon** : chaque échéance a une clé de période (le mois, la semaine ISO ou
  l'année). Deux téléphones qui génèrent la même échéance écrivent le **même** enregistrement,
  donc une seule transaction. C'est un vrai point de confiance, à formuler simplement.
- Pour une mensuelle, la date retenue est **le jour prévu du mois**, borné au dernier jour :
  une charge au 31 tombe au 30 en avril, au 28 en février.

**Le chiffre qui compte : « il te faut X par mois »**
- PairWise additionne **toutes les charges actives** et affiche le total mensuel.
- Les fréquences sont **ramenées au mois** : une charge hebdomadaire compte pour 52/12 par
  mois, une charge annuelle pour 1/12. Une assurance payée 480 € une fois par an pèse donc
  40 €/mois dans le total — c'est ce qui rend le chiffre honnête.
- Chaque charge est **convertie dans ta devise d'affichage**, même si tu la paies dans une autre.
- Le détail est **ouvert par défaut**, **les plus grosses charges en haut** — on voit
  immédiatement ce qui pèse.
- À deux, chacun peut voir **sa part** du total selon le partage de chaque charge.

**Tu es prévenu avant, pas après**
- Une notification arrive **jusqu'à 3 jours avant** l'échéance, chaque matin à 8 h.
- Le message dit le libellé, le montant et le moment : « aujourd'hui », « demain » ou
  « dans 3 jours ».
- **Un rappel n'est jamais envoyé deux fois** pour la même échéance.
- Une liste « à venir » signale aussi les échéances du jour et les prochaines directement
  dans l'app.

**Les crédits**
- La mensualité d'un crédit est une charge fixe comme une autre et entre dans le total.
- PairWise suit par ailleurs les prêts eux-mêmes (immobilier, auto, consommation, étudiant,
  personnel) avec leur capital restant dû — mais ce sujet appartient à la page
  « Patrimoine & investissements » : ici, mentionne-le en une phrase, sans le développer.

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro, bouton « C'est parti ». À
   droite, une carte reproduisant le widget : le grand total **« Il te faut 1 240 € / mois »**
   suivi de la liste détaillée, du plus gros au plus petit — par exemple Loyer 780 €,
   Crédit auto 210 €, Assurance habitation 32 €, Internet 29 €, Électricité 95 €,
   Netflix 13,49 €, Spotify 11,99 € — chacun avec son icône de catégorie colorée.
2. **« Comment ça marche »** (fond `--panel`) — 3 étapes numérotées avec capture mobile en
   vis-à-vis, alternées :
   - *Tu la crées une fois* : le formulaire (montant, catégorie, fréquence en trois segments
     Hebdo / Mensuel / Annuel, jour du mois, partage).
   - *Elle se rejoue toute seule* : la transaction apparaît dans l'historique à la date prévue,
     et jamais en double.
   - *Tu es prévenu avant* : la notification « Loyer — 780 € (demain) ».
3. **« Le total qui change tout »** — la normalisation au mois expliquée avec l'exemple de
   l'assurance annuelle à 480 € qui pèse 40 €/mois, et le tri du plus gros au plus petit qui
   fait ressortir ce qu'on peut couper. Une ou deux phrases, pas un pavé.
4. **« Pour qui »** — quatre cartes non cliquables : En solo (savoir ce qu'il faut gagner
   chaque mois), À deux (les charges communes et la part de chacun), Voyageurs & nomades
   (des charges dans plusieurs devises, un seul total), Expatriés (des charges ici et là-bas).
5. **FAQ** (fond `--panel`), 5 questions : comment suivre ses abonnements ; les transactions
   sont-elles créées automatiquement ; risque-t-on des doublons si on ouvre l'app sur deux
   appareils ; comment une charge annuelle est-elle comptée dans le total mensuel ; reçoit-on
   un rappel avant le prélèvement.
6. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/charges-recurrentes.html`,
brancher sur `/assets/site.css` (verser les règles nouvelles dans `site.css`), rebrancher le
lien dans les footers. La CI déploie au merge sur `main`.

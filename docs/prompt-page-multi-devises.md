# Prompt à coller dans Claude (design) — page « Multi-devises »

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

**Page : Multi-devises**

- **URL** : `https://pairwise.finance/fonctionnalites/multi-devises`
- **Miroir anglais** : `https://pairwise.finance/en/features/multi-currency`
- **Mot-clé cible** : *application budget multi-devises* (variantes : gérer plusieurs devises,
  budget en voyage, compte en devise étrangère)
- **Sur-titre** : Multi-devises
- **Angle** : la plupart des applis de budget supposent que ta vie tient dans une seule
  monnaie. Dès que ce n'est plus vrai — un compte à l'étranger, un voyage, un salaire dans une
  devise et un loyer dans une autre — elles t'obligent à convertir à la main dans un tableur.
  PairWise traite la devise comme une **propriété de chaque montant**, pas comme un réglage
  global. **161 devises.**

### Les deux situations à mettre en avant (le cœur de la page)

**A. Avoir des comptes dans plusieurs devises.** Chaque compte, actif ou crédit porte **sa
propre devise** — un compte courant en euros, un compte à l'étranger en bahts, un portefeuille
titres en dollars, un bien immobilier dans une autre monnaie encore. PairWise les consolide en
**un seul patrimoine net**, affiché dans la devise de ton choix. Personne ne convertit à la main.

**B. Gérer ses dépenses à l'étranger.** Tu saisis dans la monnaie du pays — « 150k₫ pho »,
« 320 ฿ scooter » — et PairWise **détecte la devise** dans ta phrase. Le montant est converti au
taux du jour et rangé dans tes catégories habituelles, sans que tu changes de réglage. Tes
dépenses de voyage s'additionnent avec le reste de ton budget, dans la devise où tu raisonnes.

### Ce que l'utilisateur choisit lui-même : sa liste courte

À insister, c'est une vraie commodité :
- Le catalogue compte **161 devises**, mais l'application n'en propose **que celles que tu
  utilises**. Pas de menu déroulant interminable.
- On part de quelques devises courantes, puis on **ajoute** ce dont on a besoin (une recherche
  par nom ou par code) et on **retire** ce qui ne sert plus, **à tout moment**.
- La liste est partagée par le couple, et se retrouve partout : ajout de transaction, charges
  récurrentes, actifs, budgets.
- On part en Thaïlande : on ajoute le baht. On en revient : on le retire. La liste suit ta vie.

### Ce qui compte et auquel on ne pense pas d'emblée (à traiter, c'est différenciant)

1. **La conversion est figée au moment de la saisie — ton historique reste vrai.** Le montant
   converti et le taux appliqué sont enregistrés **sur la transaction elle-même**. Ton voyage au
   Vietnam garde le taux qu'il avait à l'époque. Quand la monnaie bouge, **ton passé ne se
   réécrit pas** — beaucoup d'applis recalculent tout, et le budget de l'an dernier change tout
   seul. C'est le point le plus important de la page : formule-le simplement et donne-lui de la
   place.
2. **La devise d'affichage est indépendante des données.** Tu peux lire tout ton tableau de bord
   en euros aujourd'hui et en bahts demain, sans modifier une seule transaction. Le tableau de
   bord et le patrimoine ont chacun leur réglage.
3. **Le mode « dernière devise utilisée », propre à chaque membre.** En voyage, tu continues de
   saisir en monnaie locale sans la resélectionner à chaque fois. Dans un couple d'expatriés,
   chacun garde la sienne. (L'autre mode fixe une devise par défaut.)
4. **Les charges récurrentes en devises mixtes donnent un seul total mensuel.** Un loyer dans une
   devise, des abonnements dans une autre : PairWise convertit chacun et affiche un unique
   « il te faut X par mois ».
5. **On n'invente jamais un taux.** Les taux viennent d'un service public de taux de change.
   Quand un taux n'est qu'approximatif, c'est signalé ; et si aucun taux fiable n'est
   disponible, PairWise **préfère ne pas convertir** plutôt qu'afficher un chiffre faux — parce
   qu'un montant figé faux le reste pour toujours. À dire en une phrase, sur le ton de la
   franchise, pas de la technique.

### Captures à reproduire

- *Hero* : une carte « Patrimoine net » affichant un total consolidé, et en dessous la
  ventilation par compte **avec des devises différentes** — par exemple Compte courant 4 200 €,
  Compte Bangkok 68 000 ฿, Portefeuille titres 12 400 $, chacun avec son symbole, et le total
  converti dans la devise d'affichage. Un petit sélecteur de devise d'affichage en haut à droite.
- *Étape « à l'étranger »* : capture mobile du champ de saisie contenant « 150k₫ pho », puis le
  résultat compris — montant 150 000 ₫, devise VND, catégorie Alimentation — et la ligne
  convertie telle qu'elle apparaîtra dans l'historique (≈ 5,45 €).
- *Étape « ta liste courte »* : capture mobile du sélecteur de devises, montrant les devises
  actives (avec une coche) et une recherche pour en ajouter une (taper « bah » → Baht
  thaïlandais), plus la possibilité d'en retirer.

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro mentionnant les 161 devises,
   bouton « C'est parti », capture patrimoine multi-devises à droite.
2. **« Tes comptes, chacun dans sa monnaie »** (fond `--panel`) — situation A, avec la capture.
3. **« À l'étranger, tu saisis comme tu paies »** — situation B, avec la capture.
4. **« Seulement les devises que tu utilises »** — la liste courte personnalisable, avec la
   capture du sélecteur.
5. **« Ton historique ne bouge pas »** — la conversion figée (point 1 ci-dessus), et en
   complément bref : la devise d'affichage indépendante, le mode « dernière devise utilisée »,
   le total mensuel des charges en devises mixtes, et l'honnêteté sur les taux. Garde cette
   section dense mais lisible : un point fort développé, les autres en une ligne chacun.
6. **« Pour qui »** — quatre cartes non cliquables : Voyageurs & nomades (en premier ici, c'est
   leur page), Expatriés (revenus ici, charges là-bas), À deux (deux pays, un budget commun),
   En solo (un compte à l'étranger, un portefeuille en dollars).
7. **FAQ** (fond `--panel`), 5 à 6 questions : combien de devises sont gérées (161) ; d'où
   viennent les taux de change ; les anciennes transactions sont-elles recalculées quand le taux
   change (non — le taux est figé à la saisie) ; peut-on n'afficher que les devises qu'on
   utilise ; peut-on changer la devise d'affichage sans modifier ses données ; que se passe-t-il
   hors connexion.
8. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/multi-devises.html`, brancher
sur `/assets/site.css`, rebrancher le lien dans les footers. La CI déploie au merge sur `main`.

**Chiffres à ne pas se tromper** (vérifiés dans le code) : **161** devises au catalogue,
**7** proposées par défaut, **15** reconnues dans la saisie en langage naturel. Ne pas écrire
« toutes les devises du monde ».

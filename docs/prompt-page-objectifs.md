# Prompt à coller dans Claude (design) — page « Objectifs d'épargne »

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

**Page : Objectifs d'épargne**

- **URL** : `https://pairwise.finance/fonctionnalites/objectifs`
- **Miroir anglais** : `https://pairwise.finance/en/features/savings-goals`
- **Mot-clé cible** : *objectif d'épargne* (variantes : épargner pour un projet, combien
  épargner par mois, application objectif épargne)
- **Sur-titre** : Objectifs d'épargne
- **Angle** : épargner sans objectif, c'est juste ne pas dépenser. Un objectif donne un **nom**,
  un **montant** et une **date** à ton épargne — et surtout une réponse à la seule question qui
  compte : **est-ce que j'y arrive ?**

### Le point différenciant (à placer tôt et à marteler)

**Tu ne saisis jamais ta progression.** Dans la plupart des applis, un objectif d'épargne est
un compteur que tu mets à jour à la main — donc que tu oublies, donc qui ment. Ici, tu **relies
l'objectif aux comptes** qui le financent (Livret A, PEA, compte épargne, assurance vie…), et
la progression est **la somme réelle de ces comptes**, prix du marché compris pour les
placements cotés. Rien à tenir à jour : ton objectif avance tout seul, parce qu'il lit ton
patrimoine réel.

### Ce qu'on règle sur un objectif (tout est réel, ne rien inventer)

- Un **nom** et une **icône** (parce qu'« Apport appartement » motive plus qu'« Épargne 2 »).
- Un **montant cible** et **sa devise** — les objectifs dans des devises différentes se
  comparent dans une devise d'affichage commune.
- Les **comptes liés** : la progression est la somme de ces comptes.
- Une **échéance**, facultative.
- Une **épargne mensuelle**, facultative.

### Ce que PairWise en déduit

- Le **pourcentage atteint** et ce qu'il **reste** à réunir.
- Si tu as fixé une échéance : **« il te faut X par mois pour tenir l'échéance »**.
- Si tu as indiqué une épargne mensuelle : **« atteint vers {mois} à ce rythme »**.
- Et quand les deux sont là, la réponse directe : **ton rythme actuel suffit-il, ou non**.
- Quand l'objectif est atteint : **des confettis**. Une fois, au bon moment — pas à chaque
  ouverture de l'app.

Les objectifs sont **partagés dans le couple** : les deux les voient et les font avancer.

### Les trois exemples à dérouler (le cœur de la page)

Choisis-les pour montrer **trois mécaniques différentes**, pas trois fois la même chose. Chacun
avec sa barre de progression, son icône et ses chiffres.

**Exemple 1 — « Apport appartement » : l'objectif qui a une date**
Cible **40 000 €** pour **juin 2029**. Comptes liés : Livret A + compte épargne + PEA, soit
**14 200 €** aujourd'hui (**36 %**). Il reste 25 800 € et 41 mois : PairWise annonce
**« il te faut 630 € par mois pour tenir l'échéance »**. Le projet cesse d'être un vœu, il
devient un chiffre mensuel.
→ *Illustre : l'échéance et le rythme requis.*

**Exemple 2 — « Vacances en Grèce » : l'objectif court, à deux**
Cible **2 400 €** pour **juillet**. Vous mettez **300 € par mois** de côté et vous en êtes à
**1 500 €**. PairWise projette **« atteint vers juin à ce rythme »** — vous êtes en avance,
et vous le savez sans calculer. Les deux voient la même barre avancer.
→ *Illustre : l'épargne mensuelle, la date projetée, et l'usage à deux.*

**Exemple 3 — « Études des enfants » : l'objectif qui avance sans toi**
Cible **60 000 €** à horizon **2038**. Les comptes liés incluent une assurance vie et un PEA,
dont la valeur **bouge toute seule**. Tu n'ouvres pas l'app pour mettre à jour un compteur :
quand tes placements montent, l'objectif progresse ; quand ils baissent, il le montre
honnêtement.
→ *Illustre : la progression déduite du patrimoine réel, prix du marché inclus.*

Tu peux mentionner en une ligne, sans les développer, d'autres objectifs typiques :
**fonds d'urgence**, **nouvelle voiture**, **travaux**, **création d'entreprise**.

### Captures à reproduire

- *Hero* : la liste des objectifs sur mobile — trois cartes avec icône Tabler, nom, barre de
  progression, montant courant / cible et pourcentage. L'une d'elles proche de l'objectif, une
  autre à un tiers. Utilise `--lavi` comme couleur dominante des objectifs (c'est celle de
  l'app pour cet écran), et `--sage` pour un objectif atteint.
- *Section réglages* : le formulaire de création — nom, sélecteur d'icône, montant cible et
  devise, la liste des **comptes à lier** avec des cases cochées, l'échéance et l'épargne
  mensuelle marquées « optionnel ».
- *Section « est-ce que j'y arrive ? »* : une carte d'objectif dépliée montrant les deux
  phrases déduites — « Il te faut 630 €/mois pour tenir l'échéance » et « Atteint vers juin à
  ce rythme ».

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro posant « un nom, un montant, une
   date », bouton « C'est parti », capture de la liste d'objectifs à droite.
2. **« Ta progression n'est pas un compteur »** (fond `--panel`) — le point différenciant
   ci-dessus, avec la capture du formulaire et ses comptes liés. C'est la section la plus
   importante de la page.
3. **« Est-ce que j'y arrive ? »** — ce que PairWise déduit (rythme requis, date projetée,
   verdict), avec la capture correspondante. Court.
4. **« Trois projets, trois façons d'y aller »** — les trois exemples ci-dessus.
5. **« Pour qui »** — quatre cartes non cliquables : En solo (un projet, un chiffre par mois),
   À deux (le même objectif, les deux le voient avancer), Voyageurs & nomades (un objectif dans
   la devise de son choix), Expatriés (des comptes dans plusieurs pays, un seul objectif).
6. **FAQ** (fond `--panel`), 5 à 6 questions : comment se fixer un objectif d'épargne ;
   comment savoir combien épargner par mois ; faut-il mettre sa progression à jour à la main
   (non) ; peut-on lier plusieurs comptes à un même objectif ; peut-on avoir un objectif dans
   une autre devise ; que se passe-t-il quand l'objectif est atteint.
7. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/objectifs.html`, brancher sur
`/assets/site.css`, rebrancher le lien dans les footers. La CI déploie au merge sur `main`.

**Vérifié dans le code** (`GoalsScreen`, `useGoalProgress`, `useGoalCelebration`,
`FinanceContext`, `translations.js`) : champs `label`, `icon`, `targetAmount`, `currency`,
`linkedAssetIds`, `deadline` (optionnel), `monthlyContribution` (optionnel) · progression =
**somme des comptes liés**, calculée à la lecture et **jamais stockée**, prix live inclus ·
libellés réels : *« Reste {montant} »*, *« Il te faut {montant}/mois pour tenir l'échéance. »*,
*« Atteint vers {date} à ce rythme. »*, *« Objectif atteint 🎉 »* · `onTrack` compare l'épargne
mensuelle au rythme requis · confettis + retour haptique **une seule fois** à l'atteinte ·
devise d'affichage commune pour comparer des objectifs de devises différentes.

**Ne pas écrire** qu'un objectif peut être personnel ou privé : les objectifs sont partagés
au sein du couple, l'application n'expose pas de réglage par membre.

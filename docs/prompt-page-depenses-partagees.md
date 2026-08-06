# Prompt à coller dans Claude (design) — page « Dépenses partagées »

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

**Page : Dépenses partagées**

- **URL** : `https://pairwise.finance/fonctionnalites/depenses-partagees`
- **Miroir anglais** : `https://pairwise.finance/en/features/shared-expenses`
- **Mot-clé cible** : *partage de dépenses* (variantes : gérer son budget à deux, qui doit
  combien, compte commun couple, application dépenses partagées)
- **Sur-titre** : Dépenses partagées
- **Angle** : il n'y a pas une bonne façon de gérer l'argent à deux. Certains couples mettent
  tout en commun, d'autres séparent scrupuleusement, beaucoup font un mélange des deux.
  **PairWise ne choisit pas à votre place** — et quelle que soit votre organisation, vous voyez
  toujours qui dépense quoi.

### ⚠️ Le message le plus important de la page

**Le partage est optionnel.** Il faut que quelqu'un qui cherche « appli budget couple » comprenne
en lisant le hero que PairWise **n'impose pas** de comptabiliser des dettes entre partenaires.
Un couple qui fonctionne avec un pot commun et un patrimoine commun est un usage **de plein
droit**, pas un cas dégradé. Ne présente donc jamais le partage comme la façon normale de
faire, avec le compte commun en exception.

### Les deux modes (réglage réel, modifiable à tout moment)

PairWise propose un **mode de finances**, choisi à l'inscription et modifiable ensuite dans les
réglages :

- **Compte commun** — pas de dette entre partenaires. Tout est au pot ; PairWise garde
  simplement le suivi de **qui dépense quoi**, et de ce qui est commun ou personnel. Le
  patrimoine aussi est celui du foyer.
- **Partagé** — chacun ses finances. PairWise suit **qui a payé**, **pour qui**, et **qui doit
  combien à qui**.

Présente-les **côte à côte, à égalité**, dans deux cartes de même poids visuel.

### Quand on partage : comment une dépense se répartit

- **50/50**, ou **pour l'un**, ou **pour l'autre**.
- Ou une **répartition personnalisée**, en **pourcentage** ou en **montant** — pour un loyer
  60/40 quand les revenus ne sont pas les mêmes.
- La ligne de transaction montre la part de chacun.
- Le **solde entre vous** se met à jour tout seul : plus de tableur, plus de « je crois que
  c'est moi qui ai payé la dernière fois ».
- *(Ce suivi de solde n'existe qu'en mode Partagé — en compte commun il n'aurait aucun sens.)*

### 🎯 Le filtre par membre : la section à développer

C'est ce qui distingue vraiment PairWise d'une simple appli de partage de notes. **Le même
filtre existe sur presque tous les écrans** : d'un geste, tu passes du **foyer** à **une
personne**, et tous les chiffres se recalculent — en tenant compte de la **part** de chacun sur
les dépenses partagées, pas seulement de qui a sorti la carte.

Détaille où il agit :

- **Sur l'accueil** — les totaux du mois, les revenus, les dépenses, vus foyer ou par personne.
- **Sur les charges fixes** — combien il faut par mois au foyer, et combien pour chacun.
- **Dans les rapports** — un widget **« Comparaison entre membres »**, et le widget des
  anomalies (« ce qui a augmenté ») lui aussi filtrable par personne.
- **Sur le patrimoine** — **« Total du foyer »** ou **« Total de {prénom} »**, avec une
  **répartition par membre**.
- **Sur les budgets** — un budget peut être commun ou **personnel** (il ne compte alors que ta
  part et ne notifie que toi), et à l'intérieur d'un budget commun on voit qui a consommé quoi.
- **Sur l'historique et les charges récurrentes** — filtrables par membre également.

Il existe en plus un écran **« Habitudes de dépense »** par personne : le total dépensé sur le
mois — **part incluse** — et sa ventilation par catégorie.

Formule la promesse simplement : *savoir qui dépense quoi ne suppose pas de se devoir de
l'argent.* Même dans un couple qui met tout en commun, la question « où part notre argent, et
lequel de nous deux fait quoi » reste utile — et sans reproche.

### Les deux exemples à dérouler (courts, côte à côte)

**Léa & Sam — tout en commun.**
Un seul pot, un seul patrimoine, aucune dette entre eux. Ils saisissent leurs dépenses sans
jamais penser au partage. À la fin du mois, ils regardent le filtre par personne par simple
curiosité : Léa 1 180 €, Sam 940 €. Personne ne doit rien à personne — ils savent juste où va
l'argent du foyer.

**Chloé & Karim — chacun son compte.**
Les courses sont à 50/50, le loyer à **60/40** parce que les revenus ne sont pas les mêmes, et
les dépenses perso restent perso. PairWise tient le solde : *Karim doit 214 € à Chloé*. Aucun
tableur, aucune discussion pénible.

### Captures à reproduire

- *Hero* : les **deux cartes de mode** côte à côte — « Compte commun » et « Partagé » — avec
  une coche sur l'une, exactement comme le sélecteur des réglages. C'est l'image qui porte le
  message « tu choisis ».
- *Section partage* : une transaction avec sa répartition — « Loyer, 1 200 € — Chloé 720 €
  (60 %) · Karim 480 € (40 %) », plus une carte de solde « Karim doit 214 € à Chloé ».
- *Section filtre membre* : **la même carte de chiffres, deux fois** — une fois en « Foyer »,
  une fois en « Léa » — avec le sélecteur au-dessus. Montrer le même écran sous deux angles est
  plus parlant que deux écrans différents.

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro posant « il n'y a pas une bonne
   façon », bouton « C'est parti », capture des deux modes à droite.
2. **« Deux façons de gérer à deux »** (fond `--panel`) — les deux modes à égalité. Insister
   sur le caractère optionnel du partage et la modification possible à tout moment.
3. **« Qui a payé, pour qui »** — la répartition d'une dépense et le solde, en précisant que
   c'est le mode Partagé.
4. **« Qui dépense quoi — sans se devoir quoi que ce soit »** — le filtre par membre, section
   développée, avec la capture foyer / personne. **C'est le cœur de la page.**
5. **« Deux couples, deux organisations »** — les deux exemples ci-dessus, courts.
6. **« Pour qui »** — quatre cartes non cliquables : À deux (en premier ici), En solo (le filtre
   n'a alors rien à filtrer, tout est à toi), Voyageurs & nomades (partager un voyage sans
   tenir de comptes), Expatriés (des revenus différents, une répartition qui suit).
7. **FAQ** (fond `--panel`), 5 à 6 questions : peut-on utiliser PairWise sans partager les
   dépenses (oui, mode compte commun) ; comment répartir une dépense autrement qu'en 50/50 ;
   comment savoir qui doit combien ; peut-on voir les dépenses d'une seule personne ; le
   patrimoine peut-il être commun ; peut-on changer de mode plus tard (oui, à tout moment).
8. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/depenses-partagees.html`,
brancher sur `/assets/site.css`, rebrancher le lien dans les footers. La CI déploie au merge
sur `main`.

**Vérifié dans le code** (`SettingsScreen`, `AddTransactionScreen`, `utils/members`,
`DashboardScreen`, `FluxScreen`, `ReportsScreen`, `WealthScreen`, `BudgetScreen`,
`MemberBreakdownScreen`, `translations.js`) : réglage `financeMode` à deux valeurs, libellés
exacts **« Partagé »** (*« Chacun ses finances : PairWise suit qui a payé, pour qui, et qui doit
combien à qui »*) et **« Compte commun »** (*« pas de dette entre partenaires. On garde le suivi
de qui dépense quoi et pour qui »*) · répartition `split` A / B / 50-50 ou `splitDetails` en
**pourcentage ou montant** · `memberShareFraction` calcule la part réelle de chacun · filtre de
portée membre sur l'accueil, les flux, les rapports, le patrimoine et les budgets · libellés
**« Total du foyer »**, **« Total {nom} »**, **« Répartition par membre »**, **« Comparaison
entre membres »** · écran **« Habitudes de dépense »** : *« Total dépensé ce mois (part
incluse) »* + ventilation par catégorie · le widget de dette est **masqué en mode compte
commun**.

**Ne pas écrire** que PairWise calcule des dettes entre partenaires en toutes circonstances :
c'est propre au mode Partagé.

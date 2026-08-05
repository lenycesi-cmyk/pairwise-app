# Prompt à coller dans Claude (design) — page « Rapports & insights »

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

**Page : Rapports & insights**

- **URL** : `https://pairwise.finance/fonctionnalites/rapports`
- **Miroir anglais** : `https://pairwise.finance/en/features/reports-insights`
- **Mot-clé cible** : *analyser ses dépenses* (variantes : rapport de dépenses, où part mon
  argent, tableau de bord financier personnel)
- **Sur-titre** : Rapports & insights
- **Angle** : des chiffres, toutes les applis en donnent. Ce qui manque, c'est **ce qu'ils
  veulent dire**. PairWise fait les deux : des **rapports** que tu vas explorer quand tu veux
  comprendre, et des **insights** qui viennent à toi sans que tu demandes — parce que le mois
  où ça dérape, justement, tu n'ouvres pas l'onglet Rapports.

### L'idée structurante (à rendre visible dans la page)

Deux mouvements opposés, à présenter clairement comme tels :

- **Les rapports : tu vas les chercher.** Tu choisis une période, tu explores, tu creuses.
- **Les insights : ils viennent à toi.** Une bande « Pour toi » sur l'accueil, qui repère ce
  qui mérite ton attention et te le dit en une phrase.

### Les rapports (toutes ces vues existent, ne rien inventer)

L'écran est un **canevas de widgets** : on les réorganise par glisser-déposer et on **masque
ceux qu'on ne veut pas**. Chacun choisit son tableau de bord.

- **Total revenus & dépenses**, avec la comparaison **vs période précédente**.
- **Revenus vs dépenses** en barres, et la **courbe d'évolution** des dépenses.
- **Flux de trésorerie (diagramme de Sankey)** : tes sources de revenu à gauche, un nœud
  central, et à droite où tout est parti — postes de dépense, investissement, épargne. On
  **clique un poste pour descendre** dans ses sous-catégories, et on peut l'ouvrir en plein
  écran avec un zoom. Quand tu as dépensé plus que gagné, le diagramme le montre honnêtement
  par un flux « épargne puisée ».
- **Dépenses par catégorie**, et **dépenses par tag** (dépliables jusqu'aux transactions).
- **Comparaison entre membres**.
- **À surveiller** : les anomalies repérées toutes seules — ton plus gros poste et sa part,
  un poste en hausse par rapport à la **moyenne des 3 périodes précédentes**, un poste
  **nouveau** ce mois-ci, ou au contraire un poste où tu dépenses **moins**. Filtrable par
  membre.
- **Tendance par poste** : tu choisis une **catégorie, une sous-catégorie ou un tag**, et tu
  suis sa courbe dans le temps, avec un « d'où ça vient » qui détaille.
- **Simulateur d'économies** : tu choisis un poste et un pourcentage de réduction, PairWise
  calcule ce que ça représente **par an**. La base est la moyenne des 6 derniers mois, et on
  peut cibler des sous-catégories précises plutôt que toute la catégorie.
- **Évolution du patrimoine net** sur la période.

**Périodes** : mois, semaine, trimestre, année, 12 derniers mois, ou une plage personnalisée.
**Devise d'affichage** propre à l'écran, sans toucher aux données.

### Les insights (bande « Pour toi », sur l'accueil)

Des phrases courtes dérivées de tes données, **calculées sur ton appareil**, sans réseau ni
service tiers. Ce qu'elles savent repérer :

- **Ton fonds d'urgence** : combien de mois de dépenses tes liquidités couvrent.
- **Ton taux d'épargne**, et l'alerte quand il devient négatif.
- **Des charges fixes trop lourdes** par rapport à tes revenus.
- **L'équilibre 50/30/20** quand il est respecté.
- **La tendance de ton patrimoine** sur environ trois mois — et une **célébration quand tu
  bats ton record**.
- **Un abonnement probable** : une dépense qui revient régulièrement sans être déclarée comme
  charge récurrente.
- **Tes budgets dépassés**.

Trois détails qui font la différence, à mentionner brièvement :
- les **alertes passent en tête**, le reste **tourne d'un jour à l'autre** pour que tu ne voies
  pas toujours la même chose ;
- les sujets affichés sont **diversifiés** (pas trois insights sur le même thème) ;
- tu peux **mettre un insight en sourdine** pour la semaine.

### Les trois exemples concrets à dérouler (le cœur de la page)

**Exemple 1 — « Où est passé l'argent ce mois-ci ? » (le Sankey)**
3 200 € de revenus entrent à gauche. À droite : Logement 980 €, Alimentation 610 €,
Transport 240 €, Loisirs 180 €, Investissements 400 €, Épargne 300 €. Tu cliques sur
**Alimentation** et le diagramme se recentre : Courses 340 €, Livraison de repas 150 €,
Restaurant 90 €, Café à emporter 30 €. En deux gestes, tu es passé de « je gagne 3 200 € » à
« je mets 150 € par mois dans la livraison ».
→ *Illustre : le flux complet, et le clic pour descendre d'un niveau.*

**Exemple 2 — « Combien si j'arrête ? » (le simulateur d'économies)**
Tu sélectionnes **Livraison de repas** (moyenne 150 €/mois sur 6 mois) et tu tires le curseur
à **−40 %**. PairWise affiche : **720 € économisés par an**. Le chiffre n'est plus une
intuition, c'est un arbitrage.
→ *Illustre : le simulateur, la base sur 6 mois, le résultat annualisé.*

**Exemple 3 — « Ce que tu n'aurais pas remarqué » (à surveiller + insights)**
Sans rien demander, deux phrases apparaissent : *« Alimentation : +34 % vs moyenne 3 périodes »*
et *« Un abonnement probable a été détecté : Spotify »*. La première vient du widget
**À surveiller**, la seconde de la bande **Pour toi** sur l'accueil. Aucune des deux ne
supposait que tu ouvres un rapport.
→ *Illustre : la détection d'anomalie, et le fait que l'information vient à toi.*

### Captures à reproduire

- *Hero* : un aperçu du **Sankey** en HTML/CSS — trois ou quatre flux entrants à gauche, un
  nœud central, cinq ou six sorties à droite avec leurs couleurs et leurs montants. Des flux
  en dégradé, épaisseur proportionnelle au montant. C'est l'image la plus reconnaissable de la
  fonctionnalité : soigne-la.
- *Section simulateur* : la carte du simulateur avec le poste choisi, un curseur à −40 %, et le
  résultat en gros : « 720 € économisés par an ».
- *Section insights* : la bande « Pour toi » sur mobile — deux ou trois cartes d'insight avec
  leur icône et leur couleur de ton (`--tang` pour une alerte, `--sage` pour un point positif,
  `--sky` pour un neutre).

Si un Sankey complet en CSS est trop lourd, un **SVG inline** est tout à fait acceptable pour
cette capture — mais il doit utiliser les variables de couleur pour suivre le thème.

### Structure suggérée

1. **Hero** — h1 orienté bénéfice contenant le mot-clé, intro posant les deux mouvements,
   bouton « C'est parti », aperçu du Sankey à droite.
2. **« Tu vas les chercher »** (fond `--panel`) — les rapports : la liste des vues, présentée
   de façon compacte (une grille de petites cartes avec icône + nom + une ligne), plus la
   mention du canevas réorganisable et des périodes.
3. **« Trois questions, trois réponses »** — les trois exemples ci-dessus.
4. **« Ils viennent à toi »** — les insights, avec la capture de la bande « Pour toi » et
   l'insistance sur le calcul local. Court.
5. **« Pour qui »** — quatre cartes non cliquables : En solo (comprendre ses habitudes),
   À deux (comparer sans se disputer), Voyageurs & nomades (des rapports dans la devise de son
   choix), Expatriés (des dépenses réparties sur deux pays).
6. **FAQ** (fond `--panel`), 5 à 6 questions : comment savoir où part son argent ; qu'est-ce
   qu'un diagramme de flux (Sankey) ; peut-on analyser par tag et pas seulement par catégorie ;
   peut-on comparer un mois à la période précédente ; les analyses sont-elles envoyées quelque
   part (non — tout est calculé sur l'appareil) ; peut-on choisir les rapports affichés.
7. **Bande CTA**, puis **footer**.

Produis maintenant la page complète.

## ▲▲▲ COPIER JUSQU'ICI ▲▲▲

---

**Après validation :** enregistrer sous `marketing/fonctionnalites/rapports.html`, brancher sur
`/assets/site.css`, rebrancher le lien dans les footers. La CI déploie au merge sur `main`.

**Vérifié dans le code** (`ReportsScreen`, `useInsights`, `translations.js`) : canevas de
widgets réorganisable et masquable · périodes mois / semaine / trimestre / année / 12 derniers
mois / personnalisée · Sankey avec drill-down par sous-catégorie, plein écran et zoom, plus les
nœuds « Reste » et « Épargne puisée » qui équilibrent le flux · widget « À surveiller » (plus
gros poste, hausse vs **moyenne 3 périodes**, nouveau poste, baisse) filtrable par membre ·
« Tendance par poste » sur catégorie / sous-catégorie / **tag** · simulateur d'économies basé
sur une **moyenne 6 mois**, résultat annualisé, ciblage par sous-catégorie · insights :
fonds d'urgence, taux d'épargne, charges fixes, équilibre 50/30/20, tendance et record de
patrimoine, abonnement probable, budgets dépassés — alertes épinglées, rotation quotidienne,
diversification par catégorie, mise en sourdine hebdomadaire en `localStorage`, **aucun appel
réseau**.

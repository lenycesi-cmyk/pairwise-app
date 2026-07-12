# Objectifs d'épargne / patrimoine + Insights UI — plan de mise en place

> Réflexion de cadrage. Point de départ : ~60 % des fondations existent déjà
> (`useHealthScore`, `netWorthHistory`, `useNetWorth.getAssetValue`,
> `useSubscriptionSuggestion`, `useScreenWidgets`/`BENTO_SPAN`). On construit du
> **dérivé + présentation**, pas de nouvelle plomberie.

## A. Objectifs

### Modèle de données (`couples/{coupleId}.goals[]`, même pattern que budgets/assets)
```js
goals: [{
  id: "goal_<ts>",
  kind: "emergency_fund" | "savings_target" | "networth_target"
      | "debt_payoff" | "purchase" | "retirement",
  label, icon, color,
  targetAmount, currency,
  linkedAssetIds: [],        // progression = somme des assets liés (getAssetValue)
  linkedCategoryGroup: null,
  deadline: null,            // → rythme mensuel requis
  monthlyContribution: null, // → date d'atteinte projetée
  ownership: "shared" | uid, // couple-centric
  createdAt,
}]
```
- CRUD `addGoal/updateGoal/removeGoal` dans FinanceContext (read-modify-merge).
- Hook `useGoalProgress()` → `[{ goal, current, pct, monthlyNeeded, projectedDate, onTrack }]`.
- **Progression branchée sur assets réels** via `useNetWorth.getAssetValue` (prix live inclus) → zéro double saisie.
- **UI** : section "Objectifs" en tête de l'onglet Patrimoine + widget "Objectif le plus proche" sur Dashboard (span 1).

### Concurrence
- Monarch/Copilot : pots reliés aux comptes réels + contribution recommandée (**modèle le plus proche**).
- YNAB : targets par catégorie (micro, budget mensuel).
- Finary/Origin : objectif net worth global + projection.
- Emma/Plum : gamification/round-ups (à doser).
- **Différenciateur : objectif de couple** (ownership shared, sharePct, getMemberShare) — unique.

### Aide à l'atteinte
1. Rythme requis vs réel (`useGoalProjection`, factorisé depuis InvestmentCalculator).
2. Bouton "créer virement d'épargne récurrent" (geste `accept()` de useSubscriptionSuggestion).
3. Nudges via useBudgetAlerts + push FCM (jalons 25/50/75/100 %).
4. Réaffectation de budget sous-consommé.
5. Effet couple (contributions par membre).

### Templates suggérés (`src/data/goalTemplates.js`, ordre = pyramide financière)
1. Fonds d'urgence 1 mois (starter)
2. Fonds d'urgence 3–6 mois (montant auto = monthlyExpense × 6)
3. Solder dettes coûteuses (useDebtCalculation)
4. Projet court terme (vacances/mariage/voiture)
5. Apport immobilier (10–20 %)
6. Investissement long terme régulier (ETF World — CW8.PA/VWCE.DE déjà présents)
7. Épargne retraite (PER)
8. Patrimoine net (50k/100k/premier 100k)
9. Tenir 50/30/20 N mois (behavioural, budgetGroups)

## B. Insights UI

### Comment / où
- Hook `useInsights()` → `[{ id, category, tone, icon, text, priority, cta? }]`, règles pures.
- Moteur de templates i18n généralisé depuis `onboardingCopy` (interpolation `{var}`).
- `<InsightStrip>` sous GreetingHeader (cartes horizontales façon "stories"), top 2–3, masquable via useScreenWidgets.

### Concurrence
Cleo/Emma (ton + fraîcheur), Copilot (anomalies), Monarch (résumés mensuels),
Rocket Money (abonnements). Angle : insights **de couple**.

### Évolutivité (ne jamais voir la même chose)
1. Pool large (10–20) → affiche 2–3.
2. Scoring = sévérité × nouveauté × pertinence temporelle.
3. Cooldown `insightSeen_<id>_<YYYY-Www>` en localStorage (pattern budgetAlert_/subscriptionDismissed_).
4. Cadence naturelle (insights datés se renouvellent seuls).
5. Déclencheurs événementiels (seuils, records, fin de mois, jalons).
6. Dismiss utilisateur.
7. Diversité de catégories.

### Catalogue (tout calculable avec données actuelles sauf mention)
- **Résilience** : mois de coussin (pilier emergency), manque pour 6 mois, baisse < 3 mois.
- **Épargne** : taux (pilier savings), delta vs trimestre, projection 12 mois.
- **Patrimoine** : +x % 3 mois (netWorthHistory), record, part risquée (totalsByType), premier 100k.
- **Budgets** : anomalie catégorie +35 %, 50/30/20 tenu, reste budget, meilleur mois.
- **Charges fixes** : ratio (pilier recurring), abonnement détecté, abos inutilisés.
- **Dette** : date de solde (useDebtCalculation), gain si +100€/mois.
- **Couple** : part des dépenses communes, épargne combinée, déséquilibre.
- **Investissement** : coût d'opportunité resto→ETF (InvestmentCalculator passif), inactivité.

## C. Phasage (1 PR / phase, build + test manuel + squash-merge)
- **Phase 0** — `useInsightEngine` (moteur templates + registre règles + cooldown). Pas d'UI.
- **Phase 1** — 🌟 Insights Dashboard : `useInsights` + `<InsightStrip>` (meilleur premier pas, 0 nouvelle donnée).
- **Phase 2** — 🎯 `goals[]` + CRUD + `useGoalProgress` + section Patrimoine + `goalTemplates.js`.
- **Phase 3** — 📊 `useGoalProjection` (rythme/date/on-track) + virement récurrent + widget Dashboard.
- **Phase 4** — 🔔 Jalons + insights couple/objectif via useBudgetAlerts + push FCM + réaffectation.
</content>
</invoke>

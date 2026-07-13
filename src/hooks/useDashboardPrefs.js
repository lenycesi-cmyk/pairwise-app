import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// `size` (petit/moyen/grand) ne sert qu'à la grille bento desktop : petit = tuile
// stat au tiers, moyen ~40%, grand ~60% (cf. WIDGET_SIZE_SPAN dans
// DashboardScreen). Ignoré sur mobile (empilement pleine largeur). Rétrocompatible :
// les prefs enregistrées sans `size` retombent sur DEFAULT_WIDGET_SIZE.
// L'ordre par défaut reproduit la maquette : 3 petits en haut, puis moyen+grand,
// puis grand+moyen.
export const DEFAULT_WIDGETS = [
  { id: "net_balance", visible: true, size: "small" },
  { id: "health_score", visible: true, size: "small" },
  // Visible par défaut pour compléter la rangée de 3 tuiles stat en haut de la
  // grille bento desktop (sur mobile, l'ordre importe peu — simple empilement).
  { id: "available_savings", visible: true, size: "small" },
  { id: "budget_tracking", visible: true, size: "medium" },
  // Desktop-only — DashboardScreen filters these out entirely on mobile
  // regardless of this "visible" flag, see DESKTOP_ONLY_WIDGETS.
  { id: "reports_trend", visible: true, size: "large" },
  { id: "transaction_history", visible: true, size: "large" },
  { id: "member_breakdown", visible: true, size: "medium" },
  { id: "spending_by_category", visible: true, size: "medium" },
  { id: "wealth_allocation", visible: true, size: "medium" },
  { id: "net_worth", visible: false, size: "small" },
  { id: "debt_tracker", visible: false, size: "small" },
  { id: "recurring", visible: false, size: "medium" },
];

// Ordre + visibilité par défaut des cartes de l'onglet Rapports (toutes
// visibles). Même forme que DEFAULT_WIDGETS pour réutiliser le même moteur
// d'édition (réorganisation + afficher/cacher par carte).
export const DEFAULT_REPORT_WIDGETS = [
  { id: "totals", visible: true },
  { id: "net_worth", visible: true },
  { id: "spending_evolution", visible: true },
  { id: "income_vs_expense", visible: true },
  { id: "member_comparison", visible: true },
  { id: "by_tag", visible: true },
  { id: "by_category", visible: true },
];

// Ordre + visibilité par défaut des cartes personnalisables de l'onglet
// Patrimoine (les listes d'actifs par type restent le contenu principal, hors
// système de widgets). Champ distinct de l'ancien `wealthWidgets` (map
// visibilité seule) pour ne pas mélanger les deux formats.
export const DEFAULT_WEALTH_WIDGETS = [
  { id: "net_worth", visible: true },
  { id: "evolution", visible: true },
  { id: "allocation", visible: true },
  { id: "member_allocation", visible: true },
  { id: "calculator", visible: true },
];

// Ordre + visibilité par défaut des cartes de l'onglet Budget.
export const DEFAULT_BUDGET_WIDGETS = [
  { id: "overview", visible: true },
  { id: "list", visible: true },
];

// Préférences de widgets par utilisateur et par écran (ordre + visibilité),
// stockées comme un tableau sur users/{uid}.{field}. Les widgets par défaut
// absents des prefs enregistrées sont ajoutés à la fin (ils restent visibles).
function useWidgetPrefs(field, defaults) {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data()[field]) {
        const saved = snap.data()[field];
        const savedIds = new Set(saved.map((w) => w.id));
        // Append any new default widgets not yet in saved prefs
        const merged = [
          ...saved,
          ...defaults.filter((w) => !savedIds.has(w.id)),
        ];
        setWidgets(merged);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, field]);

  const saveWidgets = useCallback(
    async (newWidgets) => {
      setWidgets(newWidgets);
      if (!user) return;
      await setDoc(
        doc(db, "users", user.uid),
        { [field]: newWidgets },
        { merge: true }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.uid, field]
  );

  return { widgets, saveWidgets, loaded };
}

export function useDashboardPrefs() {
  return useWidgetPrefs("dashboardWidgets", DEFAULT_WIDGETS);
}

export function useReportsPrefs() {
  return useWidgetPrefs("reportsLayout", DEFAULT_REPORT_WIDGETS);
}

export function useWealthPrefs() {
  return useWidgetPrefs("wealthLayout", DEFAULT_WEALTH_WIDGETS);
}

export function useBudgetPrefs() {
  return useWidgetPrefs("budgetLayout", DEFAULT_BUDGET_WIDGETS);
}

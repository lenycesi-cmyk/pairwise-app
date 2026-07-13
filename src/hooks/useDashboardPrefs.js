import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Le layout bento desktop est FIXE : la taille d'un widget découle de sa POSITION
// parmi les widgets visibles (cf. slotSize dans DashboardScreen), pas d'un réglage.
// L'ordre par défaut reproduit donc la maquette : 3 petits en haut, puis
// moyen+grand, puis grand+moyen. Sur mobile, l'ordre n'affecte que l'empilement.
export const DEFAULT_WIDGETS = [
  { id: "net_balance", visible: true },
  { id: "health_score", visible: true },
  // Visible par défaut pour compléter la rangée de 3 tuiles stat en haut.
  { id: "available_savings", visible: true },
  { id: "budget_tracking", visible: true },
  // Desktop-only — DashboardScreen filters these out entirely on mobile
  // regardless of this "visible" flag, see DESKTOP_ONLY_WIDGETS.
  { id: "reports_trend", visible: true },
  { id: "transaction_history", visible: true },
  { id: "member_breakdown", visible: true },
  { id: "spending_by_category", visible: true },
  { id: "wealth_allocation", visible: true },
  { id: "net_worth", visible: false },
  { id: "debt_tracker", visible: false },
  { id: "recurring", visible: false },
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

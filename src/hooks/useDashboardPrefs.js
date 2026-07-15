import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Le layout bento desktop est FIXE : la taille d'un widget découle de sa POSITION
// parmi les widgets visibles (cf. slotSize dans DashboardScreen), pas d'un réglage.
// L'ordre par défaut reproduit donc la maquette : 3 petits en haut, puis
// moyen+grand, puis grand+moyen. Sur mobile, l'ordre n'affecte que l'empilement.
export const DEFAULT_WIDGETS = [
  // Ordre reproduisant la maquette (refonte 1B) sur la grille 12 colonnes :
  // rangée 1 : Solde(5) · Par membre(4) · Santé(3)
  // rangée 2 : Liquidités(4) · Budget(5) · Transactions(3)
  // rangée 3 : Patrimoine(4) · Répartition(5) · Dettes(3)
  // rangée 4 : Revenus/Dépenses(4) · Dépenses par catégorie(5) · [récurrences masquées]
  { id: "net_balance", visible: true },
  { id: "member_breakdown", visible: true },
  { id: "health_score", visible: true },
  { id: "available_savings", visible: true },
  { id: "budget_tracking", visible: true },
  { id: "transaction_history", visible: true },
  { id: "net_worth", visible: true },
  // Desktop-only — DashboardScreen filters these out entirely on mobile
  // regardless of this "visible" flag, see DESKTOP_ONLY_WIDGETS.
  { id: "wealth_allocation", visible: true },
  { id: "debt_tracker", visible: true },
  { id: "reports_trend", visible: true },
  { id: "spending_by_category", visible: true },
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
  // « member_allocation » a été fusionné dans le widget « net_worth » (Patrimoine
  // net) — plus de widget séparé.
  { id: "net_worth", visible: true },
  { id: "evolution", visible: true },
  { id: "allocation", visible: true },
  { id: "calculator", visible: true },
];

// Ordre + visibilité par défaut des widgets de l'onglet Flux (grille bento).
// `subscription` reste dans la liste mais ne s'affiche que si une suggestion
// d'abonnement est détectée (renderContent renvoie null sinon).
export const DEFAULT_FLUX_WIDGETS = [
  { id: "cashflow", visible: true },
  { id: "spending_by_category", visible: true },
  { id: "fixed", visible: true },
  { id: "recent", visible: true },
  { id: "upcoming", visible: true },
  { id: "subscription", visible: true },
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

// Layout de l'onglet Budget PAR UTILISATEUR : « un budget = un widget ». La
// disposition est un widget "overview" + un widget par budget (id = budget.id),
// avec ordre et visibilité propres à chaque utilisateur (users/{uid}.budgetLayout).
// On fusionne avec la liste courante des budgets du couple : les nouveaux budgets
// apparaissent (visibles) à la fin, les budgets supprimés sont retirés. Les
// budgets restent partagés — seule la disposition/visibilité est personnelle.
export function useBudgetLayout(budgetIds) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      setSaved(snap.exists() && Array.isArray(snap.data().budgetLayout) ? snap.data().budgetLayout : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const idsKey = budgetIds.join(",");
  const widgets = useMemo(() => {
    const base = ["overview", ...budgetIds];
    const baseSet = new Set(base);
    const ordered = [];
    const seen = new Set();
    for (const w of saved || []) {
      if (baseSet.has(w.id) && !seen.has(w.id)) {
        ordered.push({ id: w.id, visible: w.visible !== false });
        seen.add(w.id);
      }
    }
    for (const id of base) if (!seen.has(id)) ordered.push({ id, visible: true });
    return ordered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, idsKey]);

  const saveWidgets = useCallback(
    (newWidgets) => {
      setSaved(newWidgets);
      if (user) setDoc(doc(db, "users", user.uid), { budgetLayout: newWidgets }, { merge: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.uid]
  );

  return { widgets, saveWidgets, loaded: saved !== null };
}

// Ids des budgets masqués par l'utilisateur (visible === false dans budgetLayout)
// — consommé par le widget budget de l'Accueil pour ne pas les afficher non plus.
export function useBudgetHiddenIds() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => new Set());
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      const arr = snap.exists() && Array.isArray(snap.data().budgetLayout) ? snap.data().budgetLayout : [];
      setHidden(new Set(arr.filter((w) => w.id !== "overview" && w.visible === false).map((w) => w.id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
  return hidden;
}

export function useReportsPrefs() {
  return useWidgetPrefs("reportsLayout", DEFAULT_REPORT_WIDGETS);
}

export function useWealthPrefs() {
  return useWidgetPrefs("wealthLayout", DEFAULT_WEALTH_WIDGETS);
}

// Widgets « fixes » de l'onglet Patrimoine (hors cartes d'actifs par type).
const FIXED_WEALTH_WIDGETS = ["net_worth", "evolution", "allocation", "calculator"];

// Layout de l'onglet Patrimoine PAR UTILISATEUR, incluant les cartes d'actifs par
// type comme widgets déplaçables/masquables (id = "asset_<typeId>"), au même titre
// que les widgets fixes. Même mécanique que useBudgetLayout : on compose
// [widgets fixes, ...cartes d'actifs présentes] et on fusionne avec la disposition
// enregistrée (users/{uid}.wealthLayout) — nouveaux ids ajoutés (visibles) à la
// fin, ids disparus retirés. Rétro-compatible avec l'ancien format (mêmes ids
// pour les widgets fixes ; member_allocation, absent de la base, est ignoré).
export function useWealthLayout(assetTypeIds) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      setSaved(snap.exists() && Array.isArray(snap.data().wealthLayout) ? snap.data().wealthLayout : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const idsKey = assetTypeIds.join(",");
  const widgets = useMemo(() => {
    const base = [...FIXED_WEALTH_WIDGETS, ...assetTypeIds.map((id) => `asset_${id}`)];
    const baseSet = new Set(base);
    const ordered = [];
    const seen = new Set();
    for (const w of saved || []) {
      if (baseSet.has(w.id) && !seen.has(w.id)) {
        ordered.push({ id: w.id, visible: w.visible !== false });
        seen.add(w.id);
      }
    }
    for (const id of base) if (!seen.has(id)) ordered.push({ id, visible: true });
    return ordered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, idsKey]);

  const saveWidgets = useCallback(
    (newWidgets) => {
      setSaved(newWidgets);
      if (user) setDoc(doc(db, "users", user.uid), { wealthLayout: newWidgets }, { merge: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.uid]
  );

  return { widgets, saveWidgets, loaded: saved !== null };
}

export function useBudgetPrefs() {
  return useWidgetPrefs("budgetLayout", DEFAULT_BUDGET_WIDGETS);
}

export function useFluxPrefs() {
  return useWidgetPrefs("fluxLayout", DEFAULT_FLUX_WIDGETS);
}

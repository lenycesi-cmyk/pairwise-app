import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export const DEFAULT_WIDGETS = [
  { id: "net_balance", visible: true },
  { id: "available_savings", visible: true },
  { id: "budget_tracking", visible: true },
  { id: "member_breakdown", visible: true },
  { id: "spending_by_category", visible: true },
  { id: "transaction_history", visible: true },
  { id: "net_worth", visible: false },
  { id: "debt_tracker", visible: false },
  { id: "recurring", visible: false },
];

export function useDashboardPrefs() {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().dashboardWidgets) {
        const saved = snap.data().dashboardWidgets;
        const savedIds = new Set(saved.map((w) => w.id));
        // Append any new default widgets not yet in saved prefs
        const merged = [
          ...saved,
          ...DEFAULT_WIDGETS.filter((w) => !savedIds.has(w.id)),
        ];
        setWidgets(merged);
      }
      setLoaded(true);
    });
  }, [user?.uid]);

  const saveWidgets = useCallback(
    async (newWidgets) => {
      setWidgets(newWidgets);
      if (!user) return;
      await setDoc(
        doc(db, "users", user.uid),
        { dashboardWidgets: newWidgets },
        { merge: true }
      );
    },
    [user?.uid]
  );

  return { widgets, saveWidgets, loaded };
}

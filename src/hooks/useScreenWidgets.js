import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Préférences de visibilité des widgets d'un onglet (Rapports, Patrimoine,
// Budget...). Version légère du système du Dashboard : pas de réordonnancement,
// juste afficher/masquer chaque section. Seuls les écarts par rapport au
// défaut (tout visible) sont stockés, sur users/{uid}.{field} sous forme de
// map { widgetId: bool } — les nouveaux widgets ajoutés plus tard restent
// donc visibles par défaut chez tout le monde.
export function useScreenWidgets(field) {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data()[field]) setOverrides(snap.data()[field]);
    });
  }, [user?.uid, field]);

  const isVisible = useCallback((id) => overrides[id] !== false, [overrides]);

  const toggle = useCallback(
    (id) => {
      const next = { ...overrides, [id]: overrides[id] === false };
      setOverrides(next);
      if (user) setDoc(doc(db, "users", user.uid), { [field]: next }, { merge: true });
    },
    [overrides, user, field]
  );

  return { isVisible, toggle };
}

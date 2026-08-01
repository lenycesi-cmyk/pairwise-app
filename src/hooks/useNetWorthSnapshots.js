import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, startAt } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Lecture des instantanés détaillés du patrimoine
// (`couples/{id}/netWorthSnapshots/{YYYY-MM-DD}`).
//
// Volontairement en `getDocs` et NON en `onSnapshot` : ces documents ne changent
// qu'une fois par jour, à 23 h, et une souscription temps réel maintiendrait une
// écoute ouverte sur des centaines de documents pour un événement quotidien. Le
// résumé du couple, lui, reste en temps réel — c'est lui qui bouge quand
// l'utilisateur modifie un actif.
//
// Chargé à la DEMANDE, quand l'écran Patrimoine se monte : le graphique
// d'évolution, l'écran Rapports et les insights continuent de lire le tableau
// `netWorthHistory` du document du couple en une seule lecture, sans toucher à
// cette sous-collection.

/**
 * @param {number} months  profondeur d'historique, en mois (défaut 13 : douze
 *        mois complets plus le mois en cours, pour que la comparaison
 *        d'une année à l'autre ait toujours son point de départ).
 */
export function useNetWorthSnapshots(months = 13) {
  const { coupleId } = useAuth();
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Aucun setState synchrone dans le corps de l'effet : tout passe par les
    // callbacks de la promesse. Sans couple, il n'y a simplement rien à charger —
    // l'état initial ([] / loading) est déjà le bon.
    if (!coupleId) return undefined;
    let cancelled = false;

    // L'identifiant du document EST la date (YYYY-MM-DD), donc l'ordre
    // lexicographique est l'ordre chronologique : une borne basse suffit, sans
    // index composite ni champ à requêter.
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const fromKey = from.toISOString().slice(0, 10);

    getDocs(query(
      collection(db, "couples", coupleId, "netWorthSnapshots"),
      orderBy("__name__"),
      startAt(fromKey)
    ))
      .then((snap) => {
        if (cancelled) return;
        setSnapshots(snap.docs.map((d) => ({ date: d.id, ...d.data() })));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Un historique illisible n'est pas une raison de casser l'onglet : les
        // widgets concernés se masquent, le reste de la page continue.
        console.error("Historique du patrimoine illisible :", err.message);
        setError(err);
        setSnapshots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coupleId, months]);

  return { snapshots, loading, error };
}

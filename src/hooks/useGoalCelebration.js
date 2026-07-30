import { useEffect, useRef } from "react";
import { useGoalProgress } from "./useGoalProgress";
import { celebrate } from "../utils/celebrate";

// Détecte le passage d'un objectif à l'état « atteint » (reached) et déclenche
// une salve de confettis + un feedback haptique — une seule fois par événement.
//
// Deux garde-fous, parce que la fête se rejouait à chaque rechargement de
// l'app :
//
//  1. On n'évalue rien avant `ready` (taux de change + prix live arrivés).
//     Avant ça un actif coté vaut 0, donc un objectif atteint apparaît
//     brièvement comme non atteint — ce qui ré-armait le marqueur, puis
//     re-déclenchait la fête dès que les prix atterrissaient.
//  2. L'état est persisté explicitement ("1" atteint / "0" non atteint) plutôt
//     que posé/supprimé. On ne célèbre que la transition "0" → atteint : une
//     clé absente signifie « jamais évalué », donc on amorce en silence (un
//     objectif déjà atteint avant l'installation ne se fête pas).
export function useGoalCelebration() {
  const { items, ready } = useGoalProgress();
  // Objectifs déjà traités dans cette session : évite de re-célébrer sur un
  // simple re-render avant que le localStorage ne soit relu.
  const seen = useRef(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ready || items.length === 0) return;

    for (const { goal, reached } of items) {
      if (!goal?.id) continue;
      const key = `goalReached_${goal.id}`;
      const previous = localStorage.getItem(key);

      if (reached) {
        if (previous === "0" && !seen.current.has(goal.id)) {
          seen.current.add(goal.id);
          celebrate(goal.name || "Objectif atteint 🎉");
        }
        localStorage.setItem(key, "1");
      } else {
        // Repassé sous la cible (retrait, cible relevée) : on ré-arme pour
        // pouvoir fêter la prochaine atteinte.
        seen.current.delete(goal.id);
        localStorage.setItem(key, "0");
      }
    }
  }, [items, ready]);
}

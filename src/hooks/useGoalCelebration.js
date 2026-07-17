import { useEffect, useRef } from "react";
import { useGoalProgress } from "./useGoalProgress";
import { celebrate } from "../utils/celebrate";

// Détecte le passage d'un objectif à l'état « atteint » (reached) et déclenche
// une salve de confettis + un feedback haptique — une seule fois par objectif.
//
// La dédup est permanente (un objectif atteint est un événement ponctuel) :
// on marque `goalReached_{id}` en localStorage. Au tout premier chargement on
// n'affiche rien pour les objectifs déjà atteints — on se contente d'amorcer
// le marqueur, sinon la fête se rejouerait à chaque ouverture de l'app.
export function useGoalCelebration() {
  const progress = useGoalProgress();
  const primed = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!progress || progress.length === 0) return;

    for (const { goal, reached } of progress) {
      if (!goal?.id) continue;
      const key = `goalReached_${goal.id}`;
      const already = localStorage.getItem(key);

      if (reached && !already) {
        // Premier passage de l'app : on amorce sans célébrer les objectifs
        // déjà atteints avant cette session.
        if (primed.current) {
          celebrate(goal.name || "Objectif atteint 🎉");
        }
        localStorage.setItem(key, "1");
      } else if (!reached && already) {
        // L'objectif est repassé sous la cible (retrait) : on ré-arme pour
        // pouvoir refêter une prochaine atteinte.
        localStorage.removeItem(key);
      }
    }

    primed.current = true;
  }, [progress]);
}

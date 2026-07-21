import { useEffect } from "react";
import { useBudgetProgress } from "./useBudgetProgress";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { getMemberKey } from "../utils/members";
import { sendPushNotification } from "../utils/sendPush";
import { showLocalNotification } from "../utils/localNotification";

function monthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

// Alertes budget à deux niveaux : au seuil d'alerte (80 % par défaut) puis
// au dépassement (100 %). Chaque niveau notifie UNIQUEMENT les membres
// concernés par le budget (budget.memberUid) : un budget personnel ne
// notifie jamais le/la partenaire.
// - notification locale si JE suis concerné (app ouverte) ;
// - push (sendPush, kind budgetAlert + targetKeys) vers les autres membres
//   concernés, pour qu'ils soient prévenus même app fermée.
// Dédup par budget+mois+niveau en localStorage ; côté push, le tag FCM fait
// s'écraser les doublons si les deux appareils sont ouverts en même temps.
export function useBudgetAlerts() {
  const { progress } = useBudgetProgress();
  const { members, coupleId, categories, defaultCurrency } = useFinance();
  const { user } = useAuth();

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!user || !coupleId) return;

    const me = members.find((m) => m.uid === user.uid);
    const myKey = me ? getMemberKey(me) : user?.uid;

    for (const { budget, pct } of progress) {
      if (budget.active === false) continue;
      const threshold = budget.alertThreshold ?? 80;
      const levels = [];
      if (pct >= 100) levels.push({ key: "100", pct });
      else if (pct >= threshold) levels.push({ key: "warn", pct });

      const concernedKeys =
        !budget.memberUid || budget.memberUid === "couple"
          ? members.map(getMemberKey)
          : [budget.memberUid];

      const label =
        budget.name ||
        (budget.scope === "global"
          ? "Budget global"
          : (budget.categoryIds || [])
              .map((cid) => categories.find((c) => c.id === cid)?.name)
              .filter(Boolean)
              .join(", ") || "Budget");

      for (const level of levels) {
        const storageKey = `budgetAlert_${budget.id}_${monthKey()}_${level.key}`;
        if (localStorage.getItem(storageKey)) continue;

        if (concernedKeys.includes(myKey)) {
          showLocalNotification(level.key === "100" ? "Budget dépassé" : "Alerte budget", {
            body: `${label} : ${Math.round(level.pct)}% du budget atteint.`,
            tag: storageKey,
          });
        }

        const otherConcerned = concernedKeys.filter((k) => k && k !== myKey);
        if (otherConcerned.length > 0) {
          sendPushNotification({
            coupleId,
            kind: "budgetAlert",
            description: label,
            pct: level.pct,
            currency: defaultCurrency,
            targetKeys: otherConcerned,
          });
        }

        localStorage.setItem(storageKey, "1");
      }
    }
  }, [progress, members, coupleId, categories, user, defaultCurrency]);
}

import { useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "./useTranslation";
import { nextOccurrence, daysUntil } from "../utils/recurrence";
import { showLocalNotification } from "../utils/localNotification";

export const REMINDER_DAYS_AHEAD = 3;

// Rappel des récurrences à venir : notification navigateur quand une
// échéance tombe dans les REMINDER_DAYS_AHEAD prochains jours. Monté en
// permanence via RecurringRemindersRunner (App.jsx). Dédup par
// règle + date d'échéance en localStorage, comme les alertes budget.
export function useRecurringReminders() {
  const { recurringTx } = useFinance();
  const t = useTranslation();

  useEffect(() => {
    if (!recurringTx.length) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const now = new Date();
    for (const rule of recurringTx) {
      if (rule.active === false) continue;
      const next = nextOccurrence(rule, now);
      if (!next) continue;
      const days = daysUntil(next, now);
      if (days < 0 || days > REMINDER_DAYS_AHEAD) continue;

      const dedupeKey = `recurringReminder_${rule.id}_${next.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(dedupeKey)) continue;

      const when =
        days === 0 ? t("recurring_reminder_today") :
        days === 1 ? t("recurring_reminder_tomorrow") :
        t("recurring_reminder_in_days").replace("{days}", days);
      showLocalNotification(t("recurring_reminder_title"), {
        body: `${rule.description} — ${Math.round(rule.amount).toLocaleString("fr-FR")} ${rule.currency} · ${when}`,
        tag: dedupeKey,
      });
      localStorage.setItem(dedupeKey, "1");
    }
  }, [recurringTx, t]);
}

import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";

// Clé de période (unité de récurrence) : sert d'identifiant idempotent pour la
// transaction générée, de sorte que deux appareils (ou un double rendu) qui
// génèrent la même échéance écrivent le MÊME document → une seule transaction,
// jamais de doublon.
function periodKey(rule, now) {
  const y = now.getFullYear();
  if (rule.frequency === "monthly") return `${y}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (rule.frequency === "yearly") return `${y}`;
  // weekly → numéro de semaine ISO
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Date « représentative » de l'échéance, déterministe (indépendante de l'heure
// d'ouverture de l'app) pour que le document idempotent ait toujours le même
// contenu. Pour le mensuel : le jour prévu du mois (borné au dernier jour).
function scheduledDate(rule, now) {
  if (rule.frequency === "monthly") {
    const y = now.getFullYear();
    const m = now.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(rule.dayOfMonth || 1, lastDay);
    return new Date(y, m, day, 12, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

// `lastGen` = date ISO de dernière génération de CETTE règle (depuis la map
// recurringLastGen ; repli sur rule.lastGenerated pour les données héritées).
function shouldGenerate(rule, now, lastGen) {
  const last = lastGen ? new Date(lastGen) : null;

  if (rule.frequency === "monthly") {
    if (now.getDate() < rule.dayOfMonth) return false;
    if (!last) return true;
    const sameMonth =
      last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
    return !sameMonth;
  }

  if (rule.frequency === "weekly") {
    if (!last) return true;
    const diffDays = (now - last) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  }

  if (rule.frequency === "yearly") {
    if (!last) return true;
    const sameYear = last.getFullYear() === now.getFullYear();
    return !sameYear;
  }

  return false;
}

export function useRecurringGenerator() {
  const { coupleId, user } = useAuth();
  const { recurringTx, recurringLastGen } = useFinance();

  useEffect(() => {
    if (!coupleId || !recurringTx || recurringTx.length === 0) return;

    async function generate() {
      const now = new Date();
      const lastGenUpdates = {};

      for (const rule of recurringTx) {
        if (rule.active === false) continue;
        const lastGen = recurringLastGen?.[rule.id] ?? rule.lastGenerated ?? null;
        if (!shouldGenerate(rule, now, lastGen)) continue;

        // ID déterministe (règle + période) → idempotent : re-génération ou
        // second appareil réécrivent le même doc, pas de doublon.
        const txId = `${rule.id}_${periodKey(rule, now)}`;
        const when = scheduledDate(rule, now);
        await setDoc(doc(db, "couples", coupleId, "transactions", txId), {
          type: rule.type,
          amount: rule.amount,
          currency: rule.currency,
          categoryId: rule.categoryId,
          subcategory: rule.subcategory,
          description: rule.description,
          paidBy: rule.paidBy,
          split: rule.split,
          date: when.toISOString(),
          createdAt: Date.now(),
          createdBy: user.uid,
          isRecurring: true,
          recurringId: rule.id,
        });
        lastGenUpdates[rule.id] = now.toISOString();
      }

      // On n'écrit QUE la map recurringLastGen (merge profond), jamais le tableau
      // recurringTx : une édition simultanée d'une règle n'est donc plus écrasée.
      if (Object.keys(lastGenUpdates).length > 0) {
        await setDoc(
          doc(db, "couples", coupleId),
          { recurringLastGen: lastGenUpdates },
          { merge: true }
        );
      }
    }

    generate();
  }, [coupleId, recurringTx, recurringLastGen, user]);
}

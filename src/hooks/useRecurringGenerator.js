import { useEffect } from "react";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFinance } from "../context/FinanceContext";

function shouldGenerate(rule, now) {
  const last = rule.lastGenerated ? new Date(rule.lastGenerated) : null;

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
  const { recurringTx } = useFinance();

  useEffect(() => {
    if (!coupleId || !recurringTx || recurringTx.length === 0) return;

    async function generate() {
      const now = new Date();
      const updatedRules = [];
      let hasChanges = false;

      for (const rule of recurringTx) {
        if (rule.active === false) {
          updatedRules.push(rule);
          continue;
        }
        if (shouldGenerate(rule, now)) {
          await addDoc(collection(db, "couples", coupleId, "transactions"), {
            type: rule.type,
            amount: rule.amount,
            currency: rule.currency,
            categoryId: rule.categoryId,
            subcategory: rule.subcategory,
            description: rule.description,
            paidBy: rule.paidBy,
            split: rule.split,
            date: now.toISOString(),
            createdAt: Date.now(),
            createdBy: user.uid,
            isRecurring: true,
          });
          updatedRules.push({ ...rule, lastGenerated: now.toISOString() });
          hasChanges = true;
        } else {
          updatedRules.push(rule);
        }
      }

      if (hasChanges) {
        await setDoc(
          doc(db, "couples", coupleId),
          { recurringTx: updatedRules },
          { merge: true }
        );
      }
    }

    generate();
  }, [coupleId, recurringTx, user]);
}

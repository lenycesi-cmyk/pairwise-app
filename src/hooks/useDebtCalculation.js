import { useMemo } from "react";
import { getMemberKey } from "../utils/members";

// `options.startDate`/`options.endDate` restrict the shared-expense window
// (used by the debt tracker's month/range filters). When no explicit
// startDate is given but `options.settlements` is, the most recent
// settlement's date becomes the implicit start — "mark as paid" doesn't
// touch any transaction, it just tells this hook to stop counting
// everything before that date, so the running balance resets to 0 without
// rewriting history.
export function useDebtCalculation(transactions, members, defaultCurrency, convert, options = {}) {
  const { startDate, endDate, settlements = [] } = options;
  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  // Calcule la part de chaque membre (a, b) à partir de splitDetails, en
  // respectant l'unité (pourcentage ou montant figé en devise d'origine).
  function getCustomShares(tx, val, a, b) {
    const d = tx.splitDetails;
    if (d.unit === "percent") {
      return { shareA: (val * d.a) / 100, shareB: (val * d.b) / 100 };
    }
    // unit === "amount" : d.a et d.b sont dans la devise d'origine de la
    // transaction, on les reconvertit proportionnellement à `val` (déjà en
    // devise d'affichage) pour rester cohérent même si la devise diffère.
    const total = d.a + d.b;
    if (total === 0) return { shareA: val / 2, shareB: val / 2 };
    return { shareA: (val * d.a) / total, shareB: (val * d.b) / total };
  }

  return useMemo(() => {
    if (members.length < 2) return null;
    const [a, b] = members;
    const aKey = getMemberKey(a);
    const bKey = getMemberKey(b);

    const latestSettlement = settlements.length
      ? settlements.reduce((max, s) => (new Date(s.date) > new Date(max.date) ? s : max))
      : null;
    const effectiveStart = startDate ?? latestSettlement?.date ?? null;

    let aPaidForB = 0;
    let bPaidForA = 0;
    const sharedTx = [];

    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      if (effectiveStart && new Date(tx.date) < new Date(effectiveStart)) continue;
      if (endDate && new Date(tx.date) > new Date(endDate)) continue;
      const val = toBase(tx);

      if (tx.splitDetails) {
        // Partage avancé : chaque membre doit sa propre part, peu importe
        // qui a payé. Seule la part de l'AUTRE membre crée une dette envers
        // celui qui a payé.
        const { shareA, shareB } = getCustomShares(tx, val, a, b);
        if (tx.paidBy === aKey) {
          aPaidForB += shareB;
          sharedTx.push({ ...tx, share: shareB, paidByName: a.name, label: `${shareA.toFixed(0)}/${shareB.toFixed(0)}` });
        } else if (tx.paidBy === bKey) {
          bPaidForA += shareA;
          sharedTx.push({ ...tx, share: shareA, paidByName: b.name, label: `${shareA.toFixed(0)}/${shareB.toFixed(0)}` });
        }
      } else if (tx.split === "50/50") {
        const half = val / 2;
        if (tx.paidBy === aKey) {
          aPaidForB += half;
          sharedTx.push({ ...tx, share: half, paidByName: a.name, label: "50/50" });
        } else if (tx.paidBy === bKey) {
          bPaidForA += half;
          sharedTx.push({ ...tx, share: half, paidByName: b.name, label: "50/50" });
        }
      } else if (tx.split === aKey && tx.paidBy === bKey) {
        bPaidForA += val;
        sharedTx.push({ ...tx, share: val, paidByName: b.name, label: `pour ${a.name}` });
      } else if (tx.split === bKey && tx.paidBy === aKey) {
        aPaidForB += val;
        sharedTx.push({ ...tx, share: val, paidByName: a.name, label: `pour ${b.name}` });
      }
    }

    const net = aPaidForB - bPaidForA;
    return {
      a, b,
      aPaidForB, bPaidForA,
      net,
      owesText: net > 0 ? `${b.name} doit à ${a.name}` : `${a.name} doit à ${b.name}`,
      owesAmount: Math.abs(net),
      sharedTx: sharedTx.sort((x, y) => new Date(y.date) - new Date(x.date)),
      latestSettlement,
    };
  }, [transactions, members, defaultCurrency, convert, startDate, endDate, settlements]);
}

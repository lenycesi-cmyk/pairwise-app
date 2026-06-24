import { useMemo } from "react";

export function useDebtCalculation(transactions, members, defaultCurrency, convert) {
  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  return useMemo(() => {
    if (members.length < 2) return null;
    const [a, b] = members;

    let aPaidForB = 0;
    let bPaidForA = 0;
    const sharedTx = [];

    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const val = toBase(tx);

      if (tx.split === "50/50") {
        const half = val / 2;
        if (tx.paidBy === a.uid) {
          aPaidForB += half;
          sharedTx.push({ ...tx, share: half, paidByName: a.name, label: "50/50" });
        } else if (tx.paidBy === b.uid) {
          bPaidForA += half;
          sharedTx.push({ ...tx, share: half, paidByName: b.name, label: "50/50" });
        }
      } else if (tx.split === a.uid && tx.paidBy === b.uid) {
        bPaidForA += val;
        sharedTx.push({ ...tx, share: val, paidByName: b.name, label: `pour ${a.name}` });
      } else if (tx.split === b.uid && tx.paidBy === a.uid) {
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
    };
  }, [transactions, members, defaultCurrency]);
}

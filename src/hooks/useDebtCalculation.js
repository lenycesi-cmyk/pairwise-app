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
  const { startDate, endDate, settlements = [], transfers = [] } = options;
  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  // Calcule la part de chaque membre (a, b) à partir de splitDetails, en
  // respectant l'unité (pourcentage ou montant figé en devise d'origine).
  function getCustomShares(tx, val) {
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
      // Un REVENU coché « rembourse une dépense partagée » (refundsShared)
      // compte à l'envers d'une dépense : celui qui l'a reçu doit à l'autre la
      // part que le partage lui attribue. Sans lui, un remboursement
      // d'assurance encaissé par un seul membre laissait la facture due en
      // entier, et rien à l'écran ne disait pourquoi.
      //
      // Le tri se fait sur ce champ explicite et JAMAIS sur le seul partage du
      // revenu : celui-ci sert déjà à répartir les montants dans les rapports
      // et les budgets, si bien que tous les revenus communs déjà enregistrés —
      // salaires compris — entreraient d'un coup dans les soldes.
      const isRefund = tx.type === "income" && tx.refundsShared === true;
      if (tx.type !== "expense" && !isRefund) continue;
      if (effectiveStart && new Date(tx.date) < new Date(effectiveStart)) continue;
      if (endDate && new Date(tx.date) > new Date(endDate)) continue;
      // Une seule arithmétique pour les deux sens : le remboursement DÉFAIT ce
      // qu'une dépense de même partage aurait fait. Deux branches jumelles
      // auraient divergé à la première retouche.
      const sign = isRefund ? -1 : 1;
      const kind = isRefund ? "refund" : "expense";
      const val = toBase(tx) * sign;

      if (tx.splitDetails) {
        // Partage avancé : chaque membre doit sa propre part, peu importe
        // qui a payé. Seule la part de l'AUTRE membre crée une dette envers
        // celui qui a payé.
        const { shareA, shareB } = getCustomShares(tx, val);
        if (tx.paidBy === aKey) {
          aPaidForB += shareB;
          sharedTx.push({ ...tx, kind, share: Math.abs(shareB), paidByName: a.name, forName: b.name, label: `${Math.abs(shareA).toFixed(0)}/${Math.abs(shareB).toFixed(0)}` });
        } else if (tx.paidBy === bKey) {
          bPaidForA += shareA;
          sharedTx.push({ ...tx, kind, share: Math.abs(shareA), paidByName: b.name, forName: a.name, label: `${Math.abs(shareA).toFixed(0)}/${Math.abs(shareB).toFixed(0)}` });
        }
      } else if (tx.split === "50/50") {
        const half = val / 2;
        if (tx.paidBy === aKey) {
          aPaidForB += half;
          sharedTx.push({ ...tx, kind, share: Math.abs(half), paidByName: a.name, forName: b.name, label: "50/50" });
        } else if (tx.paidBy === bKey) {
          bPaidForA += half;
          sharedTx.push({ ...tx, kind, share: Math.abs(half), paidByName: b.name, forName: a.name, label: "50/50" });
        }
      } else if (tx.split === aKey && tx.paidBy === bKey) {
        bPaidForA += val;
        // label null + forName : l'écran traduit "pour {name}" lui-même.
        sharedTx.push({ ...tx, kind, share: Math.abs(val), paidByName: b.name, label: null, forName: a.name });
      } else if (tx.split === bKey && tx.paidBy === aKey) {
        aPaidForB += val;
        sharedTx.push({ ...tx, kind, share: Math.abs(val), paidByName: a.name, label: null, forName: b.name });
      }
    }

    // Virements directs (voir addDebtTransfer) : un membre envoie de l'argent
    // à l'autre en dehors de toute dépense catégorisée. Mathématiquement
    // identique à une dépense payée à 100% par l'expéditeur "pour" le
    // destinataire — même accumulateur, même fenêtre temporelle (un virement
    // antérieur au dernier règlement ne compte plus, comme une dépense).
    const transferActivity = [];
    for (const xf of transfers) {
      if (effectiveStart && new Date(xf.date) < new Date(effectiveStart)) continue;
      if (endDate && new Date(xf.date) > new Date(endDate)) continue;
      const val = convert(xf.amount, xf.currency, defaultCurrency);
      // Un RÈGLEMENT est un virement qui solde le compte : même arithmétique,
      // donc même accumulateur. Seule la présentation diffère (pastille, libellé
      // de période), d'où ce `kind` distinct plutôt qu'une branche de calcul.
      const kind = xf.settlement ? "settlement" : "transfer";
      if (xf.fromKey === aKey) {
        aPaidForB += val;
        transferActivity.push({ ...xf, share: val, paidByName: a.name, forName: b.name, kind });
      } else if (xf.fromKey === bKey) {
        bPaidForA += val;
        transferActivity.push({ ...xf, share: val, paidByName: b.name, forName: a.name, kind });
      }
    }

    const net = aPaidForB - bPaidForA;
    return {
      a, b,
      aPaidForB, bPaidForA,
      net,
      // Noms structurés : les écrans composent la phrase via i18n ("{from}
      // doit à {to}" / "{from} owes {to}").
      owesFromName: net > 0 ? b.name : a.name,
      owesToName: net > 0 ? a.name : b.name,
      owesAmount: Math.abs(net),
      sharedTx: sharedTx.sort((x, y) => new Date(y.date) - new Date(x.date)),
      // Liste combinée dépenses + virements, pour l'écran de détail : une
      // dépense et un virement du même jour doivent apparaître dans le bon
      // ordre l'un par rapport à l'autre, d'où le tri commun plutôt que deux
      // listes concaténées.
      activity: [
        ...sharedTx,
        ...transferActivity,
      ].sort((x, y) => new Date(y.date) - new Date(x.date)),
      latestSettlement,
    };
  }, [transactions, members, defaultCurrency, convert, startDate, endDate, settlements, transfers]);
}

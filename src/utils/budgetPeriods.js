// Calcul des plages de période d'un budget selon sa fréquence. Centralisé ici
// pour être partagé par useBudgetProgress (affichage) et useBudgetSnapshots
// (historique). 100% client-side, déterministe.
//
// Fréquences supportées (champ `budget.period`) :
//  - "monthly"   : mois civil, ou "mois ancré" si `anchorDay` > 1 (ex. 25 →
//                  période du 25 au 24 du mois suivant, alignée sur la paie).
//  - "weekly"    : semaine lundi→dimanche courante (non navigable par mois).
//  - "quarterly" : trimestre civil.
//  - "yearly"    : année civile.
//  - "rolling"   : fenêtre glissante des N derniers jours (`rollingDays`, 30
//                  par défaut), se terminant aujourd'hui.
//  - "event"     : enveloppe à durée fixe entre `startDate` et `endDate`.

function pad(n) {
  return String(n).padStart(2, "0");
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Lundi de la semaine contenant d.
function weekStart(d) {
  const day = (d.getDay() + 6) % 7; // lundi = 0
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
}

// Plage de la période "courante" d'un budget relative à refDate (pour les
// périodes calendaires) — hebdo/glissant/événement ignorent refDate et se
// basent sur maintenant / leurs dates fixes.
export function periodRange(budget, refDate = new Date()) {
  const now = new Date();
  const p = budget.period || "monthly";

  if (p === "event") {
    const s = budget.startDate ? new Date(budget.startDate) : new Date();
    const e = budget.endDate ? new Date(budget.endDate) : s;
    return { start: startOfDay(s), end: endOfDay(e), key: "event", type: "event", browsable: false };
  }

  if (p === "weekly") {
    const start = weekStart(now);
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return { start, end, key: "w" + isoDate(start), type: "weekly", browsable: false };
  }

  if (p === "rolling") {
    const days = budget.rollingDays || 30;
    const end = endOfDay(now);
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
    return { start, end, key: null, type: "rolling", browsable: false };
  }

  if (p === "quarterly") {
    const q = Math.floor(refDate.getMonth() / 3);
    const y = refDate.getFullYear();
    return {
      start: new Date(y, q * 3, 1),
      end: endOfDay(new Date(y, q * 3 + 3, 0)),
      key: `${y}-Q${q + 1}`, type: "quarterly", browsable: true,
    };
  }

  if (p === "yearly") {
    const y = refDate.getFullYear();
    return { start: new Date(y, 0, 1), end: endOfDay(new Date(y, 11, 31)), key: `${y}`, type: "yearly", browsable: true };
  }

  // monthly (civil ou ancré)
  const anchor = budget.anchorDay && budget.anchorDay > 1 ? Math.min(budget.anchorDay, 28) : 1;
  if (anchor === 1) {
    const y = refDate.getFullYear(), m = refDate.getMonth();
    return { start: new Date(y, m, 1), end: endOfDay(new Date(y, m + 1, 0)), key: `${y}-${pad(m + 1)}`, type: "monthly", browsable: true };
  }
  // Ancré : la période contenant refDate démarre à `anchor`. Si refDate est
  // avant le jour d'ancrage, la période a commencé le mois précédent.
  let sY = refDate.getFullYear(), sM = refDate.getMonth();
  if (refDate.getDate() < anchor) sM -= 1;
  const start = new Date(sY, sM, anchor);
  const end = endOfDay(new Date(sY, sM + 1, anchor - 1));
  return { start, end, key: `${start.getFullYear()}-${pad(start.getMonth() + 1)}a`, type: "monthly", browsable: true };
}

// Plage de la période PRÉCÉDENTE (pour le report YNAB et les snapshots).
// null pour les fenêtres glissantes et les enveloppes d'événement.
export function previousPeriodRange(budget, refDate = new Date()) {
  const p = budget.period || "monthly";
  if (p === "rolling" || p === "event") return null;
  const cur = periodRange(budget, refDate);
  const prevRef = new Date(cur.start.getTime() - 12 * 3600 * 1000); // ~12 h avant le début courant
  if (p === "weekly") {
    const start = weekStart(prevRef);
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
    return { start, end, key: "w" + isoDate(start), type: "weekly", browsable: false };
  }
  return periodRange(budget, prevRef);
}

// Un timestamp (ms epoch) est-il dans la plage [start, end] ?
export function inRange(ms, range) {
  return ms >= range.start.getTime() && ms <= range.end.getTime();
}

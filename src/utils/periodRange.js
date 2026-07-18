// Logique de plage temporelle partagée par les onglets Rapports et Flux.
// `getRange` transforme (type de période, date d'ancre) en { start, end, label } ;
// `shiftAnchor` avance/recule l'ancre d'une période ; `PERIOD_TYPES` liste les
// types dans l'ordre d'affichage des filtres.

export const PERIOD_TYPES = ["week", "month", "last3", "year", "last12", "custom"];

export function getRange(periodType, anchor, customRange, locale) {
  const y = anchor.getFullYear();
  if (periodType === "week") {
    // Fenêtre de 7 jours se terminant sur l'ancre (incluse).
    const start = new Date(y, anchor.getMonth(), anchor.getDate() - 6);
    const end = new Date(y, anchor.getMonth(), anchor.getDate() + 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${anchor.toLocaleDateString(locale, { day: "numeric", month: "short" })}`,
    };
  }
  if (periodType === "month") {
    const m = anchor.getMonth();
    return {
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 1),
      label: anchor.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    };
  }
  if (periodType === "last3") {
    // Fenêtre glissante des 3 mois se terminant sur le mois de l'ancre (inclus).
    const end = new Date(y, anchor.getMonth() + 1, 1);
    const start = new Date(y, anchor.getMonth() - 2, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale, { month: "short" })} – ${anchor.toLocaleDateString(locale, { month: "short", year: "numeric" })}`,
    };
  }
  if (periodType === "last12") {
    const end = new Date(y, anchor.getMonth() + 1, 1);
    const start = new Date(y, anchor.getMonth() - 11, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale, { month: "short", year: "numeric" })} – ${anchor.toLocaleDateString(locale, { month: "short", year: "numeric" })}`,
    };
  }
  if (periodType === "custom") {
    const start = customRange?.start ? new Date(customRange.start) : new Date(y, 0, 1);
    const end = customRange?.end
      ? new Date(new Date(customRange.end).getTime() + 24 * 60 * 60 * 1000)
      : new Date(y + 1, 0, 1);
    return {
      start,
      end,
      label: `${start.toLocaleDateString(locale)} – ${new Date(end.getTime() - 1).toLocaleDateString(locale)}`,
    };
  }
  return {
    start: new Date(y, 0, 1),
    end: new Date(y + 1, 0, 1),
    label: `${y}`,
  };
}

export function shiftAnchor(periodType, anchor, delta) {
  const d = new Date(anchor);
  if (periodType === "week") d.setDate(d.getDate() + delta * 7);
  else if (periodType === "month") d.setMonth(d.getMonth() + delta);
  else if (periodType === "quarter") d.setMonth(d.getMonth() + delta * 3);
  else d.setFullYear(d.getFullYear() + delta);
  return d;
}

// Découpe une plage en « seaux » (buckets) adaptés au type de période, pour un
// graphe de tendance qui SUIT réellement la période affichée (au lieu d'un
// 6-mois figé) :
//   - semaine        → 7 seaux quotidiens (libellé jour court)
//   - mois           → seaux hebdomadaires (libellé jour/mois du début de semaine)
//   - trimestre/année/12 mois → seaux mensuels
//   - personnalisé   → granularité choisie selon la durée (jour/semaine/mois)
// Chaque seau : { key, label, start, end }. `start`/`end` bornent [start, end[.
// `granularityOverride` ("day"|"week"|"month") force la granularité des seaux
// (ex. bascule « journalier » sur la vue mensuelle du graphe Flux).
export function periodBuckets(periodType, range, locale, granularityOverride) {
  const { start, end } = range;
  const dayMs = 86400000;
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs));

  let granularity;
  if (granularityOverride) granularity = granularityOverride;
  else if (periodType === "week") granularity = "day";
  else if (periodType === "month") granularity = "week";
  else if (periodType === "custom") granularity = spanDays <= 8 ? "day" : spanDays <= 70 ? "week" : "month";
  else granularity = "month"; // last3, year, last12

  const buckets = [];
  if (granularity === "day") {
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const s = new Date(d);
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      buckets.push({
        key: `d${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`,
        label: s.toLocaleDateString(locale, { weekday: "short" }),
        start: s,
        end: e,
      });
    }
  } else if (granularity === "week") {
    for (let d = new Date(start); d < end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)) {
      const s = new Date(d);
      let e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      if (e > end) e = new Date(end);
      buckets.push({
        key: `w${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`,
        label: s.toLocaleDateString(locale, { day: "numeric", month: "short" }),
        start: s,
        end: e,
      });
    }
  } else {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const s = new Date(d);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      buckets.push({
        key: `m${s.getFullYear()}-${s.getMonth()}`,
        label: s.toLocaleDateString(locale, { month: "short" }),
        start: s,
        end: e,
      });
    }
  }
  return buckets;
}

// Nombre approximatif de mois couverts par une plage (pour normaliser un taux
// mensuel — ex. charges fixes — sur une période plus longue).
export function monthsInRange(range) {
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

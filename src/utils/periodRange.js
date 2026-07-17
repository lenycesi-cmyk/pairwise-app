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

// Nombre approximatif de mois couverts par une plage (pour normaliser un taux
// mensuel — ex. charges fixes — sur une période plus longue).
export function monthsInRange(range) {
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)));
}

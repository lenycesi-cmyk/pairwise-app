// Recurring rules don't store an explicit "next date" field — only
// frequency/dayOfMonth/lastGenerated (see useRecurringGenerator's
// shouldGenerate) — so we derive one for display/reminder purposes,
// mirroring that same logic as closely as the stored fields allow.
export function nextOccurrence(rule, now) {
  if (rule.frequency === "monthly") {
    const day = rule.dayOfMonth || 1;
    let year = now.getFullYear();
    let month = now.getMonth();
    if (now.getDate() > day) { month += 1; if (month > 11) { month = 0; year += 1; } }
    const clampedDay = Math.min(day, new Date(year, month + 1, 0).getDate());
    return new Date(year, month, clampedDay);
  }
  if (rule.frequency === "weekly") {
    if (rule.lastGenerated) {
      const d = new Date(rule.lastGenerated);
      d.setDate(d.getDate() + 7);
      return d;
    }
    return now;
  }
  if (rule.frequency === "yearly") {
    if (rule.lastGenerated) {
      const d = new Date(rule.lastGenerated);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    }
    return null;
  }
  return null;
}

// Nombre de jours (entiers, calendaire) entre aujourd'hui et une date.
export function daysUntil(date, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86400000);
}

import { useMemo, useState, useCallback } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useExchangeRates } from "./useExchangeRates";
import { useHealthScore } from "./useHealthScore";
import { useBudgetProgress } from "./useBudgetProgress";
import { useSubscriptionSuggestion } from "./useSubscriptionSuggestion";

// ── Moteur d'insights du Dashboard ───────────────────────────────────────────
// Chaque règle est PURE : elle dérive une phrase des données déjà présentes
// (health score, historique de patrimoine, abonnements, budgets), sans réseau.
// Le moteur produit un large pool, puis :
//   • exclut les insights masqués cette semaine (localStorage, anti-spam) ;
//   • épingle les alertes (tone "warning") en tête ;
//   • fait TOURNER les insights positifs/neutres par jour (offset = jour) pour
//     que l'utilisateur ne voie pas toujours les mêmes ;
//   • diversifie les catégories affichées.
// Le composant consommateur applique t(key, vars) → texte final.

const TONE_PRIORITY = { warning: 100, celebrate: 60, neutral: 45, positive: 40 };

// Clé de semaine ISO approximative (année + n° de semaine) pour le cooldown.
function weekKey(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 1);
  const day = Math.floor((d - start) / 86400000);
  return `${d.getFullYear()}-W${Math.floor(day / 7)}`;
}

export function useInsights(displayCurrency) {
  const t = useTranslation();
  const { netWorthHistory, defaultCurrency, language } = useFinance();
  const base = displayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(base);
  const { pillars, hasData } = useHealthScore(base);
  const { progress: budgetProgress } = useBudgetProgress(undefined, undefined, base);
  const { suggestion } = useSubscriptionSuggestion();
  const [dismissVersion, setDismissVersion] = useState(0);
  const locale = language === "en" ? "en-US" : "fr-FR";
  const nowMs = new Date().getTime();

  const dismiss = useCallback((id) => {
    try { localStorage.setItem(`insightDismiss_${id}`, weekKey()); } catch { /* quota / private mode */ }
    setDismissVersion((v) => v + 1);
  }, []);

  const insights = useMemo(() => {
    const pool = [];
    const pillar = (k) => pillars.find((p) => p.key === k);
    const pctFmt = (r, signed = false) => {
      const v = Math.round(r * 100);
      return `${signed && v > 0 ? "+" : ""}${v} %`.replace(" %", language === "en" ? "%" : " %");
    };
    const num1 = (n) => n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    // 1. Fonds d'urgence (mois de dépenses couverts par le liquide)
    const emg = pillar("emergency");
    if (emg) {
      const m = emg.detail.months;
      if (m >= 6) pool.push({ id: "emergency_good", category: "emergency", tone: "positive", icon: "ti-lifebuoy", key: "insight_emergency_good", vars: { n: num1(m) } });
      else if (m >= 3) pool.push({ id: "emergency_mid", category: "emergency", tone: "neutral", icon: "ti-lifebuoy", key: "insight_emergency_mid", vars: { n: num1(m) } });
      else if (emg.detail.liquid > 0) pool.push({ id: "emergency_low", category: "emergency", tone: "warning", icon: "ti-lifebuoy", key: "insight_emergency_low", vars: { n: num1(m) } });
    }

    // 2. Taux d'épargne
    const sav = pillar("savings");
    if (sav) {
      const r = sav.detail.savingsRate;
      if (r >= 0.2) pool.push({ id: "savings_good", category: "savings", tone: "positive", icon: "ti-pig-money", key: "insight_savings_good", vars: { pct: pctFmt(r) } });
      else if (r < 0) pool.push({ id: "savings_neg", category: "savings", tone: "warning", icon: "ti-pig-money", key: "insight_savings_neg", vars: {} });
      else if (r < 0.1) pool.push({ id: "savings_mid", category: "savings", tone: "neutral", icon: "ti-pig-money", key: "insight_savings_mid", vars: { pct: pctFmt(r) } });
    }

    // 3. Charges fixes
    const rec = pillar("recurring");
    if (rec && rec.detail.ratio > 0.5) {
      pool.push({ id: "recurring_high", category: "recurring", tone: "warning", icon: "ti-repeat", key: "insight_recurring_high", vars: { pct: pctFmt(rec.detail.ratio) } });
    }

    // 4. Équilibre 50/30/20
    const bal = pillar("balance");
    if (bal && bal.score >= 80) {
      pool.push({ id: "balance_good", category: "balance", tone: "positive", icon: "ti-scale", key: "insight_balance_good", vars: {} });
    }

    // 5. Tendance & record de patrimoine net (historique converti)
    if (netWorthHistory.length >= 2) {
      const hist = [...netWorthHistory]
        .map((h) => ({ ts: new Date(h.date).getTime(), v: convert(h.value ?? 0, h.currency || base, base) }))
        .sort((a, b) => a.ts - b.ts);
      const latest = hist[hist.length - 1];
      const target = latest.ts - 90 * 86400000;
      // Point de référence ~3 mois avant : le plus récent antérieur à la cible,
      // sinon le plus ancien disponible (démarrage récent).
      let older = hist.find((h) => h.ts >= target) || hist[0];
      for (const h of hist) { if (h.ts <= target) older = h; }
      if (older && older.v > 0 && older.ts < latest.ts) {
        const change = (latest.v - older.v) / older.v;
        if (change >= 0.02) pool.push({ id: "networth_up", category: "networth", tone: "positive", icon: "ti-trending-up", key: "insight_networth_up", vars: { pct: pctFmt(change, true) } });
        else if (change <= -0.05) pool.push({ id: "networth_down", category: "networth", tone: "warning", icon: "ti-trending-down", key: "insight_networth_down", vars: { pct: pctFmt(Math.abs(change)) } });
      }
      // Record : dernier point = max, historique fourni, snapshot récent.
      const maxV = Math.max(...hist.map((h) => h.v));
      const fresh = nowMs - latest.ts < 35 * 86400000;
      if (hist.length >= 4 && fresh && latest.v >= maxV && latest.v > 0) {
        pool.push({ id: "networth_record", category: "networth_record", tone: "celebrate", icon: "ti-trophy", key: "insight_networth_record", vars: {} });
      }
    }

    // 6. Abonnement probable détecté
    if (suggestion) {
      pool.push({ id: "subscription", category: "subscription", tone: "neutral", icon: "ti-refresh-alert", key: "insight_subscription", vars: { desc: suggestion.description } });
    }

    // 7. Budgets dépassés
    const overCount = budgetProgress.filter((p) => p.pct >= 100).length;
    if (overCount > 0) {
      pool.push({ id: "budget_over", category: "budget", tone: "warning", icon: "ti-alert-triangle", key: "insight_budget_over", vars: { n: overCount } });
    }

    // ── Filtre (masqués cette semaine) + texte final ────────────────────────
    const wk = weekKey();
    const live = pool
      .filter((i) => {
        try { return localStorage.getItem(`insightDismiss_${i.id}`) !== wk; } catch { return true; }
      })
      .map((i) => {
        let text = t(i.key);
        for (const k in i.vars) text = text.replace(`{${k}}`, i.vars[k]);
        return { ...i, text, basePriority: TONE_PRIORITY[i.tone] || 30 };
      });

    // Épingle les alertes ; fait tourner le reste par jour.
    const pinned = live.filter((i) => i.tone === "warning").sort((a, b) => b.basePriority - a.basePriority);
    const rotating = live.filter((i) => i.tone !== "warning").sort((a, b) => b.basePriority - a.basePriority);
    if (rotating.length > 1) {
      const dayIdx = Math.floor(nowMs / 86400000);
      const off = dayIdx % rotating.length;
      rotating.push(...rotating.splice(0, off));
    }

    // Diversifie les catégories affichées (les doublons de catégorie passent en fin).
    const ordered = [...pinned, ...rotating];
    const seen = new Set();
    const primary = [];
    const rest = [];
    for (const i of ordered) {
      if (seen.has(i.category)) rest.push(i);
      else { seen.add(i.category); primary.push(i); }
    }
    return [...primary, ...rest];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillars, netWorthHistory, budgetProgress, suggestion, base, convert, language, dismissVersion, hasData]);

  return { insights, dismiss };
}

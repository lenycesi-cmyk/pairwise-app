import { useMemo, useState, useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useFixedExpenses } from "../hooks/useFixedExpenses";
import { useSubscriptionSuggestion } from "../hooks/useSubscriptionSuggestion";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useFluxPrefs } from "../hooks/useDashboardPrefs";
import { nextOccurrence, daysUntil } from "../utils/recurrence";
import { currencySymbol } from "../utils/onboardingDraft";
import WidgetCard from "../components/WidgetCard";
import WidgetCanvas from "../components/WidgetCanvas";
import HeaderMenuButton from "../components/HeaderMenuButton";
import CurrencyPicker from "../components/CurrencyPicker";
import CategoryRow from "../components/CategoryRow";
import ScopeFilter from "../components/ScopeFilter";
import IncomeExpenseTrendChart from "../components/IncomeExpenseTrendChart";
import CommentBubble from "../components/CommentBubble";
import CommentsModal from "../components/CommentsModal";
import TransactionComments from "../components/TransactionComments";
import { memberShareFraction } from "../utils/members";
import { getRange, shiftAnchor, monthsInRange, periodBuckets } from "../utils/periodRange";
import PeriodSelector from "../components/PeriodSelector";

// Retire les mois vides EN TÊTE de la tendance (aucune entrée/sortie/investi) —
// le graphe démarre au premier mois avec de l'activité. Les trous internes et de
// fin sont conservés. Si tout est vide, on garde la série telle quelle.
// Onglet Flux (« ce qui rentre, ce qui sort ») : cash flow du mois, charges
// fixes, dépenses par catégorie, détection d'abonnement, dernières transactions
// et récurrences à venir. Même UI que l'Accueil/Patrimoine : sur desktop, une
// grille bento personnalisable (glisser-déposer + afficher/masquer) ; sur mobile,
// empilement 1 colonne. Les listes renvoient aux écrans complets via les modales.
export default function FluxScreen({ onOpenMenu, onOpenTransactions, onOpenRecurring, onEditTransaction, sharedMonth, onSharedMonthChange }) {
  const t = useTranslation();
  const {
    transactions,
    categories,
    recurringTx,
    members,
    defaultCurrency,
    dashboardDisplayCurrency,
    updateDashboardDisplayCurrency,
    language,
  } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(displayCurrency);
  const { items: fixedItems } = useFixedExpenses(displayCurrency);
  const { suggestion, accept, dismiss } = useSubscriptionSuggestion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { widgets, saveWidgets } = useFluxPrefs();

  const [fixedDetailOpen, setFixedDetailOpen] = useState(false);
  const [commentsTx, setCommentsTx] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  // Filtre membre par widget (Famille / A / B), comme Liquidités en banque.
  const [scopeByWidget, setScopeByWidget] = useState({});
  const setScope = (id, v) => setScopeByWidget((prev) => ({ ...prev, [id]: v }));
  // Fraction « pour qui » d'un mouvement pour le membre filtré (1 si Famille).
  const frac = (tx, scope) => (scope === null ? 1 : memberShareFraction(tx, scope, members));

  const locale = language === "en" ? "en-US" : "fr-FR";
  const symbol = currencySymbol(displayCurrency);
  const fmt = (n) => Math.round(n).toLocaleString(locale);

  const toBase = (tx) => {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === displayCurrency) return tx.convertedAmount;
    return convert(tx.amount, tx.currency, displayCurrency);
  };

  const now = new Date();

  // ── Sélecteur de période (en haut de page) ─────────────────────────────
  // Même modèle que Rapports : type de période + ancre. Le type "month" reste
  // synchronisé avec l'Accueil/Rapports via sharedMonth ; les autres types sont
  // locaux à l'onglet.
  const [periodType, setPeriodType] = useState("month");
  const [anchor, setAnchorRaw] = useState(() =>
    sharedMonth ? new Date(sharedMonth.year, sharedMonth.month, 1) : new Date()
  );
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  function setAnchor(newAnchor) {
    setAnchorRaw(newAnchor);
    if (periodType === "month" && onSharedMonthChange) {
      onSharedMonthChange({ month: newAnchor.getMonth(), year: newAnchor.getFullYear() });
    }
  }

  useEffect(() => {
    if (periodType === "month" && sharedMonth) {
      setAnchorRaw((prev) =>
        prev.getMonth() === sharedMonth.month && prev.getFullYear() === sharedMonth.year
          ? prev
          : new Date(sharedMonth.year, sharedMonth.month, 1)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedMonth?.month, sharedMonth?.year]);

  const range = useMemo(
    () => getRange(periodType, anchor, customRange, locale),
    [periodType, anchor, customRange, locale]
  );
  const inRange = (tx) => {
    const d = new Date(tx.date);
    return d >= range.start && d < range.end;
  };

  // Cash flow de la période : entrées, sorties, net.
  const monthFlow = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (!inRange(tx)) continue;
      if (tx.type === "income") income += toBase(tx);
      else if (tx.type === "expense") expense += toBase(tx);
    }
    return { income, expense, net: income - expense };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, range, displayCurrency, convert]);

  // Dépenses de la période par catégorie (même calcul que le widget du Dashboard).
  const categoryTotals = useMemo(() => {
    const result = {};
    for (const cat of categories) {
      if (cat.id === "income") continue;
      let total = 0;
      const subtotals = {};
      for (const tx of transactions) {
        if (!inRange(tx)) continue;
        if (tx.type === "expense" && tx.categoryId === cat.id) {
          const val = toBase(tx);
          total += val;
          subtotals[tx.subcategory] = (subtotals[tx.subcategory] || 0) + val;
        }
      }
      if (total > 0) result[cat.id] = { category: cat, total, subtotals };
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, range, displayCurrency, convert]);
  const maxCatTotal = Math.max(1, ...Object.values(categoryTotals).map((c) => c.total));

  // Gabarit de seaux de tendance CALÉ sur la période affichée (jour/semaine/mois
  // selon le type) — la tendance suit désormais réellement le filtre de période.
  const trendBuckets = useMemo(
    () => periodBuckets(periodType, range, locale),
    [periodType, range, locale]
  );

  // « Ce qui bouge » : catégories dont la dépense de la période s'écarte le plus
  // de leur moyenne des 3 périodes précédentes (même type/longueur ; signal léger,
  // l'explorateur vit dans Rapports). Historique requis (moyenne > 0) et écart
  // notable (≥ 15 %) pour éviter le bruit ; hausse en tang, baisse en sage. 3 max.
  const whatsMoving = useMemo(() => {
    const baseRanges = [];
    if (periodType === "last12" || periodType === "last3" || periodType === "custom") {
      const span = range.end.getTime() - range.start.getTime();
      for (let i = 1; i <= 3; i++) {
        baseRanges.push({ start: new Date(range.start.getTime() - span * i), end: new Date(range.end.getTime() - span * i) });
      }
    } else {
      for (let i = 1; i <= 3; i++) baseRanges.push(getRange(periodType, shiftAnchor(periodType, anchor, -i), customRange, locale));
    }
    const cur = {};
    const prevSum = {};
    for (const tx of transactions) {
      if (tx.type !== "expense") continue;
      const d = new Date(tx.date);
      const v = toBase(tx);
      if (d >= range.start && d < range.end) {
        cur[tx.categoryId] = (cur[tx.categoryId] || 0) + v;
      } else if (baseRanges.some((r) => d >= r.start && d < r.end)) {
        prevSum[tx.categoryId] = (prevSum[tx.categoryId] || 0) + v;
      }
    }
    const rows = [];
    for (const cid of new Set([...Object.keys(cur), ...Object.keys(prevSum)])) {
      const thisMonth = cur[cid] || 0;
      const avg = (prevSum[cid] || 0) / 3;
      if (avg <= 0) continue;
      const pct = ((thisMonth - avg) / avg) * 100;
      if (Math.abs(pct) < 15) continue;
      rows.push({ cid, thisMonth, pct });
    }
    rows.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    return rows.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, range, periodType, anchor, customRange, locale, displayCurrency, convert]);

  const recentTx = useMemo(
    () => transactions.filter(inRange).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, range]
  );

  const seeAll = (onClick) => (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}
    >
      {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
    </button>
  );

  // Titre du widget flux calé sur la période sélectionnée (« Flux de la
  // semaine / du mois / du trimestre / de l'année / personnalisé »).
  const cashflowTitle = {
    week: t("flux_cashflow_week"),
    month: t("flux_cashflow_month"),
    last3: t("flux_cashflow_quarter"),
    year: t("flux_cashflow_year"),
    last12: t("flux_cashflow_12m"),
    custom: t("flux_cashflow_custom"),
  }[periodType] || t("flux_cashflow_title");

  const fluxWidgetLabels = {
    cashflow: cashflowTitle,
    whats_moving: t("flux_whats_moving_title"),
    spending_by_category: t("dashboard_spending_by_category"),
    fixed: t("flux_fixed_title"),
    recent: t("flux_recent_title"),
    upcoming: t("flux_upcoming_title"),
    subscription: t("flux_subscription_title"),
  };

  // Contenu d'un widget Flux (null quand rien à montrer → placeholder en édition).
  function renderFluxWidget(id) {
    if (id === "cashflow") {
      const scope = scopeByWidget[id] ?? null;
      // Flux + tendance re-scopés par membre (part « pour qui »).
      let income = 0, expense = 0, invested = 0;
      for (const tx of transactions) {
        if (!inRange(tx)) continue;
        const f = frac(tx, scope);
        if (!f) continue;
        if (tx.type === "income") income += toBase(tx) * f;
        else if (tx.type === "expense") expense += toBase(tx) * f;
        else if (tx.type === "investment") invested += toBase(tx) * f;
      }
      const flow = { income, expense, invested, net: income - expense };
      // Remplit les seaux de la période (scopés « pour qui ») : chaque tx dans la
      // plage tombe dans le seau [start, end[ correspondant.
      const scopedTrend = (() => {
        const buckets = trendBuckets.map((b) => ({ label: b.label, start: b.start, end: b.end, income: 0, expense: 0, investment: 0 }));
        for (const tx of transactions) {
          const d = new Date(tx.date);
          if (d < range.start || d >= range.end) continue;
          const b = buckets.find((bk) => d >= bk.start && d < bk.end);
          if (!b) continue;
          const f = frac(tx, scope);
          if (!f) continue;
          if (tx.type === "income") b.income += toBase(tx) * f;
          else if (tx.type === "expense") b.expense += toBase(tx) * f;
          else if (tx.type === "investment") b.investment += toBase(tx) * f;
        }
        return buckets;
      })();
      return (
        <WidgetCard icon="ti-arrows-exchange" accent="sky" title={cashflowTitle}>
          {members.length > 1 && <ScopeFilter members={members} scope={scope} onChange={(v) => setScope(id, v)} style={{ marginBottom: 12 }} />}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, background: "var(--sage-light)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{t("flux_in")}</p>
              <p className="pw-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--sage)" }}>{fmt(flow.income)} {symbol}</p>
            </div>
            <div style={{ flex: 1, background: "var(--tang-light)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{t("flux_out")}</p>
              <p className="pw-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--tang)" }}>{fmt(flow.expense)} {symbol}</p>
            </div>
            {flow.invested > 0 && (
              <div style={{ flex: 1, background: "var(--lavi-light)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
                <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{t("dashboard_invested")}</p>
                <p className="pw-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--lavi)" }}>{fmt(flow.invested)} {symbol}</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{t("flux_net")}</span>
            <span className="pw-num" style={{ fontSize: 17, fontWeight: 700, color: flow.net >= 0 ? "var(--sage)" : "var(--red)" }}>
              {flow.net >= 0 ? "+" : "−"}{fmt(Math.abs(flow.net))} {symbol}
            </span>
          </div>
          <IncomeExpenseTrendChart data={scopedTrend} currencySymbol={symbol} />
        </WidgetCard>
      );
    }

    if (id === "whats_moving") {
      if (whatsMoving.length === 0) return null;
      return (
        <WidgetCard icon="ti-activity" accent="ocean" title={t("flux_whats_moving_title")}>
          {whatsMoving.map(({ cid, thisMonth, pct }, i) => {
            const cat = categories.find((c) => c.id === cid);
            const up = pct >= 0;
            const color = up ? "var(--tang)" : "var(--sage)";
            return (
              <div
                key={cid}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i === whatsMoving.length - 1 ? "none" : "0.5px solid var(--rule)" }}
              >
                <i className={`ti ${cat?.icon || "ti-receipt"}`} style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat?.name || cid}</p>
                  <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{fmt(thisMonth)} {symbol} · {t("flux_whats_moving_vs_avg")}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 2, whiteSpace: "nowrap" }}>
                  <i className={`ti ti-arrow-${up ? "up-right" : "down-right"}`} style={{ fontSize: 14 }} aria-hidden="true" />
                  {up ? "+" : ""}{Math.round(pct)}%
                </span>
              </div>
            );
          })}
        </WidgetCard>
      );
    }

    if (id === "spending_by_category") {
      return (
        <WidgetCard icon="ti-chart-pie" accent="coral" title={t("dashboard_spending_by_category")}>
          {Object.keys(categoryTotals).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1rem 0" }}>{t("dashboard_no_expenses")}</p>
          ) : (
            <>
              {!editMode && <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>{t("dashboard_tap_category")}</p>}
              {Object.values(categoryTotals)
                .sort((a, b) => b.total - a.total)
                .map(({ category, total, subtotals }) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    total={total}
                    maxTotal={maxCatTotal}
                    subtotals={subtotals}
                    formatAmount={fmt}
                    totalExpenses={monthFlow.expense}
                    currencySymbol={symbol}
                  />
                ))}
            </>
          )}
        </WidgetCard>
      );
    }

    if (id === "fixed") {
      const scope = scopeByWidget[id] ?? null;
      const scopedItems = fixedItems
        .map(({ rule, monthly }) => ({ rule, monthly: monthly * frac(rule, scope) }))
        .filter(({ monthly }) => monthly > 0);
      const scopedMonthly = scopedItems.reduce((s, x) => s + x.monthly, 0);
      const scopedCount = scopedItems.length;
      // Revenus de la période re-scopés, ramenés à une moyenne MENSUELLE (les
      // charges fixes sont un taux mensuel) pour que la part reste comparable
      // quelle que soit la longueur de la période sélectionnée.
      let periodIncome = 0;
      for (const tx of transactions) {
        if (!inRange(tx)) continue;
        if (tx.type === "income") periodIncome += toBase(tx) * frac(tx, scope);
      }
      const scopedIncome = periodIncome / monthsInRange(range);
      return (
        <WidgetCard icon="ti-calendar-repeat" accent="amber" title={t("flux_fixed_title")}>
          {members.length > 1 && <ScopeFilter members={members} scope={scope} onChange={(v) => setScope(id, v)} style={{ marginBottom: 12 }} />}
          <p className="pw-num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "2px 0 6px" }}>
            {fmt(scopedMonthly)} {symbol}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
            {scopedCount > 0
              ? t("flux_fixed_need").replace("{count}", scopedCount)
              : t("flux_fixed_empty")}
          </p>
          {scopedIncome > 0 && scopedMonthly > 0 && (
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8 }}>
              {t("flux_fixed_share").replace("{pct}", Math.round((scopedMonthly / scopedIncome) * 100))}
            </p>
          )}
          {scopedCount > 0 && (
            <>
              <button
                onClick={() => setFixedDetailOpen((v) => !v)}
                style={{ marginTop: 12, background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
              >
                {t("flux_fixed_detail")}
                <i className={`ti ti-chevron-${fixedDetailOpen ? "up" : "down"}`} style={{ fontSize: 13 }} aria-hidden="true" />
              </button>
              {fixedDetailOpen && (
                <div style={{ marginTop: 10, borderTop: "0.5px solid var(--rule)" }}>
                  {scopedItems.map(({ rule, monthly }, i) => {
                    const cat = categories.find((c) => c.id === rule.categoryId);
                    return (
                      <div
                        key={rule.id}
                        onClick={() => onOpenRecurring?.(rule.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i === scopedItems.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: "pointer" }}
                      >
                        <i className={`ti ${cat?.icon || "ti-refresh"}`} style={{ fontSize: 15, color: "var(--ink-3)" }} aria-hidden="true" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rule.description || cat?.name}</p>
                          <p style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{t(`flux_freq_${rule.frequency}`)}</p>
                        </div>
                        <p className="pw-num" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmt(monthly)} {symbol}<span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400 }}>/{t("flux_freq_per_month")}</span></p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </WidgetCard>
      );
    }

    if (id === "subscription") {
      if (!suggestion) return null;
      return (
        <WidgetCard icon="ti-refresh-alert" accent="ocean" title={t("flux_subscription_title")}>
          <p style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.45, marginBottom: 10 }}>
            {t("subscription_suggestion")
              .replace("{description}", suggestion.description)
              .replace("{count}", suggestion.count)
              .replace("{amount}", `${fmt(suggestion.amount)} ${suggestion.currency}`)}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={accept} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--radius-md)", border: "none", background: "var(--lavi)", color: "#fff", fontSize: 12.5, fontWeight: 500 }}>
              {t("subscription_accept")}
            </button>
            <button onClick={dismiss} style={{ flex: 1, padding: "8px 0", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg-card)", color: "var(--ink-2)", fontSize: 12.5 }}>
              {t("subscription_dismiss")}
            </button>
          </div>
        </WidgetCard>
      );
    }

    if (id === "recent") {
      return (
        <WidgetCard icon="ti-list" accent="coral" title={t("flux_recent_title")} flush action={!editMode && seeAll(() => onOpenTransactions?.())}>
          {recentTx.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.25rem 0" }}>{t("flux_recent_empty")}</p>
          ) : (
            recentTx.map((tx, i) => {
              const cat = categories.find((c) => c.id === tx.categoryId);
              const income = tx.type === "income";
              return (
                <div
                  key={tx.id}
                  onClick={() => onEditTransaction?.(tx)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i === recentTx.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: "pointer" }}
                >
                  <i className={`ti ${cat?.icon || "ti-receipt"}`} style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description || cat?.name || t("flux_recent_title")}</p>
                    <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{new Date(tx.date).toLocaleDateString(locale)}</p>
                  </div>
                  {tx.comments?.length > 0 && (
                    <CommentBubble count={tx.comments.length} onClick={() => setCommentsTx(tx)} />
                  )}
                  <p className="pw-num" style={{ fontSize: 13, fontWeight: 600, color: income ? "var(--sage)" : "var(--ink)" }}>
                    {income ? "+" : "−"}{fmt(Math.abs(toBase(tx)))} {symbol}
                  </p>
                </div>
              );
            })
          )}
        </WidgetCard>
      );
    }

    if (id === "upcoming") {
      const scope = scopeByWidget[id] ?? null;
      const scopedUpcoming = recurringTx
        .filter((r) => r.active !== false)
        .map((r) => ({ ...r, nextDate: nextOccurrence(r, now), _frac: frac(r, scope) }))
        .filter((r) => r._frac > 0)
        .sort((a, b) => (a.nextDate?.getTime() ?? Infinity) - (b.nextDate?.getTime() ?? Infinity))
        .slice(0, 3);
      return (
        <WidgetCard icon="ti-repeat" accent="pink" title={t("flux_upcoming_title")} flush action={!editMode && seeAll(() => onOpenRecurring?.())}>
          {members.length > 1 && <ScopeFilter members={members} scope={scope} onChange={(v) => setScope(id, v)} style={{ padding: "0 18px 8px" }} />}
          {scopedUpcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.25rem 0" }}>{t("widget_recurring_empty")}</p>
          ) : (
            scopedUpcoming.map((r, i) => {
              const cat = categories.find((c) => c.id === r.categoryId);
              const days = r.nextDate ? daysUntil(r.nextDate, now) : null;
              const soon = days != null && days >= 0 && days <= 3;
              return (
                <div
                  key={r.id}
                  onClick={() => onOpenRecurring?.(r.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i === scopedUpcoming.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: "pointer" }}
                >
                  <i className={`ti ${cat?.icon || "ti-refresh"}`} style={{ fontSize: 16, color: "var(--ink-3)" }} aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description || cat?.name}</p>
                    {r.nextDate && (
                      <p style={{ fontSize: 11, color: soon ? "var(--tang)" : "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
                        {r.nextDate.toLocaleDateString(locale)}
                        {soon && (
                          <span style={{ fontSize: 9, fontWeight: 600, color: "var(--tang)", background: "var(--tang-light)", borderRadius: 8, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                            {days === 0 ? t("recurring_badge_today") : t("recurring_badge_soon")}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <p className="pw-num" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(r.amount * r._frac)} {r.currency}</p>
                </div>
              );
            })
          )}
        </WidgetCard>
      );
    }

    return null;
  }

  return (
    <div style={{ minHeight: "100dvh", paddingBottom: "6rem" }}>
      {commentsTx && (
        <CommentsModal title={commentsTx.description || t("tx_comments")} onClose={() => setCommentsTx(null)}>
          <TransactionComments txId={commentsTx.id} bare />
        </CommentsModal>
      )}
      {/* Header sticky : menu (mobile), titre, devise + Personnaliser. */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 30, background: "var(--bg)",
          padding: "1rem 1.25rem",
        }}
      >
        {(() => {
          const actions = (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {editMode ? (
                <button
                  onClick={() => setEditMode(false)}
                  style={{
                    background: "var(--ink)", color: "var(--bg)", border: "none",
                    borderRadius: "var(--radius-md)", padding: "5px 14px", fontSize: 13, fontWeight: 500,
                  }}
                >
                  {t("dashboard_done")}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                    style={{
                      height: 30, padding: "0 10px", borderRadius: "var(--radius-md)",
                      border: "0.5px solid var(--rule)", background: "var(--bg-card)",
                      fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {symbol} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => { setEditMode(true); setShowCurrencyPicker(false); }}
                    aria-label={t("dashboard_customize")}
                    style={{
                      width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
                      border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <i className="ti ti-pencil" style={{ fontSize: 14 }} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          );
          const title = <h1 style={{ fontSize: isDesktop ? 22 : 18, margin: 0, whiteSpace: "nowrap", fontFamily: "var(--font-display)", fontWeight: 600 }}>{t("nav_flux")}</h1>;
          if (isDesktop) {
            return (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {title}
                {actions}
              </div>
            );
          }
          return (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8 }}>
              <div style={{ justifySelf: "start" }}><HeaderMenuButton onClick={onOpenMenu} /></div>
              <div style={{ justifySelf: "center" }}>{title}</div>
              <div style={{ justifySelf: "end" }}>{actions}</div>
            </div>
          );
        })()}
        {!editMode && (
          <div style={{ marginTop: 12 }}>
            <PeriodSelector
              periodType={periodType}
              setPeriodType={setPeriodType}
              anchor={anchor}
              setAnchor={setAnchor}
              setAnchorNow={() => setAnchorRaw(new Date())}
              rangeLabel={range.label}
              customRange={customRange}
              setCustomRange={setCustomRange}
            />
          </div>
        )}
      </div>

      {showCurrencyPicker && !editMode && (
        <div style={{ margin: "0 1.25rem 14px", background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          <CurrencyPicker
            value={displayCurrency}
            onSelect={(code) => { updateDashboardDisplayCurrency(code); setShowCurrencyPicker(false); }}
          />
        </div>
      )}

      {editMode && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, marginBottom: 12, textAlign: "center" }}>
          {t("dashboard_edit_hint")}
        </p>
      )}

      <div style={{ padding: "0 1.25rem" }}>
        <WidgetCanvas
          widgets={widgets}
          onSave={saveWidgets}
          editMode={editMode}
          onEnterEditMode={() => setEditMode(true)}
          renderContent={renderFluxWidget}
          labels={fluxWidgetLabels}
          isDesktop={isDesktop}
          bento
        />
      </div>
    </div>
  );
}

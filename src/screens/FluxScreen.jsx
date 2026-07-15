import { useMemo, useState } from "react";
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
import IncomeExpenseTrendChart from "../components/IncomeExpenseTrendChart";

// Onglet Flux (« ce qui rentre, ce qui sort ») : cash flow du mois, charges
// fixes, dépenses par catégorie, détection d'abonnement, dernières transactions
// et récurrences à venir. Même UI que l'Accueil/Patrimoine : sur desktop, une
// grille bento personnalisable (glisser-déposer + afficher/masquer) ; sur mobile,
// empilement 1 colonne. Les listes renvoient aux écrans complets via les modales.
export default function FluxScreen({ onOpenMenu, onOpenTransactions, onOpenRecurring, onEditTransaction }) {
  const t = useTranslation();
  const {
    transactions,
    categories,
    recurringTx,
    defaultCurrency,
    dashboardDisplayCurrency,
    updateDashboardDisplayCurrency,
    language,
  } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(displayCurrency);
  const { monthlyTotal: fixedMonthly, count: fixedCount, items: fixedItems } = useFixedExpenses(displayCurrency);
  const { suggestion, accept, dismiss } = useSubscriptionSuggestion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { widgets, saveWidgets } = useFluxPrefs();

  const [fixedDetailOpen, setFixedDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const locale = language === "en" ? "en-US" : "fr-FR";
  const symbol = currencySymbol(displayCurrency);
  const fmt = (n) => Math.round(n).toLocaleString(locale);

  const toBase = (tx) => {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === displayCurrency) return tx.convertedAmount;
    return convert(tx.amount, tx.currency, displayCurrency);
  };

  const now = new Date();

  // Cash flow du mois en cours : entrées, sorties, net.
  const monthFlow = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      const d = new Date(tx.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
      if (tx.type === "income") income += toBase(tx);
      else if (tx.type === "expense") expense += toBase(tx);
    }
    return { income, expense, net: income - expense };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, displayCurrency, convert]);

  // Dépenses du mois par catégorie (même calcul que le widget du Dashboard).
  const categoryTotals = useMemo(() => {
    const result = {};
    for (const cat of categories) {
      if (cat.id === "income") continue;
      let total = 0;
      const subtotals = {};
      for (const tx of transactions) {
        const d = new Date(tx.date);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
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
  }, [transactions, categories, displayCurrency, convert]);
  const maxCatTotal = Math.max(1, ...Object.values(categoryTotals).map((c) => c.total));

  // Tendance 6 derniers mois (entrées vs sorties).
  const trend = useMemo(() => {
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString(locale, { month: "short" }),
        income: 0,
        expense: 0,
      });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const tx of transactions) {
      const d = new Date(tx.date);
      const b = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (!b) continue;
      if (tx.type === "income") b.income += toBase(tx);
      else if (tx.type === "expense") b.expense += toBase(tx);
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, displayCurrency, convert, locale]);

  const recentTx = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [transactions]
  );

  const upcoming = useMemo(
    () =>
      recurringTx
        .filter((r) => r.active !== false)
        .map((r) => ({ ...r, nextDate: nextOccurrence(r, now) }))
        .sort((a, b) => (a.nextDate?.getTime() ?? Infinity) - (b.nextDate?.getTime() ?? Infinity))
        .slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recurringTx]
  );

  const seeAll = (onClick) => (
    <button
      onClick={onClick}
      style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}
    >
      {t("dashboard_see_all")} <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
    </button>
  );

  const fluxWidgetLabels = {
    cashflow: t("flux_cashflow_title"),
    spending_by_category: t("dashboard_spending_by_category"),
    fixed: t("flux_fixed_title"),
    recent: t("flux_recent_title"),
    upcoming: t("flux_upcoming_title"),
    subscription: t("flux_subscription_title"),
  };

  // Contenu d'un widget Flux (null quand rien à montrer → placeholder en édition).
  function renderFluxWidget(id) {
    if (id === "cashflow") {
      return (
        <WidgetCard icon="ti-arrows-exchange" accent="sky" title={t("flux_cashflow_title")}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, background: "var(--sage-light)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{t("flux_in")}</p>
              <p className="pw-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--sage)" }}>{fmt(monthFlow.income)} {symbol}</p>
            </div>
            <div style={{ flex: 1, background: "var(--tang-light)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{t("flux_out")}</p>
              <p className="pw-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--tang)" }}>{fmt(monthFlow.expense)} {symbol}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{t("flux_net")}</span>
            <span className="pw-num" style={{ fontSize: 17, fontWeight: 700, color: monthFlow.net >= 0 ? "var(--sage)" : "var(--red)" }}>
              {monthFlow.net >= 0 ? "+" : "−"}{fmt(Math.abs(monthFlow.net))} {symbol}
            </span>
          </div>
          <IncomeExpenseTrendChart data={trend} currencySymbol={symbol} />
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
      return (
        <WidgetCard icon="ti-calendar-repeat" accent="amber" title={t("flux_fixed_title")}>
          <p className="pw-num" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "2px 0 6px" }}>
            {fmt(fixedMonthly)} {symbol}
          </p>
          <p style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45 }}>
            {fixedCount > 0
              ? t("flux_fixed_need").replace("{count}", fixedCount)
              : t("flux_fixed_empty")}
          </p>
          {monthFlow.income > 0 && fixedMonthly > 0 && (
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 8 }}>
              {t("flux_fixed_share").replace("{pct}", Math.round((fixedMonthly / monthFlow.income) * 100))}
            </p>
          )}
          {fixedCount > 0 && (
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
                  {fixedItems.map(({ rule, monthly }, i) => {
                    const cat = categories.find((c) => c.id === rule.categoryId);
                    return (
                      <div
                        key={rule.id}
                        onClick={() => onOpenRecurring?.(rule.id)}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i === fixedItems.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: "pointer" }}
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
      return (
        <WidgetCard icon="ti-repeat" accent="pink" title={t("flux_upcoming_title")} flush action={!editMode && seeAll(() => onOpenRecurring?.())}>
          {upcoming.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.25rem 0" }}>{t("widget_recurring_empty")}</p>
          ) : (
            upcoming.map((r, i) => {
              const cat = categories.find((c) => c.id === r.categoryId);
              const days = r.nextDate ? daysUntil(r.nextDate, now) : null;
              const soon = days != null && days >= 0 && days <= 3;
              return (
                <div
                  key={r.id}
                  onClick={() => onOpenRecurring?.(r.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i === upcoming.length - 1 ? "none" : "0.5px solid var(--rule)", cursor: "pointer" }}
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
                  <p className="pw-num" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(r.amount)} {r.currency}</p>
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

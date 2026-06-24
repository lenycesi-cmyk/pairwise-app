import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useDebtCalculation } from "../hooks/useDebtCalculation";
import CategoryRow from "../components/CategoryRow";
import DebtSummaryCard from "../components/DebtSummaryCard";
import { CURRENCIES } from "../data/categories";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default function DashboardScreen({ onOpenDebt, onOpenBreakdown }) {
  const { transactions, categories, members, defaultCurrency, loading } = useFinance();
  const { convert, loading: ratesLoading, error: ratesError } = useExchangeRates(defaultCurrency);

  const debt = useDebtCalculation(transactions, members, defaultCurrency, convert);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
  }

  const monthTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [transactions, viewMonth, viewYear]);

  function toBase(tx) {
    // Conversion figée à la création (nouvelle logique) : utilisée en priorité
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    // Fallback pour les transactions créées avant ce correctif (conversion dynamique)
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  const totals = useMemo(() => {
    let income = 0, expense = 0, invested = 0;
    for (const tx of monthTx) {
      const val = toBase(tx);
      if (tx.type === "income") income += val;
      else if (tx.type === "expense") expense += val;
      else if (tx.type === "investment") invested += val;
    }
    return { income, expense, invested, net: income - expense - invested };
  }, [monthTx]);

  const memberTotals = useMemo(() => {
    const result = {};
    for (const m of members) {
      result[m.uid] = { name: m.name, income: 0, expense: 0, invested: 0 };
    }
    for (const tx of monthTx) {
      const val = toBase(tx);
      const payers = tx.split === "50/50"
        ? members.map((m) => ({ uid: m.uid, share: 0.5 }))
        : [{ uid: tx.paidBy, share: 1 }];

      for (const p of payers) {
        if (!result[p.uid]) continue;
        const amt = val * p.share;
        if (tx.type === "income") result[p.uid].income += amt;
        else if (tx.type === "expense") result[p.uid].expense += amt;
        else if (tx.type === "investment") result[p.uid].invested += amt;
      }
    }
    return result;
  }, [monthTx, members]);

  const categoryTotals = useMemo(() => {
    const result = {};
    for (const cat of categories) {
      if (cat.id === "income") continue;
      let total = 0;
      const subtotals = {};
      for (const tx of monthTx) {
        if (tx.type === "expense" && tx.categoryId === cat.id) {
          const val = toBase(tx);
          total += val;
          subtotals[tx.subcategory] = (subtotals[tx.subcategory] || 0) + val;
        }
      }
      if (total > 0) result[cat.id] = { category: cat, total, subtotals };
    }
    return result;
  }, [monthTx, categories]);

  const maxCatTotal = Math.max(
    1,
    ...Object.values(categoryTotals).map((c) => c.total)
  );

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  const currencySymbol =
    CURRENCIES.find((c) => c.code === defaultCurrency)?.symbol || defaultCurrency;

  if (loading || ratesLoading) {
    return (
      <div style={{ padding: "2rem 1.5rem" }}>
        <div className="skeleton" style={{ height: 100, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => changeMonth(-1)}
          aria-label="Mois précédent"
          style={navBtnStyle}
        >
          <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
        <p style={{ fontSize: 15, fontWeight: 500 }}>
          {MONTHS[viewMonth]} {viewYear}
          {ratesError === "using_fallback_rates" && (
            <i
              className="ti ti-alert-triangle"
              title="Taux de change approximatifs (API indisponible)"
              style={{ fontSize: 12, color: "var(--amber)", marginLeft: 6 }}
              aria-label="Taux de change approximatifs"
            />
          )}
        </p>
        <button
          onClick={() => changeMonth(1)}
          aria-label="Mois suivant"
          style={navBtnStyle}
        >
          <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
        </button>
      </div>

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "1rem 1.25rem",
          marginBottom: 12,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 4 }}>
          Solde net
        </p>
        <p
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: totals.net >= 0 ? "var(--sage)" : "var(--tang)",
          }}
        >
          {totals.net >= 0 ? "+" : ""}
          {formatAmount(totals.net)} {currencySymbol}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <StatCard label="Revenus" value={`${formatAmount(totals.income)} ${currencySymbol}`} color="var(--sage)" />
        <StatCard label="Dépenses" value={`${formatAmount(totals.expense)} ${currencySymbol}`} color="var(--tang)" />
        <StatCard label="Investi" value={`${formatAmount(totals.invested)} ${currencySymbol}`} color="var(--lavi)" />
      </div>

      {members.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 500 }}>
              Résumé par membre
            </p>
            <button
              onClick={onOpenBreakdown}
              style={{
                background: "none", border: "none", color: "var(--sky)",
                fontSize: 12, display: "flex", alignItems: "center", gap: 3,
              }}
            >
              Détail
              <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {members.map((m) => {
              const mt = memberTotals[m.uid] || { income: 0, expense: 0, invested: 0 };
              return (
                <div
                  key={m.uid}
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-lg)",
                    border: "0.5px solid var(--rule)",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "var(--sky-light)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "var(--sky)",
                        flexShrink: 0,
                      }}
                    >
                      {m.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</p>
                  </div>
                  <MiniRow label="Revenus" value={mt.income} formatAmount={formatAmount} color="var(--sage)" symbol={currencySymbol} />
                  <MiniRow label="Dépenses" value={mt.expense} formatAmount={formatAmount} color="var(--tang)" symbol={currencySymbol} />
                  <MiniRow label="Investi" value={mt.invested} formatAmount={formatAmount} symbol={currencySymbol} />
                  <div style={{ borderTop: "0.5px solid var(--rule)", marginTop: 6, paddingTop: 6 }}>
                    <MiniRow
                      label="Solde"
                      value={mt.income - mt.expense - mt.invested}
                      formatAmount={formatAmount}
                      color={mt.income - mt.expense - mt.invested >= 0 ? "var(--sage)" : "var(--tang)"}
                      symbol={currencySymbol}
                      bold
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {debt && (
        <DebtSummaryCard debt={debt} defaultCurrency={defaultCurrency} onClick={onOpenDebt} />
      )}

      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
        Dépenses par catégorie
      </p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "0.5rem 1.25rem",
        }}
      >
        {Object.keys(categoryTotals).length === 0 ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-3)",
              textAlign: "center",
              padding: "1.5rem 0",
            }}
          >
            Aucune dépense ce mois-ci
          </p>
        ) : (
          Object.values(categoryTotals)
            .sort((a, b) => b.total - a.total)
            .map(({ category, total, subtotals }) => (
              <CategoryRow
                key={category.id}
                category={category}
                total={total}
                maxTotal={maxCatTotal}
                subtotals={subtotals}
                formatAmount={formatAmount}
                totalExpenses={totals.expense}
                currencySymbol={currencySymbol}
              />
            ))
        )}
      </div>
      {Object.keys(categoryTotals).length > 0 && (
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            textAlign: "center",
            marginTop: 10,
          }}
        >
          Touchez une catégorie pour voir le détail
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-md)",
        border: "0.5px solid var(--rule)",
        padding: "10px 8px",
      }}
    >
      <p style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 2 }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 500, color }}>{value}</p>
    </div>
  );
}

function MiniRow({ label, value, formatAmount, color = "var(--ink)", symbol = "", bold = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 4,
      }}
    >
      <span style={{ fontSize: bold ? 12 : 11, color: bold ? "var(--ink)" : "var(--ink-2)", fontWeight: bold ? 500 : 400 }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 700 : 500, color }}>
        {formatAmount(value)} {symbol}
      </span>
    </div>
  );
}

const navBtnStyle = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "var(--bg-card)",
  border: "0.5px solid var(--rule)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

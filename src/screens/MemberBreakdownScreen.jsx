import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { useCategoryName } from "../hooks/useCategoryName";
import { getMemberKey } from "../utils/members";

const COLOR_MAP = {
  tang: { text: "var(--tang)", bg: "var(--tang-light)" },
  sage: { text: "var(--sage)", bg: "var(--sage-light)" },
  lavi: { text: "var(--lavi)", bg: "var(--lavi-light)" },
  sky: { text: "var(--sky)", bg: "var(--sky-light)" },
  amber: { text: "var(--amber)", bg: "var(--amber-light)" },
  mint: { text: "var(--mint)", bg: "var(--mint-light)" },
  blush: { text: "var(--blush)", bg: "var(--blush-light)" },
};

export default function MemberBreakdownScreen({ onClose }) {
  const t = useTranslation();
  const { categories, members, transactions, defaultCurrency, dashboardDisplayCurrency } = useFinance();
  const displayCurrency = dashboardDisplayCurrency || defaultCurrency;
  const { convert } = useExchangeRates(displayCurrency);
  const { catName, subName: tSubName } = useCategoryName();
  const [selectedMember, setSelectedMember] = useState(members[0] ? getMemberKey(members[0]) : null);
  const [expandedCat, setExpandedCat] = useState(null);

  const now = new Date();
  const monthTx = useMemo(() => {
    return transactions.filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [transactions]);

  const currencySymbol = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === displayCurrency) return tx.convertedAmount;
    return convert(tx.amount, tx.currency, displayCurrency);
  }

  // Pour chaque catégorie/sous-catégorie, calcule la part du membre sélectionné
  const breakdown = useMemo(() => {
    const result = {};
    for (const cat of categories) {
      if (cat.id === "income") continue;
      let catTotal = 0;
      const subtotals = {};

      for (const tx of monthTx) {
        if (tx.type !== "expense" || tx.categoryId !== cat.id) continue;

        const val = toBase(tx);
        let share = 0;

        if (tx.split === "50/50") {
          share = val / 2;
        } else if (tx.split === selectedMember) {
          share = val;
        } else if (tx.paidBy === selectedMember && tx.split !== "50/50" && tx.split !== selectedMember) {
          // Le membre a payé mais pour quelqu'un d'autre : ne compte pas pour lui
          share = 0;
        }

        // Ne compter que si le membre sélectionné est concerné (payeur en 50/50, ou bénéficiaire)
        const isInvolved =
          tx.split === "50/50" ||
          tx.split === selectedMember ||
          tx.paidBy === selectedMember;

        if (!isInvolved) continue;

        if (tx.split === "50/50") {
          share = val / 2;
        } else if (tx.split === selectedMember) {
          share = val;
        } else {
          continue;
        }

        catTotal += share;
        subtotals[tx.subcategory] = (subtotals[tx.subcategory] || 0) + share;
      }

      if (catTotal > 0) {
        result[cat.id] = { category: cat, total: catTotal, subtotals };
      }
    }
    return result;
  }, [monthTx, categories, selectedMember]);

  const grandTotal = Object.values(breakdown).reduce((s, b) => s + b.total, 0);
  const maxCat = Math.max(1, ...Object.values(breakdown).map((b) => b.total));

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 100,
        overflowY: "auto",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none" }}>
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>{t("breakdown_title")}</h1>
          <div style={{ width: 20 }} />
        </div>

        {/* Sélecteur de membre */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {members.map((m) => (
            <button
              key={getMemberKey(m)}
              onClick={() => setSelectedMember(getMemberKey(m))}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: "var(--radius-md)",
                border: selectedMember === getMemberKey(m) ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                background: selectedMember === getMemberKey(m) ? "var(--sky-light)" : "var(--bg-card)",
                color: selectedMember === getMemberKey(m) ? "var(--sky)" : "var(--ink)",
                fontSize: 13,
                fontWeight: selectedMember === getMemberKey(m) ? 500 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 4 }}>
            {t("breakdown_total_spent")}
          </p>
          <p style={{ fontSize: 24, fontWeight: 500, color: "var(--tang)" }}>
            {formatAmount(grandTotal)} {currencySymbol}
          </p>
        </div>

        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("breakdown_by_category")}</p>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "0.5rem 1.25rem",
          }}
        >
          {Object.keys(breakdown).length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "1.5rem 0" }}>
              {t("breakdown_no_expenses")}
            </p>
          ) : (
            Object.values(breakdown)
              .sort((a, b) => b.total - a.total)
              .map(({ category, total, subtotals }) => {
                const colors = COLOR_MAP[category.color] || COLOR_MAP.tang;
                const barPct = Math.round((total / maxCat) * 100);
                const sharePct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
                const isExpanded = expandedCat === category.id;

                return (
                  <div key={category.id} style={{ borderBottom: "0.5px solid var(--rule)" }}>
                    <div
                      onClick={() => setExpandedCat(isExpanded ? null : category.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 0", cursor: "pointer",
                      }}
                    >
                      <i className={`ti ${category.icon}`} style={{ fontSize: 18, color: colors.text }} aria-hidden="true" />
                      <p style={{ fontSize: 13, flex: 1 }}>{catName(category)}</p>
                      <div style={{ width: 50, height: 5, background: "var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${barPct}%`, height: 5, background: colors.text }} />
                      </div>
                      <div style={{ textAlign: "right", minWidth: 78 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>
                          {formatAmount(total)} {currencySymbol}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--ink-3)" }}>{sharePct.toFixed(1)}%</p>
                      </div>
                      <i
                        className="ti ti-chevron-right"
                        style={{
                          fontSize: 14, color: "var(--ink-3)",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                        aria-hidden="true"
                      />
                    </div>

                    {isExpanded && (
                      <div style={{ padding: "0 0 10px 28px" }}>
                        {Object.entries(subtotals)
                          .sort((a, b) => b[1] - a[1])
                          .map(([subName, subTotal]) => (
                            <div
                              key={subName}
                              style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}
                            >
                              <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{tSubName(subName, category.id)}</span>
                              <span style={{ fontSize: 12, fontWeight: 500 }}>
                                {formatAmount(subTotal)} {currencySymbol}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

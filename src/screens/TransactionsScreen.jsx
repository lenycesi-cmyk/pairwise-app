import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { buildMemberColorMap, getInitial } from "../utils/memberColors";

const COLOR_MAP = {
  tang: { text: "var(--tang)", bg: "var(--tang-light)" },
  sage: { text: "var(--sage)", bg: "var(--sage-light)" },
  lavi: { text: "var(--lavi)", bg: "var(--lavi-light)" },
  sky: { text: "var(--sky)", bg: "var(--sky-light)" },
  amber: { text: "var(--amber)", bg: "var(--amber-light)" },
  mint: { text: "var(--mint)", bg: "var(--mint-light)" },
  blush: { text: "var(--blush)", bg: "var(--blush-light)" },
};

export default function TransactionsScreen({ onEdit }) {
  const { transactions, categories, members, deleteTransaction } = useFinance();
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");

  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((tx) => tx.paidBy === filter);
  }, [transactions, filter]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const tx of filtered) {
      const d = new Date(tx.date);
      const key = d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    }
    return groups;
  }, [filtered]);

  function getCategory(id) {
    return categories.find((c) => c.id === id) || categories[0];
  }

  function getMemberName(uid) {
    return members.find((m) => m.uid === uid)?.name || "?";
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Transactions</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Tout
        </FilterChip>
        {members.map((m) => (
          <FilterChip
            key={m.uid}
            active={filter === m.uid}
            onClick={() => setFilter(m.uid)}
          >
            {m.name}
          </FilterChip>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <p style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center", padding: "3rem 0" }}>
          Aucune transaction pour le moment
        </p>
      )}

      {Object.entries(grouped).map(([dateLabel, txs]) => (
        <div key={dateLabel} style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-3)",
              marginBottom: 8,
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            {dateLabel}
          </p>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--rule)",
              overflow: "hidden",
            }}
          >
            {txs.map((tx, i) => {
              const cat = getCategory(tx.categoryId);
              const colors = COLOR_MAP[cat.color] || COLOR_MAP.tang;
              const isLast = i === txs.length - 1;
              const isIncome = tx.type === "income";

              return (
                <div
                  key={tx.id}
                  onClick={() => onEdit(tx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderBottom: isLast ? "none" : "0.5px solid var(--rule)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      background: colors.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <i
                      className={`ti ${cat.icon}`}
                      style={{ fontSize: 16, color: colors.text }}
                      aria-hidden="true"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tx.description}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{tx.subcategory}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>·</span>
                      <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Payé par</span>
                      <InitialBadge member={members.find(m => m.uid === tx.paidBy)} colorMap={memberColorMap} />
                      {tx.split && (
                        <>
                          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· Pour</span>
                          {tx.split === "50/50" ? (
                            <span style={{ display: "flex", gap: 2 }}>
                              {members.map((m, i) => (
                                <span key={m.uid} style={{ display: "flex", alignItems: "center" }}>
                                  <InitialBadge member={m} colorMap={memberColorMap} />
                                  {i < members.length - 1 && (
                                    <span style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 2px" }}>&</span>
                                  )}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <InitialBadge member={members.find(m => m.uid === tx.split)} colorMap={memberColorMap} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: isIncome ? "var(--sage)" : "var(--ink)",
                      }}
                    >
                      {isIncome ? "+" : "−"}
                      {Math.round(tx.amount).toLocaleString("fr-FR")}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {tx.currency}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Supprimer cette transaction ?")) {
                        deleteTransaction(tx.id);
                      }
                    }}
                    aria-label="Supprimer"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-3)",
                      padding: 4,
                      flexShrink: 0,
                    }}
                  >
                    <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 99,
        border: active ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
        background: active ? "var(--sky-light)" : "var(--bg-card)",
        color: active ? "var(--sky)" : "var(--ink)",
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function InitialBadge({ member, colorMap }) {
  if (!member) return null;
  const color = colorMap[member.uid] || { text: "var(--ink-3)", bg: "var(--rule)" };
  return (
    <span
      title={member.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: color.bg,
        color: color.text,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {getInitial(member.name)}
    </span>
  );
}

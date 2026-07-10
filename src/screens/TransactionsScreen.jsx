import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { buildMemberColorMap } from "../utils/memberColors";
import Avatar from "../components/Avatar";
import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";
import { usedTags } from "../utils/tags";
import TagChip from "../components/TagChip";
import TransactionComments from "../components/TransactionComments";

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
  const t = useTranslation();
  const { transactions, categories, members, deleteTransaction, defaultCurrency } = useFinance();
  const [filter, setFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [tagFilter, setTagFilter] = useState(null);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [discussTxId, setDiscussTxId] = useState(null);
  // On lit la transaction "live" du contexte pour l'en-tête de la modale de
  // discussion (le composant lui-même relit aussi le fil en temps réel).
  const discussTx = discussTxId ? transactions.find((x) => x.id === discussTxId) : null;

  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);
  const allTags = useMemo(() => usedTags(transactions), [transactions]);

  const filtered = useMemo(() => {
    let result = transactions;
    if (filter !== "all") {
      result = result.filter((tx) => tx.paidBy === filter);
    }
    if (categoryFilter) {
      result = result.filter((tx) => tx.categoryId === categoryFilter);
    }
    if (tagFilter) {
      result = result.filter((tx) => (tx.tags || []).includes(tagFilter));
    }
    if (periodFilter !== "all") {
      const now = new Date();
      result = result.filter((tx) => {
        const d = new Date(tx.date);
        if (periodFilter === "week") {
          const c = new Date(now);
          c.setDate(now.getDate() - 7);
          return d >= c;
        }
        if (periodFilter === "month") {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        if (periodFilter === "3m") {
          const c = new Date(now);
          c.setMonth(now.getMonth() - 3);
          return d >= c;
        }
        if (periodFilter === "year") {
          return d.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }
    if (searchText.trim()) {
      // "#tag" cible les tags ; sinon on cherche dans description/sous-catégorie/tags.
      const raw = searchText.trim().toLowerCase();
      const q = raw.replace(/^#/, "");
      result = result.filter((tx) =>
        (tx.description || "").toLowerCase().includes(q) ||
        (tx.subcategory || "").toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.includes(q))
      );
    }
    return result;
  }, [transactions, filter, categoryFilter, tagFilter, periodFilter, searchText]);

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
    return members.find((m) => getMemberKey(m) === uid)?.name || "?";
  }

  function exportCSV() {
    const headers = [
      "date", "type", "category", "subcategory", "description",
      "amount", "currency", "convertedAmount", "defaultCurrency",
      "paidBy", "split",
    ];
    const rows = filtered.map((tx) => [
      new Date(tx.date).toISOString().slice(0, 10),
      tx.type,
      getCategory(tx.categoryId).name,
      tx.subcategory || "",
      tx.description || "",
      tx.amount,
      tx.currency,
      tx.convertedAmount ?? "",
      defaultCurrency,
      getMemberName(tx.paidBy),
      tx.split || "",
    ]);
    const escapeCell = (cell) => {
      const str = String(cell);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>{t("tx_list_title")}</h1>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: "var(--radius-md)",
            border: "0.5px solid var(--rule)",
            background: "var(--bg-card)",
            fontSize: 12,
            fontWeight: 500,
            opacity: filtered.length === 0 ? 0.5 : 1,
          }}
        >
          <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" />
          {t("tx_export")}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          background: "var(--bg-card)",
          border: "0.5px solid var(--rule)",
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
        }}
      >
        <i className="ti ti-search" style={{ fontSize: 15, color: "var(--ink-3)" }} aria-hidden="true" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t("tx_search_placeholder")}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 13,
            background: "transparent",
            color: "var(--ink)",
          }}
        />
        {searchText && (
          <i
            className="ti ti-x"
            style={{ fontSize: 14, color: "var(--ink-3)", cursor: "pointer" }}
            aria-hidden="true"
            onClick={() => setSearchText("")}
          />
        )}
        <button
          onClick={() => setShowCategoryFilter(!showCategoryFilter)}
          aria-label="Filtrer par catégorie"
          style={{
            background: categoryFilter ? "var(--sky-light)" : "none",
            border: "none",
            color: categoryFilter ? "var(--sky)" : "var(--ink-3)",
            padding: "2px 4px",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <i className="ti ti-filter" style={{ fontSize: 15 }} aria-hidden="true" />
        </button>
      </div>

      {showCategoryFilter && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 12,
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "0.75rem",
          }}
        >
          <FilterChip
            active={categoryFilter === null}
            onClick={() => { setCategoryFilter(null); setShowCategoryFilter(false); }}
          >
            {t("tx_filter_all_categories")}
          </FilterChip>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              active={categoryFilter === c.id}
              onClick={() => { setCategoryFilter(c.id); setShowCategoryFilter(false); }}
            >
              {c.name}
            </FilterChip>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          {t("tx_filter_all")}
        </FilterChip>
        {members.map((m) => (
          <FilterChip
            key={getMemberKey(m)}
            active={filter === getMemberKey(m)}
            onClick={() => setFilter(getMemberKey(m))}
          >
            {m.name}
          </FilterChip>
        ))}
      </div>

      {/* Filtre temporel */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {[
          { key: "all", label: t("tx_period_all") },
          { key: "week", label: t("tx_period_week") },
          { key: "month", label: t("tx_period_month") },
          { key: "3m", label: t("tx_period_3m") },
          { key: "year", label: t("tx_period_year") },
        ].map((p) => (
          <FilterChip key={p.key} active={periodFilter === p.key} onClick={() => setPeriodFilter(p.key)}>
            {p.label}
          </FilterChip>
        ))}
      </div>

      {/* Filtre par tag — n'apparaît que si des tags existent dans l'historique */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              style={{
                display: "flex", alignItems: "center", gap: 3, padding: "3px 9px",
                borderRadius: 99, border: "0.5px solid var(--rule)", background: "var(--bg-card)",
                color: "var(--ink-3)", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true" />
              {t("tx_filter_all")}
            </button>
          )}
          {allTags.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              active={tagFilter === tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            />
          ))}
        </div>
      )}

      {Object.keys(grouped).length === 0 && (
        <p style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center", padding: "3rem 0" }}>
          {t("tx_no_transactions")}
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
                  className="pw-chip-host"
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
                    className="pw-chip"
                    onClick={(e) => {
                      if (tx.receiptURL) {
                        e.stopPropagation();
                        setViewingReceipt(tx.receiptURL);
                      }
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--radius-md)",
                      background: colors.bg,
                      // Couleur pleine du chip au survol (voir .pw-chip-host)
                      "--pw-chip": colors.text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {tx.receiptURL ? (
                      <>
                        <img
                          src={tx.receiptURL}
                          alt="Reçu"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div
                          style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 14, height: 14, borderRadius: "50%",
                            background: "var(--ink)", display: "flex",
                            alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <i className="ti ti-receipt" style={{ fontSize: 8, color: "var(--bg)" }} aria-hidden="true" />
                        </div>
                      </>
                    ) : (
                      <i
                        className={`ti ${cat.icon}`}
                        style={{ fontSize: 16, color: colors.text }}
                        aria-hidden="true"
                      />
                    )}
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
                      <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("tx_paid_by")}</span>
                      <Avatar member={members.find(m => getMemberKey(m) === tx.paidBy)} colorMap={memberColorMap} />
                      {tx.split && (
                        <>
                          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· {t("tx_for")}</span>
                          {tx.splitDetails ? (
                            <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
                              {members.map((m, i) => (
                                <span key={getMemberKey(m)} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                  <Avatar member={m} colorMap={memberColorMap} />
                                  <span style={{ fontSize: 10, color: "var(--ink-3)" }}>
                                    {tx.splitDetails.unit === "percent"
                                      ? `${i === 0 ? tx.splitDetails.a : tx.splitDetails.b}%`
                                      : Math.round(i === 0 ? tx.splitDetails.a : tx.splitDetails.b).toLocaleString("fr-FR")}
                                  </span>
                                  {i < members.length - 1 && (
                                    <span style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 1px" }}>&</span>
                                  )}
                                </span>
                              ))}
                            </span>
                          ) : tx.split === "50/50" ? (
                            <span style={{ display: "flex", gap: 2 }}>
                              {members.map((m, i) => (
                                <span key={getMemberKey(m)} style={{ display: "flex", alignItems: "center" }}>
                                  <Avatar member={m} colorMap={memberColorMap} />
                                  {i < members.length - 1 && (
                                    <span style={{ fontSize: 11, color: "var(--ink-3)", margin: "0 2px" }}>&</span>
                                  )}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <Avatar member={members.find(m => getMemberKey(m) === tx.split)} colorMap={memberColorMap} />
                          )}
                        </>
                      )}
                    </div>
                    {tx.tags?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                        {tx.tags.map((tag) => (
                          <TagChip
                            key={tag}
                            tag={tag}
                            size="sm"
                            active={tagFilter === tag}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTagFilter(tagFilter === tag ? null : tag);
                            }}
                          />
                        ))}
                      </div>
                    )}
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
                    {tx.currency !== defaultCurrency && tx.convertedAmount !== undefined && (
                      <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>
                        ≈ {Math.round(tx.convertedAmount).toLocaleString("fr-FR")} {defaultCurrency}
                        {tx.exchangeRateIsFallback && (
                          <i
                            className="ti ti-alert-triangle"
                            title="Taux approximatif"
                            style={{ fontSize: 9, color: "var(--amber)", marginLeft: 3 }}
                            aria-label="Taux approximatif"
                          />
                        )}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
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
                      }}
                    >
                      <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
                    </button>
                    {/* Bulle de discussion : toujours visible sur chaque ligne pour
                        rendre la fonctionnalité facile à trouver (ouvre la
                        transaction, où le fil de discussion est en bas). */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDiscussTxId(tx.id); }}
                      aria-label={t("tx_comments")}
                      style={{
                        background: tx.comments?.length > 0 ? "var(--sky-light)" : "var(--bg)",
                        border: tx.comments?.length > 0 ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                        color: tx.comments?.length > 0 ? "var(--sky)" : "var(--ink-3)",
                        borderRadius: 99,
                        padding: "3px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <i className="ti ti-message-circle" style={{ fontSize: 14 }} aria-hidden="true" />
                      {tx.comments?.length > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 500 }}>{tx.comments.length}</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {viewingReceipt && (
        <div
          onClick={() => setViewingReceipt(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <img
            src={viewingReceipt}
            alt="Reçu agrandi"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "var(--radius-md)" }}
          />
          <button
            onClick={() => setViewingReceipt(null)}
            aria-label="Fermer"
            style={{
              position: "absolute", top: 24, right: 24,
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.15)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 18, color: "white" }} aria-hidden="true" />
          </button>
        </div>
      )}

      {discussTx && (
        <div
          onClick={() => setDiscussTxId(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "var(--app-shell-width)",
              maxHeight: "85vh", background: "var(--bg)",
              borderTopLeftRadius: "var(--radius-xl)", borderTopRightRadius: "var(--radius-xl)",
              display: "flex", flexDirection: "column",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
            }}
          >
            {/* En-tête : rappel de la transaction concernée + fermer */}
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "1rem 1.25rem", borderBottom: "0.5px solid var(--rule)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {discussTx.description}
                </p>
                <p style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {discussTx.type === "income" ? "+" : "−"}{Math.round(discussTx.amount).toLocaleString("fr-FR")} {discussTx.currency}
                </p>
              </div>
              <button
                onClick={() => setDiscussTxId(null)}
                aria-label={t("common_close")}
                style={{ background: "none", border: "none", display: "flex", flexShrink: 0 }}
              >
                <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem calc(1rem + env(safe-area-inset-bottom))" }}>
              <TransactionComments txId={discussTx.id} />
            </div>
          </div>
        </div>
      )}
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


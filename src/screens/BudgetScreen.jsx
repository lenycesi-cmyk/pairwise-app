import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import { useBudgetProgress } from "../hooks/useBudgetProgress";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { CURRENCIES } from "../data/categories";
import { BUDGET_GROUPS, BUDGET_GROUP_KEYS } from "../data/budgetGroups";

const EXPENSE_EXCLUDED = ["income", "investment", "savings"];
const GROUP_PCT = { essential: 0.5, fun: 0.3, investment: 0.2 };

function monthsAgoRange(n) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return start;
}

export default function BudgetScreen() {
  const t = useTranslation();
  const { catName } = useCategoryName();
  const { categories, transactions, budgets, addBudget, updateBudget, removeBudget, defaultCurrency, members } =
    useFinance();
  const { progress } = useBudgetProgress();
  const { convert } = useExchangeRates(defaultCurrency);

  const [showForm, setShowForm] = useState(false);
  const [quickMode, setQuickMode] = useState(null); // null | "5030" | "history" | "manual"
  const [editingId, setEditingId] = useState(null);
  const [scope, setScope] = useState("global");
  const [categoryIds, setCategoryIds] = useState([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [alertThreshold, setAlertThreshold] = useState("80");
  const [memberUid, setMemberUid] = useState("couple");

  const expenseCategories = categories.filter((c) => !EXPENSE_EXCLUDED.includes(c.id));

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  function resetForm() {
    setEditingId(null);
    setScope("global");
    setCategoryIds([]);
    setAmount("");
    setCurrency(defaultCurrency);
    setAlertThreshold("80");
    setMemberUid("couple");
  }

  function openNew() {
    resetForm();
    setQuickMode(null);
    setShowForm(true);
  }

  // Moyenne mensuelle des revenus sur les 3 derniers mois, pour préremplir
  // la règle 50/30/20 (50% essentiel / 30% plaisirs / 20% investissement).
  function average3MonthIncome() {
    const since = monthsAgoRange(3);
    const incomeTx = transactions.filter((tx) => tx.type === "income" && new Date(tx.date) >= since);
    const total = incomeTx.reduce((sum, tx) => sum + toBase(tx), 0);
    return total / 3;
  }

  // Moyenne mensuelle dépensée sur les 3 derniers mois pour un ensemble de
  // catégories données, pour la suggestion "basée sur l'historique".
  function average3MonthSpend(ids) {
    const since = monthsAgoRange(3);
    const expenseTx = transactions.filter(
      (tx) => tx.type === "expense" && new Date(tx.date) >= since && (ids.length === 0 || ids.includes(tx.categoryId))
    );
    const total = expenseTx.reduce((sum, tx) => sum + toBase(tx), 0);
    return total / 3;
  }

  async function applyFiftyThirtyTwenty() {
    const avgIncome = average3MonthIncome();
    for (const key of BUDGET_GROUP_KEYS) {
      const ids = BUDGET_GROUPS[key].filter((id) => categories.some((c) => c.id === id));
      if (ids.length === 0) continue;
      await addBudget({
        scope: "category",
        categoryIds: ids,
        amount: Math.round(avgIncome * GROUP_PCT[key]),
        currency: defaultCurrency,
        alertThreshold: 80,
        memberUid: "couple",
      });
    }
    setShowForm(false);
    setQuickMode(null);
    resetForm();
  }

  function chooseHistoryCategories() {
    const avg = average3MonthSpend(categoryIds);
    setAmount(avg > 0 ? Math.round(avg).toString() : "");
    setCurrency(defaultCurrency);
    setQuickMode("manual");
  }

  function openEdit(b) {
    setEditingId(b.id);
    setScope(b.scope);
    setCategoryIds(b.categoryIds || []);
    setAmount(b.amount.toString());
    setCurrency(b.currency);
    setAlertThreshold((b.alertThreshold ?? 80).toString());
    setMemberUid(b.memberUid || "couple");
    setQuickMode("manual");
    setShowForm(true);
  }

  function toggleCategory(id) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!amount || (scope === "category" && categoryIds.length === 0)) return;

    const payload = {
      scope,
      categoryIds: scope === "global" ? [] : categoryIds,
      amount: parseFloat(amount),
      currency,
      alertThreshold: parseInt(alertThreshold) || 80,
      memberUid,
    };

    if (editingId) {
      await updateBudget(editingId, payload);
    } else {
      await addBudget(payload);
    }

    setShowForm(false);
    setQuickMode(null);
    resetForm();
  }

  async function toggleActive(b) {
    await updateBudget(b.id, { active: b.active === false ? true : false });
  }

  function categoryNames(b) {
    if (b.scope === "global") return t("budget_scope_global");
    return b.categoryIds
      .map((id) => {
        const c = categories.find((c) => c.id === id);
        return c ? catName(c) : null;
      })
      .filter(Boolean)
      .join(", ");
  }

  function memberLabel(b) {
    if (!b.memberUid || b.memberUid === "couple") return t("budget_for_couple");
    return members.find((m) => m.uid === b.memberUid)?.name || t("budget_for_couple");
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, marginLeft: 44, flex: 1 }}>
          {showForm
            ? editingId
              ? t("budget_edit_title")
              : quickMode === null
                ? t("budget_new_title")
                : quickMode === "history"
                  ? t("budget_quick_history")
                  : t("budget_new_title")
            : t("budget_title")}
        </h1>
        {!showForm && (
          <button onClick={openNew} aria-label={t("common_add")} style={{ background: "none", border: "none" }}>
            <i className="ti ti-plus" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        )}
        {showForm && (
          <button
            onClick={() => { setShowForm(false); setQuickMode(null); resetForm(); }}
            aria-label={t("common_close")}
            style={{ background: "none", border: "none" }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        )}
      </div>

      {showForm && quickMode === null && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1.25rem",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <button
            onClick={applyFiftyThirtyTwenty}
            style={{
              textAlign: "left",
              padding: 14,
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500 }}>{t("budget_quick_5030")}</p>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{t("budget_quick_5030_hint")}</p>
          </button>
          <button
            onClick={() => { resetForm(); setScope("category"); setQuickMode("history"); }}
            style={{
              textAlign: "left",
              padding: 14,
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500 }}>{t("budget_quick_history")}</p>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{t("budget_quick_history_hint")}</p>
          </button>
          <button
            onClick={() => { resetForm(); setQuickMode("manual"); }}
            style={{
              textAlign: "left",
              padding: 14,
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              background: "var(--bg)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500 }}>{t("budget_quick_manual")}</p>
          </button>
        </div>
      )}

      {showForm && quickMode === "history" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1.25rem",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
            {t("budget_choose_categories")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {expenseCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-md)",
                  border: categoryIds.includes(c.id) ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                  background: categoryIds.includes(c.id) ? "var(--sky-light)" : "var(--bg)",
                  color: categoryIds.includes(c.id) ? "var(--sky)" : "var(--ink)",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <i className={`ti ${c.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                {catName(c)}
              </button>
            ))}
          </div>
          <button
            onClick={chooseHistoryCategories}
            disabled={categoryIds.length === 0}
            style={{
              width: "100%",
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: 14,
              fontSize: 14,
              fontWeight: 500,
              opacity: categoryIds.length === 0 ? 0.5 : 1,
            }}
          >
            {t("budget_quick_history_next")}
          </button>
        </div>
      )}

      {showForm && quickMode === "manual" && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1.25rem",
            marginBottom: 16,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_scope")}</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { key: "global", label: t("budget_scope_global") },
              { key: "category", label: t("budget_scope_category") },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: "var(--radius-md)",
                  border: "0.5px solid var(--rule)",
                  background: scope === s.key ? "var(--tang-light)" : "var(--bg)",
                  color: scope === s.key ? "var(--tang)" : "var(--ink)",
                  fontSize: 12,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {members.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_for")}</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <button
                  onClick={() => setMemberUid("couple")}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: "var(--radius-md)",
                    border: memberUid === "couple" ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: memberUid === "couple" ? "var(--sky-light)" : "var(--bg)",
                    color: memberUid === "couple" ? "var(--sky)" : "var(--ink)",
                    fontSize: 12,
                  }}
                >
                  {t("budget_for_couple")}
                </button>
                {members.map((m) => (
                  <button
                    key={m.uid}
                    onClick={() => setMemberUid(m.uid)}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: "var(--radius-md)",
                      border: memberUid === m.uid ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                      background: memberUid === m.uid ? "var(--sky-light)" : "var(--bg)",
                      color: memberUid === m.uid ? "var(--sky)" : "var(--ink)",
                      fontSize: 12,
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {scope === "category" && (
            <>
              <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                {t("budget_choose_categories")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {expenseCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCategory(c.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "var(--radius-md)",
                      border: categoryIds.includes(c.id) ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                      background: categoryIds.includes(c.id) ? "var(--sky-light)" : "var(--bg)",
                      color: categoryIds.includes(c.id) ? "var(--sky)" : "var(--ink)",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <i className={`ti ${c.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                    {catName(c)}
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input
              type="number"
              inputMode="decimal"
              placeholder={t("budget_amount_placeholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                fontSize: 16,
                outline: "none",
              }}
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                padding: "10px 8px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                fontSize: 13,
                background: "var(--bg-card)",
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
            {t("budget_alert_threshold")}
          </p>
          <input
            type="number"
            min="1"
            max="100"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              fontSize: 14,
              marginBottom: 14,
              outline: "none",
            }}
          />

          <button
            onClick={handleSave}
            disabled={!amount || (scope === "category" && categoryIds.length === 0)}
            style={{
              width: "100%",
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: 14,
              fontSize: 14,
              fontWeight: 500,
              opacity: !amount || (scope === "category" && categoryIds.length === 0) ? 0.5 : 1,
            }}
          >
            {editingId ? t("budget_update_button") : t("budget_create_button")}
          </button>
        </div>
      )}

      {budgets.length === 0 && !showForm && (
        <p style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center", padding: "3rem 0" }}>
          {t("budget_empty")}
          <br />
          {t("budget_empty_hint")}
        </p>
      )}

      {!showForm && progress.map(({ budget, spent, amountInBase, pct }) => {
        const isInactive = budget.active === false;
        const over = pct >= 100;
        const warn = pct >= (budget.alertThreshold ?? 80);
        const barColor = over ? "var(--red)" : warn ? "var(--amber)" : "var(--sky)";
        return (
          <div
            key={budget.id}
            onClick={() => openEdit(budget)}
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--rule)",
              padding: "12px 14px",
              marginBottom: 8,
              cursor: "pointer",
              opacity: isInactive ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14 }}>
                  {categoryNames(budget)}
                  {members.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--sky)", marginLeft: 6 }}>· {memberLabel(budget)}</span>
                  )}
                </p>
                <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {Math.round(spent).toLocaleString("fr-FR")} / {Math.round(amountInBase).toLocaleString("fr-FR")} {defaultCurrency}
                </p>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: barColor }}>
                {Math.round(pct)}%
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive(budget); }}
                aria-label={isInactive ? t("recurring_resume") : t("recurring_pause")}
                style={{ background: "none", border: "none", color: "var(--ink-3)" }}
              >
                <i className={`ti ${isInactive ? "ti-player-play" : "ti-player-pause"}`} style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeBudget(budget.id); }}
                aria-label={t("common_delete")}
                style={{ background: "none", border: "none", color: "var(--ink-3)" }}
              >
                <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "var(--rule)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(pct, 100)}%`,
                  background: barColor,
                  borderRadius: 3,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

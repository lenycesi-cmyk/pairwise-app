import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useBudgetProgress } from "../hooks/useBudgetProgress";
import { CURRENCIES } from "../data/categories";

const EXPENSE_EXCLUDED = ["income", "investment", "savings"];

export default function BudgetScreen() {
  const t = useTranslation();
  const { categories, budgets, addBudget, updateBudget, removeBudget, defaultCurrency } = useFinance();
  const { progress } = useBudgetProgress();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [scope, setScope] = useState("global");
  const [categoryIds, setCategoryIds] = useState([]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [alertThreshold, setAlertThreshold] = useState("80");

  const expenseCategories = categories.filter((c) => !EXPENSE_EXCLUDED.includes(c.id));

  function resetForm() {
    setEditingId(null);
    setScope("global");
    setCategoryIds([]);
    setAmount("");
    setCurrency(defaultCurrency);
    setAlertThreshold("80");
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(b) {
    setEditingId(b.id);
    setScope(b.scope);
    setCategoryIds(b.categoryIds || []);
    setAmount(b.amount.toString());
    setCurrency(b.currency);
    setAlertThreshold((b.alertThreshold ?? 80).toString());
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
    };

    if (editingId) {
      await updateBudget(editingId, payload);
    } else {
      await addBudget(payload);
    }

    setShowForm(false);
    resetForm();
  }

  async function toggleActive(b) {
    await updateBudget(b.id, { active: b.active === false ? true : false });
  }

  function categoryNames(b) {
    if (b.scope === "global") return t("budget_scope_global");
    return b.categoryIds
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, marginLeft: 44, flex: 1 }}>
          {showForm ? (editingId ? t("budget_edit_title") : t("budget_new_title")) : t("budget_title")}
        </h1>
        {!showForm && (
          <button onClick={openNew} aria-label={t("common_add")} style={{ background: "none", border: "none" }}>
            <i className="ti ti-plus" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        )}
        {showForm && (
          <button
            onClick={() => { setShowForm(false); resetForm(); }}
            aria-label={t("common_close")}
            style={{ background: "none", border: "none" }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
        )}
      </div>

      {showForm && (
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
                    {c.name}
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
                <p style={{ fontSize: 14 }}>{categoryNames(budget)}</p>
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

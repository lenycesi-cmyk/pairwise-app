import { useState, useEffect, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import { useBudgetProgress } from "../hooks/useBudgetProgress";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { CURRENCIES } from "../data/categories";
import { BUDGET_GROUPS, BUDGET_GROUP_KEYS } from "../data/budgetGroups";
import SpotlightHint from "../components/SpotlightHint";
import { getMemberKey } from "../utils/members";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useBudgetPrefs } from "../hooks/useDashboardPrefs";
import WidgetCanvas from "../components/WidgetCanvas";
import CurrencyPicker from "../components/CurrencyPicker";
import WidgetCard from "../components/WidgetCard";
import TagChip from "../components/TagChip";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import { splitTag } from "../utils/tags";

const EXPENSE_EXCLUDED = ["income", "investment", "savings"];
const GROUP_PCT = { essential: 0.5, fun: 0.3, investment: 0.2 };

function monthsAgoRange(n) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return start;
}

export default function BudgetScreen({ openSignal }) {
  const t = useTranslation();
  const { catName, subName } = useCategoryName();
  const { categories, transactions, budgets, addBudget, updateBudget, removeBudget, defaultCurrency, members, coupleName,
    customTags, budgetDisplayCurrency, updateBudgetDisplayCurrency } =
    useFinance();
  const displayCurrency = budgetDisplayCurrency || defaultCurrency;
  const { progress } = useBudgetProgress(undefined, undefined, displayCurrency);
  const coupleLabel = coupleName || t("budget_for_couple");
  const { convert } = useExchangeRates(defaultCurrency);
  // Liste de tags disponibles pour un budget "tag" : personnalisés du couple,
  // sinon les tags suggérés par défaut (même source que le TagManager).
  const availableTags = customTags.length > 0 ? customTags : SUGGESTED_TAGS.map((s) => s.key);

  const [showForm, setShowForm] = useState(false);
  const addButtonRef = useRef(null);
  const [quickMode, setQuickMode] = useState(null); // null | "5030" | "history" | "manual"
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState("monthly");
  // Map of selected categoryId -> array of currently-included subcategory
  // names. Selecting a category includes ALL its subcategories by default;
  // the subcategory refine UI (shown only for selected categories) lets the
  // user narrow that down. A category with every subcategory checked is
  // saved as a full categoryId; a narrowed one is saved as subcategoryKeys.
  const [categorySelection, setCategorySelection] = useState({});
  const [tagSelection, setTagSelection] = useState([]);
  const [expandedCatId, setExpandedCatId] = useState(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [alertThreshold, setAlertThreshold] = useState("80");
  const [memberUid, setMemberUid] = useState("couple");
  const [editMode, setEditMode] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const currencyButtonRef = useRef(null);
  const { widgets, saveWidgets } = useBudgetPrefs();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const expenseCategories = categories.filter((c) => !EXPENSE_EXCLUDED.includes(c.id));

  function toBase(tx) {
    if (tx.convertedAmount !== undefined && tx.convertedCurrency === defaultCurrency) {
      return tx.convertedAmount;
    }
    return convert(tx.amount, tx.currency, defaultCurrency);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setScope("global");
    setPeriod("monthly");
    setCategorySelection({});
    setTagSelection([]);
    setExpandedCatId(null);
    setAmount("");
    setCurrency(defaultCurrency);
    setAlertThreshold("80");
    setMemberUid("couple");
  }

  function openNew() {
    setEditMode(false);
    resetForm();
    setQuickMode(null);
    setShowForm(true);
  }

  // Central "+" button on the Budget tab (App.jsx) bumps openSignal to open
  // the new-budget form from anywhere, without this screen needing to know
  // about the bottom nav.
  useEffect(() => {
    if (openSignal) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

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
        period: "monthly",
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
    const avg = average3MonthSpend(Object.keys(categorySelection));
    setAmount(avg > 0 ? Math.round(avg).toString() : "");
    setCurrency(defaultCurrency);
    setQuickMode("manual");
  }

  function openEdit(b) {
    setEditingId(b.id);
    setName(b.name || "");
    setScope(b.scope);
    setPeriod(b.period || "monthly");
    const selection = {};
    for (const catId of b.categoryIds || []) {
      const cat = categories.find((c) => c.id === catId);
      if (cat) selection[catId] = [...cat.subcategories];
    }
    for (const key of b.subcategoryKeys || []) {
      const [catId, sub] = key.split("::");
      if (!selection[catId]) selection[catId] = [];
      if (!selection[catId].includes(sub)) selection[catId].push(sub);
    }
    setCategorySelection(selection);
    setTagSelection(b.tagKeys || []);
    setAmount(b.amount.toString());
    setCurrency(b.currency);
    setAlertThreshold((b.alertThreshold ?? 80).toString());
    setMemberUid(b.memberUid || "couple");
    setQuickMode("manual");
    setShowForm(true);
  }

  // Toggling a category chip selects/deselects it entirely (all subcategories
  // included by default). Refining to specific subcategories only happens via
  // toggleSubcategory, and is only offered for categories already selected here.
  function toggleCategory(id) {
    setCategorySelection((prev) => {
      if (prev[id]) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      const cat = categories.find((c) => c.id === id);
      return { ...prev, [id]: cat ? [...cat.subcategories] : [] };
    });
    setExpandedCatId((prev) => (prev === id ? null : prev));
  }

  function toggleTag(tag) {
    setTagSelection((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  }

  function toggleSubcategory(catId, subcategoryName) {
    setCategorySelection((prev) => {
      const current = prev[catId] || [];
      const updated = current.includes(subcategoryName)
        ? current.filter((s) => s !== subcategoryName)
        : [...current, subcategoryName];
      // Unchecking the last remaining subcategory drops the category entirely.
      if (updated.length === 0) {
        const { [catId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [catId]: updated };
    });
  }

  async function handleSave() {
    const selectedCatIds = Object.keys(categorySelection);
    if (!amount) return;
    if (scope === "category" && selectedCatIds.length === 0) return;
    if (scope === "tag" && tagSelection.length === 0) return;

    const categoryIds = [];
    const subcategoryKeys = [];
    for (const catId of selectedCatIds) {
      const cat = categories.find((c) => c.id === catId);
      const subs = categorySelection[catId];
      if (cat && subs.length === cat.subcategories.length) {
        categoryIds.push(catId);
      } else {
        for (const s of subs) subcategoryKeys.push(`${catId}::${s}`);
      }
    }

    const payload = {
      name: name.trim() || null,
      scope,
      period,
      categoryIds: scope === "category" ? categoryIds : [],
      subcategoryKeys: scope === "category" ? subcategoryKeys : [],
      tagKeys: scope === "tag" ? tagSelection : [],
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
    if (b.scope === "tag") {
      return (b.tagKeys || [])
        .map((tag) => {
          const { emoji, text } = splitTag(tag);
          return emoji ? `${emoji} ${text}` : `#${text}`;
        })
        .join(", ") || t("budget_scope_tag");
    }
    const catPart = (b.categoryIds || [])
      .map((id) => {
        const c = categories.find((c) => c.id === id);
        return c ? catName(c) : null;
      })
      .filter(Boolean);
    const subPart = (b.subcategoryKeys || []).map((key) => {
      const [catId, sub] = key.split("::");
      return subName(sub, catId);
    });
    return [...catPart, ...subPart].join(", ") || t("budget_scope_category");
  }

  function budgetLabel(b) {
    return b.name || categoryNames(b);
  }

  function memberLabel(b) {
    if (!b.memberUid || b.memberUid === "couple") return coupleLabel;
    return members.find((m) => getMemberKey(m) === b.memberUid)?.name || coupleLabel;
  }

  // Contenu d'un widget de l'onglet Budget pour WidgetCanvas (renvoie null
  // quand il n'y a rien à montrer → placeholder en mode édition).
  function renderBudgetWidget(id) {
    if (progress.length === 0) return null;

    if (id === "overview") {
      const active = progress.filter(({ budget }) => budget.active !== false);
      const totalBudget = active.reduce((s, p) => s + p.amountInBase, 0);
      const totalSpent = active.reduce((s, p) => s + p.spent, 0);
      const overCount = active.filter((p) => p.pct >= 100).length;
      const pct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      const barColor = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--amber)" : "var(--sky)";
      return (
        <WidgetCard icon="ti-gauge" accent="amber" title={t("budget_widget_overview")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span className="pw-num" style={{ fontSize: 22 }}>
              {Math.round(totalSpent).toLocaleString("fr-FR")}
              <span style={{ fontSize: 13, color: "var(--ink-3)", fontWeight: 400 }}> / {Math.round(totalBudget).toLocaleString("fr-FR")} {displayCurrency}</span>
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: barColor }}>{Math.round(pct)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 3 }} />
          </div>
          <p style={{ fontSize: 11, color: overCount > 0 ? "var(--red)" : "var(--ink-3)", marginTop: 6 }}>
            {overCount > 0
              ? t("budget_overview_over").replace("{n}", overCount)
              : t("budget_overview_ok").replace("{n}", active.length)}
          </p>
        </WidgetCard>
      );
    }

    if (id === "list") {
      return (
        <div>
          {progress.map(({ budget, spent, amountInBase, pct, projected, projectedOver }) => {
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
                      {budgetLabel(budget)}
                      {members.length > 0 && (
                        <span style={{ fontSize: 11, color: "var(--sky)", marginLeft: 6 }}>· {memberLabel(budget)}</span>
                      )}
                    </p>
                    {budget.name && (
                      <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{categoryNames(budget)}</p>
                    )}
                    <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {Math.round(spent).toLocaleString("fr-FR")} / {Math.round(amountInBase).toLocaleString("fr-FR")} {displayCurrency}
                      {budget.period === "yearly" && ` · ${t("budget_period_yearly")}`}
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
                <div style={{ height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 3 }} />
                </div>
                {!isInactive && projected !== null && pct < 100 && (
                  <p style={{ fontSize: 11, color: projectedOver ? "var(--amber)" : "var(--ink-3)", marginTop: 6 }}>
                    {t("budget_projection").replace("{amount}", `${Math.round(projected).toLocaleString("fr-FR")} ${displayCurrency}`)}
                    {projectedOver &&
                      ` (${t("budget_projection_over").replace("{over}", `${Math.round(projected - amountInBase).toLocaleString("fr-FR")} ${displayCurrency}`)})`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "0.4rem 1.25rem", marginBottom: 8, display: "flex", alignItems: "center" }}>
        <h1 style={{ fontSize: 20, marginLeft: isDesktop ? 0 : 44, flex: 1 }}>
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
        {!showForm && editMode && (
          <button
            onClick={() => setEditMode(false)}
            style={{
              background: "var(--ink)", color: "var(--bg)", border: "none",
              borderRadius: "var(--radius-md)", padding: "5px 14px", fontSize: 13, fontWeight: 500,
            }}
          >
            {t("dashboard_done")}
          </button>
        )}
        {!showForm && !editMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              ref={currencyButtonRef}
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              style={{
                padding: "4px 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                background: "var(--bg-card)", fontSize: 12, fontWeight: 500,
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
            </button>
            <button
              onClick={() => setEditMode(true)}
              aria-label={t("dashboard_customize")}
              style={{
                width: 30, height: 30, borderRadius: "50%", background: "var(--bg-card)",
                border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <i className="ti ti-pencil" style={{ fontSize: 14 }} aria-hidden="true" />
            </button>
            <button ref={addButtonRef} onClick={openNew} aria-label={t("common_add")} style={{ background: "none", border: "none" }}>
              <i className="ti ti-plus" style={{ fontSize: 20 }} aria-hidden="true" />
            </button>
          </div>
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

      {!showForm && <SpotlightHint tabKey="budget" targetRef={addButtonRef} text={t("hint_budget")} />}

      {!showForm && showCurrencyPicker && (
        <div style={{ marginBottom: 12, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          <CurrencyPicker
            value={displayCurrency}
            onSelect={(code) => { updateBudgetDisplayCurrency(code); setShowCurrencyPicker(false); }}
          />
        </div>
      )}

      {showForm && quickMode === null && (
        <div
          className="pw-card"
          data-accent="amber"
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
                  border: categorySelection[c.id] ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                  background: categorySelection[c.id] ? "var(--sky-light)" : "var(--bg)",
                  color: categorySelection[c.id] ? "var(--sky)" : "var(--ink)",
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
            disabled={Object.keys(categorySelection).length === 0}
            style={{
              width: "100%",
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: 14,
              fontSize: 14,
              fontWeight: 500,
              opacity: Object.keys(categorySelection).length === 0 ? 0.5 : 1,
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
          <input
            type="text"
            placeholder={t("budget_name_placeholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)",
              fontSize: 14,
              marginBottom: 12,
              outline: "none",
            }}
          />

          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_scope")}</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { key: "global", label: t("budget_scope_global") },
              { key: "category", label: t("budget_scope_category") },
              { key: "tag", label: t("budget_scope_tag") },
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

          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_period")}</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { key: "monthly", label: t("budget_period_monthly") },
              { key: "yearly", label: t("budget_period_yearly") },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: "var(--radius-md)",
                  border: "0.5px solid var(--rule)",
                  background: period === p.key ? "var(--lavi-light)" : "var(--bg)",
                  color: period === p.key ? "var(--lavi)" : "var(--ink)",
                  fontSize: 12,
                }}
              >
                {p.label}
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
                  {coupleLabel}
                </button>
                {members.map((m) => (
                  <button
                    key={getMemberKey(m)}
                    onClick={() => setMemberUid(getMemberKey(m))}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: "var(--radius-md)",
                      border: memberUid === getMemberKey(m) ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                      background: memberUid === getMemberKey(m) ? "var(--sky-light)" : "var(--bg)",
                      color: memberUid === getMemberKey(m) ? "var(--sky)" : "var(--ink)",
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
                      border: categorySelection[c.id] ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                      background: categorySelection[c.id] ? "var(--sky-light)" : "var(--bg)",
                      color: categorySelection[c.id] ? "var(--sky)" : "var(--ink)",
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

              {/* Refine to specific subcategories — only offered for categories
                  already selected above; every subcategory is included by
                  default until the user narrows it down here. */}
              {Object.keys(categorySelection).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {expenseCategories
                    .filter((c) => categorySelection[c.id])
                    .map((c) => {
                      const isExpanded = expandedCatId === c.id;
                      const selectedSubs = categorySelection[c.id] || [];
                      const isFull = selectedSubs.length === c.subcategories.length;
                      return (
                        <div key={c.id} style={{ borderBottom: "0.5px solid var(--rule)" }}>
                          <button
                            onClick={() => setExpandedCatId(isExpanded ? null : c.id)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 0",
                              background: "none",
                              border: "none",
                              textAlign: "left",
                            }}
                          >
                            <i className={`ti ${c.icon}`} style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
                            <span style={{ fontSize: 13, flex: 1 }}>{catName(c)}</span>
                            <span style={{ fontSize: 11, color: isFull ? "var(--ink-3)" : "var(--sky)" }}>
                              {isFull ? t("budget_all_subcategories") : `${selectedSubs.length}/${c.subcategories.length}`}
                            </span>
                            <i
                              className="ti ti-chevron-right"
                              style={{
                                fontSize: 13,
                                color: "var(--ink-3)",
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                transition: "transform 0.15s",
                              }}
                              aria-hidden="true"
                            />
                          </button>
                          {isExpanded && (
                            <div style={{ padding: "0 0 10px 22px" }}>
                              <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>
                                {t("budget_refine_hint")}
                              </p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {c.subcategories.map((s) => {
                                  const picked = selectedSubs.includes(s);
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => toggleSubcategory(c.id, s)}
                                      style={{
                                        padding: "5px 9px",
                                        borderRadius: "var(--radius-md)",
                                        border: picked ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                                        background: picked ? "var(--sky-light)" : "var(--bg)",
                                        color: picked ? "var(--sky)" : "var(--ink)",
                                        fontSize: 11,
                                      }}
                                    >
                                      {subName(s, c.id)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}

          {scope === "tag" && (
            <>
              <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                {t("budget_choose_tags")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {availableTags.map((tag) => (
                  <div key={tag} onClick={() => toggleTag(tag)} style={{ cursor: "pointer" }}>
                    <TagChip tag={tag} active={tagSelection.includes(tag)} />
                  </div>
                ))}
                {availableTags.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("budget_no_tags")}</p>
                )}
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
            disabled={!amount || (scope === "category" && Object.keys(categorySelection).length === 0) || (scope === "tag" && tagSelection.length === 0)}
            style={{
              width: "100%",
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: 14,
              fontSize: 14,
              fontWeight: 500,
              opacity: !amount || (scope === "category" && Object.keys(categorySelection).length === 0) || (scope === "tag" && tagSelection.length === 0) ? 0.5 : 1,
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

      {!showForm && editMode && budgets.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, marginBottom: 12, textAlign: "center" }}>
          {t("dashboard_edit_hint")}
        </p>
      )}

      {!showForm && budgets.length > 0 && (
        <WidgetCanvas
          widgets={widgets}
          onSave={saveWidgets}
          editMode={editMode}
          onEnterEditMode={() => setEditMode(true)}
          renderContent={renderBudgetWidget}
          labels={{ overview: t("budget_widget_overview"), list: t("budget_widget_list") }}
          isDesktop={isDesktop}
        />
      )}
    </div>
  );
}

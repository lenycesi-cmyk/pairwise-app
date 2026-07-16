import { useState, useEffect, useRef, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import { useBudgetProgress } from "../hooks/useBudgetProgress";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { CURRENCIES, ALL_CURRENCIES } from "../data/categories";
import { BUDGET_GROUPS, BUDGET_GROUP_KEYS } from "../data/budgetGroups";
import GreetingHeader from "../components/GreetingHeader";
import HeaderMenuButton from "../components/HeaderMenuButton";
import { getMemberKey } from "../utils/members";
import ScopeFilter from "../components/ScopeFilter";
import { AVATAR_COLOR_PALETTE } from "../utils/memberColors";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useBudgetLayout } from "../hooks/useDashboardPrefs";
import WidgetCanvas from "../components/WidgetCanvas";
import CurrencyPicker from "../components/CurrencyPicker";
import WidgetCard from "../components/WidgetCard";
import TagChip from "../components/TagChip";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import BudgetCard from "../components/BudgetCard";
import { budgetLevel } from "../utils/budgetStatus";

const EXPENSE_EXCLUDED = ["income", "investment", "savings"];
const GROUP_PCT = { essential: 0.5, fun: 0.3, investment: 0.2 };

function monthsAgoRange(n) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - n, 1);
  return start;
}

export default function BudgetScreen({ openSignal, onOpenMenu }) {
  const t = useTranslation();
  const { catName, subName } = useCategoryName();
  const { categories, transactions, budgets, addBudget, updateBudget, removeBudget, defaultCurrency, members, coupleName,
    customTags, budgetDisplayCurrency, updateBudgetDisplayCurrency,
    enabledCurrencies, updateEnabledCurrencies, language } =
    useFinance();

  const displayCurrency = budgetDisplayCurrency || defaultCurrency;
  const { progress: allProgress } = useBudgetProgress(undefined, undefined, displayCurrency);

  // « Un budget = un widget » : la disposition (ordre + afficher/masquer) est
  // gérée par WidgetCanvas via une liste [overview, ...budgets] propre à chaque
  // utilisateur. On dérive l'ensemble des budgets MASQUÉS pour la vue d'ensemble.
  const budgetIds = useMemo(() => allProgress.map((p) => p.budget.id), [allProgress]);
  const { widgets, saveWidgets } = useBudgetLayout(budgetIds);
  const hiddenIds = useMemo(
    () => new Set(widgets.filter((w) => w.id !== "overview" && !w.visible).map((w) => w.id)),
    [widgets]
  );
  const visibleProgress = useMemo(() => allProgress.filter((p) => !hiddenIds.has(p.budget.id)), [allProgress, hiddenIds]);
  const budgetById = useMemo(() => new Map(allProgress.map((p) => [p.budget.id, p])), [allProgress]);
  const canvasLabels = useMemo(() => {
    const m = { overview: t("budget_widget_overview") };
    for (const p of allProgress) {
      m[p.budget.id] = p.budget.name
        || (p.budget.scope === "global" ? t("budget_scope_global")
          : p.budget.scope === "tag" ? t("budget_scope_tag")
          : t("budget_scope_category"));
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProgress, language]);
  const coupleLabel = coupleName || t("budget_for_couple");
  const { convert } = useExchangeRates(defaultCurrency);
  // Liste de tags disponibles pour un budget "tag" : personnalisés du couple,
  // sinon les tags suggérés par défaut (même source que le TagManager).
  const availableTags = customTags.length > 0 ? customTags : SUGGESTED_TAGS.map((s) => s.key);

  const [overviewScope, setOverviewScope] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [quickMode, setQuickMode] = useState(null); // null | "5030" | "history" | "manual"
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("global");
  const [period, setPeriod] = useState("monthly");
  const [anchorDay, setAnchorDay] = useState("1");     // mois ancré (1 = mois civil)
  const [rollingDays, setRollingDays] = useState("30"); // fenêtre glissante
  const [startDate, setStartDate] = useState("");       // enveloppe d'événement
  const [endDate, setEndDate] = useState("");
  const [rollover, setRollover] = useState(false);      // report du reliquat (YNAB)
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
  const [color, setColor] = useState("amber");
  // Sélecteur de devise du formulaire (inline, calqué sur AddTransaction) —
  // distinct du sélecteur de devise d'affichage de l'en-tête (showCurrencyPicker).
  const [showFormCurrency, setShowFormCurrency] = useState(false);
  const [manageCurrencies, setManageCurrencies] = useState(false);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("80");
  const [memberUid, setMemberUid] = useState("couple");
  const [editMode, setEditMode] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const currencyButtonRef = useRef(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const expenseCategories = categories.filter((c) => !EXPENSE_EXCLUDED.includes(c.id));

  // ── Devise du budget : même sélecteur inline que la création de transaction
  // (liste blanche du couple + gestion/ajout avec recherche), au lieu du
  // <select> natif qui ouvrait le menu déroulant du système.
  const currencyList =
    enabledCurrencies && enabledCurrencies.length > 0
      ? ALL_CURRENCIES.filter(
          (c) => enabledCurrencies.includes(c.code) || c.code === currency || c.code === defaultCurrency
        )
      : CURRENCIES;
  const offeredCurrencies =
    enabledCurrencies && enabledCurrencies.length > 0
      ? ALL_CURRENCIES.filter((c) => enabledCurrencies.includes(c.code))
      : CURRENCIES;
  const currencyQuery = currencySearch.trim().toLowerCase();
  const addableCurrencies = ALL_CURRENCIES.filter(
    (c) =>
      !offeredCurrencies.some((o) => o.code === c.code) &&
      (currencyQuery === "" ||
        c.code.toLowerCase().includes(currencyQuery) ||
        c.name.toLowerCase().includes(currencyQuery))
  );
  function toggleEnabledCurrency(code) {
    const current =
      enabledCurrencies && enabledCurrencies.length > 0 ? enabledCurrencies : CURRENCIES.map((c) => c.code);
    let next = current.includes(code) ? current.filter((x) => x !== code) : [...current, code];
    if (next.length === 0) next = [defaultCurrency];
    updateEnabledCurrencies(next);
  }

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
    setAnchorDay("1");
    setRollingDays("30");
    setStartDate("");
    setEndDate("");
    setRollover(false);
    setCategorySelection({});
    setTagSelection([]);
    setExpandedCatId(null);
    setAmount("");
    setCurrency(defaultCurrency);
    setColor("amber");
    setShowFormCurrency(false);
    setManageCurrencies(false);
    setAddingCurrency(false);
    setCurrencySearch("");
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
    setAnchorDay((b.anchorDay || 1).toString());
    setRollingDays((b.rollingDays || 30).toString());
    setStartDate(b.startDate ? b.startDate.slice(0, 10) : "");
    setEndDate(b.endDate ? b.endDate.slice(0, 10) : "");
    setRollover(!!b.rollover);
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
    setColor(b.color || "amber");
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

    // Champs spécifiques à la fréquence (null quand non pertinent pour ne pas
    // laisser trainer d'anciennes valeurs après changement de type).
    if (period === "event" && (!startDate || !endDate)) return;

    const payload = {
      name: name.trim() || null,
      scope,
      period,
      anchorDay: period === "monthly" ? Math.min(Math.max(parseInt(anchorDay) || 1, 1), 28) : null,
      rollingDays: period === "rolling" ? Math.max(parseInt(rollingDays) || 30, 1) : null,
      startDate: period === "event" ? new Date(startDate).toISOString() : null,
      endDate: period === "event" ? new Date(endDate + "T23:59:59").toISOString() : null,
      // Report du reliquat : sans objet pour les fenêtres glissantes et les
      // enveloppes d'événement (pas de période qui se répète).
      rollover: period === "rolling" || period === "event" ? false : rollover,
      categoryIds: scope === "category" ? categoryIds : [],
      subcategoryKeys: scope === "category" ? subcategoryKeys : [],
      tagKeys: scope === "tag" ? tagSelection : [],
      amount: parseFloat(amount),
      currency,
      color,
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

  const locale = language === "en" ? "en-US" : "fr-FR";
  const money = (n) => `${Math.round(n).toLocaleString(locale)} ${displayCurrency}`;

  // Contenu d'un widget de l'onglet Budget pour WidgetCanvas (renvoie null
  // quand il n'y a rien à montrer → placeholder en mode édition).
  function renderBudgetWidget(id) {
    if (allProgress.length === 0) return null;

    if (id === "overview") {
      const active = visibleProgress.filter(({ budget }) => budget.active !== false);
      const spentOf = (p) => (overviewScope === null ? p.spent : (p.spentByMember?.[overviewScope] ?? 0));
      const totalBudget = active.reduce((s, p) => s + p.effectiveAmount, 0);
      const totalSpent = active.reduce((s, p) => s + spentOf(p), 0);
      const remaining = totalBudget - totalSpent;
      const calmCount = active.filter((p) => budgetLevel(p) === "good").length;
      const watchCount = active.length - calmCount;
      const pct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      // Barre agrégée : verte tant que le couple est globalement sous contrôle,
      // ambre/rouge sinon (statut sémantique, jamais la couleur de marque).
      const barColor = pct >= 100 ? "var(--red)" : watchCount > calmCount ? "var(--amber)" : "var(--sage)";
      return (
        <WidgetCard icon="ti-gauge" accent="amber" noBar title={t("budget_widget_overview")}>
          {members.length > 1 && (
            <ScopeFilter members={members} scope={overviewScope} onChange={setOverviewScope} />
          )}
          {/* Héros : on mène avec le RESTE (plus rassurant et actionnable que
              le dépensé), pas avec la fraction consommée. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {remaining < 0 && <span style={{ fontSize: 12.5, color: "var(--red)" }}>{t("budget_over_by")}</span>}
            <span className="pw-num" style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em", color: remaining >= 0 ? "var(--ink)" : "var(--red)" }}>
              {money(Math.abs(remaining))}
            </span>
            {remaining >= 0 && <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{t("budget_available")}</span>}
          </div>
          <p className="pw-num" style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, marginBottom: 10 }}>
            {t("budget_spent_of").replace("{spent}", money(totalSpent)).replace("{limit}", money(totalBudget))}
          </p>
          <div style={{ height: 8, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 99, transition: "width .4s ease" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 11, fontSize: 12.5 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--sage)" }} />
              {t("budget_count_calm").replace("{n}", calmCount)}
            </span>
            {watchCount > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--amber)" }} />
                {t("budget_count_watch").replace("{n}", watchCount)}
              </span>
            )}
          </div>
        </WidgetCard>
      );
    }

    // « Un budget = un widget » : chaque id de budget rend UNE carte. WidgetCanvas
    // gère la réorganisation (glisser-déposer) et l'afficher/masquer par widget ;
    // en édition il neutralise les interactions internes de la carte.
    const p = budgetById.get(id);
    if (!p) return null;
    return (
      <BudgetCard
        p={p}
        displayCurrency={displayCurrency}
        onEdit={openEdit}
        onToggleActive={toggleActive}
        onDelete={removeBudget}
      />
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "0.4rem 1.25rem", marginBottom: 8 }}>
        {showForm ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <h1 style={{ fontSize: 20, marginLeft: 0, flex: 1 }}>
              {editingId
                ? t("budget_edit_title")
                : quickMode === null
                  ? t("budget_new_title")
                  : quickMode === "history"
                    ? t("budget_quick_history")
                    : t("budget_new_title")}
            </h1>
            <button
              onClick={() => { setShowForm(false); setQuickMode(null); resetForm(); }}
              aria-label={t("common_close")}
              style={{ background: "none", border: "none" }}
            >
              <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
            </button>
          </div>
        ) : (() => {
          const actions = editMode ? (
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                ref={currencyButtonRef}
                onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                style={{
                  height: 30, padding: "0 10px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                  background: "var(--bg-card)", fontSize: 12, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                {ALL_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
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
            </div>
          );
          const greeting = <GreetingHeader subtitleKey="budget_subtitle" marginLeft={0} />;
          if (isDesktop) {
            return (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {greeting}
                {actions}
              </div>
            );
          }
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ justifySelf: "start" }}><HeaderMenuButton onClick={onOpenMenu} /></div>
                <div style={{ justifySelf: "end" }}>{actions}</div>
              </div>
              {greeting}
            </>
          );
        })()}
      </div>

      {!showForm && showCurrencyPicker && (
        <div style={{ marginBottom: 12, background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", padding: "0.75rem 1rem" }}>
          <CurrencyPicker
            value={displayCurrency}
            onSelect={(code) => { updateBudgetDisplayCurrency(code); setShowCurrencyPicker(false); }}
          />
        </div>
      )}

      <div style={{ maxWidth: isDesktop ? 560 : "none", margin: "0 auto" }}>
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
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_name_label")}</p>
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

          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_color")}</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {AVATAR_COLOR_PALETTE.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.key)}
                aria-label={c.key}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: c.bg,
                  border: color === c.key ? `2.5px solid ${c.text}` : "2px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {color === c.key && <i className="ti ti-check" style={{ fontSize: 14, color: c.text }} aria-hidden="true" />}
              </button>
            ))}
          </div>

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {[
              { key: "monthly", label: t("budget_period_monthly") },
              { key: "weekly", label: t("budget_period_weekly") },
              { key: "quarterly", label: t("budget_period_quarterly") },
              { key: "yearly", label: t("budget_period_yearly") },
              { key: "rolling", label: t("budget_period_rolling") },
              { key: "event", label: t("budget_period_event") },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                style={{
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

          {/* Champs spécifiques à la fréquence */}
          {period === "monthly" && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_anchor_day")}</p>
              <input
                type="number" min="1" max="28" inputMode="numeric"
                value={anchorDay}
                onChange={(e) => setAnchorDay(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", fontSize: 14, outline: "none" }}
              />
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{t("budget_anchor_hint")}</p>
            </div>
          )}
          {period === "rolling" && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_rolling_days")}</p>
              <input
                type="number" min="1" max="365" inputMode="numeric"
                value={rollingDays}
                onChange={(e) => setRollingDays(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", fontSize: 14, outline: "none" }}
              />
              <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{t("budget_rolling_hint")}</p>
            </div>
          )}
          {period === "event" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_event_start")}</p>
                <input
                  type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", fontSize: 14, outline: "none", color: "var(--ink)", background: "var(--bg)" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_event_end")}</p>
                <input
                  type="date" value={endDate} min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", fontSize: 14, outline: "none", color: "var(--ink)", background: "var(--bg)" }}
                />
              </div>
            </div>
          )}

          {/* Report du reliquat (YNAB) — pertinent uniquement pour les périodes
              qui se répètent (ni glissant, ni événement). */}
          {period !== "rolling" && period !== "event" && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: 13 }}>{t("budget_rollover")}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{t("budget_rollover_hint")}</span>
              </span>
            </label>
          )}

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

          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("budget_amount_label")}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            <button
              type="button"
              onClick={() => { setShowFormCurrency(!showFormCurrency); setManageCurrencies(false); setAddingCurrency(false); setCurrencySearch(""); }}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                background: "var(--bg)",
                fontSize: 13,
                fontWeight: 500,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {currency} <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
            </button>
          </div>

          {showFormCurrency && !manageCurrencies && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {currencyList.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { setCurrency(c.code); setShowFormCurrency(false); }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    border: currency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: currency === c.code ? "var(--sky-light)" : "var(--bg)",
                    color: currency === c.code ? "var(--sky)" : "var(--ink)",
                    fontSize: 12,
                  }}
                >
                  {c.code}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setManageCurrencies(true)}
                style={{
                  padding: "6px 10px", borderRadius: "var(--radius-md)", border: "0.5px dashed var(--rule)",
                  background: "var(--bg)", color: "var(--ink-3)", fontSize: 12,
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <i className="ti ti-adjustments" style={{ fontSize: 13 }} aria-hidden="true" />
                {t("tx_manage_currencies")}
              </button>
            </div>
          )}

          {showFormCurrency && manageCurrencies && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8, textAlign: "center" }}>
                {t("tx_manage_currencies_hint")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {offeredCurrencies.map((c) => {
                  const isDefault = c.code === defaultCurrency;
                  return (
                    <div
                      key={c.code}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                        padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg)",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>{c.symbol} {c.code} · {c.name}</span>
                      {isDefault ? (
                        <span style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>{t("tx_currency_default")}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleEnabledCurrency(c.code)}
                          aria-label={t("common_delete")}
                          style={{ background: "none", border: "none", color: "var(--ink-3)", display: "flex", alignItems: "center", flexShrink: 0 }}
                        >
                          <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {!addingCurrency ? (
                <button
                  type="button"
                  onClick={() => { setAddingCurrency(true); setCurrencySearch(""); }}
                  style={{
                    marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px dashed var(--sky)",
                    background: "var(--bg)", color: "var(--sky)", fontSize: 13, fontWeight: 500,
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                  {t("tx_add_currency")}
                </button>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <input
                      autoFocus
                      type="text"
                      value={currencySearch}
                      onChange={(e) => setCurrencySearch(e.target.value)}
                      placeholder={t("tx_search_currency")}
                      style={{ flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", fontSize: 13, outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => { setAddingCurrency(false); setCurrencySearch(""); }}
                      aria-label={t("common_cancel")}
                      style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg)", color: "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                    {addableCurrencies.map((c) => (
                      <button
                        type="button"
                        key={c.code}
                        onClick={() => { toggleEnabledCurrency(c.code); setCurrency(c.code); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", background: "var(--bg)", cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>{c.symbol} {c.code} · {c.name}</span>
                        <i className="ti ti-plus" style={{ fontSize: 14, color: "var(--sky)" }} aria-hidden="true" />
                      </button>
                    ))}
                    {addableCurrencies.length === 0 && (
                      <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>{t("tx_no_currency_found")}</p>
                    )}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => { setManageCurrencies(false); setAddingCurrency(false); setCurrencySearch(""); }}
                  style={{ background: "var(--ink)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-md)", padding: "6px 16px", fontSize: 13, fontWeight: 500 }}
                >
                  {t("dashboard_done")}
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "14px 0 6px" }}>
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
      </div>

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
          labels={canvasLabels}
          isDesktop={isDesktop}
          heroGrid
        />
      )}
    </div>
  );
}

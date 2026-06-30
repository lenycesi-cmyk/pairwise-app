import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES } from "../data/categories";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";

function getFrequencies(t) {
  return [
    { key: "monthly", label: t("recurring_freq_monthly") },
    { key: "weekly", label: t("recurring_freq_weekly") },
    { key: "yearly", label: t("recurring_freq_yearly") },
  ];
}

export default function RecurringScreen({ onClose }) {
  const t = useTranslation();
  const { catName, subName: tSubName } = useCategoryName();
  const FREQUENCIES = getFrequencies(t);
  const { categories, members, recurringTx, addRecurring, updateRecurring, removeRecurring, defaultCurrency } =
    useFinance();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [categoryId, setCategoryId] = useState(null);
  const [subcategory, setSubcategory] = useState(null);
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [paidBy, setPaidBy] = useState(user?.uid);
  const [split, setSplit] = useState("50/50");

  const availableCategories = categories.filter((c) =>
    type === "income" ? c.id === "income" :
    type === "investment" ? (c.id === "investment" || c.id === "savings") :
    c.id !== "income" && c.id !== "investment" && c.id !== "savings"
  );
  const selectedCategory = categories.find((c) => c.id === categoryId);
  // Income et Investment ont aussi besoin d'une attribution membre (à qui le
  // revenu / l'investissement récurrent est rattaché), comme dans AddTransactionScreen.
  const needsMemberAttribution = type === "income" || type === "investment";

  function getCategory(id) {
    return categories.find((c) => c.id === id) || categories[0];
  }

  function resetForm() {
    setEditingId(null);
    setType("expense");
    setAmount("");
    setCurrency(defaultCurrency);
    setCategoryId(null);
    setSubcategory(null);
    setDescription("");
    setFrequency("monthly");
    setDayOfMonth("1");
    setPaidBy(user?.uid);
    setSplit("50/50");
  }

  function openEdit(r) {
    setEditingId(r.id);
    setType(r.type);
    setAmount(r.amount.toString());
    setCurrency(r.currency);
    setCategoryId(r.categoryId);
    setSubcategory(r.subcategory);
    setDescription(r.description || "");
    setFrequency(r.frequency);
    setDayOfMonth((r.dayOfMonth || 1).toString());
    setPaidBy(r.paidBy);
    setSplit(r.split);
    setShowForm(true);
  }

  function openNew() {
    resetForm();
    setShowForm(true);
  }

  async function handleSave() {
    if (!amount || !categoryId) return;

    const payload = {
      type,
      amount: parseFloat(amount),
      currency,
      categoryId,
      subcategory,
      description: description || selectedCategory?.name,
      frequency,
      dayOfMonth: parseInt(dayOfMonth),
      paidBy: type === "expense" || needsMemberAttribution ? paidBy : user.uid,
      split: type === "expense" || needsMemberAttribution ? split : "100",
    };

    if (editingId) {
      // On modifie uniquement la règle (le "modèle"). Les transactions déjà
      // générées pour les mois passés/en cours restent inchangées, car elles
      // sont des copies indépendantes dans la collection transactions —
      // seules les FUTURES générations utiliseront les nouvelles valeurs.
      await updateRecurring(editingId, payload);
    } else {
      await addRecurring({ ...payload, active: true, lastGenerated: null });
    }

    setShowForm(false);
    resetForm();
  }

  async function toggleActive(r) {
    await updateRecurring(r.id, { active: r.active === false ? true : false });
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
          <button
            onClick={() => { if (showForm) { setShowForm(false); resetForm(); } else onClose(); }}
            aria-label="Fermer"
            style={{ background: "none", border: "none" }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>
            {showForm ? (editingId ? t("recurring_edit_title") : t("recurring_new_title")) : t("recurring_title")}
          </h1>
          {!showForm && (
            <button onClick={openNew} aria-label="Ajouter" style={{ background: "none", border: "none" }}>
              <i className="ti ti-plus" style={{ fontSize: 20 }} aria-hidden="true" />
            </button>
          )}
          {showForm && <div style={{ width: 20 }} />}
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
            {editingId && (
              <div
                style={{
                  background: "var(--amber-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 10px",
                  marginBottom: 12,
                  fontSize: 11,
                  color: "var(--amber)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                }}
              >
                <i className="ti ti-info-circle" style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                {t("recurring_edit_warning")}
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { key: "expense", label: t("tx_expense") },
                { key: "income", label: t("tx_income") },
                { key: "investment", label: t("tx_investment") },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setType(t.key); setCategoryId(null); }}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)",
                    background: type === t.key ? "var(--tang-light)" : "var(--bg)",
                    color: type === t.key ? "var(--tang)" : "var(--ink)",
                    fontSize: 12,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder={t("recurring_amount_placeholder")}
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

            <select
              value={categoryId || ""}
              onChange={(e) => {
                setCategoryId(e.target.value);
                const cat = categories.find((c) => c.id === e.target.value);
                setSubcategory(cat?.subcategories[0] || null);
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                fontSize: 14,
                marginBottom: 10,
                background: "var(--bg-card)",
              }}
            >
              <option value="">{t("recurring_choose_category")}</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>{catName(c)}</option>
              ))}
            </select>

            {selectedCategory && (
              <select
                value={subcategory || ""}
                onChange={(e) => setSubcategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "0.5px solid var(--rule)",
                  fontSize: 14,
                  marginBottom: 10,
                  background: "var(--bg-card)",
                }}
              >
                {selectedCategory.subcategories.map((s) => (
                  <option key={s} value={s}>{tSubName(s, selectedCategory.id)}</option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder={t("recurring_description_placeholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                fontSize: 14,
                marginBottom: 10,
                outline: "none",
              }}
            />

            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("recurring_frequency")}</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {FREQUENCIES.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFrequency(f.key)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: "var(--radius-md)",
                    border: frequency === f.key ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
                    background: frequency === f.key ? "var(--lavi-light)" : "var(--bg)",
                    color: frequency === f.key ? "var(--lavi)" : "var(--ink)",
                    fontSize: 12,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {frequency === "monthly" && (
              <>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                  {t("recurring_day_of_month")}
                </p>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)",
                    fontSize: 14,
                    marginBottom: 10,
                    outline: "none",
                  }}
                />
              </>
            )}

            {(type === "expense" || needsMemberAttribution) && members.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                  {needsMemberAttribution ? t("tx_received_by") : t("recurring_who_pays")}
                </p>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {members.map((m) => (
                    <button
                      key={m.uid}
                      onClick={() => setPaidBy(m.uid)}
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: "var(--radius-md)",
                        border: paidBy === m.uid ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                        background: paidBy === m.uid ? "var(--sky-light)" : "var(--bg)",
                        fontSize: 12,
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
                  {needsMemberAttribution ? t("tx_for") : t("recurring_split")}
                </p>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {members.map((m) => (
                    <button
                      key={m.uid}
                      onClick={() => setSplit(m.uid)}
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: "var(--radius-md)",
                        border: split === m.uid ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                        background: split === m.uid ? "var(--sky-light)" : "var(--bg)",
                        fontSize: 12,
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setSplit("50/50")}
                    style={{
                      flex: 1,
                      padding: 8,
                      borderRadius: "var(--radius-md)",
                      border: split === "50/50" ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                      background: split === "50/50" ? "var(--sky-light)" : "var(--bg)",
                      fontSize: 12,
                    }}
                  >
                    50/50
                  </button>
                </div>
              </>
            )}

            <button
              onClick={handleSave}
              disabled={!amount || !categoryId}
              style={{
                width: "100%",
                background: "var(--ink)",
                color: "var(--bg)",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: 14,
                fontSize: 14,
                fontWeight: 500,
                opacity: !amount || !categoryId ? 0.5 : 1,
              }}
            >
              {editingId ? t("recurring_update_button") : t("recurring_create_button")}
            </button>
          </div>
        )}

        {recurringTx.length === 0 && !showForm && (
          <p style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center", padding: "3rem 0" }}>
            {t("recurring_empty")}
            <br />
            {t("recurring_empty_hint")}
          </p>
        )}

        {!showForm && recurringTx.map((r) => {
          const cat = getCategory(r.categoryId);
          const freqLabel = FREQUENCIES.find((f) => f.key === r.frequency)?.label || r.frequency;
          const isInactive = r.active === false;
          return (
            <div
              key={r.id}
              onClick={() => openEdit(r)}
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "0.5px solid var(--rule)",
                padding: "12px 14px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                opacity: isInactive ? 0.5 : 1,
              }}
            >
              <i className={`ti ${cat.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14 }}>{r.description}</p>
                <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {freqLabel}
                  {r.frequency === "monthly" ? ` · le ${r.dayOfMonth}` : ""}
                  {isInactive ? ` · ${t("recurring_paused")}` : ""}
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>
                {Math.round(r.amount).toLocaleString("fr-FR")} {r.currency}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive(r); }}
                aria-label={isInactive ? t("recurring_resume") : t("recurring_pause")}
                style={{ background: "none", border: "none", color: "var(--ink-3)" }}
              >
                <i className={`ti ${isInactive ? "ti-player-play" : "ti-player-pause"}`} style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeRecurring(r.id); }}
                aria-label="Supprimer"
                style={{ background: "none", border: "none", color: "var(--ink-3)" }}
              >
                <i className="ti ti-trash" style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

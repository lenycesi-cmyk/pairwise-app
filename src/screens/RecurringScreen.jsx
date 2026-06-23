import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES } from "../data/categories";

const FREQUENCIES = [
  { key: "monthly", label: "Mensuel" },
  { key: "weekly", label: "Hebdomadaire" },
  { key: "yearly", label: "Annuel" },
];

export default function RecurringScreen({ onClose }) {
  const { categories, members, recurringTx, addRecurring, removeRecurring, defaultCurrency } =
    useFinance();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);

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
    type === "investment" ? c.id === "investment" :
    c.id !== "income" && c.id !== "investment"
  );
  const selectedCategory = categories.find((c) => c.id === categoryId);

  function getCategory(id) {
    return categories.find((c) => c.id === id) || categories[0];
  }

  async function handleAdd() {
    if (!amount || !categoryId) return;
    await addRecurring({
      type,
      amount: parseFloat(amount),
      currency,
      categoryId,
      subcategory,
      description: description || selectedCategory?.name,
      frequency,
      dayOfMonth: parseInt(dayOfMonth),
      paidBy: type === "expense" ? paidBy : user.uid,
      split: type === "expense" ? split : "100",
      active: true,
      lastGenerated: null,
    });
    setShowForm(false);
    setAmount("");
    setCategoryId(null);
    setDescription("");
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
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>Récurrentes</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            aria-label="Ajouter"
            style={{ background: "none", border: "none" }}
          >
            <i className="ti ti-plus" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
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
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[
                { key: "expense", label: "Dépense" },
                { key: "income", label: "Revenu" },
                { key: "investment", label: "Invest." },
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
                placeholder="Montant"
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
              <option value="">Choisir une catégorie</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            <input
              type="text"
              placeholder="Description (ex: Loyer)"
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

            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>Fréquence</p>
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
                  Jour du mois
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

            {type === "expense" && members.length > 0 && (
              <>
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>Qui paie</p>
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
                <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>Partage</p>
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
              onClick={handleAdd}
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
              Créer la récurrence
            </button>
          </div>
        )}

        {recurringTx.length === 0 && !showForm && (
          <p style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center", padding: "3rem 0" }}>
            Aucune transaction récurrente.
            <br />
            Ajoutez votre loyer, vos investissements programmés...
          </p>
        )}

        {recurringTx.map((r) => {
          const cat = getCategory(r.categoryId);
          const freqLabel = FREQUENCIES.find((f) => f.key === r.frequency)?.label || r.frequency;
          return (
            <div
              key={r.id}
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "0.5px solid var(--rule)",
                padding: "12px 14px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <i className={`ti ${cat.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14 }}>{r.description}</p>
                <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {freqLabel}
                  {r.frequency === "monthly" ? ` · le ${r.dayOfMonth}` : ""}
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>
                {Math.round(r.amount).toLocaleString("fr-FR")} {r.currency}
              </p>
              <button
                onClick={() => removeRecurring(r.id)}
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

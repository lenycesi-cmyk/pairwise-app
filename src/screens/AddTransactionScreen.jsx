import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES } from "../data/categories";

export default function AddTransactionScreen({ onClose, editingTx }) {
  const {
    categories,
    members,
    addTransaction,
    updateTransaction,
    defaultCurrency,
    currencyMode,
    lastUsedCurrency,
  } = useFinance();
  const { user } = useAuth();

  const isEditing = !!editingTx;
  const initialCurrency = isEditing
    ? editingTx.currency
    : currencyMode === "last"
    ? lastUsedCurrency
    : defaultCurrency;

  const [type, setType] = useState(editingTx?.type || "expense");
  const [amount, setAmount] = useState(editingTx?.amount?.toString() || "");
  const [currency, setCurrency] = useState(initialCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [categoryId, setCategoryId] = useState(editingTx?.categoryId || null);
  const [subcategory, setSubcategory] = useState(editingTx?.subcategory || null);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [description, setDescription] = useState(editingTx?.description || "");
  const [paidBy, setPaidBy] = useState(editingTx?.paidBy || user?.uid);
  const [split, setSplit] = useState(editingTx?.split || "50/50");
  const [busy, setBusy] = useState(false);

  const availableCategories = categories.filter((c) =>
    type === "income" ? c.id === "income" :
    type === "investment" ? c.id === "investment" :
    c.id !== "income" && c.id !== "investment"
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);

  function handleTypeChange(newType) {
    setType(newType);
    setCategoryId(null);
    setSubcategory(null);
  }

  function selectCategory(cat) {
    setCategoryId(cat.id);
    setSubcategory(cat.subcategories[0]);
    setShowCatPicker(false);
  }

  async function handleSave() {
    if (!amount || !categoryId) return;
    setBusy(true);
    try {
      const payload = {
        type,
        amount: parseFloat(amount),
        currency,
        categoryId,
        subcategory,
        description: description || selectedCategory?.name,
        paidBy: type === "expense" ? paidBy : user.uid,
        split: type === "expense" ? split : "100",
      };

      if (isEditing) {
        await updateTransaction(editingTx.id, payload);
      } else {
        await addTransaction({ ...payload, date: new Date().toISOString() });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: "none", border: "none" }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>
            {isEditing ? "Modifier la transaction" : "Nouvelle transaction"}
          </h1>
          <div style={{ width: 20 }} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { key: "expense", label: "Dépense" },
            { key: "income", label: "Revenu" },
            { key: "investment", label: "Invest." },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => handleTypeChange(t.key)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                background: type === t.key ? "var(--tang-light)" : "var(--bg-card)",
                color: type === t.key ? "var(--tang)" : "var(--ink)",
                fontSize: 13,
                fontWeight: type === t.key ? 500 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1.25rem",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                fontSize: 32,
                fontWeight: 500,
                border: "none",
                outline: "none",
                background: "transparent",
                width: 160,
                textAlign: "right",
              }}
            />
            <button
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                background: "var(--bg)",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {currency}{" "}
              <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
            </button>
          </div>

          {showCurrencyPicker && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
              }}
            >
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setCurrency(c.code);
                    setShowCurrencyPicker(false);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    border:
                      currency === c.code
                        ? "0.5px solid var(--sky)"
                        : "0.5px solid var(--rule)",
                    background:
                      currency === c.code ? "var(--sky-light)" : "var(--bg)",
                    color: currency === c.code ? "var(--sky)" : "var(--ink)",
                    fontSize: 12,
                  }}
                >
                  {c.code}
                </button>
              ))}
            </div>
          )}
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
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>
            Catégorie
          </p>
          <div
            onClick={() => setShowCatPicker(!showCatPicker)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              borderBottom: "0.5px solid var(--rule)",
              cursor: "pointer",
            }}
          >
            {selectedCategory ? (
              <>
                <i
                  className={`ti ${selectedCategory.icon}`}
                  style={{ fontSize: 16 }}
                  aria-hidden="true"
                />
                <span style={{ fontSize: 14, flex: 1 }}>
                  {selectedCategory.name}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 14, flex: 1, color: "var(--ink-3)" }}>
                Choisir une catégorie
              </span>
            )}
            <i className="ti ti-chevron-down" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
          </div>

          {showCatPicker && (
            <div style={{ marginTop: 8 }}>
              {availableCategories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => selectCategory(cat)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 4px",
                    cursor: "pointer",
                  }}
                >
                  <i className={`ti ${cat.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                  <span style={{ fontSize: 13 }}>{cat.name}</span>
                </div>
              ))}
            </div>
          )}

          {selectedCategory && (
            <>
              <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "12px 0 6px" }}>
                Sous-catégorie
              </p>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 0",
                  border: "none",
                  borderBottom: "0.5px solid var(--rule)",
                  background: "transparent",
                  fontSize: 14,
                  outline: "none",
                }}
              >
                {selectedCategory.subcategories.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          )}

          <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "12px 0 6px" }}>
            Description
          </p>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "0.5px solid var(--rule)",
              background: "transparent",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {type === "expense" && members.length > 0 && (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--rule)",
              padding: "1rem 1.25rem",
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
              Qui a payé
            </p>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {members.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => setPaidBy(m.uid)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: "var(--radius-md)",
                    border:
                      paidBy === m.uid
                        ? "0.5px solid var(--sky)"
                        : "0.5px solid var(--rule)",
                    background:
                      paidBy === m.uid ? "var(--sky-light)" : "var(--bg-card)",
                    color: paidBy === m.uid ? "var(--sky)" : "var(--ink)",
                    fontSize: 13,
                    fontWeight: paidBy === m.uid ? 500 : 400,
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>
              Partage
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              {members.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => setSplit(m.uid)}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: "var(--radius-md)",
                    border:
                      split === m.uid
                        ? "0.5px solid var(--sky)"
                        : "0.5px solid var(--rule)",
                    background: split === m.uid ? "var(--sky-light)" : "var(--bg-card)",
                    color: split === m.uid ? "var(--sky)" : "var(--ink)",
                    fontSize: 13,
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
                  border:
                    split === "50/50"
                      ? "0.5px solid var(--sky)"
                      : "0.5px solid var(--rule)",
                  background: split === "50/50" ? "var(--sky-light)" : "var(--bg-card)",
                  color: split === "50/50" ? "var(--sky)" : "var(--ink)",
                  fontSize: 13,
                  fontWeight: split === "50/50" ? 500 : 400,
                }}
              >
                50/50
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!amount || !categoryId || busy}
          style={{
            width: "100%",
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            fontSize: 15,
            fontWeight: 500,
            opacity: !amount || !categoryId || busy ? 0.5 : 1,
          }}
        >
          {busy ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

import { useState, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES } from "../data/categories";
import { uploadPhoto } from "../utils/photoUpload";
import IconPicker from "../components/IconPicker";
import { AVATAR_COLOR_PALETTE } from "../utils/memberColors";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import AdvancedSplitSelector from "../components/AdvancedSplitSelector";

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 16);
}

function toDateTimeLocal(isoString) {
  if (!isoString) return todayISO();
  const d = new Date(isoString);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 16);
}

export default function AddTransactionScreen({ onClose, editingTx }) {
  const t = useTranslation();
  const { catName, subName: tSubName } = useCategoryName();
  const {
    categories,
    members,
    addTransaction,
    updateTransaction,
    updateCategories,
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
  const [splitMode, setSplitMode] = useState(editingTx?.splitDetails ? "advanced" : "simple");
  const [splitDetails, setSplitDetails] = useState(editingTx?.splitDetails || null);
  const [dateTime, setDateTime] = useState(toDateTimeLocal(editingTx?.date));
  const [busy, setBusy] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(editingTx?.receiptURL || null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = useRef(null);

  function handleReceiptSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  }

  function removeReceipt() {
    setReceiptFile(null);
    setReceiptPreview(null);
  }

  // Création de catégorie / sous-catégorie à la volée
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("ti-tag");
  const [newCatColor, setNewCatColor] = useState("amber");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showNewSub, setShowNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");

  const availableCategories = categories.filter((c) =>
    type === "income" ? c.id === "income" :
    type === "investment" ? (c.id === "investment" || c.id === "savings") :
    c.id !== "income" && c.id !== "investment" && c.id !== "savings"
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Pour Income/Investment : on a quand même besoin de savoir QUI (paidBy)
  // et éventuellement POUR QUI (split) si la dépense d'investissement est partagée
  const needsMemberAttribution = type === "income" || type === "investment";

  function handleTypeChange(newType) {
    setType(newType);
    if (newType === "income") {
      const incomeCat = categories.find((c) => c.id === "income");
      setCategoryId(incomeCat?.id || null);
      setSubcategory(incomeCat?.subcategories[0] || null);
    } else {
      setCategoryId(null);
      setSubcategory(null);
    }
  }

  function selectCategory(cat) {
    setCategoryId(cat.id);
    setSubcategory(cat.subcategories[0] || null);
    setShowCatPicker(false);
  }

  async function handleCreateCategory() {
    const name = newCatName.trim();
    if (!name) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name,
      icon: newCatIcon,
      color: newCatColor,
      subcategories: [],
    };
    const updated = [...categories, newCat];
    await updateCategories(updated);
    setCategoryId(newCat.id);
    setSubcategory(null);
    setNewCatName("");
    setNewCatIcon("ti-tag");
    setNewCatColor("amber");
    setShowNewCat(false);
    setShowCatPicker(false);
  }

  async function handleCreateSubcategory() {
    const name = newSubName.trim();
    if (!name || !categoryId) return;
    const updated = categories.map((c) =>
      c.id === categoryId
        ? { ...c, subcategories: [...c.subcategories, name] }
        : c
    );
    await updateCategories(updated);
    setSubcategory(name);
    setNewSubName("");
    setShowNewSub(false);
  }

  function getInitial(name) {
    return name?.[0]?.toUpperCase() || "?";
  }

  async function handleSave() {
    if (!amount || !categoryId) return;
    setBusy(true);
    try {
      const isoDate = new Date(dateTime).toISOString();
      const payload = {
        type,
        amount: parseFloat(amount),
        currency,
        categoryId,
        subcategory,
        description: description || selectedCategory?.name,
        paidBy,
        split: type === "expense" || needsMemberAttribution ? split : "100",
        splitDetails: splitMode === "advanced" ? splitDetails : null,
        date: isoDate,
      };

      let txId = editingTx?.id;

      if (isEditing) {
        await updateTransaction(editingTx.id, payload);
      } else {
        txId = await addTransaction(payload);
      }

      // Upload du reçu après avoir l'ID de la transaction (nouveau fichier choisi)
      if (receiptFile && txId) {
        setUploadingReceipt(true);
        const path = `receipts/${txId}.jpg`;
        const url = await uploadPhoto(receiptFile, path);
        await updateTransaction(txId, { receiptURL: url });
        setUploadingReceipt(false);
      } else if (receiptPreview === null && editingTx?.receiptURL) {
        // L'utilisateur a retiré le reçu existant
        await updateTransaction(txId, { receiptURL: null });
      }

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
      setUploadingReceipt(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 100,
        maxWidth: 480,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 1.25rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none" }}>
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>
            {isEditing ? t("tx_edit") : t("tx_new")}
          </h1>
          <div style={{ width: 20 }} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { key: "expense", label: t("tx_expense") },
            { key: "income", label: t("tx_income") },
            { key: "investment", label: t("tx_investment") },
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

        {/* Montant + devise */}
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
              {currency} <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
            </button>
          </div>

          {showCurrencyPicker && (
            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false); }}
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
            </div>
          )}
        </div>

        {/* Date */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("tx_date")}</p>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 0",
              border: "none",
              borderBottom: "0.5px solid var(--rule)",
              background: "transparent",
              fontSize: 14,
              outline: "none",
              color: "var(--ink)",
            }}
          />
        </div>

        {/* Catégorie / sous-catégorie / description */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("tx_category")}</p>
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
                <i className={`ti ${selectedCategory.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                <span style={{ fontSize: 14, flex: 1 }}>{selectedCategory.name}</span>
              </>
            ) : (
              <span style={{ fontSize: 14, flex: 1, color: "var(--ink-3)" }}>{t("tx_choose_category")}</span>
            )}
            <i className="ti ti-chevron-down" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
          </div>

          {showCatPicker && (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {availableCategories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => selectCategory(cat)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 6px", cursor: "pointer",
                      borderRadius: "var(--radius-sm)",
                      minWidth: 0,
                    }}
                  >
                    <i className={`ti ${cat.icon}`} style={{ fontSize: 15, flexShrink: 0 }} aria-hidden="true" />
                    <span
                      style={{
                        fontSize: 12.5,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {catName(cat)}
                    </span>
                  </div>
                ))}
              </div>

              {type === "expense" && (
                <>
                  {!showNewCat ? (
                    <button
                      onClick={() => setShowNewCat(true)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "none", border: "none", color: "var(--sky)",
                        fontSize: 13, padding: "8px 4px",
                      }}
                    >
                      <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                      {t("tx_new_category")}
                    </button>
                  ) : (
                    <div style={{ padding: "8px 4px" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                        <button
                          onClick={() => setShowIconPicker(!showIconPicker)}
                          aria-label="Choisir une icône et une couleur"
                          style={{
                            width: 36, height: 36, borderRadius: "var(--radius-md)",
                            border: "0.5px solid var(--rule)",
                            background: AVATAR_COLOR_PALETTE.find((c) => c.key === newCatColor)?.bg || "var(--bg)",
                            color: AVATAR_COLOR_PALETTE.find((c) => c.key === newCatColor)?.text || "var(--ink)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i className={`ti ${newCatIcon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                        </button>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Nom de la catégorie"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                          style={{
                            flex: 1, border: "none", borderBottom: "0.5px solid var(--rule)",
                            outline: "none", fontSize: 13, background: "transparent",
                          }}
                        />
                        <button
                          onClick={handleCreateCategory}
                          style={{ background: "var(--ink)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                        >
                          OK
                        </button>
                      </div>

                      {showIconPicker && (
                        <>
                          <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                            {AVATAR_COLOR_PALETTE.map((c) => (
                              <button
                                key={c.key}
                                onClick={() => setNewCatColor(c.key)}
                                aria-label={c.key}
                                style={{
                                  width: 22, height: 22, borderRadius: "50%",
                                  background: c.bg,
                                  border: newCatColor === c.key ? `2px solid ${c.text}` : "2px solid transparent",
                                }}
                              />
                            ))}
                          </div>
                          <IconPicker
                            selectedIcon={newCatIcon}
                            onSelect={setNewCatIcon}
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {selectedCategory && (
            <>
              <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "12px 0 6px" }}>{t("tx_subcategory")}</p>
              <select
                value={subcategory || ""}
                onChange={(e) => setSubcategory(e.target.value)}
                style={{
                  width: "100%", padding: "8px 0", border: "none",
                  borderBottom: "0.5px solid var(--rule)", background: "transparent",
                  fontSize: 14, outline: "none",
                }}
              >
                <option value="" disabled>Choisir...</option>
                {selectedCategory.subcategories.map((s) => (
                  <option key={s} value={s}>{tSubName(s, selectedCategory.id)}</option>
                ))}
              </select>

              {!showNewSub ? (
                <button
                  onClick={() => setShowNewSub(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", color: "var(--sky)",
                    fontSize: 12, padding: "8px 0 0",
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" />
                  {t("tx_new_subcategory")}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6, paddingTop: 8 }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nom de la sous-catégorie"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateSubcategory()}
                    style={{
                      flex: 1, border: "none", borderBottom: "0.5px solid var(--rule)",
                      outline: "none", fontSize: 13, background: "transparent",
                    }}
                  />
                  <button
                    onClick={handleCreateSubcategory}
                    style={{ background: "var(--ink)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "4px 10px", fontSize: 12 }}
                  >
                    OK
                  </button>
                </div>
              )}
            </>
          )}

          <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "12px 0 6px" }}>{t("tx_description")}</p>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("tx_description_optional")}
            style={{
              width: "100%", padding: "8px 0", border: "none",
              borderBottom: "0.5px solid var(--rule)", background: "transparent",
              fontSize: 14, outline: "none",
            }}
          />
        </div>

        {/* Reçu / ticket */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>{t("tx_receipt")}</p>

          {receiptPreview ? (
            <div style={{ position: "relative", display: "inline-block" }}>
              <img
                src={receiptPreview}
                alt="Reçu"
                style={{
                  width: 100, height: 100, objectFit: "cover",
                  borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                }}
              />
              <button
                onClick={removeReceipt}
                aria-label="Retirer le reçu"
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "var(--ink)", border: "2px solid var(--bg-card)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <i className="ti ti-x" style={{ fontSize: 11, color: "var(--bg)" }} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => receiptInputRef.current?.click()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "14px", borderRadius: "var(--radius-md)",
                border: "0.5px dashed var(--rule)", background: "var(--bg)",
                color: "var(--ink-3)", fontSize: 13,
              }}
            >
              <i className="ti ti-camera-plus" style={{ fontSize: 16 }} aria-hidden="true" />
              {t("tx_add_photo")}
            </button>
          )}

          <input
            ref={receiptInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceiptSelect}
            style={{ display: "none" }}
          />
        </div>

        {/* Attribution membre — pour Expense (Payé par / Pour) ET Income/Investment (juste Payé par/Pour aussi) */}
        {members.length > 0 && (
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
              {needsMemberAttribution ? t("tx_received_by") : t("tx_paid_by")}
            </p>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {members.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => setPaidBy(m.uid)}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    border: paidBy === m.uid ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: paidBy === m.uid ? "var(--sky-light)" : "var(--bg-card)",
                    color: paidBy === m.uid ? "var(--sky)" : "var(--ink)",
                    fontSize: 13, fontWeight: paidBy === m.uid ? 500 : 400,
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>

            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>{t("tx_for")}</p>

            <div style={{ display: "flex", gap: 6 }}>
              {members.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => { setSplit(m.uid); setSplitMode("simple"); }}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    border: split === m.uid && splitMode === "simple" ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: split === m.uid && splitMode === "simple" ? "var(--sky-light)" : "var(--bg-card)",
                    color: split === m.uid && splitMode === "simple" ? "var(--sky)" : "var(--ink)",
                    fontSize: 13,
                  }}
                >
                  {m.name}
                </button>
              ))}
              {members.length === 2 && (
                <button
                  onClick={() => {
                    setSplit("50/50");
                    setSplitMode("advanced");
                    if (!splitDetails) {
                      setSplitDetails({ mode: "custom", unit: "percent", a: 50, b: 50 });
                    }
                  }}
                  aria-label={t("tx_split_share")}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    border: splitMode === "advanced" ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: splitMode === "advanced" ? "var(--sky-light)" : "var(--bg-card)",
                    color: splitMode === "advanced" ? "var(--sky)" : "var(--ink)",
                    fontSize: 13, fontWeight: splitMode === "advanced" ? 500 : 400,
                  }}
                >
                  <i className="ti ti-arrows-split-2" style={{ fontSize: 15 }} aria-hidden="true" />
                  {t("tx_split_share")}
                </button>
              )}
            </div>

            {splitMode === "advanced" && members.length === 2 && (
              <div style={{ marginTop: 10 }}>
                <AdvancedSplitSelector
                  members={members}
                  totalAmount={parseFloat(amount) || 0}
                  value={splitDetails}
                  onChange={setSplitDetails}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "0.75rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom))",
          background: "var(--bg)",
          borderTop: "0.5px solid var(--rule)",
        }}
      >
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
          {uploadingReceipt ? t("tx_uploading_receipt") : busy ? t("tx_saving") : isEditing ? t("tx_update") : t("tx_save")}
        </button>
      </div>
    </div>
  );
}

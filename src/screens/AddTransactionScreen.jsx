import { useState, useRef, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES } from "../data/categories";
import { uploadPhoto } from "../utils/photoUpload";
import IconPicker from "../components/IconPicker";
import { AVATAR_COLOR_PALETTE } from "../utils/memberColors";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import AdvancedSplitSelector from "../components/AdvancedSplitSelector";
import { getMemberKey } from "../utils/members";
import { buildSuggestionIndex, getSuggestions, findExactMatch } from "../utils/descriptionSuggestions";
import TransactionComments from "../components/TransactionComments";
import TagInput from "../components/TagInput";
import { dedupeTags, extractTagsFromText } from "../utils/tags";
import { parseNaturalTransaction } from "../utils/parseNaturalTransaction";
import QuickAddBar from "../components/QuickAddBar";

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
    transactions,
    addTransaction,
    updateTransaction,
    updateCategories,
    addRecurring,
    defaultCurrency,
    currencyMode,
    lastUsedCurrency,
    language,
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
  const [tags, setTags] = useState(editingTx?.tags || []);
  const [paidBy, setPaidBy] = useState(editingTx?.paidBy || user?.uid);
  const [split, setSplit] = useState(editingTx?.split || "50/50");
  const [splitMode, setSplitMode] = useState(editingTx?.splitDetails ? "advanced" : "simple");
  const [splitDetails, setSplitDetails] = useState(editingTx?.splitDetails || null);
  const [dateTime, setDateTime] = useState(toDateTimeLocal(editingTx?.date));
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState(new Date().getDate().toString());
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

  // Suggestions apprises de l'historique : taper le début d'une description
  // déjà utilisée propose de la compléter ET remplit catégorie/sous-catégorie.
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionIndex = useMemo(
    () => buildSuggestionIndex(transactions || [], type),
    [transactions, type]
  );
  const suggestions = useMemo(
    () => (showSuggestions ? getSuggestions(suggestionIndex, description) : []),
    [suggestionIndex, description, showSuggestions]
  );

  function applyCategoryFromSuggestion(s) {
    const cat = availableCategories.find((c) => c.id === s.categoryId);
    if (!cat) return;
    setCategoryId(cat.id);
    setSubcategory(
      s.subcategory && cat.subcategories.includes(s.subcategory)
        ? s.subcategory
        : cat.subcategories[0] || null
    );
  }

  function handleDescriptionChange(value) {
    setDescription(value);
    setShowSuggestions(true);
    // Description connue tapée en entier → catégorie remplie silencieusement
    // (seulement si l'utilisateur n'en a pas déjà choisi une).
    if (!categoryId) {
      const exact = findExactMatch(suggestionIndex, value);
      if (exact) applyCategoryFromSuggestion(exact);
    }
  }

  function pickSuggestion(s) {
    setDescription(s.description);
    applyCategoryFromSuggestion(s);
    setShowSuggestions(false);
  }

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

  // Applique une saisie en langage naturel : pré-remplit le formulaire à
  // partir du texte (montant, devise, date, type, catégorie, description).
  function applyNaturalLanguage(text) {
    const parsed = parseNaturalTransaction(text, {
      categories,
      transactions,
      defaultCurrency: currencyMode === "last" ? lastUsedCurrency : defaultCurrency,
    });
    if (!parsed) return;
    setType(parsed.type);
    if (parsed.amount != null) setAmount(String(parsed.amount));
    if (parsed.currency) setCurrency(parsed.currency);
    if (parsed.date) setDateTime(toDateTimeLocal(parsed.date));
    if (parsed.categoryId) setCategoryId(parsed.categoryId);
    if (parsed.subcategory) setSubcategory(parsed.subcategory);
    if (parsed.description) {
      setDescription(parsed.description);
      setTags(extractTagsFromText(text));
    }
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
        // Tags explicites (chips) + #hashtags éventuellement tapés dans la description
        tags: dedupeTags([...tags, ...extractTagsFromText(description)]),
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
        if (makeRecurring) {
          await addRecurring({
            type,
            amount: parseFloat(amount),
            currency,
            categoryId,
            subcategory,
            description: description || selectedCategory?.name,
            frequency: recurringFrequency,
            dayOfMonth: parseInt(recurringDayOfMonth) || 1,
            paidBy,
            split: type === "expense" || needsMemberAttribution ? split : "100",
            active: true,
            // This transaction IS the first occurrence — mark it as already
            // generated so the recurring generator doesn't immediately
            // create a duplicate for the current period.
            lastGenerated: isoDate,
          });
        }
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
      className="app-modal"
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* En-tête sticky : fermer sans remonter tout en haut */}
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "1rem 1.25rem",
          background: "var(--bg)",
          borderBottom: "0.5px solid var(--rule)",
          zIndex: 10,
        }}
      >
        <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", display: "flex" }}>
          <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
        </button>
        <h1 style={{ fontSize: 17, flex: 1, textAlign: "center", margin: 0 }}>
          {isEditing ? t("tx_edit") : t("tx_new")}
        </h1>
        <div style={{ width: 20 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
        {!isEditing && (
          <QuickAddBar language={language} onApply={applyNaturalLanguage} />
        )}
        {/* Type : pastilles colorées (dépense=coral, revenu=vert, invest=bleu).
            Sélectionné = fond plein + texte clair ; non sélectionné = fond
            teinté + texte de la couleur, comme les icônes du menu de gauche. */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { key: "expense", label: t("tx_expense"), color: "tang", icon: "ti-arrow-down-right" },
            { key: "income", label: t("tx_income"), color: "sage", icon: "ti-arrow-up-right" },
            { key: "investment", label: t("tx_investment"), color: "lavi", icon: "ti-trending-up" },
          ].map((opt) => {
            const sel = type === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleTypeChange(opt.key)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: "var(--radius-md)",
                  border: `0.5px solid ${sel ? `var(--${opt.color})` : "var(--rule)"}`,
                  background: sel ? `var(--${opt.color})` : `var(--${opt.color}-light)`,
                  color: sel ? `var(--${opt.color}-light)` : `var(--${opt.color})`,
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "background-color .18s ease, color .18s ease, border-color .18s ease",
                }}
              >
                <i className={`ti ${opt.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Montant + devise, avec le reçu (optionnel) à droite dans la même
            carte — essai de compacité pour libérer de la place plus bas. */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1.25rem",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{
                  fontSize: 30,
                  fontWeight: 500,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
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
                  flexShrink: 0,
                }}
              >
                {currency} <i className="ti ti-chevron-down" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            </div>

            {/* Reçu (optionnel) */}
            <div style={{ flexShrink: 0, textAlign: "center" }}>
              {receiptPreview ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img
                    src={receiptPreview}
                    alt="Reçu"
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)", display: "block" }}
                  />
                  <button
                    onClick={removeReceipt}
                    aria-label="Retirer le reçu"
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "var(--ink)", border: "2px solid var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <i className="ti ti-x" style={{ fontSize: 10, color: "var(--bg)" }} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => receiptInputRef.current?.click()}
                  aria-label={t("tx_add_photo")}
                  style={{ width: 60, height: 60, borderRadius: "var(--radius-md)", border: "0.5px dashed var(--rule)", background: "var(--bg)", color: "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <i className="ti ti-camera-plus" style={{ fontSize: 18 }} aria-hidden="true" />
                </button>
              )}
              <p style={{ fontSize: 9.5, color: "var(--ink-3)", marginTop: 3, whiteSpace: "nowrap" }}>{t("tx_receipt_optional")}</p>
              <input
                ref={receiptInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleReceiptSelect}
                style={{ display: "none" }}
              />
            </div>
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

        {/* Description — placée juste après le montant : la saisir en premier
            permet de remplir automatiquement catégorie/sous-catégorie via les
            suggestions apprises de l'historique. */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("tx_description")}</p>
          <input
            type="text"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={t("tx_description_optional")}
            style={{
              width: "100%", padding: "8px 0", border: "none",
              borderBottom: "0.5px solid var(--rule)", background: "transparent",
              fontSize: 14, outline: "none",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              {suggestions.map((s) => {
                const cat = categories.find((c) => c.id === s.categoryId);
                return (
                  <button
                    key={s.description}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 6px", borderRadius: "var(--radius-sm)",
                      border: "none", background: "var(--bg)",
                      textAlign: "left", cursor: "pointer",
                    }}
                  >
                    <i className="ti ti-history" style={{ fontSize: 14, color: "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
                    <span style={{ fontSize: 13, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.description}
                    </span>
                    {cat && (
                      <span style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <i className={`ti ${cat.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                        {catName(cat)}{s.subcategory ? ` · ${tSubName(s.subcategory, cat.id)}` : ""}
                      </span>
                    )}
                  </button>
                );
              })}
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

          {!isEditing && (
            <div style={{ marginTop: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={makeRecurring}
                  onChange={(e) => setMakeRecurring(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontSize: 14, flex: 1 }}>{t("tx_make_recurring")}</span>
                <i className="ti ti-repeat" style={{ fontSize: 16, color: "var(--lavi)" }} aria-hidden="true" />
              </label>

              {makeRecurring && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("recurring_frequency")}</p>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    {[
                      { key: "monthly", label: t("recurring_freq_monthly") },
                      { key: "weekly", label: t("recurring_freq_weekly") },
                      { key: "yearly", label: t("recurring_freq_yearly") },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setRecurringFrequency(f.key)}
                        style={{
                          flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                          border: recurringFrequency === f.key ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
                          background: recurringFrequency === f.key ? "var(--lavi-light)" : "var(--bg)",
                          color: recurringFrequency === f.key ? "var(--lavi)" : "var(--ink)",
                          fontSize: 12,
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {recurringFrequency === "monthly" && (
                    <>
                      <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("recurring_day_of_month")}</p>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={recurringDayOfMonth}
                        onChange={(e) => setRecurringDayOfMonth(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)",
                          border: "0.5px solid var(--rule)", fontSize: 14, outline: "none",
                        }}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}
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
                  key={getMemberKey(m)}
                  onClick={() => setPaidBy(getMemberKey(m))}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    border: paidBy === getMemberKey(m) ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: paidBy === getMemberKey(m) ? "var(--sky-light)" : "var(--bg-card)",
                    color: paidBy === getMemberKey(m) ? "var(--sky)" : "var(--ink)",
                    fontSize: 13, fontWeight: paidBy === getMemberKey(m) ? 500 : 400,
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
                  key={getMemberKey(m)}
                  onClick={() => { setSplit(getMemberKey(m)); setSplitMode("simple"); }}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    border: split === getMemberKey(m) && splitMode === "simple" ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: split === getMemberKey(m) && splitMode === "simple" ? "var(--sky-light)" : "var(--bg-card)",
                    color: split === getMemberKey(m) && splitMode === "simple" ? "var(--sky)" : "var(--ink)",
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

        {/* Tags — optionnels, placés tout en bas (transversaux aux catégories) */}
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
            {t("tx_tags")} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· {t("tx_optional")}</span>
          </p>
          <TagInput value={tags} onChange={setTags} />
        </div>

        {/* Fil de discussion — seulement sur une transaction existante */}
        {isEditing && <TransactionComments txId={editingTx.id} />}
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

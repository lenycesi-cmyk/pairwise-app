import { useState, useRef, useMemo, useEffect } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { CURRENCIES, ALL_CURRENCIES } from "../data/categories";
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
import TagManager from "../components/TagManager";
import { dedupeTags, extractTagsFromText, usedTags } from "../utils/tags";
import { parseNaturalTransaction } from "../utils/parseNaturalTransaction";
import QuickAddBar from "../components/QuickAddBar";
import { useMediaQuery } from "../hooks/useMediaQuery";

// Carte de section « 1B Chaleureux » : en-tête pastille (icône teintée + titre),
// identique au WidgetCard du Dashboard. `accent` est une couleur token
// (ex. "var(--tang)"). La pastille se remplit au survol via .pw-chip/.pw-chip-host.
function SectionCard({ accent, icon, title, extra, children, style }) {
  return (
    <div
      className="pw-chip-host pw-lift"
      data-manual-focus="true"
      style={{ background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-lg)", padding: 16, ...style }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="pw-chip" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: `color-mix(in srgb, ${accent} 15%, transparent)`, "--pw-chip": accent }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color: accent }} aria-hidden="true" />
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{title}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}

// Style partagé des boutons de segment (type, membres, split, fréquence) :
// bord 0.5px, fond teinté + texte couleur d'accent quand sélectionné, neutre sinon.
function segStyle(selected, accent) {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 40, borderRadius: "var(--radius-md)", cursor: "pointer",
    border: `0.5px solid ${selected ? accent : "var(--rule)"}`,
    background: selected ? `color-mix(in srgb, ${accent} 13%, transparent)` : "var(--bg-card)",
    color: selected ? accent : "var(--ink-3)",
    fontSize: 13, fontWeight: selected ? 600 : 400,
    transition: "background-color .18s ease, color .18s ease, border-color .18s ease",
  };
}

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
    deleteTransaction,
    updateCategories,
    addRecurring,
    defaultCurrency,
    currencyMode,
    financeMode,
    lastUsedCurrency,
    enabledCurrencies,
    updateEnabledCurrencies,
    language,
  } = useFinance();
  const { user } = useAuth();
  // Desktop large → corps en 2 colonnes (même breakpoint que le modal élargi).
  const wide = useMediaQuery("(min-width: 1024px)");

  const isEditing = !!editingTx;
  const initialCurrency = isEditing
    ? editingTx.currency
    : currencyMode === "last"
    ? lastUsedCurrency
    : defaultCurrency;

  // Dernière transaction saisie par cet utilisateur — sert à pré-remplir
  // "payé par" et "pour" sur une nouvelle transaction (les habitudes de
  // chaque membre diffèrent). Ignoré en édition. Appelé une seule fois dans
  // les initialiseurs paresseux ci-dessous (pas de mémoïsation nécessaire).
  function findLastOwnTx() {
    if (isEditing || !user?.uid) return null;
    let best = null;
    for (const tx of transactions) {
      if (tx.createdBy !== user.uid) continue;
      if (!best || (tx.createdAt || 0) > (best.createdAt || 0)) best = tx;
    }
    return best;
  }

  const [type, setType] = useState(editingTx?.type || "expense");
  const [amount, setAmount] = useState(editingTx?.amount?.toString() || "");
  const [currency, setCurrency] = useState(initialCurrency);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [manageCurrencies, setManageCurrencies] = useState(false);
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  // Devises proposées dans le sélecteur : liste blanche du couple si définie,
  // sinon toutes. La devise déjà saisie (ex. édition d'une vieille transaction)
  // et la devise par défaut restent toujours proposées pour ne pas se bloquer.
  const currencyList =
    enabledCurrencies && enabledCurrencies.length > 0
      ? ALL_CURRENCIES.filter(
          (c) =>
            enabledCurrencies.includes(c.code) ||
            c.code === currency ||
            c.code === defaultCurrency
        )
      : CURRENCIES;

  // Devises actuellement proposées (pour l'écran "Gérer") et celles qu'on peut
  // encore ajouter depuis le catalogue, filtrées par la recherche.
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

  // Bascule une devise dans/hors de la liste blanche du couple. Partant de
  // "toutes" (null), le premier décochage matérialise la liste courante moins
  // la devise retirée. On garde toujours au moins la devise par défaut.
  function toggleEnabledCurrency(code) {
    const current =
      enabledCurrencies && enabledCurrencies.length > 0
        ? enabledCurrencies
        : CURRENCIES.map((c) => c.code);
    let next = current.includes(code)
      ? current.filter((x) => x !== code)
      : [...current, code];
    if (next.length === 0) next = [defaultCurrency];
    updateEnabledCurrencies(next);
  }
  const [categoryId, setCategoryId] = useState(editingTx?.categoryId || null);
  const [subcategory, setSubcategory] = useState(editingTx?.subcategory || null);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [description, setDescription] = useState(editingTx?.description || "");
  const [tags, setTags] = useState(editingTx?.tags || []);
  const [showTagManager, setShowTagManager] = useState(false);
  const [paidBy, setPaidBy] = useState(() => editingTx?.paidBy || findLastOwnTx()?.paidBy || user?.uid);
  const [split, setSplit] = useState(() => editingTx?.split || findLastOwnTx()?.split || "50/50");
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
  const bodyRef = useRef(null);

  // Focus tactile mobile : la modale gère elle-même son focus (cartes marquées
  // [data-manual-focus], exclues de useScrollFocus) pour n'avoir qu'UNE SEULE
  // carte allumée à la fois. Règle : en haut → Montant (1re), en bas → Tags
  // (dernière), sinon la carte dont le centre est le plus proche du centre de
  // l'écran. Sur desktop le survol s'en charge (effet ignoré).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (window.matchMedia("(hover: hover)").matches) return;
    const update = () => {
      const cards = el.querySelectorAll(".pw-lift");
      if (!cards.length) return;
      const atTop = el.scrollTop <= 8;
      const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= 8;
      let active;
      if (atTop) {
        active = 0;
      } else if (atBottom) {
        active = cards.length - 1;
      } else {
        const mid = el.getBoundingClientRect().top + el.clientHeight / 2;
        let best = Infinity;
        cards.forEach((c, i) => {
          const r = c.getBoundingClientRect();
          const d = Math.abs(r.top + r.height / 2 - mid);
          if (d < best) { best = d; active = i; }
        });
      }
      cards.forEach((c, i) => c.classList.toggle("pw-lift--focus", i === active));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [wide, isEditing]);

  // Suivent si le montant / la catégorie ont été remplis automatiquement à
  // partir de la description (langage naturel). Tant que c'est le cas, on peut
  // les affiner à chaque frappe ; dès que l'utilisateur les modifie à la main,
  // on cesse d'y toucher.
  const amountAutoRef = useRef(false);
  const catAutoRef = useRef(false);

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

    // Auto-remplissage à la façon de l'onboarding : on déduit catégorie /
    // sous-catégorie (et le montant s'il est vide) directement de la saisie.
    // On ne touche jamais un choix fait à la main — seulement une valeur vide
    // ou une valeur déjà auto-remplie (qu'on peut donc affiner en tapant).
    const canFillCat = !categoryId || catAutoRef.current;

    // 1. Description déjà apprise de l'historique → catégorie exacte.
    const exact = findExactMatch(suggestionIndex, value);
    if (exact && canFillCat) {
      applyCategoryFromSuggestion(exact);
      catAutoRef.current = true;
      return;
    }

    // 2. Analyse en langage naturel (marchands, mots-clés type "courses",
    //    "resto", "loyer"…) + montant éventuel.
    const parsed = parseNaturalTransaction(value, {
      categories,
      transactions,
      defaultCurrency: currencyMode === "last" ? lastUsedCurrency : defaultCurrency,
    });
    if (!parsed) return;

    if (parsed.categoryId && canFillCat) {
      const cat = availableCategories.find((c) => c.id === parsed.categoryId);
      if (cat) {
        setCategoryId(cat.id);
        setSubcategory(
          parsed.subcategory && cat.subcategories.includes(parsed.subcategory)
            ? parsed.subcategory
            : cat.subcategories[0] || null
        );
        catAutoRef.current = true;
      }
    }

    if (parsed.amount != null && (!amount || amountAutoRef.current)) {
      setAmount(String(parsed.amount));
      amountAutoRef.current = true;
    }

    // Devise : uniquement si un indice explicite est présent dans le texte
    // ("euros", "$", "usd"…) — sinon on laisse la devise choisie intacte.
    if (parsed.currencyDetected && parsed.currency) {
      setCurrency(parsed.currency);
    }
  }

  function pickSuggestion(s) {
    setDescription(s.description);
    applyCategoryFromSuggestion(s);
    catAutoRef.current = false; // choix explicite : ne plus écraser
    setShowSuggestions(false);
  }

  // Pour Income/Investment : on a quand même besoin de savoir QUI (paidBy)
  // et éventuellement POUR QUI (split) si la dépense d'investissement est partagée
  const needsMemberAttribution = type === "income" || type === "investment";

  function handleTypeChange(newType) {
    catAutoRef.current = false;
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
    catAutoRef.current = false; // choix manuel : l'auto-remplissage ne l'écrase plus
    setCategoryId(cat.id);
    setSubcategory(cat.subcategories[0] || null);
    setShowCatPicker(false);
    setShowSubPicker(false);
    setShowNewSub(false);
  }

  function selectSubcategory(sub) {
    setSubcategory(sub);
    setShowSubPicker(false);
    setShowNewSub(false);
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
    setShowSubPicker(false);
  }

  // Applique une saisie en langage naturel : pré-remplit le formulaire à
  // partir du texte (montant, devise, date, type, catégorie, description).
  function applyNaturalLanguage(text) {
    const parsed = parseNaturalTransaction(text, {
      categories,
      transactions,
      defaultCurrency: currencyMode === "last" ? lastUsedCurrency : defaultCurrency,
      usedTags: usedTags(transactions),
    });
    if (!parsed) return;
    setType(parsed.type);
    if (parsed.amount != null) setAmount(String(parsed.amount));
    if (parsed.currency) setCurrency(parsed.currency);
    if (parsed.date) setDateTime(toDateTimeLocal(parsed.date));
    if (parsed.categoryId) setCategoryId(parsed.categoryId);
    if (parsed.subcategory) setSubcategory(parsed.subcategory);
    if (parsed.description) setDescription(parsed.description);
    // Tags : #hashtags éventuels + tags détectés à l'oral (mots-clés préréglés
    // ou tags déjà utilisés dans l'historique).
    const nlTags = dedupeTags([...extractTagsFromText(text), ...(parsed.tags || [])]);
    if (nlTags.length) setTags((prev) => dedupeTags([...prev, ...nlTags]));
    // Valeurs issues d'un apply explicite : on les fige (l'édition de la
    // description ne doit pas les réécraser derrière).
    amountAutoRef.current = false;
    catAutoRef.current = false;
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

  // ── Cartes de section (motif « en-tête pastille » du Dashboard) ──────────
  const montantCard = (
    <SectionCard accent="var(--tang)" icon="ti-coin" title={t("tx_amount")} style={wide ? { minHeight: 150 } : undefined}>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => { amountAutoRef.current = false; setAmount(e.target.value); }}
          style={{
            flex: 1, minWidth: 0, width: "100%", border: "none", outline: "none", background: "transparent",
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 38, lineHeight: 1, letterSpacing: "-0.02em",
            color: amount ? "var(--ink)" : "var(--ink-3)", fontVariantNumeric: "tabular-nums",
          }}
        />
        <button
          onClick={() => { setShowCurrencyPicker(!showCurrencyPicker); setManageCurrencies(false); setAddingCurrency(false); setCurrencySearch(""); }}
          style={{
            flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, height: 34, padding: "0 12px", borderRadius: 99,
            background: "color-mix(in srgb, var(--tang) 12%, transparent)", border: "0.5px solid color-mix(in srgb, var(--tang) 30%, transparent)",
            fontSize: 13, fontWeight: 600, color: "var(--tang)", cursor: "pointer",
          }}
        >
          {currency} <i className="ti ti-chevron-down" style={{ fontSize: 14 }} aria-hidden="true" />
        </button>
        {receiptPreview ? (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src={receiptPreview}
              alt={t("tx_receipt")}
              style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 10, border: "0.5px solid var(--rule)", display: "block" }}
            />
            <button
              onClick={removeReceipt}
              aria-label="Retirer le reçu"
              style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--ink)", border: "2px solid var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            >
              <i className="ti ti-x" style={{ fontSize: 9, color: "var(--bg)" }} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => receiptInputRef.current?.click()}
            title={t("tx_receipt")}
            aria-label={t("tx_add_photo")}
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none", color: "var(--ink-3)", cursor: "pointer" }}
          >
            <i className="ti ti-camera" style={{ fontSize: 17 }} aria-hidden="true" />
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

      {showCurrencyPicker && !manageCurrencies && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", alignItems: "center" }}>
          {currencyList.map((c) => (
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
          <button
            onClick={() => setManageCurrencies(true)}
            aria-label={t("tx_manage_currencies")}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-md)",
              border: "0.5px dashed var(--rule)",
              background: "var(--bg)",
              color: "var(--ink-3)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <i className="ti ti-adjustments" style={{ fontSize: 13 }} aria-hidden="true" />
            {t("tx_manage_currencies")}
          </button>
        </div>
      )}

      {showCurrencyPicker && manageCurrencies && (
        <div style={{ marginTop: 12 }}>
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)",
                    background: "var(--bg)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>
                    {c.symbol} {c.code} · {c.name}
                  </span>
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
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)", fontSize: 13, outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => { setAddingCurrency(false); setCurrencySearch(""); }}
                  aria-label={t("common_cancel")}
                  style={{
                    flexShrink: 0, width: 34, height: 34, borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)", background: "var(--bg)", color: "var(--ink-3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <i className="ti ti-x" style={{ fontSize: 15 }} aria-hidden="true" />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                {addableCurrencies.map((c) => (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => toggleEnabledCurrency(c.code)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                      padding: "10px 12px", borderRadius: "var(--radius-md)", border: "0.5px solid var(--rule)",
                      background: "var(--bg)", cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--ink)", textAlign: "left" }}>
                      {c.symbol} {c.code} · {c.name}
                    </span>
                    <i className="ti ti-plus" style={{ fontSize: 14, color: "var(--sky)" }} aria-hidden="true" />
                  </button>
                ))}
                {addableCurrencies.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>
                    {t("tx_no_currency_found")}
                  </p>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <button
              onClick={() => { setManageCurrencies(false); setAddingCurrency(false); setCurrencySearch(""); }}
              style={{
                background: "var(--ink)", color: "var(--bg)", border: "none",
                borderRadius: "var(--radius-md)", padding: "6px 16px", fontSize: 13, fontWeight: 500,
              }}
            >
              {t("dashboard_done")}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );

  const descriptionCard = (
    <SectionCard accent="var(--sage)" icon="ti-align-left" title={t("tx_description")}>
      <input
        type="text"
        value={description}
        onChange={(e) => handleDescriptionChange(e.target.value)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder={t("tx_description_optional")}
        style={{
          width: "100%", marginTop: 12, padding: "8px 0", border: "none",
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
    </SectionCard>
  );

  const categoryCard = (
    <SectionCard accent="var(--sky)" icon="ti-category" title={t("tx_category")}>
      {/* Champ sélectionné (trigger) */}
      <div
        onClick={() => setShowCatPicker(!showCatPicker)}
        style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 9, height: 44, padding: "0 13px",
          borderRadius: "var(--radius-md)", cursor: "pointer",
          background: selectedCategory ? "color-mix(in srgb, var(--sky) 12%, transparent)" : "var(--bg-card)",
          border: `0.5px solid ${selectedCategory ? "var(--sky)" : "var(--rule)"}`,
        }}
      >
        {selectedCategory ? (
          <>
            <i className={`ti ${selectedCategory.icon}`} style={{ fontSize: 17, color: "var(--sky)", flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "var(--sky)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {catName(selectedCategory)}
            </span>
          </>
        ) : (
          <span style={{ flex: 1, fontSize: 14, color: "var(--ink-3)" }}>{t("tx_choose_category")}</span>
        )}
        <i className={`ti ti-chevron-${showCatPicker ? "up" : "down"}`} style={{ fontSize: 16, color: selectedCategory ? "var(--sky)" : "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
      </div>

      {showCatPicker && (
        <div style={{ marginTop: 8, border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)", padding: 6, background: "var(--bg-card)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, maxHeight: 320, overflowY: "auto" }}>
            {availableCategories.map((cat) => {
              const sel = cat.id === categoryId;
              return (
                <div
                  key={cat.id}
                  onClick={() => selectCategory(cat)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9, height: 40, padding: "0 11px", cursor: "pointer",
                    borderRadius: 8, minWidth: 0,
                    background: sel ? "color-mix(in srgb, var(--sky) 12%, transparent)" : "transparent",
                  }}
                >
                  <i className={`ti ${cat.icon}`} style={{ fontSize: 15, flexShrink: 0, color: sel ? "var(--sky)" : "var(--ink-3)" }} aria-hidden="true" />
                  <span
                    style={{
                      fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      color: sel ? "var(--sky)" : "var(--ink-2)", fontWeight: sel ? 600 : 400,
                    }}
                  >
                    {catName(cat)}
                  </span>
                </div>
              );
            })}
          </div>

          {type === "expense" && (
            !showNewCat ? (
              <button
                onClick={() => setShowNewCat(true)}
                style={{
                  marginTop: 6, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  height: 40, borderRadius: "var(--radius-md)",
                  background: "color-mix(in srgb, var(--sky) 10%, transparent)", border: "0.5px solid color-mix(in srgb, var(--sky) 30%, transparent)",
                  fontSize: 13, fontWeight: 600, color: "var(--sky)", cursor: "pointer",
                }}
              >
                <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
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
            )
          )}
        </div>
      )}

      {/* Sous-catégorie — UI identique au menu Catégorie */}
      {selectedCategory && (
        <>
          <div style={{ marginTop: 14, marginBottom: 8, fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
            {t("tx_subcategory")}
          </div>
          <div
            onClick={() => setShowSubPicker(!showSubPicker)}
            style={{
              display: "flex", alignItems: "center", gap: 9, height: 44, padding: "0 13px",
              borderRadius: "var(--radius-md)", cursor: "pointer",
              background: subcategory ? "color-mix(in srgb, var(--sky) 12%, transparent)" : "var(--bg-card)",
              border: `0.5px solid ${subcategory ? "var(--sky)" : "var(--rule)"}`,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: subcategory ? 600 : 400, color: subcategory ? "var(--sky)" : "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {subcategory ? tSubName(subcategory, selectedCategory.id) : t("tx_choose_subcategory")}
            </span>
            <i className={`ti ti-chevron-${showSubPicker ? "up" : "down"}`} style={{ fontSize: 16, color: subcategory ? "var(--sky)" : "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
          </div>

          {showSubPicker && (
            <div style={{ marginTop: 8, border: "0.5px solid var(--rule)", borderRadius: "var(--radius-md)", padding: 6, background: "var(--bg-card)" }}>
              {selectedCategory.subcategories.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, maxHeight: 320, overflowY: "auto" }}>
                  {selectedCategory.subcategories.map((s) => {
                    const sel = subcategory === s;
                    return (
                      <div
                        key={s}
                        onClick={() => selectSubcategory(s)}
                        style={{
                          display: "flex", alignItems: "center", gap: 9, height: 40, padding: "0 11px", cursor: "pointer",
                          borderRadius: 8, minWidth: 0,
                          background: sel ? "color-mix(in srgb, var(--sky) 12%, transparent)" : "transparent",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            color: sel ? "var(--sky)" : "var(--ink-2)", fontWeight: sel ? 600 : 400,
                          }}
                        >
                          {tSubName(s, selectedCategory.id)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!showNewSub ? (
                <button
                  onClick={() => setShowNewSub(true)}
                  style={{
                    marginTop: 6, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    height: 40, borderRadius: "var(--radius-md)",
                    background: "color-mix(in srgb, var(--sky) 10%, transparent)", border: "0.5px solid color-mix(in srgb, var(--sky) 30%, transparent)",
                    fontSize: 13, fontWeight: 600, color: "var(--sky)", cursor: "pointer",
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 16 }} aria-hidden="true" />
                  {t("tx_new_subcategory")}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 6, padding: "8px 4px 4px" }}>
                  <input
                    type="text"
                    autoFocus
                    placeholder={t("tx_subcategory_name")}
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
            </div>
          )}
        </>
      )}
    </SectionCard>
  );

  const dateCard = (
    <SectionCard accent="var(--lavi)" icon="ti-calendar" title={t("tx_date_recurrence")} style={wide ? { minHeight: 150 } : undefined}>
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--ink) 4%, transparent)" }}>
        <i className="ti ti-clock" style={{ fontSize: 16, color: "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
        <input
          type="datetime-local"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          style={{
            flex: 1, minWidth: 0, border: "none", background: "transparent",
            fontSize: 14, outline: "none", color: "var(--ink)", fontVariantNumeric: "tabular-nums",
          }}
        />
      </div>

      {!isEditing && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={makeRecurring}
              onChange={(e) => setMakeRecurring(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>{t("tx_make_recurring")}</span>
            <i className="ti ti-repeat" style={{ fontSize: 16, color: "var(--lavi)" }} aria-hidden="true" />
          </label>

          {makeRecurring && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 8 }}>{t("recurring_frequency")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[
                  { key: "monthly", label: t("recurring_freq_monthly") },
                  { key: "weekly", label: t("recurring_freq_weekly") },
                  { key: "yearly", label: t("recurring_freq_yearly") },
                ].map((f) => (
                  <button key={f.key} onClick={() => setRecurringFrequency(f.key)} style={segStyle(recurringFrequency === f.key, "var(--lavi)")}>
                    {f.label}
                  </button>
                ))}
              </div>
              {recurringFrequency === "monthly" && (
                <>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 8 }}>{t("recurring_day_of_month")}</div>
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
    </SectionCard>
  );

  const attributionCard = members.length > 0 && (
    <SectionCard accent="var(--mint)" icon="ti-users" title={t("tx_paid_for")}>
      <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {needsMemberAttribution ? t("tx_received_by") : t("tx_paid_by")}
      </div>
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: `repeat(${members.length}, 1fr)`, gap: 8 }}>
        {members.map((m) => {
          const sel = paidBy === getMemberKey(m);
          return (
            <button key={getMemberKey(m)} onClick={() => setPaidBy(getMemberKey(m))} style={segStyle(sel, "var(--mint)")}>
              {m.name}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {financeMode === "common" ? t("tx_beneficiary") : t("tx_for")}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {financeMode === "common" && (
          <button
            onClick={() => { setSplit("50/50"); setSplitMode("simple"); setSplitDetails(null); }}
            style={{ ...segStyle(split === "50/50" && splitMode === "simple", "var(--mint)"), flex: 1 }}
          >
            {t("tx_common")}
          </button>
        )}
        {members.map((m) => {
          const sel = split === getMemberKey(m) && splitMode === "simple";
          return (
            <button
              key={getMemberKey(m)}
              onClick={() => { setSplit(getMemberKey(m)); setSplitMode("simple"); }}
              style={{ ...segStyle(sel, "var(--mint)"), flex: 1 }}
            >
              {m.name}
            </button>
          );
        })}
        {financeMode !== "common" && members.length === 2 && (
          <button
            onClick={() => {
              setSplit("50/50");
              setSplitMode("advanced");
              if (!splitDetails) {
                setSplitDetails({ mode: "custom", unit: "percent", a: 50, b: 50 });
              }
            }}
            aria-label={t("tx_split_share")}
            style={{ ...segStyle(splitMode === "advanced", "var(--mint)"), flex: 1 }}
          >
            <i className="ti ti-arrows-split" style={{ fontSize: 15 }} aria-hidden="true" />
            {t("tx_split_share")}
          </button>
        )}
      </div>

      {financeMode !== "common" && splitMode === "advanced" && members.length === 2 && (
        <div style={{ marginTop: 10 }}>
          <AdvancedSplitSelector
            members={members}
            totalAmount={parseFloat(amount) || 0}
            value={splitDetails}
            onChange={setSplitDetails}
          />
        </div>
      )}
    </SectionCard>
  );

  const tagsCard = (
    <SectionCard
      accent="var(--amber)"
      icon="ti-tag"
      title={t("tx_tags")}
      extra={
        <>
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· {t("tx_optional")}</span>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setShowTagManager((v) => !v)}
            aria-label={t("dashboard_customize")}
            title={t("dashboard_customize")}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 99,
              background: showTagManager ? "color-mix(in srgb, var(--sky) 12%, transparent)" : "var(--bg-card)",
              border: `0.5px solid ${showTagManager ? "var(--sky)" : "var(--rule)"}`,
              color: "var(--sky)", cursor: "pointer", flexShrink: 0,
            }}
          >
            <i className="ti ti-pencil" style={{ fontSize: 14 }} aria-hidden="true" />
          </button>
        </>
      }
    >
      <div style={{ marginTop: 12 }}>
        <TagInput value={tags} onChange={setTags} />
      </div>
      {showTagManager && (
        <div style={{ marginTop: 12, borderTop: "0.5px solid var(--rule)", paddingTop: 10 }}>
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8 }}>
            <i className="ti ti-grip-vertical" style={{ fontSize: 12, verticalAlign: -2 }} aria-hidden="true" />
            {" "}{t("categories_drag_hint")}
          </p>
          <TagManager />
        </div>
      )}
    </SectionCard>
  );

  return (
    <div className="app-modal tx-modal" style={{ display: "flex", flexDirection: "column" }}>
      {/* En-tête : pastille fermer · titre centré · supprimer (édition) */}
      <div
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
          padding: "14px 20px", background: "var(--bg)",
          borderBottom: "0.5px solid var(--rule)", zIndex: 10,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none", color: "var(--ink-2)", cursor: "pointer" }}
        >
          <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          {isEditing ? t("tx_edit") : t("tx_new")}
        </h1>
        {isEditing ? (
          <button
            onClick={async () => {
              if (confirm(t("tx_delete_confirm"))) {
                await deleteTransaction(editingTx.id);
                onClose();
              }
            }}
            aria-label={t("tx_delete")}
            style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--over) 12%, transparent)", border: "none", color: "var(--over)", cursor: "pointer" }}
          >
            <i className="ti ti-trash" style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        ) : (
          <span style={{ width: 32, height: 32, flexShrink: 0 }} />
        )}
      </div>

      {/* Corps défilant */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        {!isEditing && (
          <QuickAddBar language={language} onApply={applyNaturalLanguage} />
        )}

        {/* Type — segments à code sémantique (dépense/revenu/invest.) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { key: "expense", label: t("tx_expense"), color: "var(--tang)", icon: "ti-arrow-down-left" },
            { key: "income", label: t("tx_income"), color: "var(--good)", icon: "ti-arrow-up-right" },
            { key: "investment", label: t("tx_investment"), color: "var(--lavi)", icon: "ti-trending-up" },
          ].map((opt) => {
            const sel = type === opt.key;
            return (
              <button key={opt.key} onClick={() => handleTypeChange(opt.key)} style={{ ...segStyle(sel, opt.color), height: 42, fontSize: 13.5 }}>
                <i className={`ti ${opt.icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Colonnes (2 sur desktop large, empilées sinon) */}
        <div style={wide ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" } : { display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {montantCard}
            {descriptionCard}
            {categoryCard}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            {dateCard}
            {attributionCard}
            {tagsCard}
          </div>
        </div>

        {/* Fil de discussion — seulement sur une transaction existante */}
        {isEditing && <TransactionComments txId={editingTx.id} />}
      </div>

      {/* Enregistrer — collé en bas */}
      <div
        style={{
          flexShrink: 0,
          padding: "14px 20px calc(14px + env(safe-area-inset-bottom))",
          background: "var(--bg)",
          borderTop: "0.5px solid var(--rule)",
        }}
      >
        <button
          onClick={handleSave}
          disabled={!amount || !categoryId || busy}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            height: 50, borderRadius: "var(--radius-md)",
            background: "var(--ink)", color: "var(--bg)", border: "none",
            fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-display)", cursor: "pointer",
            opacity: !amount || !categoryId || busy ? 0.5 : 1,
          }}
        >
          <i className="ti ti-check" style={{ fontSize: 18 }} aria-hidden="true" />
          {uploadingReceipt ? t("tx_uploading_receipt") : busy ? t("tx_saving") : isEditing ? t("tx_update") : t("tx_save")}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { ASSET_TYPES, getAssetSubtypes } from "../data/assetTypes";
import { loanType } from "../data/loanTypes";
import { searchCrypto, searchStocks } from "../utils/assetSearch";
import { useTranslation } from "../hooks/useTranslation";
import AdvancedSplitSelector from "../components/AdvancedSplitSelector";
import CurrencyField from "../components/CurrencyField";
import AssetComments from "../components/AssetComments";
import { getMemberKey } from "../utils/members";
import { notifySuccess } from "../utils/successCheck";

// Carte de section « 1B Chaleureux » : en-tête pastille (icône teintée + titre),
// identique à AddTransactionScreen. `accent` est une couleur token.
function SectionCard({ accent, icon, title, extra, children, style }) {
  return (
    <div
      className="pw-chip-host pw-lift"
      style={{ background: "var(--bg-card)", border: "0.5px solid var(--rule)", borderRadius: "var(--radius-lg)", padding: 16, ...style }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
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

// Segment/chip sélectionnable (type d'actif, propriété) : bord + fond teinté quand actif.
function segStyle(selected, accent) {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "9px 12px", borderRadius: "var(--radius-md)", cursor: "pointer",
    border: `0.5px solid ${selected ? accent : "var(--rule)"}`,
    background: selected ? `color-mix(in srgb, ${accent} 13%, transparent)` : "var(--bg-card)",
    color: selected ? accent : "var(--ink-3)",
    fontSize: 13, fontWeight: selected ? 600 : 400,
    transition: "background-color .18s ease, color .18s ease, border-color .18s ease",
  };
}

const bareInput = {
  width: "100%", padding: "8px 0", border: "none",
  borderBottom: "0.5px solid var(--rule)", background: "transparent",
  fontSize: 14, outline: "none", color: "var(--ink)",
};


export default function AddAssetScreen({ onClose, editingAsset, initialTypeId }) {
  const t = useTranslation();
  const { language } = useFinance();
  const {
    addAsset, updateAsset, removeAsset, defaultCurrency, members,
    contributeToAsset, addAssetContribution, removeAssetContribution, assetContributions,
    recurringTx, addRecurring, removeRecurring, loans,
  } = useFinance();
  const { user } = useAuth();
  const isEditing = !!editingAsset;

  const [typeId, setTypeId] = useState(editingAsset?.typeId || initialTypeId || "cash");
  const [subtype, setSubtype] = useState(editingAsset?.subtype || "");
  const [loanId, setLoanId] = useState(editingAsset?.loanId || "");
  // Mode « surprise » (cadeau) : actif visible uniquement par son auteur·rice.
  const myMemberKey = getMemberKey(members.find((m) => m.uid === user?.uid)) || user?.uid;
  const [isPrivate, setIsPrivate] = useState(!!editingAsset?.privateTo);
  const [name, setName] = useState(editingAsset?.name || "");
  const [value, setValue] = useState(editingAsset?.value?.toString() || "");
  const [currency, setCurrency] = useState(editingAsset?.currency || defaultCurrency);
  const [quantity, setQuantity] = useState(editingAsset?.quantity?.toString() || "");
  const [manualPrice, setManualPrice] = useState(editingAsset?.manualPrice?.toString() || "");
  // Coût investi (lot 2) : montant total investi pour les actifs à valeur stockée,
  // prix d'achat MOYEN par unité pour les actifs cotés (× quantité à la sauvegarde).
  const [costBasisInput, setCostBasisInput] = useState(editingAsset?.costBasis?.toString() || "");
  const [avgPrice, setAvgPrice] = useState(
    editingAsset?.costBasis && editingAsset?.quantity
      ? (editingAsset.costBasis / editingAsset.quantity).toString()
      : ""
  );
  // Versements vers l'actif (lot 3) — édition uniquement (il faut un id).
  const [contribAmount, setContribAmount] = useState("");
  const [contribCurrency, setContribCurrency] = useState(editingAsset?.currency || defaultCurrency);
  const [contribFreq, setContribFreq] = useState("monthly");
  const [contribBusy, setContribBusy] = useState(false);

  async function handleAddContribution() {
    const amt = parseFloat(contribAmount);
    if (!(amt > 0) || !editingAsset) return;
    setContribBusy(true);
    try {
      if (contribFreq === "once") {
        // Ponctuel : crédit immédiat (pas de règle stockée).
        await contributeToAsset(editingAsset.id, amt, contribCurrency);
        notifySuccess();
      } else {
        await addAssetContribution({
          assetId: editingAsset.id,
          amount: amt,
          currency: contribCurrency,
          frequency: contribFreq,
        });
      }
      setContribAmount("");
    } catch (err) {
      console.error(err);
    } finally {
      setContribBusy(false);
    }
  }

  // Revenu d'actif (loyer / dividende / intérêts) — enregistré comme règle
  // récurrente de revenu rattachée à l'actif (assetId), générée automatiquement
  // par useRecurringGenerator (transactions de revenu → visibles dans les
  // revenus et rapports, et créditent un compte si la sous-catégorie y est liée).
  const [incAmount, setIncAmount] = useState("");
  const [incCurrency, setIncCurrency] = useState(editingAsset?.currency || defaultCurrency);
  const [incFreq, setIncFreq] = useState("monthly");
  const [incKind, setIncKind] = useState("rent");
  const [incBusy, setIncBusy] = useState(false);

  async function handleAddIncome() {
    const amt = parseFloat(incAmount);
    if (!(amt > 0) || !editingAsset) return;
    setIncBusy(true);
    try {
      const label = t(`asset_income_${incKind}`);
      const owner = editingAsset.ownership && editingAsset.ownership !== "shared"
        ? editingAsset.ownership
        : user.uid;
      await addRecurring({
        type: "income",
        amount: amt,
        currency: incCurrency,
        categoryId: "income",
        subcategory: label,
        description: `${label} · ${editingAsset.name}`,
        frequency: incFreq,
        dayOfMonth: 1,
        paidBy: owner,
        split: "100",
        active: true,
        lastGenerated: null,
        assetId: editingAsset.id,
      });
      setIncAmount("");
    } catch (err) {
      console.error(err);
    } finally {
      setIncBusy(false);
    }
  }
  const [apiId, setApiId] = useState(editingAsset?.apiId || "");
  const [apiLabel, setApiLabel] = useState(editingAsset?.apiLabel || "");
  const [busy, setBusy] = useState(false);

  // Recherche d'actif via API
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  // Propriété de l'actif (qui possède quoi)
  const [ownership, setOwnership] = useState(
    editingAsset?.ownership || (members[0] ? getMemberKey(members[0]) : "shared")
  );
  const [sharePct, setSharePct] = useState(editingAsset?.sharePct ?? 50);
  const [sharePctDetails, setSharePctDetails] = useState(editingAsset?.sharePctDetails || null);

  const selectedType = ASSET_TYPES.find((t) => t.id === typeId);
  const usesApi = selectedType?.hasApiPrice;

  useEffect(() => {
    if (!usesApi || searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results =
        selectedType.priceSource === "crypto"
          ? await searchCrypto(searchQuery)
          : await searchStocks(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, typeId]);

  function selectSearchResult(result) {
    if (selectedType.priceSource === "crypto") {
      setApiId(result.id);
      setApiLabel(`${result.name} (${result.symbol})`);
    } else {
      setApiId(result.symbol);
      setApiLabel(`${result.name} (${result.symbol})`);
    }
    setShowResults(false);
    setSearchQuery("");
  }

  const typeName = language === "en" && selectedType?.nameEn ? selectedType.nameEn : selectedType?.name;

  async function handleSave() {
    // Nom optionnel : si vide, on retombe sur le nom du type (ex. "Autres actifs").
    if (!usesApi && !value) return;
    if (usesApi && !quantity) return;

    setBusy(true);
    try {
      // Coût investi normalisé (devise de l'actif). Cotés : prix moyen × quantité.
      const costBasisVal = usesApi
        ? (avgPrice && quantity ? parseFloat(avgPrice) * parseFloat(quantity) : null)
        : (costBasisInput ? parseFloat(costBasisInput) : null);

      const payload = {
        typeId,
        subtype: subtype || null,
        loanId: (typeId === "real_estate" || typeId === "vehicle") ? (loanId || null) : null,
        name: name.trim() || typeName || "Actif",
        currency,
        ownership,
        sharePct: ownership === "shared" ? sharePct : 100,
        sharePctDetails: ownership === "shared" ? sharePctDetails : null,
        privateTo: isPrivate ? myMemberKey : null,
        costBasis: Number.isFinite(costBasisVal) ? costBasisVal : null,
        ...(usesApi
          ? { quantity: parseFloat(quantity), apiId, apiLabel, manualPrice: parseFloat(manualPrice) || null }
          : { value: parseFloat(value) }),
      };

      if (isEditing) {
        await updateAsset(editingAsset.id, payload);
      } else {
        await addAsset(payload);
        notifySuccess();
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(t("asset_delete_confirm"))) return;
    await removeAsset(editingAsset.id);
    onClose();
  }

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
          {isEditing ? t("asset_edit_title") : t("asset_new_title")}
        </h1>
        {/* Mode surprise (cadeau) : bascule discrète, s'il y a un·e partenaire. */}
        {members.length > 1 && (
          <button
            onClick={() => setIsPrivate((v) => !v)}
            aria-pressed={isPrivate}
            aria-label={t("private_toggle")}
            title={isPrivate ? t("private_on_hint_asset") : t("private_toggle")}
            style={{
              width: 32, height: 32, borderRadius: 99, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: isPrivate ? "color-mix(in srgb, var(--lavi) 15%, transparent)" : "transparent",
              border: "none", color: isPrivate ? "var(--lavi)" : "var(--ink-3)", cursor: "pointer",
            }}
          >
            <i className={`ti ${isPrivate ? "ti-gift" : "ti-gift-off"}`} style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        )}
        {isEditing ? (
          <button
            onClick={handleDelete}
            aria-label={t("asset_delete_button")}
            style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--red) 12%, transparent)", border: "none", color: "var(--red)", cursor: "pointer" }}
          >
            <i className="ti ti-trash" style={{ fontSize: 17 }} aria-hidden="true" />
          </button>
        ) : (
          <span style={{ width: 32, height: 32, flexShrink: 0 }} />
        )}
      </div>

      {/* Corps défilant */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
        {isPrivate && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
            borderRadius: "var(--radius-md)", background: "color-mix(in srgb, var(--lavi) 12%, transparent)",
          }}>
            <i className="ti ti-gift" style={{ fontSize: 15, color: "var(--lavi)", flexShrink: 0 }} aria-hidden="true" />
            <span style={{ fontSize: 12, color: "var(--lavi)", lineHeight: 1.4 }}>{t("private_on_hint_asset")}</span>
          </div>
        )}

        {/* Type d'actif */}
        <SectionCard accent="var(--sky)" icon="ti-category-2" title={t("asset_type_label")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ASSET_TYPES.filter(
              // Les dettes/crédits sont désormais gérés par le module Crédits :
              // on masque le type « dette » à la création (mais on le garde à
              // l'édition d'un actif hérité déjà enregistré comme dette).
              (at) => !at.isLiability || at.id === editingAsset?.typeId
            ).map((at) => {
              const sel = typeId === at.id;
              return (
                <button
                  key={at.id}
                  onClick={() => { setTypeId(at.id); setSubtype(""); setApiId(""); setApiLabel(""); }}
                  style={segStyle(sel, "var(--sky)")}
                >
                  <i className={`ti ${at.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
                  {language === "en" && at.nameEn ? at.nameEn : at.name}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.4 }}>
            {language === "en" && selectedType?.descriptionEn ? selectedType.descriptionEn : selectedType?.description}
          </p>
        </SectionCard>

        {/* Sous-type / enveloppe (optionnel) — PEA vs CTO, fonds euros vs UC,
            401(k) vs Roth IRA, locatif vs SCPI… Un clic sur la puce sélectionnée
            la désélectionne (retour à « aucun »). */}
        {getAssetSubtypes(typeId).length > 0 && (
          <SectionCard
            accent="var(--amber)"
            icon="ti-license"
            title={t("asset_subtype_label")}
            extra={<span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 400 }}>· {t("tx_optional")}</span>}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {getAssetSubtypes(typeId).map((s) => {
                const sel = subtype === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSubtype(sel ? "" : s.id)}
                    style={segStyle(sel, "var(--amber)")}
                  >
                    {language === "en" ? s.en : s.fr}
                  </button>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Nom */}
        <SectionCard
          accent="var(--ocean)"
          icon="ti-tag"
          title={t("asset_name_label")}
          extra={<span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 400 }}>· {t("tx_optional")}</span>}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={typeName || t("asset_name_placeholder")}
            style={bareInput}
          />
        </SectionCard>

        {/* Valeur (manuel) ou Recherche + Quantité (API) */}
        {!usesApi ? (
          <SectionCard accent="var(--good)" icon="ti-coin" title={t("asset_value_label")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                style={{ ...bareInput, flex: 1, fontSize: 18 }}
              />
              <CurrencyField value={currency} onChange={setCurrency} />
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            accent="var(--lavi)"
            icon="ti-chart-candle"
            title={selectedType.priceSource === "crypto" ? "Cryptomonnaie" : "Action / ETF"}
          >
            {apiLabel ? (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                  borderBottom: "0.5px solid var(--rule)",
                }}
              >
                <span style={{ fontSize: 14, flex: 1 }}>{apiLabel}</span>
                <button
                  onClick={() => { setApiId(""); setApiLabel(""); }}
                  style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 12 }}
                >
                  {t("asset_change_button")}
                </button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  placeholder={
                    selectedType.priceSource === "crypto"
                      ? t("asset_search_placeholder_crypto")
                      : t("asset_search_placeholder_stock")
                  }
                  style={bareInput}
                />
                {searching && (
                  <i
                    className="ti ti-loader-2"
                    style={{ position: "absolute", right: 0, top: 8, fontSize: 14, color: "var(--ink-3)" }}
                    aria-hidden="true"
                  />
                )}

                {showResults && searchResults.length > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "0.5px solid var(--rule)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg)",
                    }}
                  >
                    {searchResults.map((r) => (
                      <div
                        key={r.id || r.symbol}
                        onClick={() => selectSearchResult(r)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "10px 12px", cursor: "pointer",
                          borderBottom: "0.5px solid var(--rule)",
                        }}
                      >
                        <span style={{ fontSize: 13, flex: 1 }}>{r.name}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.symbol}</span>
                      </div>
                    ))}
                  </div>
                )}
                {showResults && searchQuery.length > 0 && !searching && searchResults.length === 0 && (
                  <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                    {t("asset_no_results")}
                  </p>
                )}
              </div>
            )}

            <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "14px 0 4px" }}>{t("asset_quantity_label")}</p>
            <input
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={{ ...bareInput, fontSize: 18 }}
            />
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
              <i className="ti ti-info-circle" style={{ fontSize: 12, verticalAlign: -1 }} aria-hidden="true" /> {t("asset_auto_value_hint")}
            </p>

            {/* Prix unitaire manuel (repli) : utilisé quand l'API de cotation ne
                price pas l'actif (clé "demo" limitée) → le montant s'affiche quand même. */}
            <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "14px 0 4px" }}>{t("asset_manual_price_label")}</p>
            <input
              type="number"
              inputMode="decimal"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="0"
              style={{ ...bareInput, fontSize: 16 }}
            />
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>{t("asset_manual_price_hint")}</p>
          </SectionCard>
        )}

        {/* Coût investi / prix d'achat (optionnel) — sert au calcul de la
            plus-value latente affichée dans le Patrimoine (lot 2). */}
        <SectionCard
          accent="var(--amber)"
          icon="ti-receipt"
          title={usesApi ? t("asset_avg_price_label") : t("asset_cost_basis_label")}
          extra={<span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 400 }}>· {t("tx_optional")}</span>}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              inputMode="decimal"
              value={usesApi ? avgPrice : costBasisInput}
              onChange={(e) => (usesApi ? setAvgPrice(e.target.value) : setCostBasisInput(e.target.value))}
              placeholder="0"
              style={{ ...bareInput, flex: 1, fontSize: 16 }}
            />
            {usesApi ? (
              <CurrencyField value={currency} onChange={setCurrency} suffix="/ u." />
            ) : (
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{currency}</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
            {usesApi ? t("asset_avg_price_hint") : t("asset_cost_basis_hint")}
          </p>
        </SectionCard>

        {/* Prêt lié (immobilier / véhicule) : permet d'afficher l'equity nette
            (valeur du bien − capital restant dû) sur la ligne d'actif. */}
        {(typeId === "real_estate" || typeId === "vehicle") && (
          <SectionCard
            accent="var(--tang)"
            icon="ti-link"
            title={t("asset_loan_link_label")}
            extra={<span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 400 }}>· {t("tx_optional")}</span>}
          >
            {loans && loans.length > 0 ? (
              <select
                value={loanId}
                onChange={(e) => setLoanId(e.target.value)}
                style={{
                  width: "100%", padding: "9px 10px", borderRadius: "var(--radius-md)",
                  border: "0.5px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", fontSize: 14,
                }}
              >
                <option value="">{t("asset_loan_none")}</option>
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>{l.name || t(`loan_type_${loanType(l.type).id}`)}</option>
                ))}
              </select>
            ) : (
              <p style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("asset_loan_empty")}</p>
            )}
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{t("asset_loan_link_hint")}</p>
          </SectionCard>
        )}

        {/* Propriété / partage */}
        {members.length > 0 && (
          <SectionCard accent="var(--lavi)" icon="ti-users" title={t("asset_ownership_label")}>
            <div style={{ display: "flex", gap: 6, marginBottom: ownership === "shared" ? 14 : 0 }}>
              {members.map((m) => (
                <button
                  key={getMemberKey(m)}
                  onClick={() => setOwnership(getMemberKey(m))}
                  style={{ ...segStyle(ownership === getMemberKey(m), "var(--sky)"), flex: 1 }}
                >
                  {m.name}
                </button>
              ))}
              <button
                onClick={() => setOwnership("shared")}
                style={{ ...segStyle(ownership === "shared", "var(--lavi)"), flex: 1 }}
              >
                {t("asset_shared")}
              </button>
            </div>

            {ownership === "shared" && (
              <AdvancedSplitSelector
                members={members}
                totalAmount={usesApi ? 0 : parseFloat(value) || 0}
                value={
                  sharePctDetails || {
                    mode: "custom",
                    unit: "percent",
                    a: sharePct,
                    b: 100 - sharePct,
                  }
                }
                onChange={(details) => {
                  setSharePctDetails(details);
                  // On garde sharePct synchronisé pour rétro-compatibilité avec
                  // le code existant qui lit ce champ (résumés, calculs simples).
                  if (details.unit === "percent") {
                    setSharePct(Math.round(details.a));
                  } else {
                    const total = details.a + details.b;
                    setSharePct(total > 0 ? Math.round((details.a / total) * 100) : 50);
                  }
                }}
              />
            )}
          </SectionCard>
        )}

        {/* Versements vers l'actif (édition, actifs à valeur stockée) : ponctuel
            (crédit immédiat) ou récurrent (quotidien/hebdo/mensuel, appliqué par
            le runner). Chaque versement alimente aussi le coût investi. */}
        {isEditing && !usesApi && (
          <SectionCard accent="var(--sage)" icon="ti-pig-money" title={t("asset_contrib_title")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {[["once", "asset_contrib_once"], ["daily", "asset_contrib_daily"], ["weekly", "asset_contrib_weekly"], ["monthly", "asset_contrib_monthly"]].map(([f, k]) => (
                <button key={f} onClick={() => setContribFreq(f)} style={{ ...segStyle(contribFreq === f, "var(--sage)"), flex: "1 1 40%" }}>
                  {t(k)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                value={contribAmount}
                onChange={(e) => setContribAmount(e.target.value)}
                placeholder="0"
                style={{ ...bareInput, flex: 1, fontSize: 16 }}
              />
              <CurrencyField value={contribCurrency} onChange={setContribCurrency} />
              <button
                onClick={handleAddContribution}
                disabled={contribBusy || !(parseFloat(contribAmount) > 0)}
                style={{
                  padding: "8px 14px", borderRadius: "var(--radius-md)", border: "none",
                  background: "var(--sage)", color: "#fff", fontSize: 13, fontWeight: 600,
                  whiteSpace: "nowrap",
                  opacity: contribBusy || !(parseFloat(contribAmount) > 0) ? 0.5 : 1,
                }}
              >
                {contribFreq === "once" ? t("asset_contrib_add_once") : t("asset_contrib_add")}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{t("asset_contrib_hint")}</p>

            {assetContributions.filter((c) => c.assetId === editingAsset.id).length > 0 && (
              <div style={{ marginTop: 12, borderTop: "0.5px solid var(--rule)", paddingTop: 8 }}>
                {assetContributions.filter((c) => c.assetId === editingAsset.id).map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                    <i className="ti ti-repeat" style={{ fontSize: 14, color: "var(--sage)" }} aria-hidden="true" />
                    <span style={{ fontSize: 13, flex: 1 }}>
                      {Math.round(c.amount).toLocaleString("fr-FR")} {c.currency} · {t(`asset_contrib_${c.frequency}`)}
                    </span>
                    <button onClick={() => removeAssetContribution(c.id)} aria-label={t("asset_delete_button")} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>
                      <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* Revenus générés par l'actif (loyer / dividende / intérêts) : règle de
            revenu récurrente rattachée à l'actif, générée automatiquement dans
            les revenus (et rapports). Disponible pour tous les types. */}
        {isEditing && (
          <SectionCard accent="var(--good)" icon="ti-cash-banknote" title={t("asset_income_title")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {[["rent", "asset_income_rent"], ["dividend", "asset_income_dividend"], ["interest", "asset_income_interest"], ["other", "asset_income_other"]].map(([k, tk]) => (
                <button key={k} onClick={() => setIncKind(k)} style={{ ...segStyle(incKind === k, "var(--good)"), flex: "1 1 40%" }}>
                  {t(tk)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {[["weekly", "asset_contrib_weekly"], ["monthly", "asset_contrib_monthly"], ["yearly", "asset_income_yearly"]].map(([f, tk]) => (
                <button key={f} onClick={() => setIncFreq(f)} style={{ ...segStyle(incFreq === f, "var(--good)"), flex: "1 1 30%" }}>
                  {t(tk)}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                value={incAmount}
                onChange={(e) => setIncAmount(e.target.value)}
                placeholder="0"
                style={{ ...bareInput, flex: 1, fontSize: 16 }}
              />
              <CurrencyField value={incCurrency} onChange={setIncCurrency} />
              <button
                onClick={handleAddIncome}
                disabled={incBusy || !(parseFloat(incAmount) > 0)}
                style={{
                  padding: "8px 14px", borderRadius: "var(--radius-md)", border: "none",
                  background: "var(--good)", color: "#fff", fontSize: 13, fontWeight: 600,
                  whiteSpace: "nowrap",
                  opacity: incBusy || !(parseFloat(incAmount) > 0) ? 0.5 : 1,
                }}
              >
                {t("asset_income_add")}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{t("asset_income_hint")}</p>

            {recurringTx.filter((r) => r.assetId === editingAsset.id).length > 0 && (
              <div style={{ marginTop: 12, borderTop: "0.5px solid var(--rule)", paddingTop: 8 }}>
                {recurringTx.filter((r) => r.assetId === editingAsset.id).map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                    <i className="ti ti-cash-banknote" style={{ fontSize: 14, color: "var(--good)" }} aria-hidden="true" />
                    <span style={{ fontSize: 13, flex: 1 }}>
                      {Math.round(r.amount).toLocaleString("fr-FR")} {r.currency} · {r.subcategory} · {t(r.frequency === "yearly" ? "asset_income_yearly" : `asset_contrib_${r.frequency}`)}
                    </span>
                    <button onClick={() => removeRecurring(r.id)} aria-label={t("asset_delete_button")} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>
                      <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* Discussion sur l'actif (édition uniquement — il faut un id) : le
            couple peut échanger sur l'investissement (on vend, on rachète…). */}
        {isEditing && (
          <div style={{ padding: "0 20px" }}>
            <AssetComments assetId={editingAsset.id} />
          </div>
        )}
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
          disabled={busy || (!usesApi && !value) || (usesApi && (!quantity || !apiId))}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            height: 50, borderRadius: "var(--radius-md)",
            background: "var(--ink)", color: "var(--bg)", border: "none",
            fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-display)", cursor: "pointer",
            opacity: busy || (!usesApi && !value) || (usesApi && (!quantity || !apiId)) ? 0.5 : 1,
          }}
        >
          <i className="ti ti-check" style={{ fontSize: 18 }} aria-hidden="true" />
          {busy ? t("tx_saving") : isEditing ? t("asset_update_button") : t("asset_save_button")}
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { ASSET_TYPES } from "../data/assetTypes";
import { CURRENCIES } from "../data/categories";
import { searchCrypto, searchStocks } from "../utils/assetSearch";
import { useTranslation } from "../hooks/useTranslation";
import AdvancedSplitSelector from "../components/AdvancedSplitSelector";
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

export default function AddAssetScreen({ onClose, editingAsset }) {
  const t = useTranslation();
  const { language } = useFinance();
  const { addAsset, updateAsset, removeAsset, defaultCurrency, members } = useFinance();
  const isEditing = !!editingAsset;

  const [typeId, setTypeId] = useState(editingAsset?.typeId || "cash");
  const [name, setName] = useState(editingAsset?.name || "");
  const [value, setValue] = useState(editingAsset?.value?.toString() || "");
  const [currency, setCurrency] = useState(editingAsset?.currency || defaultCurrency);
  const [quantity, setQuantity] = useState(editingAsset?.quantity?.toString() || "");
  const [manualPrice, setManualPrice] = useState(editingAsset?.manualPrice?.toString() || "");
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
      const payload = {
        typeId,
        name: name.trim() || typeName || "Actif",
        currency,
        ownership,
        sharePct: ownership === "shared" ? sharePct : 100,
        sharePctDetails: ownership === "shared" ? sharePctDetails : null,
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
                  onClick={() => { setTypeId(at.id); setApiId(""); setApiLabel(""); }}
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
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  padding: "6px 8px", borderRadius: "var(--radius-sm)",
                  border: "0.5px solid var(--rule)", fontSize: 13, background: "var(--bg)", color: "var(--ink)",
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
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

import { useState, useEffect, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { ASSET_TYPES } from "../data/assetTypes";
import { CURRENCIES } from "../data/categories";
import { searchCrypto, searchStocks } from "../utils/assetSearch";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";
import AdvancedSplitSelector from "../components/AdvancedSplitSelector";
import { getMemberKey } from "../utils/members";

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

  async function handleSave() {
    if (!name.trim()) return;
    if (!usesApi && !value) return;
    if (usesApi && !quantity) return;

    setBusy(true);
    try {
      const payload = {
        typeId,
        name: name.trim(),
        currency,
        ownership,
        sharePct: ownership === "shared" ? sharePct : 100,
        sharePctDetails: ownership === "shared" ? sharePctDetails : null,
        ...(usesApi
          ? { quantity: parseFloat(quantity), apiId, apiLabel }
          : { value: parseFloat(value) }),
      };

      if (isEditing) {
        await updateAsset(editingAsset.id, payload);
      } else {
        await addAsset(payload);
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
    <div className="app-modal">
      <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none" }}>
            <i className="ti ti-x" style={{ fontSize: 20 }} aria-hidden="true" />
          </button>
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>
            {isEditing ? t("asset_edit_title") : t("asset_new_title")}
          </h1>
          <div style={{ width: 20 }} />
        </div>

        {/* Type d'actif */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>{t("asset_type_label")}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ASSET_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTypeId(t.id); setApiId(""); setApiLabel(""); }}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--radius-md)",
                  border: typeId === t.id ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                  background: typeId === t.id ? "var(--sky-light)" : "var(--bg)",
                  color: typeId === t.id ? "var(--sky)" : "var(--ink)",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <i className={`ti ${t.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                {language === "en" && t.nameEn ? t.nameEn : t.name}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
            {language === "en" && selectedType?.descriptionEn ? selectedType.descriptionEn : selectedType?.description}
          </p>
        </div>

        {/* Nom */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("asset_name_label")}</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("asset_name_placeholder")}
            style={{
              width: "100%", padding: "8px 0", border: "none",
              borderBottom: "0.5px solid var(--rule)", background: "transparent",
              fontSize: 14, outline: "none",
            }}
          />
        </div>

        {/* Valeur (manuel) ou Recherche + Quantité (API) */}
        {!usesApi ? (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--rule)",
              padding: "1rem 1.25rem",
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>{t("asset_value_label")}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                style={{
                  flex: 1, padding: "8px 0", border: "none",
                  borderBottom: "0.5px solid var(--rule)", background: "transparent",
                  fontSize: 18, outline: "none",
                }}
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  padding: "6px 8px", borderRadius: "var(--radius-sm)",
                  border: "0.5px solid var(--rule)", fontSize: 13, background: "var(--bg)",
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
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
              {selectedType.priceSource === "crypto" ? "Cryptomonnaie" : "Action / ETF"}
            </p>

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
                  style={{
                    width: "100%", padding: "8px 0", border: "none",
                    borderBottom: "0.5px solid var(--rule)", background: "transparent",
                    fontSize: 14, outline: "none",
                  }}
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

            <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "12px 0 6px" }}>{t("asset_quantity_label")}</p>
            <input
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              style={{
                width: "100%", padding: "8px 0", border: "none",
                borderBottom: "0.5px solid var(--rule)", background: "transparent",
                fontSize: 18, outline: "none",
              }}
            />
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>
              <i className="ti ti-info-circle" style={{ fontSize: 12, verticalAlign: -1 }} aria-hidden="true" /> {t("asset_auto_value_hint")}
            </p>
          </div>
        )}

        {/* Propriété / partage */}
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
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>{t("asset_ownership_label")}</p>
            <div style={{ display: "flex", gap: 6, marginBottom: ownership === "shared" ? 14 : 0 }}>
              {members.map((m) => (
                <button
                  key={getMemberKey(m)}
                  onClick={() => setOwnership(getMemberKey(m))}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    border: ownership === getMemberKey(m) ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: ownership === getMemberKey(m) ? "var(--sky-light)" : "var(--bg)",
                    color: ownership === getMemberKey(m) ? "var(--sky)" : "var(--ink)",
                    fontSize: 13,
                  }}
                >
                  {m.name}
                </button>
              ))}
              <button
                onClick={() => setOwnership("shared")}
                style={{
                  flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                  border: ownership === "shared" ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
                  background: ownership === "shared" ? "var(--lavi-light)" : "var(--bg)",
                  color: ownership === "shared" ? "var(--lavi)" : "var(--ink)",
                  fontSize: 13,
                }}
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
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={busy || !name.trim() || (!usesApi && !value) || (usesApi && (!quantity || !apiId))}
          style={{
            width: "100%",
            background: "var(--ink)",
            color: "var(--bg)",
            border: "none",
            borderRadius: "var(--radius-lg)",
            padding: 16,
            fontSize: 15,
            fontWeight: 500,
            marginBottom: 10,
            opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? t("tx_saving") : isEditing ? t("asset_update_button") : t("asset_save_button")}
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            style={{
              width: "100%",
              background: "none",
              border: "none",
              color: "var(--red)",
              fontSize: 14,
              padding: 10,
            }}
          >
            {t("asset_delete_button")}
          </button>
        )}
      </div>
    </div>
  );
}

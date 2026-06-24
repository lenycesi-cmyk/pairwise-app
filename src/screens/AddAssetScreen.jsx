import { useState, useEffect, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { ASSET_TYPES } from "../data/assetTypes";
import { CURRENCIES } from "../data/categories";
import { searchCrypto, searchStocks } from "../utils/assetSearch";

export default function AddAssetScreen({ onClose, editingAsset }) {
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
    editingAsset?.ownership || (members[0] ? members[0].uid : "shared")
  );
  const [sharePct, setSharePct] = useState(editingAsset?.sharePct ?? 50);

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
    if (!confirm("Supprimer cet actif ?")) return;
    await removeAsset(editingAsset.id);
    onClose();
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
          <h1 style={{ fontSize: 18, flex: 1, textAlign: "center" }}>
            {isEditing ? "Modifier l'actif" : "Nouvel actif"}
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
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Type d'actif</p>
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
                {t.name}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{selectedType?.description}</p>
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
          <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>Nom</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Livret A, PEA Jess, Bitcoin..."
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
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 6 }}>Valeur actuelle</p>
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
                  Changer
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
                      ? "Rechercher (ex: Bitcoin, Solana...)"
                      : "Rechercher (ex: Apple, MSCI World...)"
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
                    Aucun résultat. Essayez un autre terme.
                  </p>
                )}
              </div>
            )}

            <p style={{ fontSize: 12, color: "var(--ink-2)", margin: "12px 0 6px" }}>Quantité détenue</p>
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
              <i className="ti ti-info-circle" style={{ fontSize: 12, verticalAlign: -1 }} aria-hidden="true" /> La valeur sera calculée automatiquement selon le cours actuel.
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
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>À qui appartient cet actif</p>
            <div style={{ display: "flex", gap: 6, marginBottom: ownership === "shared" ? 14 : 0 }}>
              {members.map((m) => (
                <button
                  key={m.uid}
                  onClick={() => setOwnership(m.uid)}
                  style={{
                    flex: 1, padding: 8, borderRadius: "var(--radius-md)",
                    border: ownership === m.uid ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                    background: ownership === m.uid ? "var(--sky-light)" : "var(--bg)",
                    color: ownership === m.uid ? "var(--sky)" : "var(--ink)",
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
                Partagé
              </button>
            </div>

            {ownership === "shared" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                    {members[0]?.name} : {sharePct}%
                  </span>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                    {members[1]?.name || "Autre"} : {100 - sharePct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sharePct}
                  onChange={(e) => setSharePct(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
                <button
                  onClick={() => setSharePct(50)}
                  style={{
                    marginTop: 6, background: "none", border: "none",
                    color: "var(--sky)", fontSize: 11,
                  }}
                >
                  Réinitialiser à 50/50
                </button>
              </div>
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
          {busy ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Ajouter"}
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
            Supprimer cet actif
          </button>
        )}
      </div>
    </div>
  );
}

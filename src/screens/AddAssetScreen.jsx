import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { ASSET_TYPES, COMMON_CRYPTOS, COMMON_STOCKS } from "../data/assetTypes";
import { CURRENCIES } from "../data/categories";

export default function AddAssetScreen({ onClose, editingAsset }) {
  const { addAsset, updateAsset, removeAsset, defaultCurrency } = useFinance();
  const isEditing = !!editingAsset;

  const [typeId, setTypeId] = useState(editingAsset?.typeId || "cash");
  const [name, setName] = useState(editingAsset?.name || "");
  const [value, setValue] = useState(editingAsset?.value?.toString() || "");
  const [currency, setCurrency] = useState(editingAsset?.currency || defaultCurrency);
  const [quantity, setQuantity] = useState(editingAsset?.quantity?.toString() || "");
  const [apiId, setApiId] = useState(editingAsset?.apiId || "");
  const [showApiPicker, setShowApiPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedType = ASSET_TYPES.find((t) => t.id === typeId);
  const usesApi = selectedType?.hasApiPrice;
  const apiOptions = selectedType?.priceSource === "crypto" ? COMMON_CRYPTOS : COMMON_STOCKS;

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
        ...(usesApi
          ? { quantity: parseFloat(quantity), apiId }
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
                onClick={() => { setTypeId(t.id); setApiId(""); }}
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

        {/* Valeur (manuel) ou Quantité + actif suivi (API) */}
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
            <div
              onClick={() => setShowApiPicker(!showApiPicker)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                borderBottom: "0.5px solid var(--rule)", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 14, flex: 1, color: apiId ? "var(--ink)" : "var(--ink-3)" }}>
                {apiId
                  ? apiOptions.find((o) => (o.id || o.symbol) === apiId)?.name || apiId
                  : "Choisir..."}
              </span>
              <i className="ti ti-chevron-down" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
            </div>

            {showApiPicker && (
              <div style={{ marginTop: 8 }}>
                {apiOptions.map((o) => (
                  <div
                    key={o.id || o.symbol}
                    onClick={() => { setApiId(o.id || o.symbol); setShowApiPicker(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", cursor: "pointer" }}
                  >
                    <span style={{ fontSize: 13, flex: 1 }}>{o.name}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{o.symbol}</span>
                  </div>
                ))}
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

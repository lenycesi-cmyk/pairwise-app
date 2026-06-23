import { useState, useEffect, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { ASSET_TYPES, getAssetType } from "../data/assetTypes";
import { getCryptoPrice, getStockPrice } from "../utils/assetPrices";
import { CURRENCIES } from "../data/categories";
import AddAssetScreen from "./AddAssetScreen";
import NetWorthChart from "../components/NetWorthChart";
import AllocationChart from "../components/AllocationChart";

const COLOR_MAP = {
  tang: { text: "var(--tang)", bg: "var(--tang-light)" },
  sage: { text: "var(--sage)", bg: "var(--sage-light)" },
  lavi: { text: "var(--lavi)", bg: "var(--lavi-light)" },
  sky: { text: "var(--sky)", bg: "var(--sky-light)" },
  amber: { text: "var(--amber)", bg: "var(--amber-light)" },
  mint: { text: "var(--mint)", bg: "var(--mint-light)" },
  blush: { text: "var(--blush)", bg: "var(--blush-light)" },
  red: { text: "var(--red)", bg: "var(--red-light)" },
};

export default function WealthScreen({ onOpenCalculator }) {
  const { assets, updateAsset, removeAsset, defaultCurrency, netWorthHistory, recordNetWorthSnapshot } =
    useFinance();
  const { convert, loading: ratesLoading } = useExchangeRates(defaultCurrency);

  const [showAdd, setShowAdd] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  const currencySymbol = CURRENCIES.find((c) => c.code === defaultCurrency)?.symbol || defaultCurrency;

  // Récupère les prix live pour les actifs avec source API (crypto/stocks)
  async function refreshPrices() {
    setRefreshing(true);
    const updates = {};
    for (const asset of assets) {
      const type = getAssetType(asset.typeId);
      if (!type.hasApiPrice || !asset.apiId) continue;

      if (type.priceSource === "crypto") {
        const { price, success } = await getCryptoPrice(asset.apiId, defaultCurrency.toLowerCase());
        if (success) updates[asset.id] = price * (asset.quantity || 1);
      } else if (type.priceSource === "stocks") {
        const { price, success } = await getStockPrice(asset.apiId);
        if (success) {
          const converted = convert(price, "USD", defaultCurrency);
          updates[asset.id] = converted * (asset.quantity || 1);
        }
      }
    }
    setLivePrices(updates);
    setRefreshing(false);
  }

  useEffect(() => {
    if (assets.length > 0 && !ratesLoading) {
      refreshPrices();
    }
  }, [assets.length, ratesLoading]);

  function getAssetValue(asset) {
    if (livePrices[asset.id] !== undefined) return livePrices[asset.id];
    // Valeur manuelle, convertie si devise différente
    return convert(asset.value, asset.currency || defaultCurrency, defaultCurrency);
  }

  const totalsByType = useMemo(() => {
    const result = {};
    for (const type of ASSET_TYPES) {
      result[type.id] = 0;
    }
    for (const asset of assets) {
      const val = getAssetValue(asset);
      result[asset.typeId] = (result[asset.typeId] || 0) + val;
    }
    return result;
  }, [assets, livePrices, defaultCurrency]);

  const netWorth = useMemo(() => {
    let total = 0;
    for (const type of ASSET_TYPES) {
      const val = totalsByType[type.id] || 0;
      total += type.isLiability ? -Math.abs(val) : val;
    }
    return total;
  }, [totalsByType]);

  const totalAssets = useMemo(() => {
    let total = 0;
    for (const type of ASSET_TYPES) {
      if (type.isLiability) continue;
      total += totalsByType[type.id] || 0;
    }
    return total;
  }, [totalsByType]);

  const totalLiabilities = totalsByType["debt"] || 0;

  // Enregistre un point d'historique une fois par session (évite le spam)
  useEffect(() => {
    if (!ratesLoading && assets.length > 0 && netWorth !== 0) {
      recordNetWorthSnapshot(netWorth, defaultCurrency);
    }
  }, [netWorth, ratesLoading]);

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  if (showAdd || editingAsset) {
    return (
      <AddAssetScreen
        editingAsset={editingAsset}
        onClose={() => {
          setShowAdd(false);
          setEditingAsset(null);
        }}
      />
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>Patrimoine</h1>
        <button
          onClick={() => setShowAdd(true)}
          aria-label="Ajouter un actif"
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "var(--ink)", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 16, color: "var(--bg)" }} aria-hidden="true" />
        </button>
      </div>

      {/* Net worth total */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "1.25rem",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ fontSize: 12, color: "var(--ink-2)" }}>Patrimoine net</p>
          {refreshing && (
            <i className="ti ti-refresh" style={{ fontSize: 13, color: "var(--ink-3)" }} aria-hidden="true" />
          )}
        </div>
        <p style={{ fontSize: 30, fontWeight: 500, color: netWorth >= 0 ? "var(--sage)" : "var(--tang)" }}>
          {formatAmount(netWorth)} {currencySymbol}
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--ink-3)" }}>Actifs</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--sage)" }}>
              {formatAmount(totalAssets)} {currencySymbol}
            </p>
          </div>
          {totalLiabilities > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-3)" }}>Dettes</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--red)" }}>
                −{formatAmount(totalLiabilities)} {currencySymbol}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Net worth chart */}
      {netWorthHistory.length > 1 && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Évolution</p>
          <NetWorthChart history={netWorthHistory} currencySymbol={currencySymbol} />
        </div>
      )}

      {/* Allocation chart */}
      {assets.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Répartition</p>
          <AllocationChart totalsByType={totalsByType} totalAssets={totalAssets} />
        </div>
      )}

      {/* Calculateur shortcut */}
      <button
        onClick={onOpenCalculator}
        style={{
          width: "100%",
          background: "var(--lavi-light)",
          border: "0.5px solid var(--lavi)",
          borderRadius: "var(--radius-lg)",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <i className="ti ti-calculator" style={{ fontSize: 18, color: "var(--lavi)" }} aria-hidden="true" />
        <span style={{ fontSize: 13, color: "var(--lavi)", fontWeight: 500, flex: 1, textAlign: "left" }}>
          Et si j'avais investi mes dépenses superflues ?
        </span>
        <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--lavi)" }} aria-hidden="true" />
      </button>

      {/* Liste des actifs par type */}
      {ASSET_TYPES.map((type) => {
        const typeAssets = assets.filter((a) => a.typeId === type.id);
        if (typeAssets.length === 0) return null;
        const colors = COLOR_MAP[type.color] || COLOR_MAP.sky;

        return (
          <div key={type.id} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8, fontWeight: 500 }}>
              {type.name.toUpperCase()}
            </p>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "0.5px solid var(--rule)",
                overflow: "hidden",
              }}
            >
              {typeAssets.map((asset, i) => {
                const val = getAssetValue(asset);
                return (
                  <div
                    key={asset.id}
                    onClick={() => setEditingAsset(asset)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderBottom: i === typeAssets.length - 1 ? "none" : "0.5px solid var(--rule)",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: "var(--radius-md)",
                        background: colors.bg, display: "flex",
                        alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <i className={`ti ${type.icon}`} style={{ fontSize: 16, color: colors.text }} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14 }}>{asset.name}</p>
                      {asset.apiId && (
                        <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          {asset.quantity} {asset.apiId.toUpperCase()}
                          {livePrices[asset.id] !== undefined && " · prix live"}
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 500, color: type.isLiability ? "var(--red)" : "var(--ink)" }}>
                      {type.isLiability ? "−" : ""}{formatAmount(val)} {currencySymbol}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {assets.length === 0 && (
        <p style={{ fontSize: 14, color: "var(--ink-3)", textAlign: "center", padding: "3rem 0" }}>
          Aucun actif enregistré.
          <br />
          Ajoutez votre premier compte, investissement ou bien immobilier.
        </p>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { ASSET_TYPES } from "../data/assetTypes";
import { getCryptoPrice, getStockPrice } from "../utils/assetPrices";
import { CURRENCIES } from "../data/categories";
import AddAssetScreen from "./AddAssetScreen";
import NetWorthChart from "../components/NetWorthChart";
import AllocationChart from "../components/AllocationChart";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { useTranslation } from "../hooks/useTranslation";

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
  const t = useTranslation();
  const {
    assets,
    defaultCurrency,
    netWorthHistory,
    recordNetWorthSnapshot,
    members,
    wealthDisplayCurrency,
    updateWealthDisplayCurrency,
  } = useFinance();

  // La devise d'affichage du patrimoine peut différer de la devise des transactions
  const displayCurrency = wealthDisplayCurrency || defaultCurrency;
  const { convert, loading: ratesLoading } = useExchangeRates(displayCurrency);
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  const [editingAsset, setEditingAsset] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const currencySymbol = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

  async function refreshPrices() {
    setRefreshing(true);
    const updates = {};
    for (const asset of assets) {
      const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
      if (!type?.hasApiPrice || !asset.apiId) continue;

      if (type.priceSource === "crypto") {
        const { price, success } = await getCryptoPrice(asset.apiId, displayCurrency.toLowerCase());
        if (success) updates[asset.id] = price * (asset.quantity || 1);
      } else if (type.priceSource === "stocks") {
        const { price, success } = await getStockPrice(asset.apiId);
        if (success) {
          const converted = convert(price, "USD", displayCurrency);
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
  }, [assets.length, ratesLoading, displayCurrency]);

  function getAssetValue(asset) {
    if (livePrices[asset.id] !== undefined) return livePrices[asset.id];
    return convert(asset.value, asset.currency || displayCurrency, displayCurrency);
  }

  function getMemberShare(asset, memberUid) {
    const total = getAssetValue(asset);
    if (asset.ownership === memberUid) return total;
    if (asset.ownership === "shared") {
      const isFirstMember = members[0]?.uid === memberUid;
      const pct = isFirstMember ? (asset.sharePct ?? 50) : 100 - (asset.sharePct ?? 50);
      return total * (pct / 100);
    }
    return 0;
  }

  const totalsByType = useMemo(() => {
    const result = {};
    for (const type of ASSET_TYPES) result[type.id] = 0;
    for (const asset of assets) {
      const val = getAssetValue(asset);
      result[asset.typeId] = (result[asset.typeId] || 0) + val;
    }
    return result;
  }, [assets, livePrices, displayCurrency]);

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

  // Patrimoine net par membre
  const netWorthByMember = useMemo(() => {
    const result = {};
    for (const m of members) result[m.uid] = 0;
    for (const asset of assets) {
      const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
      const sign = type?.isLiability ? -1 : 1;
      for (const m of members) {
        result[m.uid] = (result[m.uid] || 0) + sign * Math.abs(getMemberShare(asset, m.uid));
      }
    }
    return result;
  }, [assets, livePrices, displayCurrency, members]);

  useEffect(() => {
    if (!ratesLoading && assets.length > 0 && netWorth !== 0) {
      recordNetWorthSnapshot(netWorth, displayCurrency);
    }
  }, [netWorth, ratesLoading]);

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  if (editingAsset) {
    return (
      <AddAssetScreen
        editingAsset={editingAsset}
        onClose={() => setEditingAsset(null)}
      />
    );
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20 }}>{t("wealth_title")}</h1>
        <button
          onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
          style={{
            padding: "4px 10px", borderRadius: "var(--radius-md)",
            border: "0.5px solid var(--rule)", background: "var(--bg-card)",
            fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          {displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
        </button>
      </div>

      {showCurrencyPicker && (
        <div
          style={{
            display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16,
            background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)", padding: "0.75rem 1rem",
          }}
        >
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => { updateWealthDisplayCurrency(c.code); setShowCurrencyPicker(false); }}
              style={{
                padding: "6px 10px", borderRadius: "var(--radius-md)",
                border: displayCurrency === c.code ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
                background: displayCurrency === c.code ? "var(--sky-light)" : "var(--bg)",
                color: displayCurrency === c.code ? "var(--sky)" : "var(--ink)",
                fontSize: 12,
              }}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      )}

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
          <p style={{ fontSize: 12, color: "var(--ink-2)" }}>{t("wealth_net_worth")}</p>
          {refreshing && (
            <i className="ti ti-refresh" style={{ fontSize: 13, color: "var(--ink-3)" }} aria-hidden="true" />
          )}
        </div>
        <p style={{ fontSize: 30, fontWeight: 500, color: netWorth >= 0 ? "var(--sage)" : "var(--tang)" }}>
          {formatAmount(netWorth)} {currencySymbol}
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("wealth_assets")}</p>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--sage)" }}>
              {formatAmount(totalAssets)} {currencySymbol}
            </p>
          </div>
          {totalLiabilities > 0 && (
            <div>
              <p style={{ fontSize: 11, color: "var(--ink-3)" }}>{t("wealth_liabilities")}</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--red)" }}>
                −{formatAmount(totalLiabilities)} {currencySymbol}
              </p>
            </div>
          )}
        </div>

        {/* Patrimoine par membre */}
        {members.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--rule)" }}>
            {members.map((m) => (
              <div key={m.uid} style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Avatar member={m} colorMap={memberColorMap} size={18} />
                  <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{m.name}</span>
                </div>
                <p style={{
                  fontSize: 15, fontWeight: 500,
                  color: (netWorthByMember[m.uid] || 0) >= 0 ? "var(--sage)" : "var(--tang)",
                }}>
                  {formatAmount(netWorthByMember[m.uid] || 0)} {currencySymbol}
                </p>
              </div>
            ))}
          </div>
        )}
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
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t("wealth_evolution")}</p>
          <NetWorthChart
            history={netWorthHistory}
            currencySymbol={currencySymbol}
            displayCurrency={displayCurrency}
            convert={convert}
          />
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
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t("wealth_allocation")}</p>
          <AllocationChart totalsByType={totalsByType} totalAssets={totalAssets} />
        </div>
      )}

      {/* Répartition par membre */}
      {members.length > 1 && totalAssets > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>{t("wealth_member_allocation")}</p>
          {members.map((m) => {
            const share = netWorthByMember[m.uid] || 0;
            const pct = totalAssets > 0 ? (share / totalAssets) * 100 : 0;
            return (
              <div key={m.uid} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{m.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, background: "var(--sky)" }} />
                </div>
              </div>
            );
          })}
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
          {t("wealth_calculator_cta")}
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
                const ownerLabel =
                  asset.ownership === "shared"
                    ? "Partagé"
                    : members.find((m) => m.uid === asset.ownership)?.name || "";

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
                      <p style={{ fontSize: 11, color: "var(--ink-3)" }}>
                        {asset.apiId && `${asset.quantity} ${asset.apiId.toUpperCase()} · `}
                        {ownerLabel}
                        {asset.ownership === "shared" && ` (${asset.sharePct ?? 50}/${100 - (asset.sharePct ?? 50)})`}
                      </p>
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
          {t("wealth_no_assets")}
          <br />
          {t("wealth_add_first_asset")}
        </p>
      )}
    </div>
  );
}

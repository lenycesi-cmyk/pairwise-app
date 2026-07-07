import { useState, useEffect, useMemo, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { ASSET_TYPES } from "../data/assetTypes";
import { getCryptoPrice, getStockPrice } from "../utils/assetPrices";
import { CURRENCIES } from "../data/categories";
import AddAssetScreen from "./AddAssetScreen";
import WidgetCard from "../components/WidgetCard";
import ConnectBankButton from "../components/ConnectBankButton";
import NetWorthChart from "../components/NetWorthChart";
import AllocationChart from "../components/AllocationChart";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { useTranslation } from "../hooks/useTranslation";
import SpotlightHint from "../components/SpotlightHint";
import { getMemberKey } from "../utils/members";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useScreenWidgets } from "../hooks/useScreenWidgets";
import CustomizePanel, { CustomizeButton } from "../components/CustomizePanel";

// Widgets proposés dans le panneau "personnaliser" de cet onglet. La liste
// des actifs par type n'y figure pas : c'est le contenu principal de l'écran.
const WEALTH_WIDGETS = [
  { id: "net_worth", labelKey: "wealth_net_worth" },
  { id: "evolution", labelKey: "wealth_evolution" },
  { id: "allocation", labelKey: "wealth_allocation" },
  { id: "member_allocation", labelKey: "wealth_member_allocation" },
  { id: "calculator", labelKey: "wealth_calculator_cta" },
];

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

export default function WealthScreen({ onOpenCalculator, addButtonRef }) {
  const t = useTranslation();
  const { language } = useFinance();
  const netWorthCardRef = useRef(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
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
  const [liveChanges, setLiveChanges] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const { isVisible, toggle } = useScreenWidgets("wealthWidgets");

  const currencySymbol = CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

  async function refreshPrices() {
    setRefreshing(true);
    const updates = {};
    const changes = {};
    for (const asset of assets) {
      const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
      if (!type?.hasApiPrice || !asset.apiId) continue;

      if (type.priceSource === "crypto") {
        const { price, change24h, success } = await getCryptoPrice(asset.apiId, displayCurrency.toLowerCase());
        if (success) {
          updates[asset.id] = price * (asset.quantity || 1);
          if (change24h !== null) changes[asset.id] = change24h;
        }
      } else if (type.priceSource === "stocks") {
        const { price, change24h, success } = await getStockPrice(asset.apiId);
        if (success) {
          const converted = convert(price, "USD", displayCurrency);
          updates[asset.id] = converted * (asset.quantity || 1);
          // percent_change is currency-independent, no conversion needed
          if (change24h !== null) changes[asset.id] = change24h;
        }
      }
    }
    setLivePrices(updates);
    setLiveChanges(changes);
    setRefreshing(false);
  }

  useEffect(() => {
    if (assets.length > 0 && !ratesLoading) {
      refreshPrices();
    }
  }, [assets.length, ratesLoading, displayCurrency]);

  function getAssetValue(asset) {
    if (livePrices[asset.id] !== undefined) return livePrices[asset.id];
    // API-priced assets (stocks/crypto) store no `value` — only quantity + apiId.
    // If the live price fetch failed (e.g. Twelve Data's demo key only prices AAPL),
    // we have nothing to convert, so guard against NaN leaking into per-asset display and totals.
    const converted = convert(asset.value, asset.currency || displayCurrency, displayCurrency);
    return Number.isFinite(converted) ? converted : 0;
  }

  function getMemberShare(asset, memberUid) {
    const total = getAssetValue(asset);
    if (asset.ownership === memberUid) return total;
    if (asset.ownership === "shared") {
      const isFirstMember = getMemberKey(members[0]) === memberUid;
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
    for (const m of members) result[getMemberKey(m)] = 0;
    for (const asset of assets) {
      const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
      const sign = type?.isLiability ? -1 : 1;
      for (const m of members) {
        const key = getMemberKey(m);
        result[key] = (result[key] || 0) + sign * Math.abs(getMemberShare(asset, key));
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
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "0.4rem 1.25rem", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 20, marginLeft: isDesktop ? 0 : 44 }}>{t("wealth_title")}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => { setShowCurrencyPicker(!showCurrencyPicker); setShowCustomize(false); }}
            style={{
              padding: "4px 10px", borderRadius: "var(--radius-md)",
              border: "0.5px solid var(--rule)", background: "var(--bg-card)",
              fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4,
            }}
          >
            {displayCurrency} <i className="ti ti-chevron-down" style={{ fontSize: 11 }} aria-hidden="true" />
          </button>
          <CustomizeButton onClick={() => { setShowCustomize(!showCustomize); setShowCurrencyPicker(false); }} label={t("dashboard_customize")} />
        </div>
      </div>

      <SpotlightHint
        tabKey="wealth"
        steps={[
          { ref: netWorthCardRef, text: t("hint_wealth") },
          addButtonRef && { ref: addButtonRef, text: t("hint_wealth_add") },
        ].filter(Boolean)}
      />

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

      {showCustomize && (
        <CustomizePanel widgets={WEALTH_WIDGETS} isVisible={isVisible} toggle={toggle} />
      )}

      <div className={isDesktop ? "card-columns" : ""}>

      {isVisible("net_worth") && (
      <>
      {/* Net worth total — column item so its width matches the other cards
          on desktop (was previously full-width above the masonry). */}
      <div
        ref={netWorthCardRef}
        className="pw-card"
        data-accent="ocean"
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
              <div key={getMemberKey(m)} style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Avatar member={m} colorMap={memberColorMap} size={18} />
                  <span style={{ fontSize: 11, color: "var(--ink-2)" }}>{m.name}</span>
                </div>
                <p style={{
                  fontSize: 15, fontWeight: 500,
                  color: (netWorthByMember[getMemberKey(m)] || 0) >= 0 ? "var(--sage)" : "var(--tang)",
                }}>
                  {formatAmount(netWorthByMember[getMemberKey(m)] || 0)} {currencySymbol}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Net worth chart */}
      {isVisible("evolution") && netWorthHistory.length > 1 && (
        <WidgetCard icon="ti-chart-line" accent="mint" title={t("wealth_evolution")} style={{ marginBottom: 12 }}>
          <NetWorthChart
            history={netWorthHistory}
            currencySymbol={currencySymbol}
            displayCurrency={displayCurrency}
            convert={convert}
          />
        </WidgetCard>
      )}

      {/* Allocation chart */}
      {isVisible("allocation") && assets.length > 0 && (
        <WidgetCard icon="ti-chart-donut" accent="amber" title={t("wealth_allocation")} style={{ marginBottom: 12 }}>
          <AllocationChart totalsByType={totalsByType} totalAssets={totalAssets} />
        </WidgetCard>
      )}

      {/* Répartition par membre */}
      {isVisible("member_allocation") && members.length > 1 && totalAssets > 0 && (
        <WidgetCard icon="ti-users" accent="ocean" title={t("wealth_member_allocation")} style={{ marginBottom: 12 }}>
          <div>
          {members.map((m) => {
            const share = netWorthByMember[getMemberKey(m)] || 0;
            const pct = totalAssets > 0 ? (share / totalAssets) * 100 : 0;
            return (
              <div key={getMemberKey(m)} style={{ marginBottom: 8 }}>
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
        </WidgetCard>
      )}

      {/* Calculateur shortcut */}
      {isVisible("calculator") && (
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
      )}

      {/* Liste des actifs par type */}
      {ASSET_TYPES.map((type) => {
        const typeAssets = assets.filter((a) => a.typeId === type.id);
        if (typeAssets.length === 0) return null;
        const colors = COLOR_MAP[type.color] || COLOR_MAP.sky;

        return (
          <WidgetCard
            key={type.id}
            icon={type.icon}
            accent={type.isLiability ? "pink" : "mint"}
            title={language === "en" && type.nameEn ? type.nameEn : type.name}
            flush
            style={{ marginBottom: 16 }}
          >
            <div>
              {typeAssets.map((asset, i) => {
                const val = getAssetValue(asset);
                // API-priced asset with no live price and no stored value: price couldn't be fetched
                const priceUnavailable =
                  !!asset.apiId && livePrices[asset.id] === undefined && !Number.isFinite(asset.value);
                const ownerLabel =
                  asset.ownership === "shared"
                    ? "Partagé"
                    : members.find((m) => getMemberKey(m) === asset.ownership)?.name || "";

                return (
                  <div
                    key={asset.id}
                    style={{ borderBottom: i === typeAssets.length - 1 ? "none" : "0.5px solid var(--rule)" }}
                  >
                    <div
                      onClick={() => setEditingAsset(asset)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
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
                      <div style={{ textAlign: "right" }}>
                        {priceUnavailable ? (
                          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }} title={t("wealth_price_unavailable")}>
                            {t("wealth_price_unavailable_short")}
                          </p>
                        ) : (
                          <p style={{ fontSize: 14, fontWeight: 500, color: type.isLiability ? "var(--red)" : "var(--ink)" }}>
                            {type.isLiability ? "−" : ""}{formatAmount(val)} {currencySymbol}
                          </p>
                        )}
                        {liveChanges[asset.id] !== undefined && (
                          <p style={{ fontSize: 11, color: liveChanges[asset.id] >= 0 ? "var(--sage)" : "var(--tang)", marginTop: 1 }}>
                            {liveChanges[asset.id] >= 0 ? "+" : ""}{liveChanges[asset.id].toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </div>
                    {type.id === "account" && (
                      <div style={{ paddingLeft: 46, paddingRight: 14, paddingBottom: 10 }}>
                        <ConnectBankButton
                          asset={asset}
                          onSuccess={() => setEditingAsset(null)}
                        />
                      </div>
                    )}
                  </div>
                );
            })}
            </div>
          </WidgetCard>
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
    </div>
  );
}

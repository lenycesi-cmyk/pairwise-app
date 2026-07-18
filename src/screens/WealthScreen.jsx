import { useState, useEffect, useMemo, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { ASSET_TYPES } from "../data/assetTypes";
import { getCryptoPrice, getStockPrice } from "../utils/assetPrices";
import { ALL_CURRENCIES } from "../data/categories";
import CurrencyPicker from "../components/CurrencyPicker";
import AddAssetScreen from "./AddAssetScreen";
import WidgetCard from "../components/WidgetCard";
import ConnectBankButton from "../components/ConnectBankButton";
import NetWorthChart from "../components/NetWorthChart";
import AllocationChart from "../components/AllocationChart";
import Avatar from "../components/Avatar";
import { buildMemberColorMap } from "../utils/memberColors";
import { useTranslation } from "../hooks/useTranslation";
import SpotlightHint from "../components/SpotlightHint";
import GreetingHeader from "../components/GreetingHeader";
import HeaderMenuButton from "../components/HeaderMenuButton";
import { getMemberKey } from "../utils/members";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useLoanProgress } from "../hooks/useLoanProgress";
import { loanType } from "../data/loanTypes";
import { useWealthLayout } from "../hooks/useDashboardPrefs";
import WidgetCanvas from "../components/WidgetCanvas";
import ScopeFilter from "../components/ScopeFilter";
import CommentBubble from "../components/CommentBubble";
import AnimatedNumber from "../components/AnimatedNumber";
import CommentsModal from "../components/CommentsModal";
import AssetComments from "../components/AssetComments";

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

export default function WealthScreen({ onOpenCalculator, addButtonRef, onOpenMenu, onOpenCredits }) {
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
  // Crédits en cours : leur capital restant dû pèse comme un passif dans le
  // patrimoine net (intégration lot 5).
  const { items: loanItems, aggregate: loanAgg } = useLoanProgress(displayCurrency);

  const [editingAsset, setEditingAsset] = useState(null);
  const [commentsAsset, setCommentsAsset] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [liveChanges, setLiveChanges] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Périmètre du total par catégorie d'actifs : null = famille (tous), sinon la
  // clé d'un membre (part de ce membre). Filtre membre GLOBAL de la page, placé
  // sous le header et appliqué à tous les widgets scopables (répartition + totaux
  // par catégorie) — remplace les anciens sélecteurs par widget.
  const [globalScope, setGlobalScope] = useState(null);
  // Ids des types d'actifs réellement présents (chaque catégorie devient un widget
  // déplaçable "asset_<typeId>" dans la grille bento) — mémorisé sur `assets`.
  const assetTypeIds = useMemo(
    () => ASSET_TYPES.filter((ty) => assets.some((a) => a.typeId === ty.id)).map((ty) => ty.id),
    [assets]
  );
  const { widgets, saveWidgets } = useWealthLayout(assetTypeIds);

  const currencySymbol = ALL_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol || displayCurrency;

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

  // Passifs = dettes du Patrimoine + capital restant dû des crédits en cours.
  const totalLiabilities = (totalsByType["debt"] || 0) + loanAgg.balance;
  // Patrimoine net « tout compris » : actifs − passifs (crédits déduits).
  const netWorthAll = netWorth - loanAgg.balance;

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
    if (!ratesLoading && assets.length > 0 && netWorthAll !== 0) {
      recordNetWorthSnapshot(netWorthAll, displayCurrency);
    }
  }, [netWorthAll, ratesLoading]);

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  const wealthWidgetLabels = {
    net_worth: t("wealth_net_worth"),
    evolution: t("wealth_evolution"),
    allocation: t("wealth_allocation"),
    credits: t("nav_credits"),
    calculator: t("wealth_calculator_cta"),
    // Cartes d'actifs par type (widgets déplaçables "asset_<typeId>").
    ...Object.fromEntries(
      ASSET_TYPES.map((ty) => [`asset_${ty.id}`, language === "en" && ty.nameEn ? ty.nameEn : ty.name])
    ),
  };

  // Contenu d'un widget personnalisable de l'onglet Patrimoine pour
  // WidgetCanvas (null quand il n'y a rien à montrer → placeholder en édition).
  function renderWealthWidget(id) {
    if (id === "net_worth") {
      return (
        <div
          ref={netWorthCardRef}
          className="pw-card pw-chip-host"
          data-accent="ocean"
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1.25rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pw-chip" style={{ width: 32, height: 32, borderRadius: 10, background: "var(--lavi-light)", "--pw-chip": "var(--lavi)", flexShrink: 0 }}>
                <i className="ti ti-diamond" style={{ fontSize: 16, color: "var(--lavi)" }} aria-hidden="true" />
              </span>
              <p style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)" }}>{t("wealth_net_worth")}</p>
            </div>
            {refreshing && (
              <i className="ti ti-refresh" style={{ fontSize: 13, color: "var(--ink-3)" }} aria-hidden="true" />
            )}
          </div>
          <p style={{ fontSize: 30, fontWeight: 500, color: netWorthAll >= 0 ? "var(--sage)" : "var(--tang)" }}>
            <AnimatedNumber value={netWorthAll} format={formatAmount} /> {currencySymbol}
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

          {/* Fusion « Répartition par membre » : par membre, valeur nette +
              part (%) + barre de répartition. */}
          {members.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--rule)" }}>
              {members.map((m) => {
                const share = netWorthByMember[getMemberKey(m)] || 0;
                const pct = totalAssets > 0 ? (share / totalAssets) * 100 : 0;
                const showBar = members.length > 1 && totalAssets > 0;
                return (
                  <div key={getMemberKey(m)} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: showBar ? 5 : 0 }}>
                      <Avatar member={m} colorMap={memberColorMap} size={18} />
                      <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1, minWidth: 0 }}>{m.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: share >= 0 ? "var(--sage)" : "var(--tang)" }}>
                        {formatAmount(share)} {currencySymbol}
                      </span>
                      {showBar && (
                        <span style={{ fontSize: 11, color: "var(--ink-3)", width: 44, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                      )}
                    </div>
                    {showBar && (
                      <div style={{ width: "100%", height: 6, background: "var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, background: "var(--sky)" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (id === "evolution") {
      if (netWorthHistory.length <= 1) return null;
      return (
        <WidgetCard icon="ti-chart-line" accent="mint" title={t("wealth_evolution")}>
          <NetWorthChart
            history={netWorthHistory}
            currencySymbol={currencySymbol}
            displayCurrency={displayCurrency}
            convert={convert}
          />
        </WidgetCard>
      );
    }

    if (id === "allocation") {
      if (assets.length === 0) return null;
      const scope = globalScope;
      // Répartition re-scopée par part de propriété du membre (comme Liquidités).
      let tbt = totalsByType;
      let ta = totalAssets;
      if (scope !== null) {
        tbt = {};
        ta = 0;
        for (const type of ASSET_TYPES) tbt[type.id] = 0;
        for (const asset of assets) {
          const type = ASSET_TYPES.find((ty) => ty.id === asset.typeId);
          if (type?.isLiability) continue;
          const val = getMemberShare(asset, scope);
          tbt[asset.typeId] = (tbt[asset.typeId] || 0) + val;
          ta += val;
        }
      }
      return (
        <WidgetCard icon="ti-chart-donut" accent="amber" title={t("wealth_allocation")}>
          <AllocationChart totalsByType={tbt} totalAssets={ta} />
        </WidgetCard>
      );
    }

    if (id === "calculator") {
      return (
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
          }}
        >
          <i className="ti ti-calculator" style={{ fontSize: 18, color: "var(--lavi)" }} aria-hidden="true" />
          <span style={{ fontSize: 13, color: "var(--lavi)", fontWeight: 500, flex: 1, textAlign: "left" }}>
            {t("wealth_calculator_cta")}
          </span>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: "var(--lavi)" }} aria-hidden="true" />
        </button>
      );
    }

    if (id === "credits") {
      // Carte « Crédits » : capital restant dû (passif), top prêts, lien vers
      // l'onglet Crédits. Masquée si aucun crédit en cours.
      if (loanAgg.count === 0) return null;
      const top = loanItems.filter((i) => !i.state.isPaidOff).slice(0, 3);
      return (
        <WidgetCard icon="ti-building-bank" accent="coral" title={t("nav_credits")}>
          <div onClick={onOpenCredits} style={{ cursor: "pointer" }}>
            <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 2 }}>{t("loan_total_remaining")}</p>
            <p className="pw-num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, letterSpacing: "-0.01em", color: "var(--red)", marginBottom: 10 }}>
              −{formatAmount(loanAgg.balance)} {currencySymbol}
            </p>
            <div style={{ height: 8, borderRadius: 99, background: "var(--rule)", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${Math.min(100, Math.round(loanAgg.progress * 100))}%`, background: "var(--sage)" }} />
            </div>
            {top.map(({ loan, conv }, i) => {
              const ty = loanType(loan.type);
              return (
                <div key={loan.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--rule)" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `var(--${ty.color}-light)` }}>
                    <i className={`ti ${ty.icon}`} style={{ fontSize: 15, color: `var(--${ty.color})` }} aria-hidden="true" />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loan.name || t(`loan_type_${ty.id}`)}</span>
                  <span className="pw-num" style={{ fontSize: 13, fontWeight: 600 }}>{formatAmount(conv.balance)} {currencySymbol}</span>
                </div>
              );
            })}
          </div>
        </WidgetCard>
      );
    }

    if (id.startsWith("asset_")) {
      const type = ASSET_TYPES.find((ty) => `asset_${ty.id}` === id);
      return type ? renderAssetTypeCard(type) : null;
    }

    return null;
  }

  // Carte d'une catégorie d'actifs (Compte en banque, Assurance-vie…), rendue
  // comme widget déplaçable dans la grille bento (id "asset_<typeId>"). Renvoie
  // null si la catégorie est vide → le widget disparaît de la grille.
  function renderAssetTypeCard(type) {
    // Filtre membre global : on ne montre que les actifs du membre choisi (+ les
    // partagés / sans propriétaire), comme le widget Liquidités de l'Accueil.
    const typeAssets = assets.filter(
      (a) => a.typeId === type.id &&
        (globalScope == null || a.ownership === globalScope || a.ownership === "shared" || a.ownership == null)
    );
    if (typeAssets.length === 0) return null;
    const colors = COLOR_MAP[type.color] || COLOR_MAP.sky;
    return (
      <WidgetCard
        icon={type.icon}
        accent={type.isLiability ? "pink" : "mint"}
        title={language === "en" && type.nameEn ? type.nameEn : type.name}
        flush
      >
        <div>
          {/* Total de la catégorie : sur les comptes en banque toujours,
              et sur toute autre catégorie contenant au moins deux entrées.
              Filtrable par membre (Famille / A / B) quand la catégorie
              comporte des entrées pour plus d'un membre. */}
          {(type.id === "account" || typeAssets.length >= 2) && (() => {
            const scope = globalScope;
            const catTotal = typeAssets.reduce(
              (s, a) => s + (scope === null ? getAssetValue(a) : getMemberShare(a, scope)),
              0
            );
            const label = type.id === "account" ? t("bank_total_available") : t("wealth_category_total");
            return (
              <div style={{ padding: "12px 14px", borderBottom: "0.5px solid var(--rule)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5, color: "var(--ink-2)", fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: type.isLiability ? "var(--red)" : "var(--ink)" }}>
                    {type.isLiability ? "−" : ""}{formatAmount(catTotal)} {currencySymbol}
                  </span>
                </div>
              </div>
            );
          })()}
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
                    <p style={{ fontSize: 12 }}>{asset.name}</p>
                    <p style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      {asset.apiId && `${asset.quantity} ${asset.apiId.toUpperCase()} · `}
                      {ownerLabel}
                      {asset.ownership === "shared" && ` (${asset.sharePct ?? 50}/${100 - (asset.sharePct ?? 50)})`}
                    </p>
                  </div>
                  {/* Bouton compact "Connecter" entre le nom et le solde
                      (seulement tant que la banque n'est pas connectée). */}
                  {type.id === "account" && !asset.bankConnected && (
                    <ConnectBankButton asset={asset} compact onSuccess={() => setEditingAsset(null)} />
                  )}
                  {asset.comments?.length > 0 && (
                    <CommentBubble count={asset.comments.length} onClick={() => setCommentsAsset(asset)} />
                  )}
                  <div style={{ textAlign: "right" }}>
                    {priceUnavailable ? (
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }} title={t("wealth_price_unavailable")}>
                        {t("wealth_price_unavailable_short")}
                      </p>
                    ) : (
                      <p style={{ fontSize: 12, fontWeight: 500, color: type.isLiability ? "var(--red)" : "var(--ink)" }}>
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
                {type.id === "account" && asset.bankConnected && (
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
    <div style={{ padding: "0 1.25rem 6rem" }}>
      {commentsAsset && (
        <CommentsModal title={commentsAsset.name} onClose={() => setCommentsAsset(null)}>
          <AssetComments assetId={commentsAsset.id} bare />
        </CommentsModal>
      )}
      <div style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--bg)", marginLeft: "-1.25rem", marginRight: "-1.25rem", padding: "1rem 1.25rem" }}>
        {(() => {
          const actions = (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {editMode ? (
                <button
                  onClick={() => setEditMode(false)}
                  style={{
                    background: "var(--ink)", color: "var(--bg)", border: "none",
                    borderRadius: "var(--radius-md)", padding: "5px 14px", fontSize: 13, fontWeight: 500,
                  }}
                >
                  {t("dashboard_done")}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
                    style={{
                      height: 34, padding: "0 12px", borderRadius: 99,
                      border: "0.5px solid var(--rule)", background: "var(--bg-card)",
                      fontSize: 13, fontWeight: 600, color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 5,
                    }}
                  >
                    {currencySymbol} <i className="ti ti-chevron-down" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => { setEditMode(true); setShowCurrencyPicker(false); }}
                    aria-label={t("dashboard_customize")}
                    style={{
                      width: 34, height: 34, borderRadius: "50%", background: "var(--bg-card)",
                      border: "0.5px solid var(--rule)", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <i className="ti ti-pencil" style={{ fontSize: 15 }} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          );
          const greeting = <GreetingHeader subtitleKey="wealth_subtitle" marginLeft={0} />;
          // Desktop : une ligne [accueil | · | actions] comme l'Accueil (le
          // sélecteur de membre est posé sous le header, structure identique).
          if (isDesktop) {
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
                {greeting}
                <span />
                <div style={{ justifySelf: "end" }}>{actions}</div>
              </div>
            );
          }
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ justifySelf: "start" }}><HeaderMenuButton onClick={onOpenMenu} /></div>
                <div style={{ justifySelf: "end" }}>{actions}</div>
              </div>
              {greeting}
            </>
          );
        })()}
        {!editMode && members.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <ScopeFilter members={members} scope={globalScope} onChange={setGlobalScope} size="lg" style={{ marginBottom: 0 }} />
          </div>
        )}
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
            marginBottom: 16, background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)", padding: "0.75rem 1rem",
          }}
        >
          <CurrencyPicker
            value={displayCurrency}
            onSelect={(code) => { updateWealthDisplayCurrency(code); setShowCurrencyPicker(false); }}
          />
        </div>
      )}

      {editMode && (
        <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, marginBottom: 12, textAlign: "center" }}>
          {t("dashboard_edit_hint")}
        </p>
      )}

      <WidgetCanvas
        widgets={widgets}
        onSave={saveWidgets}
        editMode={editMode}
        onEnterEditMode={() => setEditMode(true)}
        renderContent={renderWealthWidget}
        labels={wealthWidgetLabels}
        isDesktop={isDesktop}
        bento
      />

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

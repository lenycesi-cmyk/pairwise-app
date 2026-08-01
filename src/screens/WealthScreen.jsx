import { useState, useEffect, useMemo, useRef } from "react";
import { useFinance } from "../context/FinanceContext";
import { useExchangeRates } from "../hooks/useExchangeRates";
import { ASSET_TYPES, getSubtypeLabel } from "../data/assetTypes";
import { getCryptoPrice, getStockPrice } from "../utils/assetPrices";
import { ALL_CURRENCIES } from "../data/categories";
import CurrencyPicker from "../components/CurrencyPicker";
import AddAssetScreen from "./AddAssetScreen";
import WidgetCard from "../components/WidgetCard";
import ConnectBankButton from "../components/ConnectBankButton";
import NetWorthChart from "../components/NetWorthChart";
import AllocationChart from "../components/AllocationChart";
import AllocationTargetCard from "../components/AllocationTargetCard";
import ProjectionCard from "../components/ProjectionCard";
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
import { netWorthMonthlyDelta } from "../utils/netWorthDelta";
import { shareForMember } from "../utils/memberShare";
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
    targetAllocation,
    updateTargetAllocation,
    assetContributions,
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
  // Catégories dépliées dans « Mes actifs » / « Mes passifs ». Volontairement
  // non mémorisé d'une visite à l'autre : la vue de référence est la liste des
  // catégories, pas l'état dans lequel on a laissé la page.
  const [openGroups, setOpenGroups] = useState([]);
  const toggleGroup = (key) =>
    setOpenGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const { widgets, saveWidgets } = useWealthLayout();

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
        // On n'enregistre qu'un cours strictement positif : un 0 (ou un cours
        // invalide renvoyé par une clé API limitée) ne doit PAS écraser le repli
        // sur le prix unitaire manuel (cf. getAssetValue).
        if (success && price > 0) {
          updates[asset.id] = price * (asset.quantity || 1);
          if (change24h !== null) changes[asset.id] = change24h;
        }
      } else if (type.priceSource === "stocks") {
        const { price, change24h, success } = await getStockPrice(asset.apiId);
        if (success && price > 0) {
          const converted = convert(price, "USD", displayCurrency);
          if (converted > 0) updates[asset.id] = converted * (asset.quantity || 1);
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
    // Un cours live valide (> 0) prime ; sinon on retombe sur le prix manuel puis
    // la valeur stockée. Le « > 0 » (plutôt que « !== undefined ») évite qu'un
    // cours nul/invalide masque le prix unitaire manuel.
    if (livePrices[asset.id] > 0) return livePrices[asset.id];
    // Repli sur un prix unitaire manuel quand l'API n'a pas coté l'actif
    // (clé "demo" limitée) : valeur = prix manuel × quantité.
    if (asset.manualPrice > 0) {
      // Devise propre au prix manuel si renseignée, sinon devise de l'actif : un
      // titre peut être coté dans une devise et acheté dans une autre.
      const priceCur = asset.manualPriceCurrency || asset.currency || displayCurrency;
      const converted = convert(asset.manualPrice * (asset.quantity || 1), priceCur, displayCurrency);
      return Number.isFinite(converted) ? converted : 0;
    }
    // API-priced assets (stocks/crypto) store no `value` — only quantity + apiId.
    // If the live price fetch failed (e.g. Twelve Data's demo key only prices AAPL),
    // we have nothing to convert, so guard against NaN leaking into per-asset display and totals.
    const converted = convert(asset.value, asset.currency || displayCurrency, displayCurrency);
    return Number.isFinite(converted) ? converted : 0;
  }

  function getMemberShare(asset, memberUid) {
    return shareForMember(
      getAssetValue(asset),
      asset.ownership,
      asset.sharePct,
      memberUid,
      getMemberKey(members[0])
    );
  }

  // Part d'un crédit revenant à un membre. Les crédits ne portent pas de
  // `sharePct` : un prêt partagé se partage donc en deux.
  function getLoanShare(item, memberUid) {
    return shareForMember(item.conv.balance, item.loan.ownership, undefined, memberUid, getMemberKey(members[0]));
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

  // Exposition par devise : sur les actifs à valeur stockée (comptes, liquidités,
  // AV, immobilier…), regroupés par devise native. On somme le solde natif (même
  // devise → sommable) et l'équivalent converti (pour le %). Les actifs cotés
  // (actions/crypto) sont exclus : leur devise native n'est pas suivie ici.
  const fxExposure = useMemo(() => {
    const byCur = {};
    for (const asset of assets) {
      const type = ASSET_TYPES.find((ty) => ty.id === asset.typeId);
      if (!type || type.isLiability || type.hasApiPrice) continue;
      const cur = asset.currency || displayCurrency;
      const converted = getAssetValue(asset);
      if (!Number.isFinite(converted)) continue;
      if (!byCur[cur]) byCur[cur] = { currency: cur, native: 0, converted: 0 };
      byCur[cur].native += asset.value || 0;
      byCur[cur].converted += converted;
    }
    const list = Object.values(byCur).sort((a, b) => b.converted - a.converted);
    const total = list.reduce((s, x) => s + x.converted, 0);
    return { list, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, livePrices, displayCurrency]);

  // Plus-value latente agrégée (lot 2) : sur les actifs avec un coût investi,
  // somme (valeur actuelle − coût investi), le tout en devise de résumé.
  const unrealized = useMemo(() => {
    let invested = 0;
    let current = 0;
    let any = false;
    for (const asset of assets) {
      const type = ASSET_TYPES.find((ty) => ty.id === asset.typeId);
      if (!type || type.isLiability || !asset.costBasis) continue;
      const cb = convert(asset.costBasis, asset.currency || displayCurrency, displayCurrency);
      const cur = getAssetValue(asset);
      if (!Number.isFinite(cb) || cb <= 0 || !Number.isFinite(cur)) continue;
      invested += cb;
      current += cur;
      any = true;
    }
    return { any, gain: current - invested, pct: invested > 0 ? ((current - invested) / invested) * 100 : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, livePrices, displayCurrency]);

  // Équivalent mensuel des versements programmés (lot 3), en devise de résumé —
  // alimente la projection. daily ≈ 30,44/mois, weekly ≈ 4,345/mois.
  const monthlyContribution = useMemo(() => {
    let sum = 0;
    for (const c of assetContributions || []) {
      if (c.active === false) continue;
      const factor = c.frequency === "daily" ? 30.44 : c.frequency === "weekly" ? 4.345 : 1;
      const conv = convert(c.amount * factor, c.currency || displayCurrency, displayCurrency);
      if (Number.isFinite(conv)) sum += conv;
    }
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetContributions, displayCurrency]);

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

  // Vue filtrée par le sélecteur de membre. Elle ne sert QU'À L'AFFICHAGE du
  // widget : `netWorthAll` reste le patrimoine du couple, parce que c'est lui
  // qu'on enregistre dans l'historique. Un instantané par membre n'aurait aucun
  // sens rétroactif et fausserait le graphique d'évolution.
  const scoped = useMemo(() => {
    if (globalScope === null) {
      return { byType: totalsByType, assets: totalAssets, liabilities: totalLiabilities };
    }
    const byType = {};
    for (const ty of ASSET_TYPES) byType[ty.id] = 0;
    for (const a of assets) byType[a.typeId] = (byType[a.typeId] || 0) + getMemberShare(a, globalScope);
    let assetsTotal = 0;
    for (const ty of ASSET_TYPES) if (!ty.isLiability) assetsTotal += byType[ty.id] || 0;
    let loanBalance = 0;
    for (const item of loanItems) {
      if (item.state.isPaidOff) continue;
      loanBalance += getLoanShare(item, globalScope);
    }
    return { byType, assets: assetsTotal, liabilities: (byType.debt || 0) + loanBalance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalScope, totalsByType, totalAssets, totalLiabilities, loanItems, assets, livePrices, displayCurrency, members]);

  const scopedNetWorth = scoped.assets - scoped.liabilities;

  // Nom du membre sélectionné, pour titrer « Total Nicolas » plutôt que
  // « Total du foyer ». null en vue famille.
  const scopeName = globalScope === null
    ? null
    : members.find((m) => getMemberKey(m) === globalScope)?.name || null;

  // Ventilation du widget « Patrimoine net » : une ligne par poste, du plus
  // lourd au plus léger, avec sa part du total de sa colonne. Les postes vides
  // sortent de la liste — une ligne à 0 € n'apprend rien et allonge la carte.
  const assetRows = useMemo(() => {
    return ASSET_TYPES
      .filter((ty) => !ty.isLiability && (scoped.byType[ty.id] || 0) > 0)
      .map((ty) => ({
        key: ty.id,
        icon: ty.icon,
        color: ty.color,
        label: language === "en" && ty.nameEn ? ty.nameEn : ty.name,
        value: scoped.byType[ty.id] || 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [scoped, language]);

  // Côté passifs, deux sources cohabitent : le type d'actif « dette » du
  // Patrimoine et les crédits de l'onglet Crédits, regroupés par type de prêt
  // (un foyer a rarement un seul prêt immobilier, mais il les lit comme un poste).
  const liabilityRows = useMemo(() => {
    const rows = [];
    const debtType = ASSET_TYPES.find((ty) => ty.id === "debt");
    if (debtType && (scoped.byType.debt || 0) > 0) {
      rows.push({
        key: "debt",
        icon: debtType.icon,
        color: debtType.color,
        label: language === "en" && debtType.nameEn ? debtType.nameEn : debtType.name,
        value: scoped.byType.debt,
      });
    }
    const byLoanType = {};
    for (const item of loanItems) {
      if (item.state.isPaidOff) continue;
      const share = globalScope === null ? item.conv.balance : getLoanShare(item, globalScope);
      if (!(share > 0)) continue;
      const id = item.loan.typeId || "other";
      byLoanType[id] = (byLoanType[id] || 0) + share;
    }
    for (const [id, value] of Object.entries(byLoanType)) {
      rows.push({
        key: `loan_${id}`,
        icon: loanType(id).icon,
        color: loanType(id).color,
        label: t(`loan_type_${id}`),
        value,
      });
    }
    return rows.sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, loanItems, globalScope, language]);
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

  // Variation sur un mois glissant. `null` tant que l'historique ne remonte pas
  // assez loin : on masque alors la ligne plutôt que d'afficher « +0 € », qui se
  // lirait comme une stagnation.
  // L'historique est celui du COUPLE : il n'existe pas de série par membre à
  // comparer. Sous filtre membre, la ligne disparaît donc au lieu d'afficher une
  // variation qui ne correspondrait pas au total affiché juste au-dessus.
  const monthlyDelta = useMemo(
    () =>
      globalScope !== null
        ? null
        : netWorthMonthlyDelta(netWorthHistory, netWorthAll, displayCurrency, convert),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [netWorthHistory, netWorthAll, displayCurrency, globalScope]
  );

  function formatAmount(n) {
    return Math.round(n).toLocaleString("fr-FR");
  }

  const wealthWidgetLabels = {
    net_worth: t("wealth_net_worth"),
    evolution: t("wealth_evolution"),
    allocation: t("wealth_allocation"),
    allocation_target: t("alloc_target_title"),
    projection: t("projection_title"),
    fx_exposure: t("wealth_fx_exposure"),
    credits: t("nav_credits"),
    calculator: t("wealth_calculator_cta"),
    my_assets: t("wealth_my_assets"),
    my_liabilities: t("wealth_my_liabilities"),
  };

  // Pastille d'insight du widget Patrimoine net : teinte du sens à faible
  // saturation (vert = ça monte, lavande = plus-value, corail = ça baisse). Elle
  // doit se voir sans disputer le regard au total, qui reste l'élément dominant.
  function renderInsightTag(text, tone) {
    const color = `var(--${tone})`;
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700,
          padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap", lineHeight: 1.45,
          background: `color-mix(in srgb, ${color} 16%, transparent)`,
          color: `color-mix(in srgb, ${color} 82%, var(--ink))`,
        }}
      >
        {text}
      </span>
    );
  }

  // Une section « Actifs » ou « Passifs » du widget Patrimoine net : un en-tête
  // coloré portant le total de la colonne, puis une ligne par poste avec sa part.
  // Le pourcentage se rapporte au total de la section, pas au patrimoine net —
  // sinon les parts des passifs dépasseraient 100 % dès que le foyer est endetté.
  function renderBreakdown(label, color, sectionTotal, rows, isLiability) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "16px 0 8px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color }}>
            {label}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color }}>
            {formatAmount(sectionTotal)} {currencySymbol}
          </span>
        </div>
        {rows.map((row) => {
          const pct = sectionTotal > 0 ? (row.value / sectionTotal) * 100 : 0;
          const rowColors = COLOR_MAP[row.color] || COLOR_MAP.sky;
          return (
            <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
              <i
                className={`ti ${row.icon}`}
                style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0, color: rowColors.text }}
                aria-hidden="true"
              />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.label}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: isLiability ? "var(--tang)" : "var(--ink)" }}>
                {formatAmount(row.value)} {currencySymbol}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-3)", width: 34, textAlign: "right", flexShrink: 0 }}>
                {Math.round(pct)}%
              </span>
            </div>
          );
        })}
      </div>
    );
  }

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
            // Même structure que WidgetCard : en-tête et pied figés, corps
            // défilant entre les deux. Sans la bande de pied, la dernière ligne
            // de la ventilation butait sur le bord de la carte dès que le
            // contenu débordait (grille bento à hauteur plafonnée).
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "1.25rem 1.25rem 0",
          }}
        >
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
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
          {/* Tête en grille : chaque insight partage sa ligne avec l'élément de
              gauche correspondant, et .pw-networth-head (index.css) aligne les
              lignes de base. Voir le commentaire là-bas — l'alignement est la
              raison d'être de la grille, il ne survivrait pas à un retour au flex. */}
          <div className="pw-networth-head">
            <p className="pw-nw-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)" }}>
              {scopeName ? t("wealth_member_total").replace("{name}", scopeName) : t("wealth_household_total")}
            </p>
            {monthlyDelta && (
              // Seul insight présent ⇒ il rejoint la ligne du montant, pour ne pas
              // laisser une ligne vide en face du total.
              <span className="pw-nw-ins" style={{ gridRow: unrealized.any ? 1 : 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-3)" }}>{t("wealth_over_month")}</span>
                {renderInsightTag(
                  `${monthlyDelta.amount >= 0 ? "↑ +" : "↓ −"}${formatAmount(Math.abs(monthlyDelta.amount))} ${currencySymbol}`,
                  monthlyDelta.amount >= 0 ? "sage" : "tang"
                )}
              </span>
            )}
            <p className="pw-nw-total" style={{ fontSize: 30, fontWeight: 500, color: scopedNetWorth >= 0 ? "var(--sage)" : "var(--tang)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <AnimatedNumber value={scopedNetWorth} format={formatAmount} /> {currencySymbol}
            </p>
            {unrealized.any && (
              <span className="pw-nw-ins" style={{ gridRow: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-3)" }}>{t("wealth_gain_short")}</span>
                {/* Le pourcentage seul, pas le montant : la colonne est déjà la
                    plus large des dispositions testées, et y ajouter le montant
                    ferait déborder un total à huit chiffres. */}
                {renderInsightTag(
                  `${unrealized.gain >= 0 ? "+" : ""}${unrealized.pct.toFixed(1)}%`,
                  unrealized.gain >= 0 ? "lavi" : "tang"
                )}
              </span>
            )}
          </div>

          {/* Actifs / passifs côte à côte, puis la barre de proportion : le
              ratio d'endettement se lit avant tout chiffre détaillé. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 15, borderTop: "0.5px solid var(--rule)" }}>
            <div style={{ padding: "12px 0 2px" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sage)", flexShrink: 0 }} />
                {t("wealth_assets")}
              </p>
              <p style={{ fontSize: 17, fontWeight: 600 }}>
                {formatAmount(scoped.assets)} {currencySymbol}
              </p>
            </div>
            <div style={{ padding: "12px 0 2px 14px", borderLeft: "0.5px solid var(--rule)" }}>
              <p style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--tang)", flexShrink: 0 }} />
                {t("wealth_liabilities")}
              </p>
              <p style={{ fontSize: 17, fontWeight: 600, color: scoped.liabilities > 0 ? "var(--tang)" : "var(--ink-3)" }}>
                {formatAmount(scoped.liabilities)} {currencySymbol}
              </p>
            </div>
          </div>

          {scoped.assets + scoped.liabilities > 0 && (
            <div style={{ display: "flex", height: 7, borderRadius: 4, background: "var(--rule)", overflow: "hidden", marginTop: 14 }}>
              <span style={{ height: 7, background: "var(--sage)", width: `${(scoped.assets / (scoped.assets + scoped.liabilities)) * 100}%` }} />
              <span style={{ height: 7, background: "var(--tang)", width: `${(scoped.liabilities / (scoped.assets + scoped.liabilities)) * 100}%` }} />
            </div>
          )}

          {/* Ventilation par poste. Le détail des actifs individuels reste dans
              les widgets dédiés par catégorie, plus bas dans la page. */}
          {assetRows.length > 0 &&
            renderBreakdown(t("wealth_assets"), "var(--sage)", scoped.assets, assetRows, false)}
          {liabilityRows.length > 0 &&
            renderBreakdown(t("wealth_liabilities"), "var(--tang)", scoped.liabilities, liabilityRows, true)}

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
        {/* Bande de pied figée, de la même hauteur que le dégagement d'en-tête :
            la dernière ligne de la ventilation ne bute plus sur le bord. */}
        <div style={{ flexShrink: 0, height: "1.25rem" }} aria-hidden="true" />
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

    if (id === "projection") {
      if (assets.length === 0) return null;
      return (
        <ProjectionCard
          base={totalAssets}
          monthlyContribution={monthlyContribution}
          currencySymbol={currencySymbol}
          formatAmount={formatAmount}
        />
      );
    }

    if (id === "allocation_target") {
      if (assets.length === 0) return null;
      return (
        <AllocationTargetCard
          assets={assets}
          getAssetValue={getAssetValue}
          currencySymbol={currencySymbol}
          formatAmount={formatAmount}
          targetAllocation={targetAllocation}
          onSave={updateTargetAllocation}
          language={language}
        />
      );
    }

    if (id === "fx_exposure") {
      // Une seule devise → rien à montrer (le widget disparaît de la grille).
      if (fxExposure.list.length < 2) return null;
      return (
        <WidgetCard icon="ti-world" accent="sky" title={t("wealth_fx_exposure")}>
          <div>
            {fxExposure.list.map((x) => {
              const pct = fxExposure.total > 0 ? (x.converted / fxExposure.total) * 100 : 0;
              const sym = ALL_CURRENCIES.find((c) => c.code === x.currency)?.symbol || x.currency;
              return (
                <div key={x.currency} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{x.currency}</span>
                    <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{formatAmount(x.native)} {sym}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)", width: 40, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: 6, background: "var(--sky)" }} />
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>{t("wealth_fx_exposure_hint")}</p>
          </div>
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

    if (id === "my_assets") return renderAssetGroupCard(false);
    if (id === "my_liabilities") return renderAssetGroupCard(true);

    return null;
  }

  // Actifs d'un type, filtre membre global appliqué : on ne montre que ceux du
  // membre choisi (+ les partagés / sans propriétaire), comme le widget
  // Liquidités de l'Accueil.
  function assetsOfType(typeId) {
    return assets.filter(
      (a) => a.typeId === typeId &&
        (globalScope == null || a.ownership === globalScope || a.ownership === "shared" || a.ownership == null)
    );
  }

  // Ligne d'un actif individuel, telle qu'elle s'affiche dans le panneau déplié
  // d'une catégorie. Extraite sans changement de l'ancienne carte par type.
  function renderAssetRow(asset, type, isLast) {
    const colors = COLOR_MAP[type.color] || COLOR_MAP.sky;
    const val = getAssetValue(asset);
    // Actif dont la valeur dérive d'un cours (actions/crypto) sans aucune
    // source exploitable : ni cours live, ni prix unitaire manuel, ni
    // valeur stockée POSITIVE. Le test portait sur `Number.isFinite`, donc
    // une valeur à 0 laissée en base faisait afficher un « 0 » affirmatif
    // au lieu de reconnaître qu'aucun prix n'est disponible.
    const priceUnavailable =
      type.hasApiPrice &&
      !(livePrices[asset.id] > 0) &&
      !(asset.manualPrice > 0) &&
      !(asset.value > 0);
    // Affichage devise native : pour les actifs à valeur stockée (comptes,
    // liquidités, AV, immobilier…) libellés dans une devise ≠ devise de
    // résumé, on montre le solde dans SA devise (gros) + l'équivalent
    // converti (petit). Les actifs cotés (actions/crypto) restent en devise
    // de résumé (pas de devise native pertinente ici).
    const nativeCur = asset.currency || displayCurrency;
    const showNative = !type.hasApiPrice && nativeCur !== displayCurrency;
    const nativeSymbol = ALL_CURRENCIES.find((c) => c.code === nativeCur)?.symbol || nativeCur;
    const sign = type.isLiability ? "−" : "";
    // Carte « Compte en banque » : nom en colonne de largeur fixe pour
    // que les boutons « Connecter » soient tous alignés (cf. plus bas).
    const isAccount = type.id === "account";
    // Plus-value latente (lot 2) : coût investi (devise de l'actif) ramené
    // en devise de résumé, comparé à la valeur actuelle (déjà en devise de
    // résumé). % de rendement total depuis l'achat.
    const costBasisDisplay = asset.costBasis
      ? convert(asset.costBasis, asset.currency || displayCurrency, displayCurrency)
      : 0;
    const hasCost = costBasisDisplay > 0 && Number.isFinite(val) && !priceUnavailable;
    const gainPct = hasCost ? ((val - costBasisDisplay) / costBasisDisplay) * 100 : 0;
    const ownerLabel =
      asset.ownership === "shared"
        ? "Partagé"
        : members.find((m) => getMemberKey(m) === asset.ownership)?.name || "";
    const subtypeLabel = getSubtypeLabel(asset.typeId, asset.subtype, language);
    // Equity nette : pour un bien lié à un prêt (asset.loanId), valeur du
    // bien − capital restant dû. Le prêt reste comptabilisé une seule fois
    // au niveau du patrimoine (loanAgg) : ici c'est un affichage par bien.
    const linkedLoan = asset.loanId ? loanItems.find((li) => li.loan.id === asset.loanId) : null;
    const equity = linkedLoan ? val - linkedLoan.conv.balance : null;

    return (
      <div
        key={asset.id}
        style={{ borderBottom: isLast ? "none" : "0.5px solid var(--rule)" }}
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
          <div style={isAccount ? { width: 96, flexShrink: 0, minWidth: 0 } : { flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asset.name}</p>
            <p style={{ fontSize: 10, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {subtypeLabel && `${subtypeLabel} · `}
              {asset.apiId && `${asset.quantity} ${asset.apiId.toUpperCase()} · `}
              {ownerLabel}
              {asset.ownership === "shared" && ` (${asset.sharePct ?? 50}/${100 - (asset.sharePct ?? 50)})`}
            </p>
          </div>
          {/* Bouton bancaire juste à côté du nom. La colonne de nom a une
              largeur fixe (isAccount) → tous les boutons « Connecter »
              démarrent au même x, quelle que soit la longueur du nom ; le
              spacer qui suit repousse le solde à droite. */}
          {isAccount && (
            <ConnectBankButton asset={asset} compact onSuccess={() => setEditingAsset(null)} />
          )}
          {isAccount && <div style={{ flex: 1 }} />}
          {asset.comments?.length > 0 && (
            <CommentBubble count={asset.comments.length} onClick={() => setCommentsAsset(asset)} />
          )}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {priceUnavailable ? (
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }} title={t("wealth_price_unavailable")}>
                {t("wealth_price_unavailable_short")}
              </p>
            ) : showNative ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 500, color: type.isLiability ? "var(--red)" : "var(--ink)" }}>
                  {sign}{formatAmount(asset.value)} {nativeSymbol}
                </p>
                <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>
                  ≈ {sign}{formatAmount(val)} {currencySymbol}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12, fontWeight: 500, color: type.isLiability ? "var(--red)" : "var(--ink)" }}>
                {sign}{formatAmount(val)} {currencySymbol}
              </p>
            )}
            {/* Rendement total depuis l'achat (si coût investi renseigné),
                sinon variation 24h pour les actifs cotés. */}
            {hasCost ? (
              <p style={{ fontSize: 11, color: gainPct >= 0 ? "var(--sage)" : "var(--tang)", marginTop: 1 }} title={t("wealth_since_purchase")}>
                {gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
              </p>
            ) : liveChanges[asset.id] !== undefined ? (
              <p style={{ fontSize: 11, color: liveChanges[asset.id] >= 0 ? "var(--sage)" : "var(--tang)", marginTop: 1 }}>
                {liveChanges[asset.id] >= 0 ? "+" : ""}{liveChanges[asset.id].toFixed(2)}%
              </p>
            ) : null}
            {/* Equity nette (bien − prêt lié). */}
            {equity !== null && (
              <p style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>
                {t("wealth_net_equity")} {formatAmount(equity)} {currencySymbol}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Bandeau de reconnexion : comptes dont la connexion Plaid est à réparer
  // (statut poussé par le webhook). Le bouton « Reconnecter » vit dans chaque
  // ligne concernée ; ce bandeau ne fait que résumer.
  function renderBankBanner(typeAssets) {
    const attention = typeAssets.filter((a) => a.bankConnected && a.bankStatus && a.bankStatus !== "active");
    if (attention.length === 0) return null;
    const msg = attention.length === 1
      ? t("bank_banner_one")
      : t("bank_banner_many").replace("{count}", attention.length);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderBottom: "0.5px solid var(--rule)",
        background: "var(--amber-light, #fff4e0)",
      }}>
        <i className="ti ti-alert-triangle" style={{ fontSize: 15, color: "var(--amber, #e0932f)", flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: 12.5, color: "var(--amber, #e0932f)", fontWeight: 600 }}>{msg}</span>
      </div>
    );
  }

  // Ligne repliable d'une catégorie, dans « Mes actifs » / « Mes passifs » :
  // icône, nom, nombre d'entrées, total, chevron. Le panneau déplié contient les
  // lignes individuelles rendues par `children`.
  function renderGroupRow({ key, icon, color, label, count, total, isLiability, children, isLast }) {
    const open = openGroups.includes(key);
    const colors = COLOR_MAP[color] || COLOR_MAP.sky;
    return (
      <div key={key}>
        <button
          type="button"
          onClick={() => toggleGroup(key)}
          aria-expanded={open}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "11px 14px", border: 0, background: open ? colors.bg : "none",
            font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer",
            borderBottom: open || !isLast ? "0.5px solid var(--rule)" : "none",
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0, color: colors.text }} aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: "var(--ink-3)", background: "var(--rule)", borderRadius: 20, padding: "1px 7px", flexShrink: 0 }}>
            {count}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0, color: isLiability ? "var(--tang)" : "var(--ink)" }}>
            {isLiability ? "−" : ""}{formatAmount(total)} {currencySymbol}
          </span>
          <i
            className="ti ti-chevron-right"
            style={{
              fontSize: 14, color: "var(--ink-4)", flexShrink: 0,
              transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s ease",
            }}
            aria-hidden="true"
          />
        </button>
        {open && <div style={{ borderBottom: isLast ? "none" : "0.5px solid var(--rule)" }}>{children()}</div>}
      </div>
    );
  }

  // Carte « Mes actifs » / « Mes passifs » : une ligne repliable par catégorie,
  // là où chaque catégorie occupait auparavant un widget de premier rang. Onze
  // cartes possibles se replient ainsi en deux, et le patrimoine net cesse
  // d'être noyé au milieu de cartes qui pèsent visuellement autant que lui.
  function renderAssetGroupCard(isLiability) {
    // Catégories d'actifs non vides, de la plus lourde à la plus légère.
    const typeRows = ASSET_TYPES
      .filter((ty) => !!ty.isLiability === isLiability)
      .map((ty) => ({ type: ty, list: assetsOfType(ty.id) }))
      .filter(({ list }) => list.length > 0)
      .map(({ type, list }) => ({
        key: `type_${type.id}`,
        icon: type.icon,
        color: type.color,
        label: language === "en" && type.nameEn ? type.nameEn : type.name,
        count: list.length,
        total: list.reduce((s, a) => s + (globalScope === null ? getAssetValue(a) : getMemberShare(a, globalScope)), 0),
        render: () => (
          <>
            {type.id === "account" && renderBankBanner(list)}
            {list.map((a, i) => renderAssetRow(a, type, i === list.length - 1))}
          </>
        ),
      }))
      .sort((a, b) => b.total - a.total);

    // Côté passifs, les crédits rejoignent les dettes du Patrimoine : le foyer
    // les lit comme un même poste, regroupés par type de prêt. Le rendu "credits"
    // de renderWealthWidget existe toujours mais son id n'est pas dans
    // FIXED_WEALTH_WIDGETS, donc il ne s'affiche pas sur cet onglet : cette carte
    // est bien le seul endroit où les crédits pèsent ici. Un clic sur une ligne
    // ouvre l'onglet Crédits, qui porte l'avancement et les échéances.
    if (isLiability) {
      const byLoanType = {};
      for (const item of loanItems) {
        if (item.state.isPaidOff || !(item.conv.balance > 0)) continue;
        const id = item.loan.typeId || "other";
        (byLoanType[id] ||= []).push(item);
      }
      for (const [id, items] of Object.entries(byLoanType)) {
        typeRows.push({
          key: `loan_${id}`,
          icon: loanType(id).icon,
          color: loanType(id).color,
          label: t(`loan_type_${id}`),
          count: items.length,
          total: items.reduce((s, it) => s + it.conv.balance, 0),
          render: () => (
            <>
              {items.map((it, i) => (
                <div
                  key={it.loan.id}
                  onClick={onOpenCredits}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 10px 36px",
                    cursor: onOpenCredits ? "pointer" : "default",
                    borderBottom: i === items.length - 1 ? "none" : "0.5px solid var(--rule)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {it.loan.name || t(`loan_type_${id}`)}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      {t("loan_repaid_pct").replace("{pct}", Math.round((it.state.progress || 0) * 100))}
                    </p>
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "var(--tang)", flexShrink: 0 }}>
                    −{formatAmount(it.conv.balance)} {currencySymbol}
                  </p>
                </div>
              ))}
            </>
          ),
        });
      }
      typeRows.sort((a, b) => b.total - a.total);
    }

    if (typeRows.length === 0) return null;
    const sectionTotal = typeRows.reduce((s, r) => s + r.total, 0);

    return (
      <WidgetCard
        icon={isLiability ? "ti-credit-card" : "ti-wallet"}
        accent={isLiability ? "pink" : "ocean"}
        title={isLiability ? t("wealth_my_liabilities") : t("wealth_my_assets")}
        flush
      >
        <div>
          <div style={{ padding: "12px 14px", borderBottom: "0.5px solid var(--rule)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13.5, color: "var(--ink-2)", fontWeight: 600 }}>{t("wealth_category_total")}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: isLiability ? "var(--tang)" : "var(--ink)" }}>
                {isLiability ? "−" : ""}{formatAmount(sectionTotal)} {currencySymbol}
              </span>
            </div>
          </div>
          {typeRows.map((row, i) =>
            renderGroupRow({ ...row, isLiability, children: row.render, isLast: i === typeRows.length - 1 })
          )}
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

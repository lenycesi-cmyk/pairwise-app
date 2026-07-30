import { useMemo, useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import {
  REBALANCE_BAND,
  className,
  computeClassTotals,
  computeDrift,
  matchProfile,
  migrateLegacyTargets,
  profileName,
} from "../data/allocationModels";
import AllocationBar from "./AllocationBar";
import AllocationTargetModal from "./AllocationTargetModal";
import WidgetCard from "./WidgetCard";

// Carte « Allocation cible » : compare la répartition actuelle du patrimoine
// INVESTISSABLE à une cible (profil de risque standard ou grille personnalisée)
// et n'annonce un arbitrage que lorsque l'écart sort de la bande de ±5 points —
// le seuil retenu par la profession pour éviter de rééquilibrer en permanence.
export default function AllocationTargetCard({
  assets,
  getAssetValue,
  currencySymbol,
  formatAmount,
  targetAllocation,
  onSave,
  language,
}) {
  const t = useTranslation();
  const lang = language === "en" ? "en" : "fr";
  const [open, setOpen] = useState(false);

  // Les anciennes cibles étaient stockées par type d'actif : on les replie vers
  // les classes de risque à la lecture, sans réécriture silencieuse.
  const weights = useMemo(() => migrateLegacyTargets(targetAllocation), [targetAllocation]);
  const { totals, investable, excluded } = useMemo(
    () => computeClassTotals(assets, getAssetValue),
    [assets, getAssetValue]
  );
  const drift = useMemo(() => computeDrift(totals, investable, weights), [totals, investable, weights]);

  const hasTargets = Object.values(weights).some((v) => v > 0);
  const profile = matchProfile(weights);

  const editBtn = (
    <button
      onClick={() => setOpen(true)}
      style={{
        marginLeft: "auto", background: "none", border: "none",
        color: "var(--sky)", fontSize: 12, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      <i className="ti ti-adjustments" style={{ fontSize: 14 }} aria-hidden="true" />
      {t("alloc_target_edit")}
    </button>
  );

  const modal = open ? (
    <AllocationTargetModal
      weights={weights}
      classTotals={totals}
      investable={investable}
      onSave={onSave}
      onClose={() => setOpen(false)}
      language={language}
    />
  ) : null;

  if (!hasTargets) {
    return (
      <WidgetCard icon="ti-target-arrow" accent="ocean" title={t("alloc_target_title")}>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 10 }}>
          {t("alloc_target_empty")}
        </p>
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: "9px 14px", borderRadius: "var(--radius-md)", border: "none",
            background: "var(--sky)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          <i className="ti ti-compass" style={{ fontSize: 15 }} aria-hidden="true" />
          {t("alloc_choose_profile")}
        </button>
        {modal}
      </WidgetCard>
    );
  }

  if (investable <= 0) {
    return (
      <WidgetCard icon="ti-target-arrow" accent="ocean" title={t("alloc_target_title")} action={editBtn}>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{t("alloc_no_investable")}</p>
        {modal}
      </WidgetCard>
    );
  }

  const actionCount = drift.actions.length;

  return (
    <WidgetCard icon="ti-target-arrow" accent="ocean" title={t("alloc_target_title")} action={editBtn}>
      {/* Ligne de synthèse : profil + verdict de rééquilibrage. */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99,
            background: "var(--sky-light)", color: "var(--sky)",
          }}
        >
          {profile ? profileName(profile, lang) : t("alloc_custom")}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4,
            color: drift.balanced ? "var(--sage)" : "var(--tang)",
          }}
        >
          <i
            className={`ti ${drift.balanced ? "ti-circle-check" : "ti-alert-triangle"}`}
            style={{ fontSize: 13 }}
            aria-hidden="true"
          />
          {drift.balanced
            ? t("alloc_target_balanced")
            : `${actionCount} ${actionCount > 1 ? t("alloc_trades_many") : t("alloc_trades_one")}`}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--ink-3)", marginLeft: "auto" }}>
          {t("alloc_drift_max")} {drift.maxDrift.toFixed(0)} {t("alloc_points")} · ±{REBALANCE_BAND}
        </span>
      </div>

      {/* Comparaison visuelle actuel / cible sur la même échelle. */}
      <div style={{ display: "grid", gap: 5, marginBottom: 12 }}>
        <AllocationBar weights={Object.fromEntries(drift.rows.map((r) => [r.class.id, r.currentPct]))} label={t("alloc_current")} />
        <AllocationBar weights={weights} label={t("alloc_target_label")} muted />
      </div>

      {/* Détail par classe : écart en points et montant à arbitrer. */}
      {drift.rows
        .filter((r) => r.currentAmount > 0 || r.targetPct > 0)
        .map((r) => (
          <div key={r.class.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${r.class.color})`, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {className(r.class.id, lang)}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>
              {r.currentPct.toFixed(0)}% → {r.targetPct.toFixed(0)}%
            </span>
            <span
              style={{
                fontSize: 11.5, fontWeight: 600, flexShrink: 0, width: 96, textAlign: "right",
                color: !r.outOfBand ? "var(--ink-3)" : r.delta > 0 ? "var(--sage)" : "var(--tang)",
              }}
            >
              {!r.outOfBand
                ? "—"
                : r.delta > 0
                  ? `+${formatAmount(r.delta)} ${currencySymbol}`
                  : `−${formatAmount(-r.delta)} ${currencySymbol}`}
            </span>
          </div>
        ))}

      {/* Plan d'action, formulé comme un conseiller le dirait. */}
      {actionCount > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--rule)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
            {t("alloc_rebalance_title")}
          </p>
          {drift.actions.map((r) => (
            <p key={r.class.id} style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {r.delta > 0 ? t("alloc_target_buy") : t("alloc_target_trim")}{" "}
              <strong>
                {r.delta > 0 ? "+" : "−"}
                {formatAmount(Math.abs(r.delta))} {currencySymbol}
              </strong>{" "}
              {r.delta > 0 ? t("alloc_in") : t("alloc_from")} {className(r.class.id, lang)}
            </p>
          ))}
        </div>
      )}

      {/* Base de calcul : on explique ce qui a été volontairement écarté. */}
      <p style={{ fontSize: 10.5, color: "var(--ink-3)", lineHeight: 1.5, marginTop: 10, paddingTop: 8, borderTop: "0.5px solid var(--rule)" }}>
        {t("alloc_base_note")} {formatAmount(investable)} {currencySymbol}
        {excluded > 0 && ` · ${t("alloc_excluded_note")} ${formatAmount(excluded)} ${currencySymbol}`}
      </p>

      {modal}
    </WidgetCard>
  );
}

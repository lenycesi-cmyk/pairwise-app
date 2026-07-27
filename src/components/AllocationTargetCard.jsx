import { useState } from "react";
import { ASSET_TYPES } from "../data/assetTypes";
import { useTranslation } from "../hooks/useTranslation";
import WidgetCard from "./WidgetCard";

const NON_LIABILITY = ASSET_TYPES.filter((t) => !t.isLiability);

// Carte « Allocation cible » : compare la répartition actuelle du patrimoine à
// une cible définie par l'utilisateur (par type d'actif) et suggère le
// rééquilibrage (montant à investir / alléger pour atteindre la cible).
export default function AllocationTargetCard({
  totalsByType,
  totalAssets,
  currencySymbol,
  formatAmount,
  targetAllocation,
  onSave,
  language,
}) {
  const t = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(NON_LIABILITY.map((ty) => [ty.id, String(targetAllocation?.[ty.id] || "")]))
  );

  const typeName = (ty) => (language === "en" && ty.nameEn ? ty.nameEn : ty.name);
  const hasTargets = NON_LIABILITY.some((ty) => (targetAllocation?.[ty.id] || 0) > 0);

  function startEdit() {
    setDraft(Object.fromEntries(NON_LIABILITY.map((ty) => [ty.id, String(targetAllocation?.[ty.id] || "")])));
    setEditing(true);
  }

  async function save() {
    const map = {};
    for (const ty of NON_LIABILITY) {
      const v = parseFloat(draft[ty.id]);
      map[ty.id] = Number.isFinite(v) && v > 0 ? v : 0;
    }
    await onSave(map);
    setEditing(false);
  }

  const draftSum = NON_LIABILITY.reduce((s, ty) => s + (parseFloat(draft[ty.id]) || 0), 0);

  const editBtn = (
    <button
      onClick={() => (editing ? save() : startEdit())}
      style={{
        marginLeft: "auto", background: "none", border: "none",
        color: "var(--sky)", fontSize: 12, fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      <i className={`ti ${editing ? "ti-check" : "ti-adjustments"}`} style={{ fontSize: 14 }} aria-hidden="true" />
      {editing ? t("dashboard_done") : t("alloc_target_edit")}
    </button>
  );

  return (
    <WidgetCard icon="ti-target-arrow" accent="ocean" title={t("alloc_target_title")} action={editBtn}>
      {editing ? (
        <div>
          {NON_LIABILITY.map((ty) => (
            <div key={ty.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <span style={{ fontSize: 13, flex: 1, color: "var(--ink-2)" }}>{typeName(ty)}</span>
              <input
                type="number"
                inputMode="decimal"
                value={draft[ty.id]}
                onChange={(e) => setDraft((d) => ({ ...d, [ty.id]: e.target.value }))}
                placeholder="0"
                style={{
                  width: 64, textAlign: "right", padding: "6px 8px",
                  border: "0.5px solid var(--rule)", borderRadius: "var(--radius-sm)",
                  background: "var(--bg)", color: "var(--ink)", fontSize: 13,
                }}
              />
              <span style={{ fontSize: 12, color: "var(--ink-3)", width: 14 }}>%</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "0.5px solid var(--rule)" }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{t("alloc_target_total")}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: Math.round(draftSum) === 100 ? "var(--sage)" : "var(--tang)" }}>
              {Math.round(draftSum)}%
            </span>
          </div>
        </div>
      ) : !hasTargets ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>{t("alloc_target_empty")}</p>
      ) : (
        <div>
          {NON_LIABILITY.filter(
            (ty) => (totalsByType[ty.id] || 0) > 0 || (targetAllocation?.[ty.id] || 0) > 0
          ).map((ty) => {
            const currentAmt = totalsByType[ty.id] || 0;
            const currentPct = totalAssets > 0 ? (currentAmt / totalAssets) * 100 : 0;
            const targetPct = targetAllocation?.[ty.id] || 0;
            const targetAmt = (totalAssets * targetPct) / 100;
            const delta = targetAmt - currentAmt; // + = investir, − = alléger
            const onTarget = Math.abs(delta) < totalAssets * 0.01; // < 1% du total
            const barColor = `var(--${ty.color})`;
            return (
              <div key={ty.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{typeName(ty)}</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                    {currentPct.toFixed(0)}% → {targetPct.toFixed(0)}%
                  </span>
                </div>
                {/* Barre : remplissage = allocation actuelle ; repère vertical = cible. */}
                <div style={{ position: "relative", width: "100%", height: 8, background: "var(--rule)", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, currentPct))}%`, height: 8, background: barColor }} />
                  <div style={{ position: "absolute", top: -1, left: `calc(${Math.max(0, Math.min(100, targetPct))}% - 1px)`, width: 2, height: 10, background: "var(--ink)" }} />
                </div>
                <p style={{ fontSize: 11, color: onTarget ? "var(--ink-3)" : delta > 0 ? "var(--sage)" : "var(--tang)" }}>
                  {onTarget
                    ? t("alloc_target_balanced")
                    : delta > 0
                      ? `${t("alloc_target_buy")} +${formatAmount(delta)} ${currencySymbol}`
                      : `${t("alloc_target_trim")} −${formatAmount(-delta)} ${currencySymbol}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "../hooks/useTranslation";

/**
 * Sélecteur de partage avancé entre exactement 2 membres.
 * `value` attendu : { mode: "members" } pour 50/50 simple,
 *                    { mode: "custom", unit: "percent"|"amount", a: number, b: number }
 * où `a` et `b` sont les valeurs pour members[0] et members[1] respectivement.
 *
 * En mode "percent", a + b = 100 toujours.
 * En mode "amount", a + b = totalAmount toujours (les deux champs se complètent).
 */
export default function AdvancedSplitSelector({ members, totalAmount, value, onChange }) {
  const t = useTranslation();
  const [unit, setUnit] = useState(value?.unit || "percent");
  const [pctA, setPctA] = useState(value?.unit === "percent" ? value.a : 50);
  const [amountA, setAmountA] = useState(
    value?.unit === "amount" ? value.a : Math.round((totalAmount || 0) / 2)
  );

  const memberA = members[0];
  const memberB = members[1];

  // Recalcule le montant A à chaque fois que le % ou le total change, pour
  // garder les deux unités synchronisées visuellement.
  useEffect(() => {
    if (unit === "percent" && totalAmount > 0) {
      setAmountA(Math.round((totalAmount * pctA) / 100));
    }
  }, [pctA, totalAmount, unit]);

  function commitPercent(newPctA) {
    const clamped = Math.max(0, Math.min(100, newPctA));
    setPctA(clamped);
    onChange({ mode: "custom", unit: "percent", a: clamped, b: 100 - clamped });
  }

  function commitAmount(newAmountA) {
    const clamped = Math.max(0, Math.min(totalAmount || 0, newAmountA));
    setAmountA(clamped);
    const remainder = (totalAmount || 0) - clamped;
    onChange({ mode: "custom", unit: "amount", a: clamped, b: remainder });
  }

  function switchUnit(newUnit) {
    setUnit(newUnit);
    if (newUnit === "percent") {
      commitPercent(pctA);
    } else {
      commitAmount(totalAmount > 0 ? Math.round((totalAmount * pctA) / 100) : 0);
    }
  }

  const pctB = 100 - pctA;
  const amountB = (totalAmount || 0) - amountA;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => switchUnit("percent")}
          style={{
            flex: 1, padding: 6, borderRadius: "var(--radius-sm)",
            border: unit === "percent" ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
            background: unit === "percent" ? "var(--lavi-light)" : "var(--bg)",
            color: unit === "percent" ? "var(--lavi)" : "var(--ink-3)",
            fontSize: 12,
          }}
        >
          %
        </button>
        <button
          onClick={() => switchUnit("amount")}
          style={{
            flex: 1, padding: 6, borderRadius: "var(--radius-sm)",
            border: unit === "amount" ? "0.5px solid var(--lavi)" : "0.5px solid var(--rule)",
            background: unit === "amount" ? "var(--lavi-light)" : "var(--bg)",
            color: unit === "amount" ? "var(--lavi)" : "var(--ink-3)",
            fontSize: 12,
          }}
        >
          {t("split_amount_unit")}
        </button>
      </div>

      {unit === "percent" ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
              {memberA?.name} : {pctA}%
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
              {memberB?.name} : {pctB}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={pctA}
            onChange={(e) => commitPercent(parseInt(e.target.value))}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min="0"
              max="100"
              value={pctA}
              onChange={(e) => commitPercent(parseInt(e.target.value) || 0)}
              style={{
                width: 60, padding: "6px 8px", borderRadius: "var(--radius-sm)",
                border: "0.5px solid var(--rule)", fontSize: 13, textAlign: "center",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              % {t("split_for")} {memberA?.name}
            </span>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
              {memberA?.name} : {Math.round(amountA).toLocaleString("fr-FR")}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
              {memberB?.name} : {Math.round(amountB).toLocaleString("fr-FR")}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={totalAmount || 0}
            value={amountA}
            onChange={(e) => commitAmount(parseFloat(e.target.value))}
            style={{ width: "100%", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min="0"
              max={totalAmount || 0}
              value={amountA}
              onChange={(e) => commitAmount(parseFloat(e.target.value) || 0)}
              style={{
                width: 90, padding: "6px 8px", borderRadius: "var(--radius-sm)",
                border: "0.5px solid var(--rule)", fontSize: 13, textAlign: "center",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {t("split_for")} {memberA?.name}
            </span>
          </div>
        </>
      )}

      <button
        onClick={() => { setUnit("percent"); commitPercent(50); }}
        style={{ marginTop: 10, background: "none", border: "none", color: "var(--sky)", fontSize: 11 }}
      >
        {t("split_reset_5050")}
      </button>
    </div>
  );
}

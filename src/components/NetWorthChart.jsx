import { useState, useMemo } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CHART_ANIM, TOOLTIP_ANIM } from "../utils/chartAnim";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";

const PERIODS = [
  { key: "1m", labelKey: "wealth_period_1m", days: 30 },
  { key: "3m", labelKey: "wealth_period_3m", days: 90 },
  { key: "6m", labelKey: "wealth_period_6m", days: 180 },
  { key: "1y", labelKey: "wealth_period_1y", days: 365 },
  { key: "all", labelKey: "wealth_period_all", days: null },
];

export default function NetWorthChart({ history, currencySymbol, displayCurrency, convert }) {
  const t = useTranslation();
  const [period, setPeriod] = useState("3m");
  const [chartType, setChartType] = useState("line"); // "line" | "bar"

  const selectedPeriod = PERIODS.find((p) => p.key === period);

  const filteredHistory = useMemo(() => {
    if (!selectedPeriod.days) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedPeriod.days);
    return history.filter((h) => new Date(h.date) >= cutoff);
  }, [history, period]);

  // Chaque point de l'historique a été enregistré dans la devise active au
  // moment de sa création (h.currency). On le reconvertit systématiquement
  // vers la devise d'affichage actuelle, sinon un changement de devise donne
  // l'illusion d'une chute ou d'une hausse brutale du patrimoine.
  const { language } = useFinance();
  const locale = language === "en" ? "en-GB" : "fr-FR";
  const data = filteredHistory.map((h) => ({
    date: new Date(h.date).toLocaleDateString(locale, { day: "2-digit", month: "short" }),
    value: h.currency && h.currency !== displayCurrency
      ? convert(h.value, h.currency, displayCurrency)
      : h.value,
  }));

  // Performance sur la période affichée
  const performance = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    if (first === 0) return null;
    const diff = last - first;
    const pct = (diff / Math.abs(first)) * 100;
    return { diff, pct };
  }, [data]);

  function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    return (
      <div
        style={{
          background: "var(--ink)",
          color: "var(--bg)",
          padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
        }}
      >
        {Math.round(payload[0].value).toLocaleString("fr-FR")} {currencySymbol}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: "4px 9px",
                borderRadius: "var(--radius-sm)",
                border: period === p.key ? "0.5px solid var(--sage)" : "0.5px solid var(--rule)",
                background: period === p.key ? "var(--sage-light)" : "transparent",
                color: period === p.key ? "var(--sage)" : "var(--ink-3)",
                fontSize: 11,
                fontWeight: period === p.key ? 500 : 400,
              }}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>
        {/* Bascule courbe / barres. */}
        <div style={{ display: "flex", flexShrink: 0, borderRadius: "var(--radius-sm)", border: "0.5px solid var(--rule)", overflow: "hidden" }}>
          {[
            { key: "line", icon: "ti-chart-line", label: t("chart_type_line") },
            { key: "bar", icon: "ti-chart-bar", label: t("chart_type_bar") },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setChartType(c.key)}
              aria-label={c.label}
              aria-pressed={chartType === c.key}
              style={{
                width: 30, height: 26, display: "flex", alignItems: "center", justifyContent: "center", border: "none",
                background: chartType === c.key ? "var(--sage-light)" : "transparent",
                color: chartType === c.key ? "var(--sage)" : "var(--ink-3)", cursor: "pointer",
              }}
            >
              <i className={`ti ${c.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      {performance && (
        <p
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
            color: performance.diff >= 0 ? "var(--sage)" : "var(--tang)",
          }}
        >
          {performance.diff >= 0 ? "+" : ""}
          {Math.round(performance.diff).toLocaleString("fr-FR")} {currencySymbol}
          {" "}({performance.pct >= 0 ? "+" : ""}{performance.pct.toFixed(1)}%)
          <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> {t("wealth_period_over")} {t(selectedPeriod.labelKey).toLowerCase()}</span>
        </p>
      )}

      <div style={{ width: "100%", height: 140 }}>
        <ResponsiveContainer>
          {chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                axisLine={{ stroke: "var(--rule)" }}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--rule)", opacity: 0.4 }} {...TOOLTIP_ANIM} />
              <Bar dataKey="value" fill="var(--sage)" radius={[3, 3, 0, 0]} {...CHART_ANIM} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                axisLine={{ stroke: "var(--rule)" }}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} {...TOOLTIP_ANIM} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--sage)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                {...CHART_ANIM}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

import { useState } from "react";
import { PERIOD_TYPES, shiftAnchor } from "../utils/periodRange";
import { useTranslation } from "../hooks/useTranslation";

// Sélecteur de période unifié (Rapports + Flux). Un seul bouton affichant la
// période courante ouvre un menu listant tous les types ; les périodes
// « glissables » (semaine / mois / année) gagnent une navigation ‹ › de part et
// d'autre. Les fenêtres ancrées sur aujourd'hui (3 / 12 derniers mois) et le
// personnalisé n'ont pas de navigation. En mode personnalisé, deux champs de
// dates apparaissent sous le bouton.
export default function PeriodSelector({
  periodType,
  setPeriodType,
  anchor,
  setAnchor,      // pose une ancre précise (nav ‹ ›) + synchro sharedMonth
  setAnchorNow,   // réinitialise l'ancre sur aujourd'hui (semaine / N derniers mois)
  rangeLabel,
  customRange,
  setCustomRange,
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const navigable = periodType === "week" || periodType === "month" || periodType === "year";

  const choose = (p) => {
    setPeriodType(p);
    if (p === "week" || p === "last3" || p === "last12") setAnchorNow?.();
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      {/* Conteneur RELATIF sans `overflow` : le menu déroulant est un frère de
          la pastille, pas un enfant. Placé dedans, il serait rogné par
          l'`overflow: hidden` qui donne à la pastille ses coins arrondis. */}
      <div style={{ position: "relative", minWidth: 0 }}>
        {/* Pastille UNIQUE à trois zones. La fusion est visuelle seulement :
            ce sont toujours trois <button> distincts, chacun avec son
            aria-label. Un bouton unique qui devinerait l'intention d'après
            l'endroit touché serait inutilisable au clavier et au lecteur
            d'écran. */}
        <div
          style={{
            display: "inline-flex", alignItems: "stretch", height: 34, minWidth: 0,
            borderRadius: 99, border: "0.5px solid var(--rule)",
            background: "var(--bg-card)", overflow: "hidden",
          }}
        >
          {navigable && (
            <>
              <button
                onClick={() => setAnchor(shiftAnchor(periodType, anchor, -1))}
                aria-label={t("period_prev")}
                style={arrowZone}
              >
                <i className="ti ti-chevron-left" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
              <span style={sep} aria-hidden="true" />
            </>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0,
              padding: "0 10px", border: "none", background: "none",
              font: "inherit", fontSize: 13.5, color: "var(--ink)",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <i className="ti ti-calendar-event" style={{ fontSize: 15, color: "var(--sky)" }} aria-hidden="true" />
            {/* Largeur plancher : la zone centrale est encadrée par les deux
                flèches, donc un libellé plus court les ferait glisser sous le
                doigt d'un mois à l'autre. C'est un MINIMUM, pas une largeur
                fixe — les libellés plus longs (plages de dates, « 12 derniers
                mois ») s'étendent normalement plutôt que d'être tronqués. */}
            <span style={{ fontWeight: 600, textTransform: "capitalize", minWidth: 78, textAlign: "center" }}>{rangeLabel}</span>
            <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
          </button>

          {navigable && (
            <>
              <span style={sep} aria-hidden="true" />
              <button
                onClick={() => setAnchor(shiftAnchor(periodType, anchor, 1))}
                aria-label={t("period_next")}
                style={arrowZone}
              >
                <i className="ti ti-chevron-right" style={{ fontSize: 16 }} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                zIndex: 41, minWidth: 200, background: "var(--bg-card)", borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)", boxShadow: "var(--shadow-lg)", padding: 6,
              }}
            >
              {PERIOD_TYPES.map((p) => {
                const sel = periodType === p;
                return (
                  <button
                    key={p}
                    onClick={() => choose(p)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontSize: 13.5, textAlign: "left",
                      background: sel ? "var(--sky-light)" : "transparent",
                      color: sel ? "var(--sky)" : "var(--ink)", fontWeight: sel ? 600 : 400,
                    }}
                  >
                    {t(`reports_period_${p}`)}
                    {sel && <i className="ti ti-check" style={{ fontSize: 15 }} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {periodType === "custom" && (
        <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360 }}>
          <input type="date" value={customRange.start} onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))} style={dateInput} />
          <input type="date" value={customRange.end} onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))} style={dateInput} />
        </div>
      )}
    </div>
  );
}

// Zone flèche : LARGEUR ÉGALE À LA HAUTEUR de la pastille (34 px), donc une
// cible carrée — les pastilles rondes d'avant n'en faisaient que 30.
const arrowZone = {
  width: 34, flexShrink: 0,
  display: "grid", placeItems: "center",
  border: "none", background: "none", padding: 0,
  color: "var(--ink-2)", cursor: "pointer",
};

// Filet de séparation. Sans lui, la pastille se lit comme un bouton unique et
// rien ne laisse deviner que les extrémités agissent séparément. Il s'arrête
// avant les bords pour ne pas trancher la pastille en trois morceaux.
const sep = {
  width: 1, flexShrink: 0, margin: "7px 0", background: "var(--rule)",
};

const dateInput = {
  flex: 1, padding: "8px 10px", borderRadius: "var(--radius-md)",
  border: "0.5px solid var(--rule)", background: "var(--bg-card)",
  fontSize: 13, color: "var(--ink)",
};

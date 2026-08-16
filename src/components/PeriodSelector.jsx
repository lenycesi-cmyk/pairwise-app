import { useState } from "react";
import { PERIOD_TYPES, shiftAnchor, toDateInputValue } from "../utils/periodRange";
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
  range,          // plage courante — sert à pré-remplir « personnalisé »
  customRange,
  setCustomRange,
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const navigable = periodType === "week" || periodType === "month" || periodType === "year";

  const choose = (p) => {
    setPeriodType(p);
    if (p === "week" || p === "last3" || p === "last12") setAnchorNow?.();
    if (p === "custom") {
      // On POSE vraiment les dates au lieu de les deviner à l'affichage. Sans
      // ça, `customRange` restait vide, le calcul de plage se rabattait sur
      // l'année entière et l'affichait comme un choix — pendant que les deux
      // champs, eux, restaient vides. Le bandeau annonçait donc une période que
      // les champs ne montraient pas.
      if (!customRange?.start && !customRange?.end && range) {
        setCustomRange({
          start: toDateInputValue(range.start),
          // `range.end` est EXCLUSIF (début du jour suivant) : le dernier jour
          // affiché est la milliseconde d'avant.
          end: toDateInputValue(new Date(range.end.getTime() - 1)),
        });
      }
      // Seul type de période qui demande une saisie ensuite : le menu reste
      // ouvert pour que les champs apparaissent sous le choix qu'on vient de
      // faire.
      return;
    }
    setOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 0, maxWidth: "100%" }}>
      {/* Conteneur RELATIF sans `overflow` : le menu déroulant est un frère de
          la pastille, pas un enfant. Placé dedans, il serait rogné par
          l'`overflow: hidden` qui donne à la pastille ses coins arrondis. */}
      <div style={{ position: "relative", minWidth: 0, maxWidth: "100%" }}>
        {/* Pastille UNIQUE à trois zones. La fusion est visuelle seulement :
            ce sont toujours trois <button> distincts, chacun avec son
            aria-label. Un bouton unique qui devinerait l'intention d'après
            l'endroit touché serait inutilisable au clavier et au lecteur
            d'écran. */}
        <div
          style={{
            display: "inline-flex", alignItems: "stretch", height: 34, minWidth: 0, maxWidth: "100%",
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
              display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0, flexShrink: 1,
              padding: "0 10px", border: "none", background: "none",
              font: "inherit", fontSize: 13.5, color: "var(--ink)",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <i className="ti ti-calendar-event" style={{ fontSize: 15, color: "var(--sky)", flexShrink: 0 }} aria-hidden="true" />
            {/* Largeur de CONFORT (`width`, pas `minWidth`) : la zone centrale est
                encadrée par les deux flèches, donc un libellé plus court les
                ferait glisser sous le doigt d'un mois à l'autre — à largeur
                normale le libellé occupe donc ces 78 px. Ce n'est PAS un plancher
                rigide : sur un écran étroit (beaucoup d'Android font 360 px, voire
                320) un `minWidth` incompressible poussait devise et crayon hors de
                l'écran. Avec `width` + `minWidth: 0`, le libellé cède et se tronque
                (ellipsis) plutôt que d'éjecter les autres boutons ; les libellés
                plus longs s'étendent toujours quand la place existe. */}
            <span style={{ fontWeight: 600, textTransform: "capitalize", width: 78, minWidth: 0, flexShrink: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>{rangeLabel}</span>
            <i className={`ti ti-chevron-${open ? "up" : "down"}`} style={{ fontSize: 14, color: "var(--ink-3)", flexShrink: 0 }} aria-hidden="true" />
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

              {/* Les champs vivent DANS le menu. Posés sous la pastille, ils
                  étaient à l'intérieur de la colonne centrale de l'en-tête —
                  étroite — et débordaient par-dessus le bouton de menu. Le
                  panneau, lui, est en position absolue : aucune colonne ne le
                  contraint. */}
              {periodType === "custom" && (
                <div style={{ borderTop: "0.5px solid var(--rule)", marginTop: 6, padding: "10px 4px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={dateRow}>
                    <span style={dateKey}>{t("period_from")}</span>
                    <input
                      type="date"
                      value={customRange.start}
                      onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                      style={dateInput}
                    />
                  </label>
                  <label style={dateRow}>
                    <span style={dateKey}>{t("period_to")}</span>
                    <input
                      type="date"
                      value={customRange.end}
                      onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                      style={dateInput}
                    />
                  </label>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Zone flèche : LARGEUR ÉGALE À LA HAUTEUR de la pastille (34 px), donc une
// cible carrée — les pastilles rondes d'avant n'en faisaient que 30.
const arrowZone = {
  width: 34, flexShrink: 0, minWidth: 34,
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

const dateRow = { display: "flex", alignItems: "center", gap: 10 };

const dateKey = { fontSize: 12, color: "var(--ink-3)", width: 26, flexShrink: 0 };

const dateInput = {
  flex: 1, minWidth: 0, height: 34, padding: "0 10px",
  borderRadius: "var(--radius-sm)",
  border: "0.5px solid var(--rule)", background: "var(--bg)",
  fontSize: 13, color: "var(--ink)",
};

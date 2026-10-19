import { useState } from "react";
import { useCategoryName } from "../hooks/useCategoryName";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";

// Au-dela, une sous-categorie ouverte remplirait l'ecran a elle seule —
// « Courses » sur un an, c'est cinquante lignes dans un widget. On en montre
// huit, les plus grosses, et le reste se deplie a la demande.
const TX_VISIBLE = 8;

const COLOR_MAP = {
  tang: { text: "var(--tang)", bg: "var(--tang-light)" },
  sage: { text: "var(--sage)", bg: "var(--sage-light)" },
  lavi: { text: "var(--lavi)", bg: "var(--lavi-light)" },
  sky: { text: "var(--sky)", bg: "var(--sky-light)" },
  amber: { text: "var(--amber)", bg: "var(--amber-light)" },
  mint: { text: "var(--mint)", bg: "var(--mint-light)" },
  blush: { text: "var(--blush)", bg: "var(--blush-light)" },
};

/* `subTx` porte, pour chaque sous-categorie, les mouvements qui ont fabrique son
   sous-total : `{ "Mariages": [{ tx, value }, …] }`.

   La VALEUR est passee par l'ecran appelant, elle n'est pas relue de `tx`. Sur
   l'Accueil et le Flux un sous-total ne compte que la part revenant au membre
   filtre — une depense partagee a 50/50 n'y pese que pour moitie. Si la ligne
   affichait le montant entier du ticket, les lignes ne s'additionneraient plus
   a leur sous-total, juste au-dessus. L'ecran sait quelle part il a comptee ;
   ce composant ne le devine pas. */
export default function CategoryRow({
  category, total, maxTotal, subtotals, formatAmount, totalExpenses, currencySymbol = "",
  subTx, displayCurrency, onSelectTransaction,
}) {
  const [expanded, setExpanded] = useState(false);
  // Plusieurs sous-categories peuvent rester ouvertes : au niveau du dessus,
  // deux categories le peuvent deja (chacune a son propre etat).
  const [openSubs, setOpenSubs] = useState(() => new Set());
  const [fullSubs, setFullSubs] = useState(() => new Set());
  const { catName, subName: tSubName } = useCategoryName();
  const { language } = useFinance();
  const t = useTranslation();
  const locale = language === "en" ? "en-US" : "fr-FR";
  const thisYear = new Date().getFullYear();

  // Jour et mois court suffisent dans la periode courante ; l'annee n'apparait
  // que lorsqu'elle differe, sinon elle encombre huit lignes sur dix.
  const fmtDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const base = d.toLocaleDateString(locale, { day: "numeric", month: "short" });
    return d.getFullYear() === thisYear ? base : `${base} ${String(d.getFullYear()).slice(2)}`;
  };

  const toggleSub = (name) =>
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const colors = COLOR_MAP[category.color] || COLOR_MAP.tang;
  const barPct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  const sharePct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
  const hasSubs = subtotals && Object.keys(subtotals).length > 0;

  return (
    <div style={{ borderBottom: "0.5px solid var(--rule)" }}>
      <div
        onClick={() => hasSubs && setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 0",
          cursor: hasSubs ? "pointer" : "default",
        }}
      >
        <i
          className={`ti ${category.icon}`}
          style={{ fontSize: 18, color: colors.text, flexShrink: 0 }}
          aria-hidden="true"
        />
        <p style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{catName(category)}</p>
        <div
          style={{
            width: 50,
            height: 5,
            background: "var(--rule)",
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: `${barPct}%`,
              height: 5,
              background: colors.text,
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 78 }}>
          <p style={{ fontSize: 13, fontWeight: 500 }}>
            {formatAmount(total)} {currencySymbol}
          </p>
          <p style={{ fontSize: 10, color: "var(--ink-3)" }}>
            {sharePct.toFixed(1)}%
          </p>
        </div>
        {hasSubs && (
          <i
            className="ti ti-chevron-right"
            style={{
              fontSize: 14,
              color: "var(--ink-3)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {expanded && hasSubs && (
        <div style={{ padding: "0 0 10px 28px" }}>
          {Object.entries(subtotals)
            .sort((a, b) => b[1] - a[1])
            .map(([subName, subTotal]) => {
              const subSharePct = totalExpenses > 0 ? (subTotal / totalExpenses) * 100 : 0;
              const list = subTx?.[subName] || [];
              const isOpen = openSubs.has(subName);
              const showAll = fullSubs.has(subName);
              const shown = showAll ? list : list.slice(0, TX_VISIBLE);
              const rest = list.length - shown.length;
              return (
                <div key={subName}>
                  <div
                    onClick={() => list.length > 0 && toggleSub(subName)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "5px 0",
                      cursor: list.length > 0 ? "pointer" : "default",
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1, minWidth: 0 }}>
                      {tSubName(subName, category.id)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, display: "flex", gap: 6, alignItems: "baseline" }}>
                      {formatAmount(subTotal)} {currencySymbol}
                      <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400 }}>
                        {subSharePct.toFixed(1)}%
                      </span>
                    </span>
                    {/* Le chevron se pose sous celui de la categorie, a la meme
                        place : c'est le meme geste, un cran plus bas. */}
                    {list.length > 0 && (
                      <i
                        className="ti ti-chevron-right"
                        style={{
                          fontSize: 13,
                          color: "var(--ink-3)",
                          transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                          flexShrink: 0,
                        }}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ margin: "1px 0 6px 2px", paddingLeft: 14, borderLeft: "1.5px solid var(--rule)" }}>
                      {shown.map(({ tx, value }) => (
                        <div
                          key={tx.id}
                          onClick={() => onSelectTransaction?.(tx)}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            padding: "4px 0 4px 8px",
                            cursor: onSelectTransaction ? "pointer" : "default",
                          }}
                        >
                          <span style={{ fontSize: 10.5, color: "var(--ink-3)", flexShrink: 0, minWidth: 44 }}>
                            {fmtDate(tx.date)}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {tx.description}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                            {formatAmount(value)} {currencySymbol}
                            {/* Le montant d'origine n'apparait que s'il differe :
                                sans lui, on ne reconnait pas sa propre depense. */}
                            {displayCurrency && tx.currency && tx.currency !== displayCurrency && (
                              <span style={{ fontSize: 10, color: "var(--ink-3)", fontWeight: 400, marginLeft: 4 }}>
                                {Math.round(tx.amount).toLocaleString(locale)} {tx.currency}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                      {rest > 0 && (
                        <button
                          type="button"
                          onClick={() => setFullSubs((prev) => new Set(prev).add(subName))}
                          style={{ background: "none", border: "none", padding: "4px 0 2px 8px", fontSize: 11, fontWeight: 600, color: "var(--tang)", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {t("cat_show_more_tx").replace("{n}", rest)}
                        </button>
                      )}
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

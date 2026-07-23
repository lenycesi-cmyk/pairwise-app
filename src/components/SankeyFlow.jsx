import { useRef, useState, useLayoutEffect } from "react";

// Diagramme de Sankey « flux de trésorerie » en SVG pur (aucune dépendance).
// Structure fixe à 3 colonnes : sources (gauche) → nœud central → postes (droite).
// L'appelant fournit `left` et `right` DÉJÀ équilibrés (même somme des valeurs)
// via un nœud d'ajustement « Épargne » (à droite) ou « Épargne puisée » (à gauche),
// pour que le flux se conserve et que le nœud central soit entièrement couvert.
//
// Chaque item : { key, label, value, color } où color est un token CSS (ex. "sage",
// donc rendu via var(--sage)). `formatValue(v)` renvoie la chaîne affichée (montant
// + devise). Purement présentationnel : ne lit aucun contexte.
//
// Le rendu est mesuré (ResizeObserver) et posé en pixels réels ; sur écran étroit
// l'SVG garde une largeur minimale et le conteneur défile horizontalement, pour que
// les libellés restent lisibles plutôt que d'être écrasés.

function ribbonPath(x0, y0t, y0b, x1, y1t, y1b) {
  const xm = (x0 + x1) / 2;
  return `M ${x0} ${y0t} C ${xm} ${y0t}, ${xm} ${y1t}, ${x1} ${y1t}`
    + ` L ${x1} ${y1b} C ${xm} ${y1b}, ${xm} ${y0b}, ${x0} ${y0b} Z`;
}

// `dense` : variante miniature pour tenir dans une carte de widget — pas de
// largeur minimale (donc pas de scroll horizontal), gouttières et polices
// réduites. L'appelant est censé regrouper les petits postes en « Autres ».
// `onRightClick(key)` : rend cliquables les nœuds ET rubans de la colonne de
// droite (drill-down) — jamais les nœuds techniques (clés "__…").
export default function SankeyFlow({ left, right, centralLabel, centralColor = "var(--ink-2)", formatValue = (v) => Math.round(v), height, dense = false, large = false, onRightClick = null }) {
  const MIN_W = dense ? 0 : 540;
  const LEFT_LABEL_W = large ? 132 : dense ? 78 : 96;
  const RIGHT_LABEL_W = large ? 140 : dense ? 84 : 104;
  const NODE_W = dense ? 9 : 12;
  const GAP = dense ? 8 : 12; // écart vertical entre nœuds empilés d'une même colonne
  const PAD_Y = 18; // marge haute/basse (place pour le libellé du nœud central)
  const LABEL_FS = large ? 15 : dense ? 10.5 : 11.5;
  const VALUE_FS = large ? 13 : dense ? 9.5 : 10.5;
  const ref = useRef(null);
  const [cw, setCw] = useState(MIN_W);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => setCw(entries[0].contentRect.width));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(cw, MIN_W, 280);
  const leftTotal = left.reduce((s, n) => s + n.value, 0);
  const rightTotal = right.reduce((s, n) => s + n.value, 0);
  const total = Math.max(leftTotal, rightTotal, 1);
  const maxCount = Math.max(left.length, right.length, 1);
  const H = height || Math.max(dense ? 200 : 240, maxCount * (dense ? 42 : 52));

  // Échelle commune aux deux côtés (conservation du flux). On réserve la place
  // des écarts du côté le plus fourni.
  const usableH = H - PAD_Y * 2 - GAP * (maxCount - 1);
  const scale = usableH / total;

  const leftNodeX = LEFT_LABEL_W;
  const ribLeftX = leftNodeX + NODE_W;
  const centralX = (W - NODE_W) / 2;
  const rightNodeX = W - RIGHT_LABEL_W - NODE_W;
  const ribRightX = rightNodeX;

  const centralH = total * scale;
  const centralTop = (H - centralH) / 2;

  // Empilement d'un côté, centré verticalement sur la hauteur totale.
  function layoutColumn(items) {
    const sum = items.reduce((s, n) => s + n.value, 0);
    const groupH = sum * scale + GAP * Math.max(0, items.length - 1);
    let y = (H - groupH) / 2;
    return items.map((n) => {
      const h = Math.max(1, n.value * scale);
      const seg = { ...n, y, h };
      y += h + GAP;
      return seg;
    });
  }

  const leftSeg = layoutColumn(left);
  const rightSeg = layoutColumn(right);

  // Slots contigus sur le nœud central (sans écart), dans l'ordre des colonnes.
  function stackLinks(segs) {
    const out = [];
    let off = centralTop;
    for (const s of segs) {
      out.push({ seg: s, cyt: off, cyb: off + s.h });
      off += s.h;
    }
    return out;
  }
  const leftLinks = stackLinks(leftSeg);
  const rightLinks = stackLinks(rightSeg);

  return (
    <div ref={ref} style={{ width: "100%", overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block" }} role="img" aria-label={centralLabel}>
        {/* Rubans gauche → central */}
        {leftLinks.map(({ seg, cyt, cyb }) => (
          <path
            key={`l-${seg.key}`}
            d={ribbonPath(ribLeftX, seg.y, seg.y + seg.h, centralX, cyt, cyb)}
            fill={`var(--${seg.color})`}
            opacity={0.34}
          />
        ))}
        {/* Rubans central → droite */}
        {rightLinks.map(({ seg, cyt, cyb }) => {
          const clickable = onRightClick && !seg.key.startsWith("__");
          return (
            <path
              key={`r-${seg.key}`}
              d={ribbonPath(centralX + NODE_W, cyt, cyb, ribRightX, seg.y, seg.y + seg.h)}
              fill={`var(--${seg.color})`}
              opacity={0.34}
              style={clickable ? { cursor: "pointer" } : undefined}
              onClick={clickable ? () => onRightClick(seg.key) : undefined}
            />
          );
        })}

        {/* Nœud central */}
        <rect x={centralX} y={centralTop} width={NODE_W} height={centralH} rx={3} fill={centralColor} />
        <text x={W / 2} y={centralTop - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink-3)">
          {centralLabel}
        </text>

        {/* Nœuds + libellés gauche (ancrés à droite du gouttière) */}
        {leftSeg.map((s) => (
          <g key={`ln-${s.key}`}>
            <rect x={leftNodeX} y={s.y} width={NODE_W} height={s.h} rx={3} fill={`var(--${s.color})`} />
            <text x={leftNodeX - 8} y={s.y + s.h / 2 - 1} textAnchor="end" fontSize={LABEL_FS} fontWeight={600} fill="var(--ink)">
              {s.label}
            </text>
            <text x={leftNodeX - 8} y={s.y + s.h / 2 + 11} textAnchor="end" fontSize={VALUE_FS} fill="var(--ink-3)">
              {formatValue(s.value)}
            </text>
          </g>
        ))}

        {/* Nœuds + libellés droite (ancrés à gauche du gouttière). Cliquables
            pour le drill-down, sauf les nœuds techniques (Autres, Épargne…). */}
        {rightSeg.map((s) => {
          const clickable = onRightClick && !s.key.startsWith("__");
          return (
          <g
            key={`rn-${s.key}`}
            style={clickable ? { cursor: "pointer" } : undefined}
            onClick={clickable ? () => onRightClick(s.key) : undefined}
          >
            <rect x={rightNodeX} y={s.y} width={NODE_W} height={s.h} rx={3} fill={`var(--${s.color})`} />
            <text x={rightNodeX + NODE_W + 8} y={s.y + s.h / 2 - 1} textAnchor="start" fontSize={LABEL_FS} fontWeight={600} fill="var(--ink)">
              {clickable ? `${s.label} ›` : s.label}
            </text>
            <text x={rightNodeX + NODE_W + 8} y={s.y + s.h / 2 + 11} textAnchor="start" fontSize={VALUE_FS} fill="var(--ink-3)">
              {formatValue(s.value)}
            </text>
          </g>
          );
        })}
      </svg>
    </div>
  );
}

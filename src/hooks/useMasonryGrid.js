import { useLayoutEffect } from "react";

// Masonry en CSS Grid : chaque enfant direct du conteneur se voit attribuer un
// `grid-row-end: span N` calculé d'après la hauteur réelle de son contenu, pour
// que les cartes se tassent verticalement colonne par colonne (pas d'espace
// mort sous une carte courte, contrairement à une grille classique qui aligne
// chaque rangée sur sa carte la plus haute). Combiné à des `grid-column: span`
// variables par widget, ça donne la mise en page « bento » (tuiles de tailles
// variables) tout en respectant la hauteur intrinsèque de chaque carte.
//
// Le conteneur doit avoir `grid-auto-rows: <rowUnit>px` et `row-gap: 0` ; on
// simule l'espacement vertical en ajoutant `gap` à la hauteur mesurée avant de
// convertir en nombre de lignes. On mesure le PREMIER enfant de chaque cellule
// (son contenu), dont la marge éventuelle est ignorée par getBoundingClientRect.
export function useMasonryGrid(ref, { enabled = true, rowUnit = 8, gap = 24 } = {}, deps = []) {
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid || !enabled) return;

    const layout = () => {
      for (const cell of grid.children) {
        const content = cell.firstElementChild;
        if (!content) continue;
        const h = content.getBoundingClientRect().height;
        const span = Math.max(1, Math.ceil((h + gap) / rowUnit));
        cell.style.gridRowEnd = `span ${span}`;
      }
    };

    layout();

    // Recalcule quand la hauteur d'un contenu change (chargement des données,
    // rendu asynchrone des graphiques recharts, changement de police…).
    const ro = new ResizeObserver(layout);
    for (const cell of grid.children) {
      if (cell.firstElementChild) ro.observe(cell.firstElementChild);
    }
    window.addEventListener("resize", layout);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", layout);
      // Nettoie les spans posés pour ne pas polluer les autres mises en page
      // (mode édition, mobile) qui réutilisent les mêmes éléments.
      for (const cell of grid.children) cell.style.gridRowEnd = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rowUnit, gap, ...deps]);
}

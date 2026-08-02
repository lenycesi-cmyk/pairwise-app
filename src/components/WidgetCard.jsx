// Carte de widget façon brand kit : le titre vit DANS la carte, précédé d'une
// pastille d'icône teintée (qui se remplit au survol via .pw-chip-host), avec
// une action optionnelle à droite ("Voir tout", pills de période...).
// `flush` retire le padding horizontal du contenu (listes bord à bord).
// Partagé par Dashboard / Reports / Wealth pour une UI homogène.
const WIDGET_ACCENTS = {
  coral: ["var(--tang)", "var(--tang-light)"],
  ocean: ["var(--lavi)", "var(--lavi-light)"],
  sky: ["var(--sky)", "var(--sky-light)"],
  amber: ["var(--amber)", "var(--amber-light)"],
  mint: ["var(--sage)", "var(--sage-light)"],
  pink: ["var(--blush)", "var(--blush-light)"],
  // `red` est volontairement distinct de `coral` : le corail est la couleur des
  // éléments actionnables (bouton « Ajouter », onglet actif), donc une pastille
  // corail pleine se lit comme un bouton. Les cartes purement informatives
  // utilisent ce rouge.
  red: ["var(--red)", "var(--red-light)"],
};

// `bodyStyle` : styles supplémentaires sur la zone de contenu. La carte est une
// colonne flex dont le corps prend `flex: 1` — dans une box bento à hauteur fixe,
// ça permet à un widget peu dense de répartir/centrer son contenu sur toute la
// hauteur (remplissage dynamique) en passant p.ex. `{ justifyContent: "center" }`.
// Sur une carte à hauteur automatique (mobile, autres écrans), `flex: 1` est sans
// effet — le corps prend simplement la hauteur de son contenu.
// Le rognage de la carte utilise `overflow: clip` et NON `hidden`. Les deux
// rognent identiquement aux coins arrondis, mais `hidden` fait de la carte un
// conteneur défilant : un élément `position: sticky` placé à l'intérieur se
// colle alors à la carte — qui, elle, défile avec la page. Le bloc paraissait
// donc figé un court instant, puis disparaissait avec sa carte. `clip` rogne
// sans créer de conteneur défilant, ce qui laisse le collage se résoudre par
// rapport à la page.
export default function WidgetCard({ id, icon, accent = "coral", title, action, flush = false, noBar = false, style, bodyStyle, children }) {
  const [color, light] = WIDGET_ACCENTS[accent] || WIDGET_ACCENTS.coral;
  return (
    <div
      id={id}
      className="pw-card pw-chip-host"
      data-accent={accent}
      data-nobar={noBar ? "true" : undefined}
      style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--rule)", overflow: "clip", display: "flex", flexDirection: "column", ...style }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "17px 18px 11px", flexShrink: 0 }}>
        <span className="pw-chip" style={{ width: 32, height: 32, borderRadius: 10, background: light, "--pw-chip": color, flexShrink: 0 }}>
          <i className={`ti ${icon}`} style={{ fontSize: 16, color }} aria-hidden="true" />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        {action}
      </div>
      {/* En-tête figé (flexShrink:0 plus haut) + corps défilant : quand la carte
          est plafonnée en hauteur (grille bento de l'Accueil), le trop-plein
          défile ici sans pousser l'en-tête. Sur une carte à hauteur auto, il n'y
          a jamais de débordement → aucun défilement. */}
      <div style={{ padding: flush ? "4px 0 8px" : "4px 18px 10px", flex: 1, minHeight: 0, overflowY: "auto", ...bodyStyle }}>{children}</div>
      {/* Pied VISIBLE : bande vide FIGÉE (sans ligne ni contenu) qui reste en bas
          même quand le corps défile — donne une vraie respiration sous le contenu
          (sinon la dernière ligne bute sur le bord de la carte). */}
      <div style={{ flexShrink: 0, height: 18 }} aria-hidden="true" />
    </div>
  );
}

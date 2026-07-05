import { tagColor } from "../utils/tags";
import { suggestedTagMeta } from "../data/suggestedTags";
import { useTranslation } from "../hooks/useTranslation";

// Petite pastille d'affichage d'un tag, couleur stable dérivée du tag lui-même.
// `onRemove` ajoute une croix (mode édition) ; `onClick` rend la pastille
// cliquable (filtre). `size` = "sm" pour les listes denses.
export default function TagChip({ tag, onRemove, onClick, active = false, size = "md" }) {
  const t = useTranslation();
  const color = tagColor(tag);
  const meta = suggestedTagMeta(tag);
  const small = size === "sm";
  // Libellé traduit pour les tags préréglés (ex. "inutile" ↔ "unnecessary") ;
  // sinon on affiche le tag brut saisi par l'utilisateur.
  const label = meta ? t(meta.labelKey) : tag;
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: small ? "1px 7px" : "3px 9px",
        borderRadius: 99,
        fontSize: small ? 10.5 : 12,
        fontWeight: 500,
        background: active ? `var(--${color})` : `var(--${color}-light)`,
        color: active ? "#fff" : `var(--${color})`,
        border: `0.5px solid var(--${color})`,
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
      }}
    >
      {meta ? `${meta.emoji} ` : "#"}
      {label}
      {onRemove && (
        <i
          className="ti ti-x"
          style={{ fontSize: small ? 10 : 12, marginLeft: 1 }}
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </span>
  );
}

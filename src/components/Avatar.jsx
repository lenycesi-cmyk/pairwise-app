import { getInitial } from "../utils/memberColors";

/**
 * Avatar standard de l'app : toujours une initiale colorée, jamais une photo.
 * La photo de profil reste réservée à l'écran Réglages pour une UI moins chargée.
 */
export default function Avatar({ member, colorMap, size = 16 }) {
  if (!member) return null;
  const color = colorMap[member.uid] || { text: "var(--ink-3)", bg: "var(--rule)" };

  return (
    <span
      title={member.name}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color.bg,
        color: color.text,
        fontSize: Math.round(size * 0.6),
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {getInitial(member.name)}
    </span>
  );
}

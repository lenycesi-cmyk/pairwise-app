import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";

// Pills de filtre par membre « Famille / A / B ».
// UI unifiée dans toute l'app (refonte) : chips clairs SANS bordure, centrés,
// placés EN HAUT du widget — comme le widget « Répartition du patrimoine » de
// l'Accueil. La chip active a un fond neutre discret.
//
// `scope`/`value` (alias) === null = Famille (couple entier), sinon la clé d'un
// membre. Ne s'affiche pas quand il y a moins de deux membres.
export default function ScopeFilter({ members, scope, value, onChange, coupleLabel, style, size }) {
  const t = useTranslation();
  if (!members || members.length < 2) return null;
  const current = scope !== undefined ? scope : value;
  const lg = size === "lg";
  const scopes = [
    { key: null, label: coupleLabel ?? t("bank_scope_family") },
    ...members.map((m) => ({ key: getMemberKey(m), label: m.name })),
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: lg ? 8 : 6, justifyContent: "center", marginBottom: 12, ...style }}>
      {scopes.map((s) => {
        const active = current === s.key;
        return (
          <button
            key={s.key ?? "family"}
            onClick={() => onChange(s.key)}
            style={{
              padding: lg ? "6px 14px" : "3px 11px",
              borderRadius: 99,
              fontSize: lg ? 13.5 : 11.5,
              border: "none",
              background: active ? "color-mix(in srgb, var(--ink) 6%, transparent)" : "transparent",
              color: active ? "var(--ink-2)" : "var(--ink-3)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

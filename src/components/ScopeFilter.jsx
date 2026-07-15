import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";

// Pills de filtre par membre « Famille / A / B », comme le widget Liquidités en
// banque. `scope === null` = Famille (couple entier), sinon la clé d'un membre.
// Ne s'affiche pas quand il y a moins de deux membres (rien à filtrer).
export default function ScopeFilter({ members, scope, onChange, style }) {
  const t = useTranslation();
  if (!members || members.length < 2) return null;
  const scopes = [
    { key: null, label: t("bank_scope_family") },
    ...members.map((m) => ({ key: getMemberKey(m), label: m.name })),
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, ...style }}>
      {scopes.map((s) => {
        const active = scope === s.key;
        return (
          <button
            key={s.key ?? "family"}
            onClick={() => onChange(s.key)}
            style={{
              padding: "3px 11px",
              borderRadius: 99,
              fontSize: 11.5,
              border: active ? "0.5px solid var(--sky)" : "0.5px solid var(--rule)",
              background: active ? "var(--sky-light)" : "var(--bg)",
              color: active ? "var(--sky)" : "var(--ink-2)",
              fontWeight: active ? 500 : 400,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

import { useTranslation } from "../hooks/useTranslation";
import TagManager from "../components/TagManager";

// Écran de gestion des tags (ouvert depuis Réglages, aux côtés de Catégories
// et Récurrences). Le contenu réel est dans le composant partagé TagManager.
export default function TagsScreen() {
  const t = useTranslation();
  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>{t("categories_tags_title")}</h1>
      <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 16 }}>
        <i className="ti ti-grip-vertical" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />
        {" "}{t("categories_drag_hint")}
      </p>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "0.5px solid var(--rule)",
          padding: "12px 0",
          overflow: "hidden",
        }}
      >
        <TagManager />
      </div>
    </div>
  );
}

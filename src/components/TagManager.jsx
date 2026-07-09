import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { normalizeTag, dedupeTags } from "../utils/tags";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import SortableList from "./SortableList";
import TagChip from "./TagChip";

// Gestion de la liste de tags du couple : ajouter / réordonner (glisser) /
// supprimer. Partagé entre l'écran Tags (Réglages) et le panneau inline de
// l'écran d'ajout de transaction. Lit/écrit customTags via le contexte ; tant
// que rien n'est personnalisé, part des presets par défaut.
export default function TagManager() {
  const t = useTranslation();
  const { customTags, updateCustomTags } = useFinance();
  const [newTagInput, setNewTagInput] = useState("");

  const tagList = customTags.length > 0 ? customTags : SUGGESTED_TAGS.map((s) => s.key);

  function addTag() {
    const tag = normalizeTag(newTagInput);
    if (!tag || tagList.includes(tag)) { setNewTagInput(""); return; }
    updateCustomTags(dedupeTags([...tagList, tag]));
    setNewTagInput("");
  }
  function removeTag(tag) {
    updateCustomTags(tagList.filter((x) => x !== tag));
  }
  function reorderTags(items) {
    updateCustomTags(items.map((i) => i.id));
  }

  return (
    <div>
      <SortableList
        items={tagList.map((tag) => ({ id: tag }))}
        onReorder={reorderTags}
        renderItem={(item) => (
          <div style={{ padding: "8px 14px 8px 6px", borderBottom: "0.5px solid var(--rule)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TagChip tag={item.id} />
            </div>
            <i
              className="ti ti-trash"
              style={{ fontSize: 13, color: "var(--ink-3)", cursor: "pointer", flexShrink: 0 }}
              aria-hidden="true"
              onClick={() => removeTag(item.id)}
            />
          </div>
        )}
      />
      <div style={{ padding: "8px 14px 0 42px", display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder={t("categories_new_tag_placeholder")}
          value={newTagInput}
          onChange={(e) => setNewTagInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          style={{ flex: 1, border: "none", borderBottom: "0.5px solid var(--rule)", outline: "none", fontSize: 13, background: "transparent", paddingBottom: 4 }}
        />
        <button onClick={addTag} style={{ background: "none", border: "none", color: "var(--sky)", fontSize: 13 }}>
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

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
  const { customTags, updateCustomTags, replaceTagInTransactions } = useFinance();
  const [newTagInput, setNewTagInput] = useState("");
  // Édition inline d'un tag existant : id du tag en cours d'édition + valeur.
  const [editingTag, setEditingTag] = useState(null);
  const [editInput, setEditInput] = useState("");

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

  function startEdit(tag) {
    setEditingTag(tag);
    setEditInput(tag);
  }
  function cancelEdit() {
    setEditingTag(null);
    setEditInput("");
  }
  // Renomme le tag : met à jour la liste (en matérialisant les presets si
  // besoin) puis propage le renommage aux transactions existantes pour garder
  // chips et report par tag cohérents.
  function saveEdit(oldTag) {
    const newTag = normalizeTag(editInput);
    if (!newTag || newTag === oldTag) { cancelEdit(); return; }
    const withoutOld = tagList.filter((x) => x !== oldTag);
    // Collision avec un tag déjà présent → on fusionne (on retire simplement
    // l'ancien, le renommage sur les transactions les regroupe sous le nouveau).
    const nextList = withoutOld.includes(newTag)
      ? withoutOld
      : tagList.map((x) => (x === oldTag ? newTag : x));
    updateCustomTags(dedupeTags(nextList));
    replaceTagInTransactions(oldTag, newTag);
    cancelEdit();
  }

  return (
    <div>
      <SortableList
        items={tagList.map((tag) => ({ id: tag }))}
        onReorder={reorderTags}
        renderItem={(item) => (
          <div style={{ padding: "8px 14px 8px 6px", borderBottom: "0.5px solid var(--rule)", display: "flex", alignItems: "center", gap: 8 }}>
            {editingTag === item.id ? (
              <>
                <input
                  type="text"
                  autoFocus
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(item.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ flex: 1, minWidth: 0, border: "none", borderBottom: "0.5px solid var(--rule)", outline: "none", fontSize: 13, background: "transparent", paddingBottom: 4 }}
                />
                <i
                  className="ti ti-check"
                  style={{ fontSize: 15, color: "var(--sky)", cursor: "pointer", flexShrink: 0 }}
                  aria-hidden="true"
                  onClick={() => saveEdit(item.id)}
                />
                <i
                  className="ti ti-x"
                  style={{ fontSize: 15, color: "var(--ink-3)", cursor: "pointer", flexShrink: 0 }}
                  aria-hidden="true"
                  onClick={cancelEdit}
                />
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TagChip tag={item.id} />
                </div>
                <i
                  className="ti ti-pencil"
                  style={{ fontSize: 13, color: "var(--ink-3)", cursor: "pointer", flexShrink: 0 }}
                  aria-label={t("categories_edit_tag")}
                  onClick={() => startEdit(item.id)}
                />
                <i
                  className="ti ti-trash"
                  style={{ fontSize: 13, color: "var(--ink-3)", cursor: "pointer", flexShrink: 0 }}
                  aria-hidden="true"
                  onClick={() => removeTag(item.id)}
                />
              </>
            )}
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

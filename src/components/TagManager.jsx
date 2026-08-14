import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { normalizeTag, dedupeTags } from "../utils/tags";
import { archivedTags } from "../utils/archive";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import SortableList from "./SortableList";
import TagChip from "./TagChip";

// Gestion de la liste de tags du couple : ajouter / réordonner (glisser) /
// supprimer. Partagé entre l'écran Tags (Réglages) et le panneau inline de
// l'écran d'ajout de transaction. Lit/écrit customTags via le contexte ; tant
// que rien n'est personnalisé, part des presets par défaut.
// `showArchived` n'est vrai que dans l'écran Tags des Réglages. Le même
// composant sert de panneau replié dans la saisie de transaction, où une
// archive serait du bruit au pire moment.
export default function TagManager({ showArchived = false }) {
  const t = useTranslation();
  const { customTags, updateCustomTags, replaceTagInTransactions, transactions } = useFinance();
  const [newTagInput, setNewTagInput] = useState("");
  // Édition inline d'un tag existant : id du tag en cours d'édition + valeur.
  const [editingTag, setEditingTag] = useState(null);
  const [editInput, setEditInput] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);

  const tagList = customTags.length > 0 ? customTags : SUGGESTED_TAGS.map((s) => s.key);

  // Tags « archivés » : retirés de la liste mais encore portés par des
  // transactions. Rien n'est stocké — c'est exactement la différence entre les
  // deux, recalculée à chaque rendu, donc rien ne peut se désynchroniser.
  const archived = useMemo(
    () => (showArchived ? archivedTags(tagList, transactions) : []),
    [showArchived, tagList, transactions]
  );

  // Remettre un tag dans la liste. Les presets sont matérialisés au passage
  // (même règle que l'ajout) pour que la liste devienne explicitement celle du
  // couple plutôt qu'un repli implicite sur les suggestions.
  function restoreTag(tag) {
    updateCustomTags(dedupeTags([...tagList, tag]));
  }

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

      {archived.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "0.5px solid var(--rule)" }}>
          <button
            onClick={() => setArchivedOpen((v) => !v)}
            aria-expanded={archivedOpen}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "12px 14px", background: "none", border: "none",
              font: "inherit", fontSize: 13, fontWeight: 700,
              color: "var(--ink-2)", cursor: "pointer", textAlign: "left",
            }}
          >
            <i
              className={archivedOpen ? "ti ti-chevron-down" : "ti ti-chevron-right"}
              style={{ fontSize: 14, color: "var(--ink-3)" }}
              aria-hidden="true"
            />
            {t("archived_tags_title")}
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink-3)" }}>
              {archived.length}
            </span>
          </button>

          {archivedOpen && (
            <div style={{ padding: "0 14px 14px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "9px 12px" }}>
                {/* Pas de pastille autour de la pastille : TagChip porte déjà
                    son fond et sa bordure. Le compteur et le bouton s'alignent
                    simplement à côté. */}
                {archived.map(({ tag, count }) => (
                  <span key={tag} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <TagChip tag={tag} />
                    {/* Le compteur distingue un tag ABANDONNÉ d'un tag jamais
                        utilisé — ce dernier n'apparaît pas ici, puisqu'il ne
                        laisse aucune trace à retrouver. */}
                    <span className="pw-num" style={{ fontSize: 11, fontWeight: 800, color: "var(--ink-3)" }}>{count}</span>
                    <button
                      onClick={() => restoreTag(tag)}
                      aria-label={t("archived_restore")}
                      title={t("archived_restore")}
                      style={{
                        width: 18, height: 18, borderRadius: 999, border: "none",
                        display: "grid", placeItems: "center", cursor: "pointer",
                        background: "color-mix(in srgb, var(--tang) 14%, transparent)",
                        color: "var(--tang)", fontSize: 12, lineHeight: 1, padding: 0,
                      }}
                    >
                      <i className="ti ti-plus" style={{ fontSize: 12 }} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 11.5, color: "var(--ink-3)", margin: "10px 0 0" }}>
                {t("archived_tags_hint")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useTranslation } from "../hooks/useTranslation";
import { normalizeTag, dedupeTags, usedTags } from "../utils/tags";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import TagChip from "./TagChip";

// Champ de saisie de tags : chips retirables + input (Entrée/virgule valide),
// avec suggestions (tags préréglés + déjà utilisés dans l'historique). Contrôlé
// via `value` (tableau normalisé) / `onChange`.
export default function TagInput({ value, onChange }) {
  const t = useTranslation();
  const { transactions } = useFinance();
  const [input, setInput] = useState("");

  const history = useMemo(() => usedTags(transactions), [transactions]);
  // Suggestions = tags préréglés + historique, moins ceux déjà posés.
  const suggestions = useMemo(() => {
    const preset = SUGGESTED_TAGS.map((s) => s.key);
    const all = dedupeTags([...preset, ...history]);
    const q = normalizeTag(input);
    return all
      .filter((tag) => !value.includes(tag))
      .filter((tag) => !q || tag.includes(q))
      .slice(0, 8);
  }, [history, value, input]);

  function addTag(raw) {
    const tag = normalizeTag(raw);
    if (!tag || value.includes(tag)) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  }

  function removeTag(tag) {
    onChange(value.filter((v) => v !== tag));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && value.length) {
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((tag) => (
            <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(input)}
        placeholder={t("tx_tags_placeholder")}
        style={{
          width: "100%", padding: "8px 0", border: "none",
          borderBottom: "0.5px solid var(--rule)", background: "transparent",
          fontSize: 14, outline: "none",
        }}
      />
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(tag)}
              style={{ background: "none", border: "none", padding: 0 }}
            >
              <TagChip tag={tag} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

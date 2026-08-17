import { useState, useMemo } from "react";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { normalizeTag, dedupeTags, usedTags } from "../utils/tags";
import { SUGGESTED_TAGS } from "../data/suggestedTags";
import TagChip from "./TagChip";

// Champ de saisie de tags : chips retirables + input (Entrée/virgule valide),
// avec suggestions (tags préréglés + déjà utilisés dans l'historique). Contrôlé
// via `value` (tableau normalisé) / `onChange`.
export default function TagInput({ value, onChange }) {
  const t = useTranslation();
  const { transactions, customTags } = useFinance();
  const { user } = useAuth();
  const [input, setInput] = useState("");

  // Historique PERSONNEL : les tags posés par l'utilisateur sur ses propres
  // saisies. L'accès rapide sert ses habitudes, et celles du/de la partenaire
  // n'y ont pas leur place — la liste `customTags` est déjà par membre, mais
  // sans ce filtre les tags de l'autre y remontaient quand même par
  // l'historique du couple.
  //
  // Le critère est l'AUTEUR de la saisie (`createdBy`), comme pour le
  // pré-remplissage de « payé par / pour ». Conséquence assumée : une
  // transaction trop ancienne pour porter ce champ ne nourrit plus les
  // suggestions — sa curation explicite, elle, vit dans la liste du membre.
  const uid = user?.uid;
  const history = useMemo(
    () => usedTags(uid ? transactions.filter((tx) => tx.createdBy === uid) : transactions),
    [transactions, uid]
  );
  // Suggestions : la liste personnalisée du membre si elle existe (dans son
  // ordre), sinon les presets par défaut ; complétée par l'historique. On
  // retire ceux déjà posés et on filtre sur la saisie.
  const suggestions = useMemo(() => {
    const base = customTags && customTags.length > 0
      ? customTags
      : SUGGESTED_TAGS.map((s) => s.key);
    const all = dedupeTags([...base, ...history]);
    const q = normalizeTag(input);
    return all
      .filter((tag) => !value.includes(tag))
      .filter((tag) => !q || tag.includes(q))
      .slice(0, 8);
  }, [customTags, history, value, input]);

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

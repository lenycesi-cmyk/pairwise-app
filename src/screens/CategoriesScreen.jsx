import { useState } from "react";
import { useFinance } from "../context/FinanceContext";

const ICON_OPTIONS = [
  "ti-tools-kitchen-2", "ti-home", "ti-car", "ti-heart", "ti-user",
  "ti-movie", "ti-gift", "ti-dots", "ti-coin", "ti-chart-line",
  "ti-paw", "ti-plane", "ti-device-laptop", "ti-shirt",
];

const COLOR_OPTIONS = ["tang", "sage", "lavi", "sky", "amber", "mint", "blush"];

export default function CategoriesScreen() {
  const { categories, updateCategories } = useFinance();
  const [expanded, setExpanded] = useState(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newSubInputs, setNewSubInputs] = useState({});

  const editableCategories = categories.filter(
    (c) => c.id !== "income" && c.id !== "investment"
  );

  function persist(updated) {
    const others = categories.filter(
      (c) => c.id === "income" || c.id === "investment"
    );
    updateCategories([...updated, ...others]);
  }

  function addSubcategory(catId) {
    const value = (newSubInputs[catId] || "").trim();
    if (!value) return;
    const updated = editableCategories.map((c) =>
      c.id === catId
        ? { ...c, subcategories: [...c.subcategories, value] }
        : c
    );
    persist(updated);
    setNewSubInputs({ ...newSubInputs, [catId]: "" });
  }

  function removeSubcategory(catId, subName) {
    const updated = editableCategories.map((c) =>
      c.id === catId
        ? { ...c, subcategories: c.subcategories.filter((s) => s !== subName) }
        : c
    );
    persist(updated);
  }

  function addCategory() {
    if (!newCatName.trim()) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      icon: ICON_OPTIONS[Math.floor(Math.random() * ICON_OPTIONS.length)],
      color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)],
      subcategories: [],
    };
    persist([...editableCategories, newCat]);
    setNewCatName("");
    setShowNewCat(false);
  }

  function removeCategory(catId) {
    if (!confirm("Supprimer cette catégorie et toutes ses sous-catégories ?")) return;
    persist(editableCategories.filter((c) => c.id !== catId));
  }

  return (
    <div style={{ padding: "1.5rem 1.25rem 6rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20 }}>Catégories</h1>
        <button
          onClick={() => setShowNewCat(!showNewCat)}
          aria-label="Ajouter une catégorie"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--ink)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 16, color: "var(--bg)" }} aria-hidden="true" />
        </button>
      </div>

      {showNewCat && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
            display: "flex",
            gap: 8,
          }}
        >
          <input
            type="text"
            placeholder="Nom de la catégorie"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 14,
              background: "transparent",
            }}
            autoFocus
          />
          <button
            onClick={addCategory}
            style={{
              background: "var(--ink)",
              color: "var(--bg)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              padding: "6px 14px",
              fontSize: 13,
            }}
          >
            Ajouter
          </button>
        </div>
      )}

      {editableCategories.map((cat) => (
        <div
          key={cat.id}
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            marginBottom: 12,
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setExpanded(expanded === cat.id ? null : cat.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: "var(--bg)",
              cursor: "pointer",
            }}
          >
            <i className={`ti ${cat.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
            <p style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{cat.name}</p>
            <i
              className="ti ti-trash"
              style={{ fontSize: 14, color: "var(--ink-3)", marginRight: 6 }}
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation();
                removeCategory(cat.id);
              }}
            />
            <i
              className={expanded === cat.id ? "ti ti-chevron-down" : "ti ti-chevron-right"}
              style={{ fontSize: 14, color: "var(--ink-3)" }}
              aria-hidden="true"
            />
          </div>

          {expanded === cat.id && (
            <div style={{ padding: "4px 0" }}>
              {cat.subcategories.map((sub) => (
                <div
                  key={sub}
                  style={{
                    padding: "8px 14px 8px 42px",
                    borderBottom: "0.5px solid var(--rule)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <p style={{ fontSize: 13, flex: 1 }}>{sub}</p>
                  <i
                    className="ti ti-trash"
                    style={{ fontSize: 13, color: "var(--ink-3)", cursor: "pointer" }}
                    aria-hidden="true"
                    onClick={() => removeSubcategory(cat.id, sub)}
                  />
                </div>
              ))}
              <div style={{ padding: "8px 14px 12px 42px", display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nouvelle sous-catégorie"
                  value={newSubInputs[cat.id] || ""}
                  onChange={(e) =>
                    setNewSubInputs({ ...newSubInputs, [cat.id]: e.target.value })
                  }
                  onKeyDown={(e) => e.key === "Enter" && addSubcategory(cat.id)}
                  style={{
                    flex: 1,
                    border: "none",
                    borderBottom: "0.5px solid var(--rule)",
                    outline: "none",
                    fontSize: 13,
                    background: "transparent",
                    paddingBottom: 4,
                  }}
                />
                <button
                  onClick={() => addSubcategory(cat.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--sky)",
                    fontSize: 13,
                  }}
                >
                  <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

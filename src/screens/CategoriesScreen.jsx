import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import IconPicker from "../components/IconPicker";
import { AVATAR_COLOR_PALETTE } from "../utils/memberColors";
import SortableList from "../components/SortableList";
import { useTranslation } from "../hooks/useTranslation";
import { useCategoryName } from "../hooks/useCategoryName";

export default function CategoriesScreen() {
  const t = useTranslation();
  const { catName, subName: tSubName } = useCategoryName();
  const { categories, updateCategories, assets, incomeAccountLinks, setIncomeAccountLinks } = useFinance();
  const [expanded, setExpanded] = useState(null);
  const [showIncomeLinks, setShowIncomeLinks] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("ti-tag");
  const [newCatColor, setNewCatColor] = useState("amber");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newSubInputs, setNewSubInputs] = useState({});

  const editableCategories = categories.filter(
    (c) => c.id !== "income" && c.id !== "investment" && c.id !== "savings"
  );

  function persist(updated) {
    const others = categories.filter(
      (c) => c.id === "income" || c.id === "investment" || c.id === "savings"
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

  function reorderSubcategories(catId, newOrderItems) {
    // newOrderItems = [{ id: "Loyer" }, { id: "Eau" }, ...]
    const newOrder = newOrderItems.map((i) => i.id);
    const updated = editableCategories.map((c) =>
      c.id === catId ? { ...c, subcategories: newOrder } : c
    );
    persist(updated);
  }

  function reorderCategories(newOrderItems) {
    persist(newOrderItems);
  }

  function addCategory() {
    if (!newCatName.trim()) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor,
      subcategories: [],
    };
    persist([...editableCategories, newCat]);
    setNewCatName("");
    setNewCatIcon("ti-tag");
    setNewCatColor("amber");
    setShowNewCat(false);
  }

  function removeCategory(catId) {
    if (!confirm(t("categories_delete_confirm"))) return;
    persist(editableCategories.filter((c) => c.id !== catId));
  }

  const incomeCategory = categories.find((c) => c.id === "income");
  const linkableAssets = assets.filter((a) => a.typeId === "account" || a.typeId === "cash");

  function setLink(subcategory, assetId) {
    const updated = { ...incomeAccountLinks };
    if (assetId) updated[subcategory] = assetId;
    else delete updated[subcategory];
    setIncomeAccountLinks(updated);
  }

  return (
    <div style={{ padding: "18px 20px 6rem", maxWidth: 640, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <button
          onClick={() => setShowNewCat(!showNewCat)}
          style={{
            height: 34, padding: "0 14px", borderRadius: 99,
            background: "var(--ink)", border: "none", color: "var(--bg)",
            display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 15 }} aria-hidden="true" />
          {t("categories_add_category")}
        </button>
      </div>

      <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 16 }}>
        <i className="ti ti-grip-vertical" style={{ fontSize: 13, verticalAlign: -2 }} aria-hidden="true" />
        {" "}{t("categories_drag_hint")}
      </p>

      {showNewCat && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            padding: "1rem 1.25rem",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              aria-label={t("categories_choose_icon_color")}
              style={{
                width: 36, height: 36, borderRadius: "var(--radius-md)",
                border: "0.5px solid var(--rule)",
                background: AVATAR_COLOR_PALETTE.find((c) => c.key === newCatColor)?.bg || "var(--bg)",
                color: AVATAR_COLOR_PALETTE.find((c) => c.key === newCatColor)?.text || "var(--ink)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <i className={`ti ${newCatIcon}`} style={{ fontSize: 16 }} aria-hidden="true" />
            </button>
            <input
              type="text"
              placeholder={t("categories_name_placeholder")}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              style={{
                flex: 1,
                border: "none",
                borderBottom: "0.5px solid var(--rule)",
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
                flexShrink: 0,
              }}
            >
              {t("categories_add_button")}
            </button>
          </div>

          {showIconPicker && (
            <>
              <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                {AVATAR_COLOR_PALETTE.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setNewCatColor(c.key)}
                    aria-label={c.key}
                    style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: c.bg,
                      border: newCatColor === c.key ? `2px solid ${c.text}` : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
              <IconPicker selectedIcon={newCatIcon} onSelect={setNewCatIcon} />
            </>
          )}
        </div>
      )}

      <SortableList
        items={editableCategories}
        onReorder={reorderCategories}
        renderItem={(cat) => (
          <div
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
              <p style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{catName(cat)}</p>
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
                <SortableList
                  items={cat.subcategories.map((s) => ({ id: s }))}
                  onReorder={(items) => reorderSubcategories(cat.id, items)}
                  renderItem={(item) => (
                    <div
                      style={{
                        padding: "8px 14px 8px 6px",
                        borderBottom: "0.5px solid var(--rule)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <p style={{ fontSize: 13, flex: 1 }}>{tSubName(item.id, cat.id)}</p>
                      <i
                        className="ti ti-trash"
                        style={{ fontSize: 13, color: "var(--ink-3)", cursor: "pointer" }}
                        aria-hidden="true"
                        onClick={() => removeSubcategory(cat.id, item.id)}
                      />
                    </div>
                  )}
                />
                <div style={{ padding: "8px 14px 12px 42px", display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder={t("categories_new_subcategory_placeholder")}
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
        )}
      />

      {incomeCategory && (
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-lg)",
            border: "0.5px solid var(--rule)",
            marginTop: 8,
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setShowIncomeLinks(!showIncomeLinks)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <i className={`ti ${incomeCategory.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
            <p style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{t("categories_income_account_links")}</p>
            <i
              className={showIncomeLinks ? "ti ti-chevron-down" : "ti ti-chevron-right"}
              style={{ fontSize: 14, color: "var(--ink-3)" }}
              aria-hidden="true"
            />
          </div>

          {showIncomeLinks && (
            <div style={{ padding: "0 14px 12px" }}>
              {linkableAssets.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--ink-3)", padding: "4px 0 8px" }}>
                  {t("categories_income_account_links_empty")}
                </p>
              ) : (
                incomeCategory.subcategories.map((sub) => (
                  <div
                    key={sub}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                    }}
                  >
                    <span style={{ fontSize: 13, flex: 1 }}>{tSubName(sub, "income")}</span>
                    <select
                      value={incomeAccountLinks[sub] || ""}
                      onChange={(e) => setLink(sub, e.target.value)}
                      style={{
                        fontSize: 12,
                        background: "var(--bg)",
                        border: "0.5px solid var(--rule)",
                        borderRadius: "var(--radius-sm)",
                        padding: "4px 6px",
                        color: "var(--ink)",
                      }}
                    >
                      <option value="">{t("categories_income_account_none")}</option>
                      {linkableAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

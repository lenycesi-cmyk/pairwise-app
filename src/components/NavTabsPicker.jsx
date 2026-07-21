import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFinance } from "../context/FinanceContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { getMemberKey } from "../utils/members";
import { NAV_TABS_META, NAV_TABS_COUNT, resolveNavTabs } from "../data/navTabsMeta";

const META = Object.fromEntries(NAV_TABS_META.map((m) => [m.key, m]));

// Rangée triable (onglet affiché) : poignée de drag + icône + libellé + retirer.
function SortableTab({ tabKey, label, icon, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tabKey });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 12px", borderRadius: "var(--radius-md)",
        border: "1.5px solid var(--sky)", background: "var(--sky-light)",
        touchAction: "none",
      }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Déplacer"
        style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "grab", display: "flex", touchAction: "none", padding: 0 }}
      >
        <i className="ti ti-grip-vertical" style={{ fontSize: 18 }} aria-hidden="true" />
      </button>
      <i className={`ti ${icon}`} style={{ fontSize: 19, color: "var(--sky)" }} aria-hidden="true" />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
      <button
        onClick={onRemove}
        aria-label="Retirer"
        style={{ background: "none", border: "none", color: "var(--ink-3)", cursor: "pointer", display: "flex", padding: 4 }}
      >
        <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
      </button>
    </div>
  );
}

// Sélecteur des onglets de la barre du bas : liste « affichés » réordonnable par
// glisser-déposer (l'ordre = ordre gauche→droite dans le footer) + liste des
// onglets disponibles à ajouter. Exactement NAV_TABS_COUNT onglets. Par membre.
export default function NavTabsPicker({ onClose }) {
  const t = useTranslation();
  const { members, navTabs, updateMemberNavTabs } = useFinance();
  const { user } = useAuth();
  const myKey = getMemberKey(members.find((m) => m.uid === user?.uid));

  const [selected, setSelected] = useState(() => resolveNavTabs(navTabs[myKey]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const available = NAV_TABS_META.filter((m) => !selected.includes(m.key));
  const canAdd = selected.length < NAV_TABS_COUNT;
  const canSave = selected.length === NAV_TABS_COUNT;

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setSelected((prev) => {
      const from = prev.indexOf(active.id);
      const to = prev.indexOf(over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  };

  const remove = (key) => setSelected((prev) => prev.filter((k) => k !== key));
  const add = (key) => setSelected((prev) => (prev.length < NAV_TABS_COUNT ? [...prev, key] : prev));

  const save = async () => {
    if (!canSave) return;
    await updateMemberNavTabs(myKey, selected);
    onClose();
  };

  return (
    <div className="app-modal">
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10, background: "var(--bg)",
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 20px", borderBottom: "0.5px solid var(--rule)",
        }}
      >
        <button
          onClick={onClose}
          aria-label={t("common_cancel")}
          style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--ink) 6%, transparent)", border: "none", color: "var(--ink-2)", cursor: "pointer" }}
        >
          <i className="ti ti-x" style={{ fontSize: 17 }} aria-hidden="true" />
        </button>
        <h1 style={{ flex: 1, textAlign: "center", margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
          {t("nav_customize_title")}
        </h1>
        <span style={{ width: 32, height: 32, flexShrink: 0 }} />
      </div>

      <div style={{ padding: "16px 20px", maxWidth: 640, margin: 0 }}>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4 }}>
          {t("nav_customize_hint")}
        </p>
        <p style={{ fontSize: 12, color: canSave ? "var(--sage)" : "var(--ink-3)", fontWeight: 600, marginBottom: 14 }}>
          {selected.length} / {NAV_TABS_COUNT}
        </p>

        {/* Onglets affichés — réordonnables par glisser-déposer. */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
          {t("nav_customize_shown")}
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={selected} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
              {selected.map((key) => (
                <SortableTab
                  key={key}
                  tabKey={key}
                  label={t(META[key].labelKey)}
                  icon={META[key].icon}
                  onRemove={() => remove(key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Onglets disponibles à ajouter. */}
        {available.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 8 }}>
              {t("nav_customize_available")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {available.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => add(tab.key)}
                  disabled={!canAdd}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 12px", borderRadius: "var(--radius-md)",
                    border: "0.5px solid var(--rule)", background: "var(--bg-card)",
                    color: canAdd ? "var(--ink)" : "var(--ink-3)",
                    opacity: canAdd ? 1 : 0.55, textAlign: "left",
                    cursor: canAdd ? "pointer" : "not-allowed",
                  }}
                >
                  <i className={`ti ${tab.icon}`} style={{ fontSize: 19, color: "var(--ink-2)" }} aria-hidden="true" />
                  <span style={{ flex: 1, fontSize: 14 }}>{t(tab.labelKey)}</span>
                  <i className="ti ti-plus" style={{ fontSize: 18, color: canAdd ? "var(--sky)" : "var(--ink-3)" }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={save}
          disabled={!canSave}
          style={{
            marginTop: 22, width: "100%", padding: "13px 0",
            borderRadius: "var(--radius-md)", border: "none",
            background: canSave ? "var(--sky)" : "var(--rule)",
            color: canSave ? "#fff" : "var(--ink-3)",
            fontSize: 15, fontWeight: 600, cursor: canSave ? "pointer" : "not-allowed",
          }}
        >
          {t("common_save")}
        </button>
      </div>
    </div>
  );
}

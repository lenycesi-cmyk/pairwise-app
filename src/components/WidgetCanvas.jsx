import { useRef } from "react";
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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "../hooks/useTranslation";

// Moteur d'édition de widgets partagé entre les onglets (Accueil, Rapports,
// Patrimoine, Budget) : réorganisation par glisser-déposer + afficher/masquer
// chaque carte directement dessus. En mode édition, la grille passe à deux
// colonnes sur desktop (mise en page masonry `card-columns` hors édition).
//
// L'écran parent possède `widgets` (tableau { id, visible }) et `onSave`, le
// mode édition (`editMode`) et la fonction `renderContent(id)` qui renvoie le
// JSX d'un widget (ou null quand il n'a pas de données à montrer). `labels`
// fournit le nom affiché dans le placeholder d'un widget masqué/vide.

const LONG_PRESS_DELAY = 500;

function SortableWidget({ id, editMode, onLongPress, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editMode });

  const longPressTimer = useRef(null);
  function startLongPress() {
    if (editMode) return;
    longPressTimer.current = setTimeout(() => onLongPress?.(), LONG_PRESS_DELAY);
  }
  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: "relative",
      }}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      {editMode && (
        <div
          style={{
            position: "absolute", inset: 0,
            border: "1.5px dashed var(--sky)",
            borderRadius: "var(--radius-lg)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Réorganiser"
          style={{
            position: "absolute", top: 8, left: 8,
            zIndex: 3, background: "var(--bg-card)", border: "0.5px solid var(--rule)",
            borderRadius: "var(--radius-sm)", width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "grab", touchAction: "none",
          }}
        >
          <i className="ti ti-grip-vertical" style={{ fontSize: 14, color: "var(--ink-3)" }} aria-hidden="true" />
        </button>
      )}
      {children}
    </div>
  );
}

export default function WidgetCanvas({
  widgets,
  onSave,
  editMode,
  onEnterEditMode,
  renderContent,
  labels = {},
  isDesktop,
  desktopOnly = [],
}) {
  const t = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const displayList = isDesktop
    ? widgets
    : widgets.filter((w) => !desktopOnly.includes(w.id));
  const visibleIds = displayList.filter((w) => w.visible || editMode).map((w) => w.id);

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const oldIndex = widgets.findIndex((w) => w.id === active.id);
    const newIndex = widgets.findIndex((w) => w.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onSave(arrayMove(widgets, oldIndex, newIndex));
  }

  function toggleWidget(id) {
    onSave(widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }

  // Deux colonnes en édition sur desktop (demande produit) ; masonry hors
  // édition ; une seule colonne sur mobile.
  const twoColEdit = editMode && isDesktop;
  const containerClass = !editMode && isDesktop ? "card-columns" : "";
  const containerStyle = twoColEdit
    ? { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 20, alignItems: "start" }
    : undefined;

  return (
    <div className={containerClass} style={containerStyle}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
          {displayList
            .filter((w) => w.visible || editMode)
            .map((w) => {
              const content = renderContent(w.id);
              if (!content && !editMode) return null;
              return (
                <SortableWidget key={w.id} id={w.id} editMode={editMode} onLongPress={onEnterEditMode}>
                  <div style={{ marginBottom: 28, position: "relative" }}>
                    {editMode && (
                      <button
                        onClick={() => toggleWidget(w.id)}
                        aria-label={w.visible ? t("dashboard_widget_hide") : t("dashboard_widget_show")}
                        style={{
                          position: "absolute", top: 8, right: 8, zIndex: 3,
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "3px 8px 3px 3px",
                          borderRadius: 13,
                          border: w.visible ? "0.5px solid var(--sky)" : "1px solid var(--ink-3)",
                          background: w.visible ? "var(--sky)" : "var(--bg-card)",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                        }}
                      >
                        <span
                          style={{
                            width: 16, height: 16, borderRadius: "50%",
                            background: w.visible ? "var(--bg)" : "var(--ink-3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <i
                            className={`ti ${w.visible ? "ti-eye" : "ti-eye-off"}`}
                            style={{ fontSize: 10, color: w.visible ? "var(--sky)" : "var(--bg-card)" }}
                            aria-hidden="true"
                          />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 500, color: w.visible ? "var(--bg)" : "var(--ink-2)" }}>
                          {w.visible ? t("dashboard_widget_shown") : t("dashboard_widget_hidden")}
                        </span>
                      </button>
                    )}
                    <div
                      style={{
                        opacity: editMode && !w.visible ? 0.4 : 1,
                        paddingLeft: editMode ? 36 : 0,
                        transition: "opacity 0.2s, padding 0.2s",
                        // En édition, on neutralise les interactions internes du
                        // widget (ouverture de détail, boutons) pour ne garder
                        // que le glisser-déposer et le bouton afficher/masquer.
                        pointerEvents: editMode ? "none" : undefined,
                      }}
                    >
                      {content || (
                        <div style={{ background: "var(--bg-card)", borderRadius: "var(--radius-lg)", border: "0.5px dashed var(--rule)", padding: "0.75rem 1.25rem" }}>
                          <p style={{ fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>{labels[w.id]}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </SortableWidget>
              );
            })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

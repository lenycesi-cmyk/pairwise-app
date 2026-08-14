import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useDroppable,
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

/**
 * Enveloppe un item pour le rendre déplaçable. `id` doit être une string/number unique.
 */
export function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          {...listeners}
          aria-label="Réorganiser"
          style={{
            background: "none",
            border: "none",
            color: "var(--ink-3)",
            padding: "4px 6px",
            cursor: "grab",
            touchAction: "none",
            flexShrink: 0,
          }}
        >
          <i className="ti ti-grip-vertical" style={{ fontSize: 15 }} aria-hidden="true" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Cible de dépôt SITUÉE HORS DE LA LISTE (p. ex. « archiver ce tag »). Elle
 * n'est pas triable : on ne peut que lâcher dessus.
 */
function DropZone({ id, render, dragging }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef}>{render({ isOver, dragging })}</div>;
}

/**
 * Liste réorganisable. `items` = tableau d'objets avec un champ `id`.
 * `onReorder` reçoit le nouveau tableau d'items dans l'ordre choisi.
 * `renderItem` reçoit chaque item et doit retourner son contenu (sans la poignée,
 * déjà gérée par SortableItem).
 *
 * Optionnel — une cible de dépôt hors liste : `dropZoneId` +
 * `renderDropZone({ isOver, dragging })` pour son rendu, et `onDropZone(id)`
 * appelé quand un élément y est lâché. Sans ces props, le composant se comporte
 * exactement comme avant.
 */
export default function SortableList({
  items,
  onReorder,
  renderItem,
  getId = (i) => i.id,
  dropZoneId = null,
  renderDropZone = null,
  onDropZone = null,
  // Rendu du calque de glissement (l'élément qui suit le doigt). Sans lui, un
  // élément traîné hors de la liste — vers une zone de dépôt — n'est plus
  // positionné par la stratégie de tri et semble DISPARAÎTRE en cours de route :
  // on ne sait plus si le geste fonctionne. Défaut : `renderItem`.
  renderDragOverlay = null,
  // Contenu intercalé ENTRE la liste et la zone de dépôt (p. ex. le champ
  // « nouveau tag »), pour que la zone reste en dernier sans reléguer ce qui
  // appartient visuellement à la liste sous elle.
  children = null,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );
  // Sert au rendu de la zone : au repos elle reste discrète, elle ne s'allume
  // qu'une fois un élément en main.
  const [dragging, setDragging] = useState(false);
  // Élément actuellement en main, pour alimenter le calque de glissement.
  const [activeId, setActiveId] = useState(null);

  const hasDropZone = Boolean(dropZoneId && renderDropZone);
  const activeItem = activeId == null ? null : items.find((i) => getId(i) === activeId) || null;

  function endDrag() {
    setDragging(false);
    setActiveId(null);
  }

  function handleDragEnd(event) {
    endDrag();
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (hasDropZone && over.id === dropZoneId) {
      onDropZone?.(active.id);
      return;
    }

    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      sensors={sensors}
      // `closestCenter` convient à une liste homogène, mais avec une cible d'une
      // AUTRE NATURE en dehors de la liste elle désigne la ligne dont le centre
      // est le plus proche — donc jamais la zone, qui est en bout de course.
      // `pointerWithin` suit le doigt, ce qui est le seul comportement juste ici.
      collisionDetection={hasDropZone ? pointerWithin : closestCenter}
      onDragStart={({ active }) => { setDragging(true); setActiveId(active.id); }}
      onDragCancel={endDrag}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={getId(item)} id={getId(item)}>
            {renderItem(item)}
          </SortableItem>
        ))}
      </SortableContext>
      {children}
      {hasDropZone && (
        <DropZone id={dropZoneId} render={renderDropZone} dragging={dragging} />
      )}
      {/* Le calque n'est monté que là où il sert : les listes sans zone de
          dépôt gardent le comportement d'avant, au pixel près. */}
      {hasDropZone && (
        <DragOverlay dropAnimation={null}>
          {activeItem
            ? (renderDragOverlay || renderItem)(activeItem)
            : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}

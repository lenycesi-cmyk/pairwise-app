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
 * Liste réorganisable. `items` = tableau d'objets avec un champ `id`.
 * `onReorder` reçoit le nouveau tableau d'items dans l'ordre choisi.
 * `renderItem` reçoit chaque item et doit retourner son contenu (sans la poignée,
 * déjà gérée par SortableItem).
 */
export default function SortableList({ items, onReorder, renderItem, getId = (i) => i.id }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableItem key={getId(item)} id={getId(item)}>
            {renderItem(item)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}

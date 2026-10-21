import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

let lastDragEnd = 0;
/** True right after a drop — lets a card ignore the click that ends a drag. */
export const justDragged = () => Date.now() - lastDragEnd < 300;

/**
 * Drag-to-reorder list. Mouse: press and move. Touch: long-press (so normal scrolling still works).
 * Keyboard: focus the grip handle, Space to pick up, arrows to move, Space to drop.
 */
export function SortableList({ ids, onReorder, horizontal = false, disabled = false, children }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragEnd = ({ active, over }) => {
    lastDragEnd = Date.now();
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={horizontal ? horizontalListSortingStrategy : verticalListSortingStrategy} disabled={disabled}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Render-prop sortable item.
 * - `dragProps` (mouse + touch) go on the area you grab, e.g. a card header.
 * - `handleProps` (keyboard + a11y) go on a small grip button.
 */
export function SortableItem({ id, disabled, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const { onKeyDown, ...pointer } = listeners || {};
  return children({
    ref: setNodeRef,
    style: { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 30 : undefined, position: 'relative' },
    dragProps: disabled ? {} : pointer,
    handleProps: disabled ? {} : { ...attributes, onKeyDown, onMouseDown: pointer.onMouseDown, onTouchStart: pointer.onTouchStart },
    isDragging
  });
}

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

function ChipRow({ id, index, label, sortable, onRemove, sortableProps = {} }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
      {sortable ? (
        <button
          type="button"
          {...sortableProps.attributes}
          {...sortableProps.listeners}
          className="shrink-0 touch-none cursor-grab text-ink-400 hover:text-ink-600 active:cursor-grabbing"
          aria-label="Reordenar procedimento"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-4 shrink-0 font-mono text-[11px] font-semibold text-ink-400">{index + 1}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-900">{label}</span>
      <span className="shrink-0 font-mono text-[10px] font-medium text-ink-400">{index + 1})</span>
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="shrink-0 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        aria-label="Remover procedimento"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SortableChipRow({ id, index, label, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ChipRow
        id={id}
        index={index}
        label={label}
        sortable
        onRemove={onRemove}
        sortableProps={{ attributes, listeners }}
      />
    </div>
  );
}

/**
 * Lista vertical de procedimentos selecionados no modal Novo Agendamento.
 */
export function ProcedimentoChipList({
  ids = [],
  labelForId,
  onReorder,
  onRemove,
  sortable = true,
  duracaoMin = 60,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (ids.length === 0) return null;

  const totalMin = ids.length * (Number(duracaoMin) || 60);
  const totalLabel =
    totalMin >= 60
      ? `${ids.length} procedimento${ids.length === 1 ? '' : 's'} · ${Math.floor(totalMin / 60)}h${
          totalMin % 60 ? ` ${totalMin % 60}min` : ''
        }`
      : `${ids.length} procedimento${ids.length === 1 ? '' : 's'} · ${totalMin}min`;

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || typeof onReorder !== 'function') return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  }

  const list = (
    <div className="flex flex-col gap-2">
      {ids.map((id, index) =>
        sortable ? (
          <SortableChipRow
            key={id}
            id={id}
            index={index}
            label={labelForId(id)}
            onRemove={onRemove}
          />
        ) : (
          <ChipRow
            key={id}
            id={id}
            index={index}
            label={labelForId(id)}
            sortable={false}
            onRemove={onRemove}
          />
        ),
      )}
    </div>
  );

  return (
    <div className="mt-2 rounded-xl border border-brand-primary/15 bg-brand-primarySubtle/40 p-3">
      {sortable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
      {ids.length > 1 ? (
        <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-wide text-ink-500">
          {totalLabel}
        </p>
      ) : null}
    </div>
  );
}

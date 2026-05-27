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

const DURACAO_PRESETS = [30, 60, 90, 120];

function ChipRow({ id, index, label, duracaoMin, sortable, onRemove, onEditDuracao, sortableProps = {} }) {
  return (
    <div className="flex w-full items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
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
      <span className="min-w-0 flex-grow truncate text-[13px] font-semibold text-ink-900">{label}</span>
      {onEditDuracao ? (
        <>
          <input
            type="number"
            min="5"
            max="480"
            value={duracaoMin ?? 60}
            onChange={(e) => onEditDuracao(id, Number(e.target.value))}
            className="w-14 shrink-0 rounded border border-ink-200 px-1.5 py-0.5 text-center font-mono text-[11px] text-ink-700 focus:border-vivid-teal-500 focus:outline-none"
            aria-label="Duração em minutos"
            title="Duração (min)"
          />
          {DURACAO_PRESETS.map((preset) => {
            const isActive = (duracaoMin ?? 60) === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onEditDuracao(id, preset)}
                className={`shrink-0 rounded border px-2 py-0.5 text-xs transition-colors ${
                  isActive
                    ? 'border-vivid-teal-500 bg-vivid-teal-100 font-semibold text-vivid-teal-700'
                    : 'border-ink-200 bg-white text-ink-500 hover:border-vivid-teal-400 hover:bg-vivid-teal-50'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </>
      ) : (
        <span className="shrink-0 font-mono text-[10px] font-medium text-ink-400">{index + 1})</span>
      )}
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

function SortableChipRow({ id, index, label, duracaoMin, onRemove, onEditDuracao }) {
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
        duracaoMin={duracaoMin}
        sortable
        onRemove={onRemove}
        onEditDuracao={onEditDuracao}
        sortableProps={{ attributes, listeners }}
      />
    </div>
  );
}

/**
 * Lista vertical de procedimentos selecionados.
 *
 * Modo legado (usado em AgendaFormModal):
 *   ids + labelForId + duracaoMin (single value)
 *
 * Modo novo (usado em modo-agendamento inline):
 *   items=[{ id, label, duracaoMin }] + onEditDuracao
 */
export function ProcedimentoChipList({
  // modo legado
  ids,
  labelForId,
  duracaoMin = 60,
  // modo novo
  items,
  onEditDuracao,
  // comuns
  onReorder,
  onRemove,
  sortable = true,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Normaliza para array interno de { id, label, duracaoMin }
  const normalizedItems = items
    ? items
    : (ids || []).map((id) => ({ id, label: labelForId ? labelForId(id) : id, duracaoMin }));

  const normalizedIds = normalizedItems.map((i) => i.id);

  if (normalizedItems.length === 0) return null;

  const totalMin = items
    ? normalizedItems.reduce((s, i) => s + (Number(i.duracaoMin) || 60), 0)
    : normalizedItems.length * (Number(duracaoMin) || 60);

  const count = normalizedItems.length;
  const totalLabel =
    totalMin >= 60
      ? `${count} procedimento${count === 1 ? '' : 's'} · ${Math.floor(totalMin / 60)}h${
          totalMin % 60 ? ` ${totalMin % 60}min` : ''
        }`
      : `${count} procedimento${count === 1 ? '' : 's'} · ${totalMin}min`;

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || typeof onReorder !== 'function') return;
    const oldIndex = normalizedIds.indexOf(active.id);
    const newIndex = normalizedIds.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(normalizedIds, oldIndex, newIndex));
  }

  const list = (
    <div className="flex flex-col gap-2">
      {normalizedItems.map((item, index) =>
        sortable ? (
          <SortableChipRow
            key={item.id}
            id={item.id}
            index={index}
            label={item.label}
            duracaoMin={item.duracaoMin}
            onRemove={onRemove}
            onEditDuracao={onEditDuracao}
          />
        ) : (
          <ChipRow
            key={item.id}
            id={item.id}
            index={index}
            label={item.label}
            duracaoMin={item.duracaoMin}
            sortable={false}
            onRemove={onRemove}
            onEditDuracao={onEditDuracao}
          />
        ),
      )}
    </div>
  );

  return (
    <div className="mt-2 rounded-xl border border-brand-primary/15 bg-brand-primarySubtle/40 p-3">
      {sortable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={normalizedIds} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
      {count > 1 ? (
        <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-wide text-ink-500">
          {totalLabel}
        </p>
      ) : null}
    </div>
  );
}

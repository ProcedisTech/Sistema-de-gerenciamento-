import { useEffect } from 'react';

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

function isGridCellArrowNavigation(event) {
  const key = event.key;
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return false;
  return Boolean(event.target?.closest?.('[role="gridcell"]'));
}

/**
 * Atalhos globais da Agenda (desktop). Ignora inputs, modais e navegação por setas na grade.
 */
export function useAgendaKeyboardShortcuts({
  enabled = false,
  blocked = false,
  onPrevMonth,
  onNextMonth,
  onToday,
  onFocusFirstFilter,
  onNewAppointment,
}) {
  useEffect(() => {
    if (!enabled || blocked) return undefined;

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (isGridCellArrowNavigation(event)) return;

      const key = event.key;
      if (key === 'ArrowLeft') {
        event.preventDefault();
        onPrevMonth?.();
      } else if (key === 'ArrowRight') {
        event.preventDefault();
        onNextMonth?.();
      } else if (key === 't' || key === 'T') {
        event.preventDefault();
        onToday?.();
      } else if (key === 'f' || key === 'F') {
        event.preventDefault();
        onFocusFirstFilter?.();
      } else if (key === 'n' || key === 'N') {
        event.preventDefault();
        onNewAppointment?.();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, blocked, onPrevMonth, onNextMonth, onToday, onFocusFirstFilter, onNewAppointment]);
}

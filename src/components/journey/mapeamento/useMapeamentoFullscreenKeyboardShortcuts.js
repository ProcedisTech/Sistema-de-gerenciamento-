import { useEffect } from 'react';

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

/**
 * Atalhos do fullscreen de mapeamento.
 * Ignora foco em input/textarea/select/contentEditable.
 * Ctrl/Meta+Z = desfazer; Escape = onEscape (popover CONFIG ou sair).
 */
export function useMapeamentoFullscreenKeyboardShortcuts({
  enabled = false,
  blocked = false,
  onSetModo,
  onDesfazer,
  onEscape,
}) {
  useEffect(() => {
    if (!enabled || blocked) return undefined;

    const onKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      if ((event.ctrlKey || event.metaKey) && !event.altKey && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        onDesfazer?.();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key;
      if (key === 'Escape') {
        event.preventDefault();
        onEscape?.();
        return;
      }

      const lower = key.length === 1 ? key.toLowerCase() : key;
      if (lower === 'p') {
        event.preventDefault();
        onSetModo?.('ponto');
      } else if (lower === 'm') {
        event.preventDefault();
        onSetModo?.('mover');
      } else if (lower === 't') {
        event.preventDefault();
        onSetModo?.('traco');
      } else if (lower === 'b') {
        event.preventDefault();
        onSetModo?.('borracha');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, blocked, onSetModo, onDesfazer, onEscape]);
}

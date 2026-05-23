import { useEffect, useRef } from 'react';
import { XCircle } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';
import { useBottomSheetDragToClose } from '../../hooks/useBottomSheetDragToClose.js';

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

export function AgendaDaySheet({ open, onClose, children, titleId = 'agenda-day-sheet-title' }) {
  const sheetRef = useRef(null);

  useBodyScrollLock(open);

  const { sheetStyle, backdropStyle, headerProps, useInlineTransform } = useBottomSheetDragToClose({
    open,
    onClose,
    sheetRef,
  });

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      onClose?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Fechar painel do dia"
        onClick={onClose}
        style={backdropStyle}
        className={`absolute inset-0 bg-ink-900/50 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
          backdropStyle ? '' : open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={sheetStyle}
        className={`fixed bottom-0 left-0 right-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-agenda-lg transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none ${
          useInlineTransform ? '' : open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div
          {...headerProps}
          className="relative shrink-0 touch-none select-none px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <div className="flex min-h-11 items-center justify-end">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
              <div className="h-1 w-9 rounded-full bg-ink-300" aria-hidden />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2"
            >
              <XCircle className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <span id={titleId} className="sr-only">
            Detalhes do dia
          </span>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

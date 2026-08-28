import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';
import { useBottomSheetDragToClose } from '../../hooks/useBottomSheetDragToClose.js';
import { AnamneseDocRail } from './AnamneseDocRail.jsx';

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

export function AnamneseDocRailSheet({ open, onClose, railProps }) {
  const sheetRef = useRef(null);
  useBodyScrollLock(open);

  const { sheetStyle, backdropStyle, headerProps, useInlineTransform } = useBottomSheetDragToClose({
    open,
    onClose,
    sheetRef,
    allowMouse: true,
    closeRatio: 0.25,
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

  return createPortal(
    <div
      className={`anamnese-sora fixed inset-0 z-[140] flex flex-col justify-end ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      role="presentation"
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Fechar biblioteca"
        onClick={onClose}
        style={backdropStyle}
        className={`absolute inset-0 bg-ink-900/35 transition-opacity duration-[240ms] ease-out motion-reduce:transition-none ${
          backdropStyle ? '' : open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Biblioteca"
        style={sheetStyle}
        className={`relative flex max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-bottom)-4rem),720px)] min-h-0 w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-[240ms] ease-out motion-reduce:transition-none ${
          useInlineTransform ? '' : open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div
          {...headerProps}
          className="relative shrink-0 touch-none select-none border-b border-[#f1f5f9] px-4 pb-3 pt-2"
        >
          <div className="flex justify-center pb-2" aria-hidden>
            <div className="h-1 w-9 rounded-full bg-ink-300" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <b className="text-[14px] font-semibold text-[#0f172a]">Biblioteca</b>
            <button
              type="button"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#e2e8f0] text-[13px] font-semibold text-[#475569]"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <AnamneseDocRail {...railProps} embedded />
        </div>
      </div>
    </div>,
    document.body,
  );
}

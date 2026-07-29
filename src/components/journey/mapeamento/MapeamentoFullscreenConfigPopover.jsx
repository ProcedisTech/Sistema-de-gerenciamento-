import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const POPOVER_WIDTH = 280;
const VIEWPORT_PAD = 8;

function computePopoverStyle(anchor) {
  if (!anchor) return { top: 0, left: 48, width: POPOVER_WIDTH };
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
  let left = rect.right + 8;
  if (left + width > window.innerWidth - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, rect.left - width - 8);
  }
  let top = rect.top;
  const maxTop = window.innerHeight - VIEWPORT_PAD - 320;
  top = Math.max(VIEWPORT_PAD, Math.min(top, maxTop));
  return { top, left, width };
}

/**
 * Popover de CONFIG ancorado no trilho recolhido (padrão PatientFiltersPopover).
 */
export function MapeamentoFullscreenConfigPopover({ open, onClose, anchorRef, children, title = 'Configuração' }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 48, width: POPOVER_WIDTH });

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      setPosition(computePopoverStyle(anchorRef?.current));
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const onPointerDown = (e) => {
      const anchor = anchorRef?.current;
      const popover = popoverRef.current;
      if (popover?.contains(e.target)) return;
      if (anchor?.contains(e.target)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown, true);
    const outsideTimer = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown);
    }, 0);

    return () => {
      window.clearTimeout(outsideTimer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed z-[170] max-h-[min(24rem,calc(100dvh-2rem))] overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
      {children}
    </div>,
    document.body,
  );
}

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VIEWPORT_DIALOG_OPEN_EVENT } from '../shared/ViewportDialog.jsx';

function placePopover(el, anchor) {
  if (!el || !anchor) return;
  el.style.visibility = 'hidden';
  el.style.display = 'block';
  const h = el.offsetHeight;
  const w = el.offsetWidth;
  el.style.display = '';
  el.style.visibility = '';
  const r = anchor.getBoundingClientRect();
  let t = r.bottom + 6;
  let l = r.left;
  if (t + h > window.innerHeight - 12) t = Math.max(12, r.top - h - 6);
  if (l + w > window.innerWidth - 12) l = Math.max(12, window.innerWidth - w - 12);
  el.style.top = `${t}px`;
  el.style.left = `${l}px`;
}

/**
 * Popover flutuante (.menu 335px / .pop 295px) posicionado via place().
 */
export function AnamneseDocPopover({
  open,
  anchorRef,
  variant = 'menu',
  onClose,
  children,
  className = '',
}) {
  const popRef = useRef(null);

  useEffect(() => {
    if (!open || !anchorRef?.current || !popRef.current) return;
    placePopover(popRef.current, anchorRef.current);
  }, [open, anchorRef, children]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (
        popRef.current?.contains(e.target) ||
        anchorRef?.current?.contains(e.target)
      ) {
        return;
      }
      onClose?.();
    };
    document.addEventListener('mousedown', onDoc, true);
    const onViewportDialog = () => onClose?.();
    document.addEventListener(VIEWPORT_DIALOG_OPEN_EVENT, onViewportDialog);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener(VIEWPORT_DIALOG_OPEN_EVENT, onViewportDialog);
    };
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  const widthCls = variant === 'menu' ? 'w-[min(335px,calc(100vw-24px))]' : 'w-[min(295px,calc(100vw-24px))]';

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      className={`anamnese-sora fixed z-[200] overflow-hidden rounded-[13px] border border-[#e2e8f0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12),0_2px_8px_rgba(15,23,42,0.06)] animate-in fade-in duration-150 motion-reduce:animate-none ${widthCls} ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}

export function PopoverHead({ title, subtitle }) {
  return (
    <div className="border-b border-[#f1f5f9] bg-[#fbfefe] px-[15px] py-3">
      <b className="block text-[13px] font-semibold text-[#0f172a]">{title}</b>
      {subtitle ? (
        <span className="mt-0.5 block text-[11.5px] leading-snug text-[#64748b]">{subtitle}</span>
      ) : null}
    </div>
  );
}

export function PopoverBody({ children, className = '' }) {
  return (
    <div className={`max-h-[min(430px,62vh)] overflow-y-auto p-1.5 ${className}`}>
      {children}
    </div>
  );
}

export function PopoverItem({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-teal-50 ${active ? 'bg-teal-50/60' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function PopoverSep() {
  return <div className="mx-2 my-1 h-px bg-[#f1f5f9]" />;
}

export function PopoverLabel({ children }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-[0.09em] text-[#64748b]">
      {children}
    </div>
  );
}

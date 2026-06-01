import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PatientFilterPanel } from './PatientFilterPanel.jsx';

const POPOVER_WIDTH = 320;
const VIEWPORT_PAD = 8;

function computePopoverStyle(anchor) {
  if (!anchor) return { top: 0, left: 0, width: POPOVER_WIDTH };

  const rect = anchor.getBoundingClientRect();
  const width = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_PAD * 2);
  let left = rect.right - width;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - width - VIEWPORT_PAD));
  const top = rect.bottom + 8;

  return { top, left, width };
}

export function PatientFiltersPopover({ open, onClose, anchorRef, ctx, onFilterChange }) {
  const panelRef = useRef(null);
  const popoverRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: POPOVER_WIDTH });

  useEffect(() => {
    if (!open) return undefined;

    const updatePosition = () => {
      setPosition(computePopoverStyle(anchorRef?.current));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    const raf = requestAnimationFrame(() => {
      panelRef.current?.focusFirstEnabled();
    });

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
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

    document.addEventListener('keydown', onKeyDown);
    const outsideTimer = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown);
    }, 0);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(outsideTimer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return undefined;
    }
    if (!wasOpenRef.current) return undefined;
    wasOpenRef.current = false;
    const anchor = anchorRef?.current;
    if (!anchor) return undefined;
    const raf = requestAnimationFrame(() => {
      anchor.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[150] hidden lg:block"
        aria-hidden
        onClick={onClose}
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-filters-popover-title"
        className="fixed z-[160] hidden max-h-[min(32rem,calc(100dvh-6rem))] overflow-y-auto rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-lg lg:block"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
        }}
      >
        <h2
          id="patient-filters-popover-title"
          className="mb-4 text-[15px] font-semibold text-[#0f172a]"
        >
          Filtros
        </h2>
        <PatientFilterPanel ref={panelRef} ctx={ctx} onFilterChange={onFilterChange} />
      </div>
    </>,
    document.body,
  );
}

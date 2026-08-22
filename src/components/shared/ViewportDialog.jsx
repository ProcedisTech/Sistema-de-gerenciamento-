import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';

export const VIEWPORT_DIALOG_OPEN_EVENT = 'procedi:viewport-dialog-open';

const EXIT_MS = 150;

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}

function getFocusable(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
}

/**
 * Modal ancorado no viewport (portal em document.body).
 * ESC / backdrop chamam apenas onDismiss — nunca a ação destrutiva.
 */
export function ViewportDialog({
  open,
  onDismiss,
  titleId,
  labelledBy,
  className = '',
  children,
}) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const reduced = prefersReducedMotion();
  const [present, setPresent] = useState(open);
  const [visible, setVisible] = useState(false);

  if (open && !present) {
    setPresent(true);
  }
  if (open && reduced && !visible) {
    setVisible(true);
  }
  if (!open && visible) {
    setVisible(false);
  }
  if (!open && present && reduced) {
    setPresent(false);
  }

  useBodyScrollLock(open || present);

  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.dispatchEvent(new CustomEvent(VIEWPORT_DIALOG_OPEN_EVENT));
    if (reduced) return undefined;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open, reduced]);

  useEffect(() => {
    if (open || reduced) return undefined;
    const t = window.setTimeout(() => setPresent(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, reduced]);

  useEffect(() => {
    if (!open || !present) return undefined;
    const panel = panelRef.current;
    const focusSafe = () => {
      const marked = panel?.querySelector('[data-dialog-initial-focus]');
      if (marked instanceof HTMLElement) {
        marked.focus();
        return;
      }
      panel?.focus();
    };
    const id = window.setTimeout(focusSafe, 0);
    return () => window.clearTimeout(id);
  }, [open, present]);

  useEffect(() => {
    if (present) return undefined;
    const el = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (el && document.contains(el)) {
      el.focus();
    }
    return undefined;
  }, [present]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        onDismiss?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = getFocusable(panelRef.current);
      if (nodes.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onDismiss]);

  if (!present && !open) return null;

  const motion = 'motion-reduce:transition-none motion-reduce:transform-none';
  const backdropCls = visible ? 'opacity-100' : 'opacity-0';
  const panelCls = visible
    ? 'opacity-100 translate-y-0 scale-100'
    : 'opacity-0 translate-y-2 scale-[0.97]';
  const duration = visible
    ? 'duration-[180ms] ease-out'
    : 'duration-[150ms] ease-in';

  return createPortal(
    <div className="anamnese-sora fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-ink-900/35 transition-opacity ${duration} ${motion} ${backdropCls}`}
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId || labelledBy}
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)] outline-none transition-[opacity,transform] ${duration} ${motion} ${panelCls} ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

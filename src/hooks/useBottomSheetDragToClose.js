import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const CLOSE_RATIO = 0.35;
const CLOSE_FALLBACK_PX = 120;
const FLICK_VELOCITY = 800;
const DRAG_ACTIVATION_PX = 8;
const VELOCITY_WINDOW_MS = 100;
const TRANSITION_MS = 320;

function isTouchPointer(event) {
  return event.pointerType === 'touch';
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createEmptyDragState() {
  return {
    active: false,
    pending: false,
    pointerId: null,
    startClientY: 0,
    captureEl: null,
    velocitySamples: [],
    currentY: 0,
  };
}

/**
 * @param {{
 *   open: boolean,
 *   onClose?: () => void,
 *   sheetRef: import('react').RefObject<HTMLElement | null>,
 * }} options
 */
export function useBottomSheetDragToClose({ open, onClose, sheetRef }) {
  const [dragY, setDragY] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const dragRef = useRef(createEmptyDragState());

  const resetDragState = useCallback(() => {
    dragRef.current = createEmptyDragState();
    setDragY(0);
    setAnimating(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const measure = () => {
      setSheetHeight(sheetRef.current?.offsetHeight ?? 0);
    };

    measure();
    const frameId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frameId);
  }, [open, sheetRef]);

  const getCloseThreshold = useCallback(() => {
    const height = sheetRef.current?.offsetHeight ?? 0;
    return height > 0 ? height * CLOSE_RATIO : CLOSE_FALLBACK_PX;
  }, [sheetRef]);

  const setDragOffset = useCallback((nextY) => {
    const y = Math.max(0, nextY);
    dragRef.current.currentY = y;
    setDragY(y);
  }, []);

  const pushVelocitySample = useCallback((clientY) => {
    const now = Date.now();
    const samples = dragRef.current.velocitySamples;
    samples.push({ y: clientY, t: now });
    dragRef.current.velocitySamples = samples.filter((sample) => now - sample.t <= VELOCITY_WINDOW_MS);
  }, []);

  const getVelocityY = useCallback(() => {
    const samples = dragRef.current.velocitySamples;
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    if (dt <= 0) return 0;
    return (last.y - first.y) / dt;
  }, []);

  const releaseCapture = useCallback(() => {
    const { captureEl, pointerId } = dragRef.current;
    if (captureEl && pointerId != null) {
      try {
        captureEl.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  const finishDrag = useCallback(
    (offsetY) => {
      const threshold = getCloseThreshold();
      const velocityY = getVelocityY();
      const shouldClose = offsetY >= threshold || velocityY >= FLICK_VELOCITY;
      const reducedMotion = prefersReducedMotion();

      releaseCapture();

      if (shouldClose) {
        if (reducedMotion) {
          resetDragState();
          onClose?.();
          return;
        }

        const height = sheetRef.current?.offsetHeight ?? window.innerHeight;
        setAnimating(true);
        setDragOffset(height);

        const sheet = sheetRef.current;
        if (!sheet) {
          resetDragState();
          onClose?.();
          return;
        }

        const onTransitionEnd = (event) => {
          if (event.propertyName !== 'transform') return;
          sheet.removeEventListener('transitionend', onTransitionEnd);
          resetDragState();
          onClose?.();
        };

        sheet.addEventListener('transitionend', onTransitionEnd);
        window.setTimeout(() => {
          sheet.removeEventListener('transitionend', onTransitionEnd);
        }, TRANSITION_MS + 50);
        return;
      }

      if (reducedMotion || offsetY <= 0) {
        resetDragState();
        return;
      }

      setAnimating(true);
      setDragOffset(0);

      const sheet = sheetRef.current;
      if (!sheet) {
        resetDragState();
        return;
      }

      const onTransitionEnd = (event) => {
        if (event.propertyName !== 'transform') return;
        sheet.removeEventListener('transitionend', onTransitionEnd);
        resetDragState();
      };

      sheet.addEventListener('transitionend', onTransitionEnd);
      window.setTimeout(() => {
        sheet.removeEventListener('transitionend', onTransitionEnd);
      }, TRANSITION_MS + 50);
    },
    [getCloseThreshold, getVelocityY, onClose, releaseCapture, resetDragState, setDragOffset, sheetRef],
  );

  const endDrag = useCallback(
    (event) => {
      const state = dragRef.current;
      if (state.pointerId !== event.pointerId) return;

      if (state.active) {
        const offsetY = Math.max(0, event.clientY - state.startClientY);
        finishDrag(offsetY);
        return;
      }

      if (state.pending) {
        state.pending = false;
        state.pointerId = null;
        releaseCapture();
      }
    },
    [finishDrag, releaseCapture],
  );

  const onHeaderPointerDown = useCallback(
    (event) => {
      if (!open || !isTouchPointer(event)) return;
      if (event.target instanceof Element && event.target.closest('button, a, input, textarea, select')) {
        return;
      }

      dragRef.current = {
        ...createEmptyDragState(),
        pending: true,
        pointerId: event.pointerId,
        startClientY: event.clientY,
        captureEl: event.currentTarget,
        velocitySamples: [{ y: event.clientY, t: Date.now() }],
      };

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [open],
  );

  const onHeaderPointerMove = useCallback(
    (event) => {
      if (!open || !isTouchPointer(event)) return;
      const state = dragRef.current;
      if (state.pointerId !== event.pointerId) return;

      const deltaY = event.clientY - state.startClientY;
      pushVelocitySample(event.clientY);

      if (!state.active) {
        if (deltaY < 0) return;
        if (deltaY < DRAG_ACTIVATION_PX) return;
        state.active = true;
        state.pending = false;
      }

      if (deltaY > 0) {
        event.preventDefault();
        setDragOffset(deltaY);
      } else {
        setDragOffset(0);
      }
    },
    [open, pushVelocitySample, setDragOffset],
  );

  const onHeaderPointerUp = useCallback(
    (event) => {
      endDrag(event);
    },
    [endDrag],
  );

  const onHeaderPointerCancel = useCallback(
    (event) => {
      endDrag(event);
    },
    [endDrag],
  );

  const isDragging = dragY > 0 && !animating;
  const backdropOpacity =
    open && dragY > 0 && sheetHeight > 0 ? Math.max(0, 1 - dragY / sheetHeight) : open ? 1 : 0;

  const useInlineTransform = open && (dragY > 0 || animating);
  const reducedMotion = prefersReducedMotion();

  const sheetStyle = useInlineTransform
    ? {
        transform: `translateY(${dragY}px)`,
        transition:
          animating && !reducedMotion
            ? `transform ${TRANSITION_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`
            : isDragging
              ? 'none'
              : undefined,
      }
    : undefined;

  const backdropStyle =
    isDragging || animating
      ? {
          opacity: backdropOpacity,
          transition:
            isDragging || reducedMotion
              ? 'none'
              : `opacity ${TRANSITION_MS}ms ease`,
        }
      : undefined;

  const headerProps = {
    onPointerDown: onHeaderPointerDown,
    onPointerMove: onHeaderPointerMove,
    onPointerUp: onHeaderPointerUp,
    onPointerCancel: onHeaderPointerCancel,
  };

  return {
    dragY,
    isDragging,
    animating,
    sheetStyle,
    backdropStyle,
    headerProps,
    useInlineTransform,
  };
}

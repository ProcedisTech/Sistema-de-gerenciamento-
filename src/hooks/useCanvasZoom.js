import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  clampCanvasZoom,
  contentToLocalScreen,
  toCanvasCoords,
} from '../utils/canvasZoomCoords.js';

const ZOOM_WHEEL_STEP = 1.08;
const ZOOM_BUTTON_STEP = 1.15;
const ZOOM_RESET_EPS = 1e-3;

const initialView = { scale: ZOOM_DEFAULT, offsetX: 0, offsetY: 0 };

function normalizeView(next) {
  if (next.scale <= ZOOM_MIN + ZOOM_RESET_EPS) {
    return initialView;
  }
  return next;
}

function distance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function center(a, b) {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}

function firstTwoPointers(map) {
  const values = Array.from(map.values());
  return values.length >= 2 ? [values[0], values[1]] : null;
}

/** @param {HTMLElement | null} el */
function getTargetSize(el) {
  if (!el) return { width: 0, height: 0 };
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Vista 2D: `ctx.translate(offsetX,offsetY); ctx.scale(scale)`.
 * Zoom 1x–10x, pan (meio ou Espaço+arrastar), roda com âncara no ponteiro.
 *
 * @param {{ current: HTMLElement | null }} targetRef
 */
export function useCanvasZoom(targetRef) {
  const [view, setView] = useState(initialView);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const isPanningRef = useRef(false);
  const isPinchingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const onWheelLatestRef = useRef(/** @type {(e: WheelEvent) => void} */ (() => {}));
  const wheelDomHandlerRef = useRef((e) => onWheelLatestRef.current(e));

  const scale = view.scale;
  const offsetX = view.offsetX;
  const offsetY = view.offsetY;

  const resetView = useCallback(() => {
    setView(initialView);
  }, []);

  const applyZoomByFactor = useCallback(
    (factor, anchorX, anchorY) => {
      setView((v) => {
        const ns = clampCanvasZoom(v.scale * factor);
        if (ns === v.scale) return normalizeView(v);
        const cx = (anchorX - v.offsetX) / v.scale;
        const cy = (anchorY - v.offsetY) / v.scale;
        return normalizeView({
          scale: ns,
          offsetX: anchorX - cx * ns,
          offsetY: anchorY - cy * ns,
        });
      });
    },
    []
  );

  const zoomIn = useCallback(() => {
    const { width, height } = getTargetSize(targetRef?.current ?? null);
    if (!width || !height) return;
    applyZoomByFactor(ZOOM_BUTTON_STEP, width / 2, height / 2);
  }, [applyZoomByFactor, targetRef]);

  const zoomOut = useCallback(() => {
    if (scale <= ZOOM_MIN) return;
    const { width, height } = getTargetSize(targetRef?.current ?? null);
    if (!width || !height) return;
    applyZoomByFactor(1 / ZOOM_BUTTON_STEP, width / 2, height / 2);
  }, [applyZoomByFactor, targetRef, scale]);

  const fitToScreen = useCallback(() => {
    setView(initialView);
  }, []);

  const toContentFromClient = useCallback(
    (clientX, clientY) => {
      const c = targetRef?.current;
      if (!c) return null;
      const rect = c.getBoundingClientRect();
      return toCanvasCoords(clientX, clientY, rect, offsetX, offsetY, scale);
    },
    [offsetX, offsetY, scale, targetRef]
  );

  const toScreen = useCallback(
    (x, y) => contentToLocalScreen(x, y, offsetX, offsetY, scale),
    [offsetX, offsetY, scale]
  );

  const zoomPercent = Math.round(scale * 100);
  const canZoomIn = scale < ZOOM_MAX;
  const canZoomOut = scale > ZOOM_MIN;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, []);

  useEffect(() => {
    const onWinPointerEnd = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        setIsPanning(false);
      }
      if (isPinchingRef.current) {
        isPinchingRef.current = false;
        pinchRef.current = null;
        activePointersRef.current.clear();
        setIsPinching(false);
      }
    };
    window.addEventListener('pointerup', onWinPointerEnd);
    window.addEventListener('pointercancel', onWinPointerEnd);
    return () => {
      window.removeEventListener('pointerup', onWinPointerEnd);
      window.removeEventListener('pointercancel', onWinPointerEnd);
    };
  }, []);

  const onWheel = useCallback(
    (e) => {
      const target = e.currentTarget;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = target.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP;
      applyZoomByFactor(factor, anchorX, anchorY);
    },
    [applyZoomByFactor]
  );

  useLayoutEffect(() => {
    onWheelLatestRef.current = onWheel;
  }, [onWheel]);

  useLayoutEffect(() => {
    const el = targetRef?.current;
    if (!el) return undefined;
    const h = wheelDomHandlerRef.current;
    el.addEventListener('wheel', h, { passive: false });
    return () => {
      el.removeEventListener('wheel', h);
    };
  }, [onWheel, targetRef]);

  const shouldStartPan = useCallback(
    (e) => e.button === 1 || (spaceDown && e.button === 0),
    [spaceDown]
  );

  const startPinchIfPossible = useCallback(() => {
    const pair = firstTwoPointers(activePointersRef.current);
    const canvas = targetRef?.current;
    if (!pair || !canvas) return false;
    const [a, b] = pair;
    const d = distance(a, b);
    if (d <= 0) return false;
    const c = center(a, b);
    const rect = canvas.getBoundingClientRect();
    const anchorX = c.clientX - rect.left;
    const anchorY = c.clientY - rect.top;
    pinchRef.current = {
      startDistance: d,
      startScale: scale,
      contentX: (anchorX - offsetX) / scale,
      contentY: (anchorY - offsetY) / scale,
    };
    isPinchingRef.current = true;
    setIsPinching(true);
    return true;
  }, [offsetX, offsetY, scale, targetRef]);

  const updatePinch = useCallback(() => {
    const pair = firstTwoPointers(activePointersRef.current);
    const pinch = pinchRef.current;
    const canvas = targetRef?.current;
    if (!pair || !pinch || !canvas) return false;
    const [a, b] = pair;
    const d = distance(a, b);
    if (d <= 0 || pinch.startDistance <= 0) return true;
    const c = center(a, b);
    const rect = canvas.getBoundingClientRect();
    const anchorX = c.clientX - rect.left;
    const anchorY = c.clientY - rect.top;
    const ns = clampCanvasZoom(pinch.startScale * (d / pinch.startDistance));
    setView(normalizeView({
      scale: ns,
      offsetX: anchorX - pinch.contentX * ns,
      offsetY: anchorY - pinch.contentY * ns,
    }));
    return true;
  }, [targetRef]);

  const onPointerDown = useCallback(
    (e) => {
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (activePointersRef.current.size >= 2 && startPinchIfPossible()) {
        e.preventDefault();
        e.stopPropagation();
        isPanningRef.current = false;
        setIsPanning(false);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return true;
      }
      if (!shouldStartPan(e)) return false;
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = true;
      setIsPanning(true);
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return true;
    },
    [shouldStartPan, startPinchIfPossible]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (activePointersRef.current.has(e.pointerId)) {
        activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      }
      if (isPinchingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return updatePinch();
      }
      if (!isPanningRef.current) return false;
      e.preventDefault();
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      setView((v) =>
        v.scale <= ZOOM_MIN + ZOOM_RESET_EPS
          ? initialView
          : { ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }
      );
      return true;
    },
    [updatePinch]
  );

  const onPointerUp = useCallback((e) => {
    activePointersRef.current.delete(e.pointerId);
    if (isPinchingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      if (activePointersRef.current.size < 2) {
        isPinchingRef.current = false;
        pinchRef.current = null;
        setIsPinching(false);
      } else {
        startPinchIfPossible();
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return true;
    }
    if (!isPanningRef.current) return false;
    e.preventDefault();
    isPanningRef.current = false;
    setIsPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    return true;
  }, [startPinchIfPossible]);

  return {
    view,
    setView,
    scale,
    offsetX,
    offsetY,
    applyZoomByFactor,
    resetView,
    fitToScreen,
    zoomIn,
    zoomOut,
    canZoomIn,
    canZoomOut,
    toContentFromClient,
    toScreen,
    toCanvasCoords: (clientX, clientY, rect) => toCanvasCoords(clientX, clientY, rect, offsetX, offsetY, scale),
    zoomPercent,
    spaceDown,
    isPanning,
    isPinching,
    isInteracting: isPanning || isPinching,
    shouldStartPan,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}

export { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN, clampCanvasZoom, toCanvasCoords, toCanvasCoordsFromEvent, contentToLocalScreen } from '../utils/canvasZoomCoords.js';

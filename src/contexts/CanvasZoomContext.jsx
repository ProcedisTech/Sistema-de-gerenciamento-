import React, { createContext, useContext } from 'react';

/* eslint-disable react-refresh/only-export-components -- provider + hook juntos */

/**
 * @typedef {object} CanvasZoomContextValue
 * @property {number} scale
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {number} zoomPercent
 * @property {boolean} canZoomIn
 * @property {boolean} canZoomOut
 * @property {() => void} zoomIn
 * @property {() => void} zoomOut
 * @property {() => void} fitToScreen
 */

const CanvasZoomContext = createContext(/** @type {CanvasZoomContextValue | null} */ (null));

export function CanvasZoomProvider({ value, children }) {
  return <CanvasZoomContext.Provider value={value}>{children}</CanvasZoomContext.Provider>;
}

/** @returns {CanvasZoomContextValue | null} */
export function useCanvasZoomContext() {
  return useContext(CanvasZoomContext);
}

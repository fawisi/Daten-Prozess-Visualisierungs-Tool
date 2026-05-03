/**
 * Pure-Function Coordinate-Transform fuer ReactFlow-Drop-Position.
 *
 * Wandelt Browser-Pixel (clientX/Y) in Flow-Koordinaten um, unter
 * Beruecksichtigung von Pane-Offset, Pan, und Zoom.
 *
 * Hinweis: ReactFlow v12 bietet `useReactFlow().screenToFlowPosition`
 * mit identischer Semantik. Diese Pure-Funktion existiert zusaetzlich,
 * damit der Coordinate-Transform OHNE React-Context und OHNE
 * ReactFlowProvider testbar ist (jsdom liefert keine Layout-Engine,
 * `screenToFlowPosition` aus dem Hook wuerde dort `NaN` produzieren).
 *
 * Bug-Hintergrund (B1): Vor diesem Helper berechnete der Code
 * `flowX = clientX - paneRect.left`, was Zoom + Pan ignorierte. Bei
 * Zoom 0.1 + Pan (354, 24) landete der Knoten ~2500 Pixel daneben.
 * Siehe docs/usage-log/2026-05-03-bug-repro.md
 */
export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface ClientPosition {
  readonly x: number;
  readonly y: number;
}

export interface PaneRect {
  readonly left: number;
  readonly top: number;
}

/**
 * Wandelt Browser-Viewport-Pixel in ReactFlow-Flow-Coords.
 *
 * Formel (kanonisch, identisch zu xyflow's pointToRendererPoint):
 *   flowX = (clientX - paneRect.left - viewport.x) / viewport.zoom
 *   flowY = (clientY - paneRect.top  - viewport.y) / viewport.zoom
 */
export function clientToFlowPosition(
  clientPos: ClientPosition,
  paneRect: PaneRect,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (clientPos.x - paneRect.left - viewport.x) / viewport.zoom,
    y: (clientPos.y - paneRect.top - viewport.y) / viewport.zoom,
  };
}

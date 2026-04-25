import { useCallback, useEffect, useRef } from 'react';

function clearBodyDragState(): void {
  if (typeof document === 'undefined') return;
  delete document.body.dataset.visoDragging;
  document.body.style.cursor = '';
}

/**
 * Palette-to-canvas Pointer-Events drag. HTML5 Drag-and-Drop is broken on
 * iOS Safari (no data transfer for touch drags); Pointer Events work
 * everywhere React-Flow 12 runs (plan R1).
 *
 * Contract:
 * - Attach `getPointerHandlers(toolType)` to a palette button. The
 *   returned `onPointerDown` starts capture.
 * - On pointerup anywhere, check if the drop target is the current
 *   ReactFlow pane (`[data-viso-canvas-pane]`). If yes, dispatch
 *   `CustomEvent('viso-spawn-node')` with canvas-relative coords — the
 *   canvas listens and turns that into an `add_node` call.
 * - Drag is cancelled if pointer is released outside the canvas.
 *
 * This leaves the pre-existing click-to-place flow untouched — clicking
 * the palette button still toggles activeTool the same way.
 */

const DRAG_THRESHOLD_PX = 5;
const CANVAS_DROPZONE_SELECTOR = '[data-viso-canvas-pane]';

export interface SpawnEventDetail {
  type: string;
  clientX: number;
  clientY: number;
}

function dispatchSpawn(type: string, clientX: number, clientY: number): void {
  const evt = new CustomEvent<SpawnEventDetail>('viso-spawn-node', {
    detail: { type, clientX, clientY },
    bubbles: true,
  });
  window.dispatchEvent(evt);
}

export function usePaletteDrag(toolType: string) {
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // Only primary button / primary touch starts a drag.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      draggingRef.current = false;
      buttonRef.current = e.currentTarget;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (!draggingRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        draggingRef.current = true;
        document.body.dataset.visoDragging = toolType;
        document.body.style.cursor = 'copy';
      }
    },
    [toolType]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const wasDragging = draggingRef.current;
      const button = buttonRef.current;
      if (button && button.hasPointerCapture(e.pointerId)) {
        try {
          button.releasePointerCapture(e.pointerId);
        } catch {
          /* Some browsers already release capture automatically. */
        }
      }
      startPosRef.current = null;
      draggingRef.current = false;
      buttonRef.current = null;
      clearBodyDragState();

      if (!wasDragging) {
        // Not a drag — let the onClick handler run (click-to-place).
        return;
      }
      // elementFromPoint ignores the original button because capture
      // doesn't prevent hit-testing after release.
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const dropzone = target?.closest(CANVAS_DROPZONE_SELECTOR);
      if (!dropzone) return;
      dispatchSpawn(toolType, e.clientX, e.clientY);
    },
    [toolType]
  );

  const onPointerCancel = useCallback(() => {
    startPosRef.current = null;
    draggingRef.current = false;
    buttonRef.current = null;
    clearBodyDragState();
  }, []);

  // If the palette remounts (locale switch, route change) mid-drag the
  // body-dataset + cursor state would leak. Clear on unmount so the
  // page never gets stuck in "copy" cursor mode.
  useEffect(() => () => clearBodyDragState(), []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

export interface UseSpawnListenerOptions {
  /**
   * Called when a `viso-spawn-node` event fires inside the canvas the
   * listener is attached to. `clientToFlowPosition` converts the pointer
   * coords to canvas-relative coords for node placement.
   */
  onSpawn: (type: string, clientPos: { x: number; y: number }) => void;
  enabled: boolean;
}

/**
 * Canvas-side counterpart to `usePaletteDrag`. Listens for the custom
 * `viso-spawn-node` event the palette fires and forwards to `onSpawn`.
 */
export function useSpawnListener({ onSpawn, enabled }: UseSpawnListenerOptions) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: Event) {
      const detail = (e as CustomEvent<SpawnEventDetail>).detail;
      if (!detail) return;
      onSpawn(detail.type, { x: detail.clientX, y: detail.clientY });
    }
    window.addEventListener('viso-spawn-node', handler as EventListener);
    return () => window.removeEventListener('viso-spawn-node', handler as EventListener);
  }, [onSpawn, enabled]);
}

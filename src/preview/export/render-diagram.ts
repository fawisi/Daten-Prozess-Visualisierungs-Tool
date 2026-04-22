import { toPng, toSvg, getFontEmbedCSS } from 'html-to-image';
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';

export interface RenderDiagramOptions {
  /** Width of the rendered canvas in px. Defaults to 1920. */
  width?: number;
  /** Height of the rendered canvas in px. Defaults to 1080. */
  height?: number;
  /**
   * Device-pixel-ratio cap. The plan (Performance-Gate §2) limits this
   * to 1.5 to avoid memory spikes on iPad at large canvas sizes.
   */
  pixelRatio?: number;
  /**
   * Static theme snapshot. Passed in so long-running exports aren't
   * invalidated mid-flight by a user toggling dark-mode — `resolveTheme()`
   * is called once at export start, not at every render tick.
   */
  theme?: 'light' | 'dark';
}

function getViewportEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.react-flow__viewport');
}

async function prepareExport(
  nodes: Node[],
  width: number,
  height: number
): Promise<{ el: HTMLElement; style: Record<string, string>; fontEmbedCSS: string } | null> {
  const el = getViewportEl();
  if (!el || nodes.length === 0) return null;

  const bounds = getNodesBounds(nodes);
  // Pad around the content so edges at the boundary don't clip.
  const vp = getViewportForBounds(bounds, width, height, 0.1, 2, 0.1);

  // Wait for the document's fonts and grab the font CSS up-front. On
  // Safari the first call would otherwise race with the first paint and
  // render the diagram with system-fallback glyphs.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }
  const fontEmbedCSS = await getFontEmbedCSS(el).catch(() => '');

  const style = {
    transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    width: `${width}px`,
    height: `${height}px`,
    overflow: 'visible',
  } as const;

  return { el, style, fontEmbedCSS };
}

/** Filter out React-Flow chrome (minimap, controls) from the export canvas. */
function isExportableNode(node: Element): boolean {
  if (!('classList' in node)) return true;
  const cl = (node as HTMLElement).classList;
  return (
    !cl?.contains('react-flow__minimap') &&
    !cl?.contains('react-flow__controls') &&
    !cl?.contains('react-flow__attribution')
  );
}

function resolveBgColor(theme: 'light' | 'dark' | undefined): string {
  if (typeof document === 'undefined') return theme === 'dark' ? '#0B0E14' : '#FFFFFF';
  const cs = getComputedStyle(document.documentElement);
  const canvasVar = cs.getPropertyValue('--bg-canvas').trim();
  if (canvasVar) return canvasVar;
  return theme === 'dark' ? '#0B0E14' : '#FFFFFF';
}

export async function renderDiagramPng(
  nodes: Node[],
  options: RenderDiagramOptions = {}
): Promise<Blob> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const prepared = await prepareExport(nodes, width, height);
  if (!prepared) {
    throw new Error('Canvas is empty — nothing to export.');
  }
  // Cap pixelRatio so a caller passing an outsized value cannot OOM
  // Safari on iPad (security-review CWE-400). `Math.min` against the
  // performance-gate ceiling gives both callers and defaults a safe
  // upper bound.
  const pixelRatio = Math.min(options.pixelRatio ?? 1.5, 2);
  const dataUrl = await toPng(prepared.el, {
    width,
    height,
    backgroundColor: resolveBgColor(options.theme),
    pixelRatio,
    cacheBust: true,
    fontEmbedCSS: prepared.fontEmbedCSS,
    style: prepared.style,
    filter: isExportableNode,
  });
  return dataUrlToBlob(dataUrl);
}

export async function renderDiagramSvg(
  nodes: Node[],
  options: RenderDiagramOptions = {}
): Promise<Blob> {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const prepared = await prepareExport(nodes, width, height);
  if (!prepared) {
    throw new Error('Canvas is empty — nothing to export.');
  }
  const dataUrl = await toSvg(prepared.el, {
    width,
    height,
    backgroundColor: resolveBgColor(options.theme),
    cacheBust: true,
    fontEmbedCSS: prepared.fontEmbedCSS,
    style: prepared.style,
    filter: isExportableNode,
  });
  // `toSvg` returns a `data:image/svg+xml;charset=utf-8,<encoded>` URL;
  // decode and wrap so consumers can `URL.createObjectURL` as usual.
  return dataUrlToBlob(dataUrl);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  // Native fetch handles both base64 + URL-encoded data URLs, runs the
  // byte copy on the browser's optimised path, and is ~1 line vs the
  // hand-rolled loop that would block the main thread on 4K exports
  // (performance-review #5).
  const res = await fetch(dataUrl);
  return res.blob();
}

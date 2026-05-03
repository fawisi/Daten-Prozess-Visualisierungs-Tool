import { describe, it, expect } from 'vitest';
import { clientToFlowPosition } from './coords.js';

describe('clientToFlowPosition', () => {
  const pane = { left: 68, top: 85 };

  it('identitaet: zoom=1, pan=(0,0), pane an origin → flow == client', () => {
    const result = clientToFlowPosition(
      { x: 100, y: 200 },
      { left: 0, top: 0 },
      { x: 0, y: 0, zoom: 1 },
    );
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('pane-Offset wird abgezogen (zoom=1, pan=0)', () => {
    const result = clientToFlowPosition(
      { x: 100, y: 200 },
      pane,
      { x: 0, y: 0, zoom: 1 },
    );
    // 100 - 68 = 32, 200 - 85 = 115
    expect(result).toEqual({ x: 32, y: 115 });
  });

  it('pan wird mit Pane-Offset abgezogen', () => {
    const result = clientToFlowPosition(
      { x: 524, y: 386 },
      pane,
      { x: 354.4, y: 23.84, zoom: 1 },
    );
    // (524 - 68 - 354.4) / 1 = 101.6
    // (386 - 85 - 23.84) / 1 = 277.16
    expect(result.x).toBeCloseTo(101.6, 5);
    expect(result.y).toBeCloseTo(277.16, 5);
  });

  it('zoom 0.5 dehnt Flow-Coords (Pixel werden groesser im Flow-Space)', () => {
    const result = clientToFlowPosition(
      { x: 200, y: 300 },
      { left: 0, top: 0 },
      { x: 0, y: 0, zoom: 0.5 },
    );
    // 200 / 0.5 = 400
    expect(result).toEqual({ x: 400, y: 600 });
  });

  it('zoom 2 staucht Flow-Coords', () => {
    const result = clientToFlowPosition(
      { x: 200, y: 300 },
      { left: 0, top: 0 },
      { x: 0, y: 0, zoom: 2 },
    );
    expect(result).toEqual({ x: 100, y: 150 });
  });

  it('Bug B1 Real-Daten: zoom=0.1, pan=(354.4, 23.84), pane(68,85), click(524,386)', () => {
    // Aus docs/usage-log/2026-05-03-bug-repro.md
    // Erwartete Flow-Position: (1016, 2769)
    // Buggy-Math (clientX - paneRect.left): (456, 300.75)
    const result = clientToFlowPosition(
      { x: 524, y: 386 },
      { left: 68, top: 85 },
      { x: 354.4, y: 23.8424, zoom: 0.1 },
    );
    expect(result.x).toBeCloseTo(1016, 0);
    expect(result.y).toBeCloseTo(2772, 0); // 2769 ± 3 — Rundungsdiff
  });

  it('combined pan+zoom: Pan-Offset wird VOR Zoom abgezogen', () => {
    const result = clientToFlowPosition(
      { x: 100, y: 100 },
      { left: 0, top: 0 },
      { x: 50, y: 50, zoom: 0.5 },
    );
    // (100 - 0 - 50) / 0.5 = 100
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it('numerische Stabilitaet bei sehr kleinem Zoom', () => {
    const result = clientToFlowPosition(
      { x: 1000, y: 1000 },
      { left: 0, top: 0 },
      { x: 0, y: 0, zoom: 0.01 },
    );
    expect(result).toEqual({ x: 100000, y: 100000 });
  });

  it('negative Pan-Werte funktionieren (Viewport links/oben verschoben)', () => {
    const result = clientToFlowPosition(
      { x: 100, y: 100 },
      { left: 0, top: 0 },
      { x: -200, y: -150, zoom: 1 },
    );
    // (100 - (-200)) = 300
    expect(result).toEqual({ x: 300, y: 250 });
  });
});

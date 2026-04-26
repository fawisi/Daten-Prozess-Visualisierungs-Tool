import { describe, it, expect, vi } from 'vitest';
import { renderMermaidToPng } from './render-png.js';

describe('renderMermaidToPng — graceful degradation', () => {
  it('returns null and warns when puppeteer is not installed', async () => {
    const warn = vi.fn();
    const result = await renderMermaidToPng({
      mermaid: 'flowchart LR\nA --> B',
      puppeteerImporter: async () => null,
      warn,
    });
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('puppeteer is not installed');
  });

  it('returns null when the puppeteer importer throws', async () => {
    const warn = vi.fn();
    const result = await renderMermaidToPng({
      mermaid: 'flowchart LR\nA --> B',
      puppeteerImporter: async () => {
        throw new Error('module load blew up');
      },
      warn,
    });
    expect(result).toBeNull();
  });

  it('returns null when puppeteer launch throws', async () => {
    const warn = vi.fn();
    const fakePuppeteer = {
      launch: async () => {
        throw new Error('Chromium binary missing');
      },
    };
    const result = await renderMermaidToPng({
      mermaid: 'flowchart LR\nA --> B',
      puppeteerImporter: async () => fakePuppeteer,
      warn,
    });
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('puppeteer failed');
  });

  it('returns the screenshot bytes on a happy puppeteer path', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const screenshot = vi.fn(async () => png);
    const $ = vi.fn(async () => ({ screenshot }));
    const waitForFunction = vi.fn(async () => undefined);
    const setContent = vi.fn(async () => undefined);
    const newPage = vi.fn(async () => ({ setContent, waitForFunction, $ }));
    const close = vi.fn(async () => undefined);
    const fakeBrowser = { newPage, close };
    const fakePuppeteer = {
      launch: vi.fn(async () => fakeBrowser),
    };

    const result = await renderMermaidToPng({
      mermaid: 'flowchart LR\nA --> B',
      puppeteerImporter: async () => fakePuppeteer,
    });
    expect(result).toEqual(png);
    expect(fakePuppeteer.launch).toHaveBeenCalledWith({ headless: true });
    expect(close).toHaveBeenCalled();
  });

  it('still closes the browser when screenshot throws', async () => {
    const close = vi.fn(async () => undefined);
    const fakeBrowser = {
      newPage: async () => ({
        setContent: async () => undefined,
        waitForFunction: async () => undefined,
        $: async () => ({
          screenshot: async () => {
            throw new Error('renderer crashed');
          },
        }),
      }),
      close,
    };
    const fakePuppeteer = { launch: async () => fakeBrowser };
    const result = await renderMermaidToPng({
      mermaid: 'flowchart LR\nA --> B',
      puppeteerImporter: async () => fakePuppeteer,
    });
    expect(result).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

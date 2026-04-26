/**
 * Server-side PNG renderer for the Handoff-Bundle (MA-8 — v1.1.2).
 *
 * Strategy: ship Mermaid to a puppeteer-driven headless browser, let
 * Mermaid render the diagram to SVG in the DOM, then screenshot the
 * resulting node. Puppeteer is an OPTIONAL peer-dependency — when it's
 * not installed (the v1.1.2 default), this module returns `null` and
 * logs a one-line hint so the bundle export degrades gracefully.
 *
 * The puppeteer import is intentionally indirect (`import('puppeteer')`
 * via a string variable) so bundlers and tsc don't resolve the dep at
 * build-time. The unit test replaces the importer with a stub.
 */

interface PuppeteerLike {
  launch: (opts?: { headless?: boolean }) => Promise<PuppeteerBrowser>;
}

interface PuppeteerBrowser {
  newPage: () => Promise<PuppeteerPage>;
  close: () => Promise<void>;
}

interface PuppeteerPage {
  setContent: (html: string, opts?: { waitUntil?: string }) => Promise<void>;
  waitForFunction: (
    fn: string,
    opts?: { timeout?: number }
  ) => Promise<unknown>;
  $: (selector: string) => Promise<PuppeteerElement | null>;
}

interface PuppeteerElement {
  screenshot: (opts?: { type?: 'png' | 'jpeg' }) => Promise<Buffer | Uint8Array>;
}

export interface MermaidToPngOptions {
  mermaid: string;
  /**
   * Importer override for tests. Production default tries to load
   * `puppeteer` and returns `null` on failure.
   */
  puppeteerImporter?: () => Promise<PuppeteerLike | null>;
  /** Warn-channel override for tests. */
  warn?: (msg: string) => void;
  /** Render timeout in milliseconds. Default 10s. */
  timeoutMs?: number;
}

async function defaultPuppeteerImporter(): Promise<PuppeteerLike | null> {
  try {
    // String-typed specifier prevents bundlers from resolving the
    // optional dep at build-time. Falls back to `null` on any failure
    // so the caller can degrade.
    const specifier = 'puppeteer';
    const mod = (await import(specifier)) as { default?: PuppeteerLike } & PuppeteerLike;
    return (mod.default ?? mod) as PuppeteerLike;
  } catch {
    return null;
  }
}

/**
 * Renders a Mermaid diagram to PNG via headless Chrome. Returns `null`
 * when puppeteer is unavailable or the render fails — the bundle ships
 * without PNG and the caller logs a hint via the `warn` channel.
 */
export async function renderMermaidToPng(
  opts: MermaidToPngOptions
): Promise<Uint8Array | null> {
  const importer = opts.puppeteerImporter ?? defaultPuppeteerImporter;
  const warn = opts.warn ?? ((msg: string) => console.warn(`[viso-mcp] ${msg}`));
  const timeoutMs = opts.timeoutMs ?? 10_000;

  // The default importer swallows its own load errors and returns null,
  // but a test stub may throw synchronously — treat both shapes as
  // "puppeteer not available" so callers always see the same skip-path.
  let puppeteer: PuppeteerLike | null;
  try {
    puppeteer = await importer();
  } catch {
    puppeteer = null;
  }
  if (!puppeteer) {
    warn(
      'puppeteer is not installed — skipping PNG export. Install the optional ' +
        'peer dependency with `npm i -D puppeteer` to enable server-side PNG ' +
        'rendering. Mermaid + source + positions are still in the bundle.'
    );
    return null;
  }

  let browser: PuppeteerBrowser | null = null;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // Mermaid is loaded from jsDelivr — runs entirely in the headless
    // browser, no Node-side dep. JSON-stringify guarantees the source
    // text is properly escaped inside the inline ESM module.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>body { margin: 0; padding: 16px; font-family: system-ui; background: #fff; }</style>
</head>
<body>
  <div id="diagram"></div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    try {
      const { svg } = await mermaid.render('viso-graph', ${JSON.stringify(opts.mermaid)});
      document.getElementById('diagram').innerHTML = svg;
      window.__visoReady = true;
    } catch (err) {
      window.__visoError = String(err && err.message || err);
    }
  </script>
</body>
</html>`;
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__visoReady === true', { timeout: timeoutMs });
    const element = await page.$('#diagram');
    if (!element) {
      warn('PNG render skipped: diagram element not found in headless DOM.');
      return null;
    }
    const buf = await element.screenshot({ type: 'png' });
    // Normalise to Uint8Array so Zip-builder + assertions don't have to
    // distinguish between Node Buffer and the typed array.
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  } catch (err) {
    warn(
      `PNG render skipped: puppeteer failed (${err instanceof Error ? err.message : String(err)})`
    );
    return null;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

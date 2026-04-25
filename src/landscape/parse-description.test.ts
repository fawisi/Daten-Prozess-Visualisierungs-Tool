import { describe, it, expect } from 'vitest';
import { parseLandscapeDescription } from './parse-description.js';

describe('parseLandscapeDescription — German narrative patterns', () => {
  it('extracts a sync relation from "X synchronisiert mit Y"', () => {
    const { landscape, stats } = parseLandscapeDescription(
      'Winestro synchronisiert taeglich mit Shopify.'
    );
    const ids = Object.keys(landscape.nodes);
    expect(ids.length).toBe(2);
    expect(landscape.relations).toHaveLength(1);
    expect(landscape.relations[0].label).toBe('sync');
    expect(stats.patternHits.sync).toBe(1);
  });

  it('never merges Shopify and Shopware (KMU dictionary hard-separator)', () => {
    const { landscape } = parseLandscapeDescription(
      'Webshop synchronisiert mit Shopify. Der andere Shop nutzt Shopware.'
    );
    const labels = Object.values(landscape.nodes).map((n) => n.label);
    expect(labels).toContain('Shopify');
    expect(labels).toContain('Shopware');
  });

  it('auto-promotes a target to database on "speichert in"', () => {
    const { landscape } = parseLandscapeDescription(
      'Winestro speichert Rechnungen in einem internen Postgres-Cluster.'
    );
    const postgres = Object.values(landscape.nodes).find((n) =>
      n.label.toLowerCase().includes('postgres')
    );
    expect(postgres?.kind).toBe('database');
  });

  it('honours KMU-dictionary kind (SharePoint stays system, not database)', () => {
    const { landscape } = parseLandscapeDescription(
      'Winestro speichert Rechnungen in SharePoint.'
    );
    const sharepoint = Object.values(landscape.nodes).find((n) => n.label === 'SharePoint');
    // Dictionary says SharePoint is a system — speichert-pattern must
    // not override a known kind.
    expect(sharepoint?.kind).toBe('system');
  });

  it('extracts "nutzt" / "verwendet" as a generic uses-relation', () => {
    const { landscape } = parseLandscapeDescription(
      'Der Webshop nutzt Stripe. Die Buchhaltung verwendet DATEV.'
    );
    expect(landscape.relations).toHaveLength(2);
    expect(landscape.relations.every((r) => r.label === 'uses')).toBe(true);
  });

  it('tags "ist ein externes System" as external kind', () => {
    const { landscape } = parseLandscapeDescription(
      'MailHoster ist ein externes System.'
    );
    const mail = Object.values(landscape.nodes)[0];
    expect(mail.kind).toBe('external');
  });

  it('dedups the same entity across multiple sentences', () => {
    const { landscape } = parseLandscapeDescription(
      'Winestro synchronisiert mit Shopify. Winestro speichert in DATEV.'
    );
    const labels = Object.values(landscape.nodes).map((n) => n.label);
    const winestro = labels.filter((l) => l.toLowerCase() === 'winestro');
    expect(winestro).toHaveLength(1);
  });

  it('merges into a supplied base landscape (idempotent re-parse)', () => {
    const { landscape: first } = parseLandscapeDescription(
      'Winestro synchronisiert mit Shopify.'
    );
    const { landscape: second, stats } = parseLandscapeDescription(
      'Winestro synchronisiert mit Shopify.',
      { engine: 'regex' },
      first
    );
    // No new nodes, no new relations — same narrative twice.
    expect(Object.keys(second.nodes).sort()).toEqual(Object.keys(first.nodes).sort());
    expect(second.relations).toHaveLength(first.relations.length);
    expect(stats.nodesAdded).toBe(0);
    expect(stats.relationsAdded).toBe(0);
  });

  it('falls back to regex with a warning for engine=llm', () => {
    const { warnings, engineUsed } = parseLandscapeDescription(
      'Winestro synchronisiert mit Shopify.',
      { engine: 'llm' }
    );
    expect(engineUsed).toBe('regex');
    expect(warnings.some((w) => /falling back to regex/i.test(w))).toBe(true);
  });

  it('extracts at least 2 systems and 1 relation from a 10-sentence KMU narrative (plan success metric)', () => {
    const text = [
      'Wir sind ein Weingut mit eigenem Webshop.',
      'Der Webshop synchronisiert taeglich mit Winestro.',
      'Winestro speichert Rechnungen in SharePoint.',
      'Der Webshop nutzt Stripe fuer die Zahlung.',
      'Kunden koennen ueber Mailchimp benachrichtigt werden.',
      'Mailchimp ist ein externes System.',
      'Die Buchhaltung verwendet DATEV.',
    ].join(' ');
    const { landscape, stats } = parseLandscapeDescription(text);
    const systemCount = Object.values(landscape.nodes).filter(
      (n) => n.kind === 'system' || n.kind === 'external' || n.kind === 'database'
    ).length;
    expect(systemCount).toBeGreaterThanOrEqual(2);
    expect(stats.relationsAdded).toBeGreaterThanOrEqual(1);
  });

  it('returns unparsedSpans for sentences that match no pattern', () => {
    const { unparsedSpans } = parseLandscapeDescription(
      'Winestro synchronisiert mit Shopify. Dies ist ein komplett unspezifischer Satz ohne Kandidaten.'
    );
    expect(unparsedSpans.length).toBeGreaterThan(0);
  });
});

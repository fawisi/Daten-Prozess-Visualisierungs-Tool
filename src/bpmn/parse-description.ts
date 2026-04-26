import { normalizeText, labelToId, MAX_NARRATIVE_INPUT_CHARS } from '../narrative/shared.js';
import { DEFAULT_PARSE_CONFIG } from '../narrative/config.js';
import type { ParseDescriptionConfig } from '../narrative/config.js';
import { emptyProcess, ProcessSchema } from './schema.js';
import type { Process } from './schema.js';

/**
 * BPMN narrative parser. v1.1 shipped 4 sequence-flow patterns; v1.1.1
 * adds 5 DE patterns surfaced by the 2026-04-25 user test (CR-5):
 * "übergibt an", "ruft für", "sendet via", "Nach X folgt Y", and
 * action verbs ("prüft" / "verarbeitet"). Each pattern resolves to one
 * or two task nodes plus a flow.
 *
 * Patterns (v1.1.1):
 *  1. "Zuerst {X}"                        → start-event + task X
 *  2. "Dann {X}"                          → task X connected in sequence
 *  3. "Wenn {COND} dann {A} sonst {B}"    → XOR-gateway 'COND?'
 *  4. "Am Ende / Zuletzt {X}"             → task X + end-event
 *  5. "{A} übergibt {payload} an {B}"     → task A -> task B (label = payload)
 *  6. "{A} ruft {service} für {B}"        → task A -> task B (label = service)
 *  7. "{A} sendet {msg} via {channel}"    → task A -> task B=channel (label = msg)
 *  8. "Nach {A} folgt {B}"                → task A -> task B
 *  9. "{A} prüft {target}"                → task labelled "{A} prüft {target}"
 * 10. "{A} verarbeitet {target}"          → task labelled "{A} verarbeitet {target}"
 */

const FIRST = /^(?:Zuerst|Als\s+erstes|Zunächst|Anfangs)\s+(.+?)[.,;]?$/iu;
const NEXT = /^(?:Dann|Danach|Anschließend|Im\s+Anschluss)\s+(.+?)[.,;]?$/iu;
const IF_THEN_ELSE =
  /^Wenn\s+(.+?)[,]?\s+dann\s+(.+?)[,]?\s+sonst\s+(.+?)[.,;]?$/iu;
const LAST = /^(?:Am\s+Ende|Zuletzt|Schließlich|Abschließend)\s+(.+?)[.,;]?$/iu;

// v1.1.1 DE-Patterns
const UEBERGIBT =
  /^([\wÄÖÜäöüß-]+)\s+(?:übergibt|uebergibt)\s+(.+?)\s+an\s+([\wÄÖÜäöüß-]+)[.,;]?$/iu;
const RUFT_FUER =
  /^([\wÄÖÜäöüß-]+)\s+ruft\s+(.+?)\s+(?:für|fuer)\s+([\wÄÖÜäöüß-]+)[.,;]?$/iu;
const SENDET_VIA =
  /^([\wÄÖÜäöüß-]+)\s+sendet\s+(.+?)\s+via\s+([\wÄÖÜäöüß-]+)[.,;]?$/iu;
const NACH_FOLGT =
  /^Nach\s+([\wÄÖÜäöüß-]+)\s+(?:folgt|kommt)\s+([\wÄÖÜäöüß-]+)[.,;]?$/iu;
const PRUEFT = /^([\wÄÖÜäöüß-]+)\s+(?:prüft|prueft)\s+(.+?)[.,;]?$/iu;
const VERARBEITET = /^([\wÄÖÜäöüß-]+)\s+verarbeitet\s+(.+?)[.,;]?$/iu;

export interface BpmnParseResult {
  process: Process;
  engineUsed: 'regex' | 'llm' | 'hybrid';
  warnings: string[];
  stats: { patternHits: Record<string, number>; nodesAdded: number; flowsAdded: number };
  unparsedSpans: string[];
}

export function parseProcessDescription(
  text: string,
  config: ParseDescriptionConfig = DEFAULT_PARSE_CONFIG,
  base: Process = emptyProcess()
): BpmnParseResult {
  const warnings: string[] = [];
  let engineUsed: BpmnParseResult['engineUsed'] = 'regex';
  if (config.engine === 'llm') {
    warnings.push(
      'config.engine="llm": MCP sampling is not host-supported yet. Falling back to regex.'
    );
  }

  const normalised = normalizeText(text);
  if (normalised.length > MAX_NARRATIVE_INPUT_CHARS) {
    warnings.push(
      `Input truncated to ${MAX_NARRATIVE_INPUT_CHARS} chars (was ${normalised.length}).`
    );
  }
  const input = normalised.slice(0, MAX_NARRATIVE_INPUT_CHARS);

  const process: Process = ProcessSchema.parse(JSON.parse(JSON.stringify(base)));
  const ids = new Set(Object.keys(process.nodes));
  const labelToIdMap = new Map<string, string>();
  for (const [id, node] of Object.entries(process.nodes)) {
    labelToIdMap.set(node.label.toLowerCase().trim(), id);
  }
  const stats = { patternHits: {} as Record<string, number>, nodesAdded: 0, flowsAdded: 0 };
  const nodesAtStart = ids.size;
  const flowsAtStart = process.flows.length;

  // The canvas invariant is "max 1 start-event"; if one exists already
  // we don't add another even when "Zuerst" fires.
  const hasStart = Object.values(process.nodes).some((n) => n.type === 'start-event');
  let lastId: string | null = null;
  for (const [id, node] of Object.entries(process.nodes)) {
    if (node.type === 'end-event') continue;
    lastId = id; // best-effort continuation point
  }

  const lines = input.split(/[.!?\n;]+/).map((s) => s.trim()).filter(Boolean);
  const unparsedSpans: string[] = [];
  const unparsed: string[] = [];

  function ensureTask(label: string): string {
    const key = label.toLowerCase().trim();
    const existing = labelToIdMap.get(key);
    if (existing) return existing;
    const id = labelToId(label, ids);
    ids.add(id);
    labelToIdMap.set(key, id);
    process.nodes[id] = { type: 'task', label };
    return id;
  }
  function connect(from: string, to: string, label?: string) {
    const exists = process.flows.some((f) => f.from === from && f.to === to);
    if (exists) return;
    process.flows.push({ from, to, label: label ?? null });
    stats.flowsAdded += 1;
  }

  for (const line of lines) {
    let matched = false;
    const mFirst = line.match(FIRST);
    if (mFirst) {
      matched = true;
      let startId: string;
      if (!hasStart) {
        startId = labelToId('Start', ids);
        ids.add(startId);
        process.nodes[startId] = { type: 'start-event', label: 'Start' };
        stats.nodesAdded += 1;
      } else {
        startId = Object.entries(process.nodes).find(
          ([, n]) => n.type === 'start-event'
        )![0];
      }
      const taskId = ensureTask(mFirst[1].trim());
      connect(startId, taskId);
      lastId = taskId;
      stats.patternHits.first = (stats.patternHits.first ?? 0) + 1;
      continue;
    }
    const mNext = line.match(NEXT);
    if (mNext) {
      matched = true;
      const taskId = ensureTask(mNext[1].trim());
      if (lastId) connect(lastId, taskId);
      lastId = taskId;
      stats.patternHits.next = (stats.patternHits.next ?? 0) + 1;
      continue;
    }
    const mIf = line.match(IF_THEN_ELSE);
    if (mIf) {
      matched = true;
      const gwId = labelToId(`${mIf[1].trim()}?`, ids);
      ids.add(gwId);
      process.nodes[gwId] = { type: 'gateway', label: `${mIf[1].trim()}?`, gatewayType: 'exclusive' };
      stats.nodesAdded += 1;
      if (lastId) connect(lastId, gwId);
      const yesId = ensureTask(mIf[2].trim());
      connect(gwId, yesId, 'ja');
      const noId = ensureTask(mIf[3].trim());
      connect(gwId, noId, 'nein');
      lastId = yesId; // default-continuation through the "yes" branch
      stats.patternHits.gateway = (stats.patternHits.gateway ?? 0) + 1;
      continue;
    }
    const mLast = line.match(LAST);
    if (mLast) {
      matched = true;
      const taskId = ensureTask(mLast[1].trim());
      if (lastId) connect(lastId, taskId);
      const endId = labelToId('Ende', ids);
      ids.add(endId);
      process.nodes[endId] = { type: 'end-event', label: 'Ende' };
      stats.nodesAdded += 1;
      connect(taskId, endId);
      lastId = endId;
      stats.patternHits.last = (stats.patternHits.last ?? 0) + 1;
      continue;
    }

    // v1.1.1: "{A} übergibt {payload} an {B}" — task A → task B labelled payload
    const mUebergibt = line.match(UEBERGIBT);
    if (mUebergibt) {
      matched = true;
      const fromId = ensureTask(mUebergibt[1].trim());
      const toId = ensureTask(mUebergibt[3].trim());
      connect(fromId, toId, mUebergibt[2].trim());
      lastId = toId;
      stats.patternHits.uebergibt = (stats.patternHits.uebergibt ?? 0) + 1;
      continue;
    }

    // v1.1.1: "{A} ruft {service} für {B}" — call-pattern, label = service
    const mRuft = line.match(RUFT_FUER);
    if (mRuft) {
      matched = true;
      const fromId = ensureTask(mRuft[1].trim());
      const toId = ensureTask(mRuft[3].trim());
      connect(fromId, toId, mRuft[2].trim());
      lastId = toId;
      stats.patternHits.ruft_fuer = (stats.patternHits.ruft_fuer ?? 0) + 1;
      continue;
    }

    // v1.1.1: "{A} sendet {msg} via {channel}" — channel becomes the task target
    const mSendet = line.match(SENDET_VIA);
    if (mSendet) {
      matched = true;
      const fromId = ensureTask(mSendet[1].trim());
      const toId = ensureTask(mSendet[3].trim());
      connect(fromId, toId, mSendet[2].trim());
      lastId = toId;
      stats.patternHits.sendet_via = (stats.patternHits.sendet_via ?? 0) + 1;
      continue;
    }

    // v1.1.1: "Nach {A} folgt {B}" — explicit sequence
    const mNach = line.match(NACH_FOLGT);
    if (mNach) {
      matched = true;
      const fromId = ensureTask(mNach[1].trim());
      const toId = ensureTask(mNach[2].trim());
      connect(fromId, toId);
      lastId = toId;
      stats.patternHits.nach_folgt = (stats.patternHits.nach_folgt ?? 0) + 1;
      continue;
    }

    // v1.1.1: "{A} prüft {target}" — single task labelled with the verb phrase
    const mPrueft = line.match(PRUEFT);
    if (mPrueft) {
      matched = true;
      const taskId = ensureTask(`${mPrueft[1].trim()} prüft ${mPrueft[2].trim()}`);
      if (lastId) connect(lastId, taskId);
      lastId = taskId;
      stats.patternHits.prueft = (stats.patternHits.prueft ?? 0) + 1;
      continue;
    }

    // v1.1.1: "{A} verarbeitet {target}" — single task
    const mVerarbeitet = line.match(VERARBEITET);
    if (mVerarbeitet) {
      matched = true;
      const taskId = ensureTask(
        `${mVerarbeitet[1].trim()} verarbeitet ${mVerarbeitet[2].trim()}`
      );
      if (lastId) connect(lastId, taskId);
      lastId = taskId;
      stats.patternHits.verarbeitet = (stats.patternHits.verarbeitet ?? 0) + 1;
      continue;
    }

    if (!matched) unparsed.push(line);
  }

  unparsedSpans.push(...unparsed);
  stats.nodesAdded = Object.keys(process.nodes).length - nodesAtStart;
  stats.flowsAdded = process.flows.length - flowsAtStart;

  return { process, engineUsed, warnings, stats, unparsedSpans };
}

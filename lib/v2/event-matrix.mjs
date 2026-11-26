// Event Flow & 2D Event Matrix engine for co-arising 2.0 + v1/ingest lossless recovery.
// Reconstructs complete EventStorming timelines (timeline × sequence × step × pivotal + hotspots)
// from: (a) v2 Canonical Model, (b) legacy v1 truth trees where decompose moved event-es-* into
// aggregates/*/notes/, or (c) raw .ingest/*.json workshop snapshots.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseDoc } from '../shared.mjs';
import { parseStructuredDoc } from './yaml-parser.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'target', 'dist', '.idea', '.bloop']);

function walkYamlFiles(dir, out = []) {
  const st = statSync(dir);
  if (st.isFile()) {
    if (/\.(?:yaml|yml)$/u.test(dir)) out.push(dir);
    return out;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkYamlFiles(full, out);
    else if (entry.isFile() && /\.(?:yaml|yml)$/u.test(entry.name)) out.push(full);
  }
  return out;
}

function slugId(raw) {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gu, '-').replace(/^-+|-+$/gu, '');
  return s || 'default';
}

function yamlScalar(str) {
  const text = String(str ?? '');
  if (!text) return '""';
  if (/[:#[\]{},&*!|>'"%@`\n]/u.test(text) || /^\s|\s$/u.test(text)) {
    return JSON.stringify(text);
  }
  return text;
}

function extractAggregateFromLinksOrPath(links, relPath) {
  for (const link of links ?? []) {
    const s = String(link);
    if (s.startsWith('aggregate:')) return s.slice('aggregate:'.length).trim();
  }
  const m = String(relPath ?? '').match(/aggregates\/([^/]+)\/notes\//u);
  if (m) return m[1];
  return null;
}

function extractLinkedEvents(links) {
  const out = [];
  for (const link of links ?? []) {
    const s = String(link);
    if (s.startsWith('event:')) out.push(s.slice('event:'.length).trim());
  }
  return out;
}

function lifecycleRank(eventName) {
  const s = String(eventName ?? '').toLowerCase();
  if (/(?:created|proposed|initiated|registered|opened|started|invited|scheduled|raised|captured)/u.test(s)) return 0;
  if (/(?:prepared|assigned|detected|updated|changed|classified|assembled|submitted|parked)/u.test(s)) return 1;
  if (/(?:resolved|accepted|joined|approved|established|passed|completed|exported|published|released|closed|withdrawn)/u.test(s)) return 2;
  return 1;
}

function normalizeMatrixFromRawNotes({ sourceKind, sourceLabel, system, subdomain, rawEvents, rawHotspots, recoveredFromAggregates = 0 }) {
  // Group events by timeline (preserving discovery order)
  const timelineOrder = [];
  const byTimeline = new Map();
  let maxExplicitSeq = -1;
  for (const ev of rawEvents) {
    if (ev.sequence !== null && ev.sequence !== undefined && Number.isFinite(ev.sequence)) {
      if (ev.sequence > maxExplicitSeq) maxExplicitSeq = ev.sequence;
    }
  }
  let nextAutoSeq = maxExplicitSeq + 1;

  for (const ev of rawEvents) {
    const tlName = ev.timeline || '未分组时间线';
    if (!byTimeline.has(tlName)) {
      byTimeline.set(tlName, []);
      timelineOrder.push(tlName);
    }
    byTimeline.get(tlName).push(ev);
  }

  // Assign deterministic coordinates scoped per (timeline, sequence, step) so distinct timelines
  // sharing a legacy sequence number (e.g. seq=4 across two phases) never swallow each other.
  const timelines = [];
  const allCells = [];

  for (const tlName of timelineOrder) {
    const list = byTimeline.get(tlName);
    const usedLocal = new Set();
    const aggAutoSeq = new Map();
    const items = [];
    // Sort unsequenced events within same aggregate by lifecycle semantics (Proposed -> Updated -> Established)
    const orderedList = [...list].sort((a, b) => {
      const aHas = a.sequence !== null && a.sequence !== undefined && Number.isFinite(a.sequence);
      const bHas = b.sequence !== null && b.sequence !== undefined && Number.isFinite(b.sequence);
      if (aHas && bHas) return (a.sequence - b.sequence) || ((a.step ?? 0) - (b.step ?? 0));
      if (aHas !== bHas) return aHas ? -1 : 1;
      const aggCmp = String(a.aggregate ?? '').localeCompare(String(b.aggregate ?? ''));
      if (aggCmp !== 0) return aggCmp;
      return (lifecycleRank(a.event) - lifecycleRank(b.event)) || a.event.localeCompare(b.event);
    });

    for (const ev of orderedList) {
      let seq = ev.sequence !== null && ev.sequence !== undefined && Number.isFinite(ev.sequence)
        ? Number(ev.sequence)
        : null;
      let step = ev.step !== null && ev.step !== undefined && Number.isFinite(ev.step)
        ? Number(ev.step)
        : 0;
      if (seq === null) {
        const aggKey = ev.aggregate || ev.event;
        if (!aggAutoSeq.has(aggKey)) {
          aggAutoSeq.set(aggKey, nextAutoSeq);
          nextAutoSeq += 1;
        }
        seq = aggAutoSeq.get(aggKey);
      }
      while (usedLocal.has(`${seq}:${step}`)) {
        step += 1;
      }
      usedLocal.add(`${seq}:${step}`);
      const cell = {
        event: ev.event,
        aggregate: ev.aggregate || null,
        timeline: tlName,
        timelineId: slugId(tlName),
        sequence: seq,
        step,
        pivotal: Boolean(ev.pivotal),
        description: ev.description || '',
        sourcePath: ev.sourcePath || null,
        producerCommands: ev.producerCommands ?? [],
        actors: ev.actors ?? [],
        consumerReadModels: ev.consumerReadModels ?? [],
        consumerPolicies: ev.consumerPolicies ?? [],
        piiFields: ev.piiFields ?? [],
      };
      items.push(cell);
      allCells.push(cell);
    }
    items.sort((a, b) => (a.sequence - b.sequence) || (a.step - b.step) || a.event.localeCompare(b.event));
    const minSeq = items.length > 0 ? Math.min(...items.map(i => i.sequence)) : 0;
    const maxSeq = items.length > 0 ? Math.max(...items.map(i => i.sequence)) : 0;
    const minStepAtMin = items.length > 0
      ? Math.min(...items.filter(i => i.sequence === minSeq).map(i => i.step))
      : 0;
    timelines.push({
      id: slugId(tlName),
      name: tlName,
      minSequence: minSeq,
      maxSequence: maxSeq,
      minStepAtMin,
      events: items,
    });
  }

  // Order timelines chronologically by (minSequence, minStepAtMin)
  timelines.sort((a, b) => (a.minSequence - b.minSequence) || (a.minStepAtMin - b.minStepAtMin));

  // Build columns scoped per (timeline, sequence) so every timeline keeps its own clean column(s)
  const columns = [];
  for (const tl of timelines) {
    const seqs = [...new Set(tl.events.map(e => e.sequence))].sort((a, b) => a - b);
    for (const seq of seqs) {
      const colCells = tl.events.filter(c => c.sequence === seq).sort((a, b) => a.step - b.step);
      columns.push({
        sequence: seq,
        timeline: tl.name,
        timelines: [tl.name],
        hasPivotal: colCells.some(c => c.pivotal),
        cells: colCells,
      });
    }
  }
  const maxStep = allCells.length > 0 ? Math.max(...allCells.map(c => c.step)) : 0;

  // Compute Space/State Swimlanes ordered strictly by each space's earliest event occurrence
  // (top-left -> bottom-right diagonal waterfall: same space/aggregate stays on one horizontal row,
  // earlier-activated spaces appear higher).
  const tlIndex = new Map(timelines.map((tl, i) => [tl.name, i]));
  const spaceMap = new Map();
  for (const cell of allCells) {
    const spaceName = cell.aggregate || cell.space || cell.timeline || 'Default';
    const orderTuple = [tlIndex.get(cell.timeline) ?? 999, cell.sequence, cell.step];
    if (!spaceMap.has(spaceName)) {
      spaceMap.set(spaceName, { name: spaceName, firstOrder: orderTuple, events: [] });
    } else {
      const rec = spaceMap.get(spaceName);
      if (
        orderTuple[0] < rec.firstOrder[0]
        || (orderTuple[0] === rec.firstOrder[0] && orderTuple[1] < rec.firstOrder[1])
        || (orderTuple[0] === rec.firstOrder[0] && orderTuple[1] === rec.firstOrder[1] && orderTuple[2] < rec.firstOrder[2])
      ) {
        rec.firstOrder = orderTuple;
      }
    }
    spaceMap.get(spaceName).events.push(cell);
  }
  const spaceLanes = [...spaceMap.values()]
    .sort((a, b) => (a.firstOrder[0] - b.firstOrder[0])
      || (a.firstOrder[1] - b.firstOrder[1])
      || (a.firstOrder[2] - b.firstOrder[2])
      || a.name.localeCompare(b.name))
    .map((lane, idx) => ({
      rank: idx,
      name: lane.name,
      firstTimelineIndex: lane.firstOrder[0],
      firstSequence: lane.firstOrder[1],
      firstStep: lane.firstOrder[2],
      events: lane.events.sort((a, b) => ((tlIndex.get(a.timeline) ?? 999) - (tlIndex.get(b.timeline) ?? 999))
        || (a.sequence - b.sequence)
        || (a.step - b.step)),
    }));

  const hotspots = rawHotspots.map((hs, idx) => ({
    id: hs.id || `HS-${idx + 1}`,
    question: hs.question || '',
    timeline: hs.timeline || null,
    linkedEvents: hs.linkedEvents ?? [],
    status: hs.status || 'open',
    blocking: Boolean(hs.blocking),
    resolution: hs.resolution || '',
    sourcePath: hs.sourcePath || null,
  }));

  return {
    schemaVersion: 'co-arising.event-matrix/v1',
    sourceKind,
    sourceLabel,
    system: system || 'default-system',
    subdomain: subdomain || 'default',
    timelines,
    columns,
    spaceLanes,
    maxStep,
    cells: allCells,
    hotspots,
    stats: {
      timelineCount: timelines.length,
      spaceLaneCount: spaceLanes.length,
      eventCount: allCells.length,
      pivotalCount: allCells.filter(c => c.pivotal).length,
      hotspotCount: hotspots.length,
      openHotspotCount: hotspots.filter(h => h.status === 'open').length,
      columnCount: columns.length,
      rowCount: spaceLanes.length,
      recoveredFromAggregates,
    },
  };
}

/**
 * Losslessly reconstructs EventStorming 2D Event Matrix + Hotspots from a legacy v1 truth tree,
 * scanning BOTH inbox/ AND aggregates/star/notes/ where decompose.mjs moved owned event-es-*.yaml notes.
 */
export function extractEventMatrixFromV1Tree(treeDir) {
  const absDir = resolve(treeDir);
  const files = walkYamlFiles(absDir);
  const rawEvents = [];
  const rawHotspots = [];
  let recoveredFromAggregates = 0;
  let system = null;

  for (const file of files) {
    const rel = relative(absDir, file).split(sep).join('/');
    const raw = readFileSync(file, 'utf8');
    let doc;
    try {
      doc = parseDoc(raw, file);
    } catch {
      try {
        doc = parseStructuredDoc(raw, file);
      } catch {
        continue;
      }
    }
    if (!doc || typeof doc !== 'object') continue;
    if ((doc.kind === 'system' || rel === 'workshop.yaml') && doc.name) {
      system = String(doc.name);
      continue;
    }
    if (doc.kind !== 'note') continue;
    const stage = doc.origin?.stage ?? doc.payload?.stage ?? null;
    if (stage !== 'eventStorming') continue;

    const payload = doc.payload && typeof doc.payload === 'object' ? doc.payload : {};
    const info = payload.info && typeof payload.info === 'object' ? payload.info : {};
    const noteType = String(doc.type ?? payload.type ?? '');

    if (noteType === 'event') {
      if (rel.includes('/aggregates/') || rel.startsWith('aggregates/')) {
        recoveredFromAggregates += 1;
      }
      rawEvents.push({
        event: String(doc.name ?? payload.name ?? ''),
        aggregate: extractAggregateFromLinksOrPath(payload.links, rel),
        timeline: info.timeline ? String(info.timeline) : '主事件流',
        sequence: info.sequence !== undefined && info.sequence !== null ? Number(info.sequence) : null,
        step: info.step !== undefined && info.step !== null ? Number(info.step) : 0,
        pivotal: Boolean(info.pivotal),
        description: String(payload.description_zh ?? payload.description ?? ''),
        sourcePath: rel,
      });
    } else if (noteType === 'question') {
      const desc = String(payload.description ?? '');
      const isResolved = /裁决|结论|已决|resolved/iu.test(desc);
      rawHotspots.push({
        id: doc.id ? String(doc.id).slice(0, 8) : `Q-${rawHotspots.length + 1}`,
        question: String(doc.name ?? payload.name ?? ''),
        linkedEvents: extractLinkedEvents(payload.links),
        status: isResolved ? 'resolved' : 'open',
        blocking: false,
        resolution: desc,
        sourcePath: rel,
      });
    }
  }

  return normalizeMatrixFromRawNotes({
    sourceKind: 'v1-tree',
    sourceLabel: absDir,
    system: system || absDir.split(sep).pop(),
    subdomain: 'eventStorming',
    rawEvents,
    rawHotspots,
    recoveredFromAggregates,
  });
}

/**
 * Losslessly extracts EventStorming 2D Event Matrix + Hotspots directly from a `.ingest/*.json` snapshot.
 */
export function extractEventMatrixFromIngestJson(ingestJsonPath) {
  const absPath = resolve(ingestJsonPath);
  const doc = JSON.parse(readFileSync(absPath, 'utf8'));
  const sessions = doc.sessions ?? [];
  const esSession = sessions.find(s => s.session === 'eventStorming' || s.name === 'eventStorming');
  const rawEvents = [];
  const rawHotspots = [];

  if (esSession) {
    for (const scope of esSession.scopes ?? []) {
      for (const note of scope.notes ?? []) {
        const info = note.info && typeof note.info === 'object' ? note.info : {};
        if (note.type === 'event') {
          rawEvents.push({
            event: String(note.name ?? ''),
            aggregate: extractAggregateFromLinksOrPath(note.links, ''),
            timeline: info.timeline ? String(info.timeline) : '主事件流',
            sequence: info.sequence !== undefined && info.sequence !== null ? Number(info.sequence) : null,
            step: info.step !== undefined && info.step !== null ? Number(info.step) : 0,
            pivotal: Boolean(info.pivotal),
            description: String(note.description ?? ''),
            sourcePath: `sessions[eventStorming].scopes[${scope.scope || 'board1'}]`,
          });
        } else if (note.type === 'question') {
          const desc = String(note.description ?? '');
          const isResolved = /裁决|结论|已决|resolved/iu.test(desc);
          rawHotspots.push({
            id: note.noteId ? String(note.noteId).slice(0, 8) : `Q-${rawHotspots.length + 1}`,
            question: String(note.name ?? ''),
            linkedEvents: extractLinkedEvents(note.links),
            status: isResolved ? 'resolved' : 'open',
            blocking: false,
            resolution: desc,
            sourcePath: `sessions[eventStorming].scopes[${scope.scope || 'board1'}]`,
          });
        }
      }
    }
  }

  return normalizeMatrixFromRawNotes({
    sourceKind: 'ingest-json',
    sourceLabel: absPath,
    system: doc.workshop || doc.name || 'ingest',
    subdomain: 'eventStorming',
    rawEvents,
    rawHotspots,
    recoveredFromAggregates: 0,
  });
}

/**
 * Builds an enriched 2D Event Matrix from a compiled v2 Canonical Model.
 * Enriches every event cell with Producer Commands, Actors, Consumer ReadModels, Policies/Sagas, and PII fields.
 */
export function buildEventMatrixFromCanonical(canonical) {
  const structures = canonical.structures ?? {};
  const aggregates = structures.aggregates ?? [];
  const readModels = structures.readModels ?? [];
  const sagas = structures.sagas ?? [];
  const useCases = structures.useCases ?? [];
  const behaviors = canonical.behaviors ?? [];

  // Build reverse enrichment indexes
  const eventInfo = new Map();
  for (const agg of aggregates) {
    for (const ev of agg.events ?? []) {
      const fq = `${agg.name}.${ev.name}`;
      const producerCommands = (agg.commands ?? [])
        .filter(c => (c.produces ?? []).includes(ev.name))
        .map(c => `${agg.name}.${c.name}`);
      const piiFields = (ev.fields ?? [])
        .filter(f => f.sensitivity === 'pii' || f.sensitivity === 'tokenized-pii' || f.sensitivity === 'secret')
        .map(f => `${f.name}:${f.sensitivity}`);
      const rec = {
        aggregate: agg.name,
        event: ev.name,
        fq,
        producerCommands,
        actors: new Set(),
        consumerReadModels: new Set(),
        consumerPolicies: new Set(),
        piiFields,
      };
      eventInfo.set(fq, rec);
      if (!eventInfo.has(ev.name)) eventInfo.set(ev.name, rec);
    }
  }

  for (const rm of readModels) {
    for (const evRef of rm.sourceEvents ?? []) {
      const info = eventInfo.get(evRef);
      if (info) info.consumerReadModels.add(rm.name);
    }
    for (const f of rm.fields ?? []) {
      const m = String(f.source ?? '').match(/^eventField:([^.]+(?:\.[^.]+)?)\.[^.]+$/u);
      if (m) {
        const info = eventInfo.get(m[1]);
        if (info) info.consumerReadModels.add(rm.name);
      }
    }
  }

  for (const saga of sagas) {
    for (const tr of saga.triggers ?? []) {
      let evName = tr?.event;
      if (typeof tr === 'string') evName = tr;
      else if (tr?.aggregate) evName = `${tr.aggregate}.${tr.event}`;
      const info = eventInfo.get(evName);
      if (info) info.consumerPolicies.add(`Saga:${saga.name}`);
    }
  }

  for (const beh of behaviors) {
    if (beh.layer !== 'application') continue;
    for (const r of beh.rules ?? []) {
      if (r.triggerKind === 'event' && r.command) {
        const info = eventInfo.get(r.command);
        if (info) info.consumerPolicies.add(`Policy:${beh.target}`);
      }
    }
  }

  for (const uc of useCases) {
    for (const st of uc.steps ?? []) {
      const actor = st.actor || uc.actor;
      for (const em of st.emissions ?? []) {
        const info = eventInfo.get(st.aggregate ? `${st.aggregate}.${em}` : em) ?? eventInfo.get(em);
        if (info && actor) info.actors.add(actor);
      }
    }
  }

  const rawEvents = [];
  const rawHotspots = [];
  const ef = structures.eventFlow;

  if (ef && Array.isArray(ef.timelines) && ef.timelines.length > 0) {
    for (const tl of ef.timelines) {
      for (const entry of tl.events ?? []) {
        const fq = entry.aggregate ? `${entry.aggregate}.${entry.event}` : entry.event;
        const info = eventInfo.get(fq) ?? eventInfo.get(entry.event);
        rawEvents.push({
          event: entry.event,
          aggregate: entry.aggregate ?? info?.aggregate ?? null,
          timeline: tl.name || tl.id,
          sequence: entry.sequence,
          step: entry.step ?? 0,
          pivotal: Boolean(entry.pivotal),
          description: entry.description || '',
          producerCommands: info?.producerCommands ?? [],
          actors: info ? [...info.actors] : [],
          consumerReadModels: info ? [...info.consumerReadModels] : [],
          consumerPolicies: info ? [...info.consumerPolicies] : [],
          piiFields: info?.piiFields ?? [],
        });
      }
    }
    for (const hs of ef.hotspots ?? []) {
      rawHotspots.push(hs);
    }
  } else {
    // Synthesize fallback timelines from UseCases (or Aggregates if no useCases)
    const seen = new Set();
    let seqCursor = 0;
    for (const uc of useCases) {
      const tlName = uc.name || uc.id;
      for (const st of uc.steps ?? []) {
        let stepRow = 0;
        for (const em of st.emissions ?? []) {
          const fq = st.aggregate ? `${st.aggregate}.${em}` : em;
          const info = eventInfo.get(fq) ?? eventInfo.get(em);
          const key = info?.fq ?? fq;
          if (seen.has(key)) continue;
          seen.add(key);
          rawEvents.push({
            event: info?.event ?? em,
            aggregate: info?.aggregate ?? st.aggregate ?? null,
            timeline: tlName,
            sequence: seqCursor,
            step: stepRow,
            pivotal: stepRow === 0,
            description: st.intent || '',
            producerCommands: info?.producerCommands ?? [],
            actors: info ? [...info.actors] : [],
            consumerReadModels: info ? [...info.consumerReadModels] : [],
            consumerPolicies: info ? [...info.consumerPolicies] : [],
            piiFields: info?.piiFields ?? [],
          });
          stepRow += 1;
        }
        if ((st.emissions ?? []).length > 0) seqCursor += 1;
      }
    }
    for (const agg of aggregates) {
      for (const ev of agg.events ?? []) {
        const fq = `${agg.name}.${ev.name}`;
        if (seen.has(fq)) continue;
        seen.add(fq);
        const info = eventInfo.get(fq);
        rawEvents.push({
          event: ev.name,
          aggregate: agg.name,
          timeline: agg.name,
          sequence: seqCursor,
          step: 0,
          pivotal: false,
          description: '',
          producerCommands: info?.producerCommands ?? [],
          actors: info ? [...info.actors] : [],
          consumerReadModels: info ? [...info.consumerReadModels] : [],
          consumerPolicies: info ? [...info.consumerPolicies] : [],
          piiFields: info?.piiFields ?? [],
        });
        seqCursor += 1;
      }
    }
  }

  return normalizeMatrixFromRawNotes({
    sourceKind: 'canonical-v2',
    sourceLabel: `${canonical.system}/${canonical.subdomain || canonical.context}`,
    system: canonical.system,
    subdomain: canonical.subdomain || canonical.context,
    rawEvents,
    rawHotspots,
    recoveredFromAggregates: 0,
  });
}

/**
 * Renders a normalized EventMatrixModel into a ready-to-use `eventFlow:` YAML block for co-arising.structures/v2.
 */
export function renderEventFlowYamlSnippet(matrix) {
  const lines = [
    '# Generated from EventStorming Event Matrix — paste into truth/structures/*.yaml',
    'eventFlow:',
    '  timelines:',
  ];
  for (const tl of matrix.timelines ?? []) {
    lines.push(`    - id: ${yamlScalar(tl.id)}`);
    lines.push(`      name: ${yamlScalar(tl.name)}`);
    lines.push('      events:');
    for (const ev of tl.events ?? []) {
      const ref = ev.aggregate ? `${ev.aggregate}.${ev.event}` : ev.event;
      lines.push(`        - event: ${yamlScalar(ref)}`);
      lines.push(`          sequence: ${ev.sequence}`);
      lines.push(`          step: ${ev.step}`);
      if (ev.pivotal) lines.push('          pivotal: true');
      if (ev.description) lines.push(`          description: ${yamlScalar(ev.description)}`);
    }
  }
  if ((matrix.hotspots ?? []).length > 0) {
    lines.push('  hotspots:');
    for (const hs of matrix.hotspots) {
      lines.push(`    - id: ${yamlScalar(hs.id)}`);
      lines.push(`      question: ${yamlScalar(hs.question)}`);
      if ((hs.linkedEvents ?? []).length > 0) {
        lines.push(`      linkedEvents: [${hs.linkedEvents.map(yamlScalar).join(', ')}]`);
      }
      lines.push(`      status: ${yamlScalar(hs.status)}`);
      if (hs.blocking) lines.push('      blocking: true');
      if (hs.resolution) lines.push(`      resolution: ${yamlScalar(hs.resolution)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Renders a Mermaid flowchart for the Event Matrix timelines & pivotal milestones.
 */
export function renderEventMatrixMermaid(matrix) {
  const lines = ['flowchart LR'];
  const sanitize = s => String(s ?? 'n').replace(/[^A-Za-z0-9_]/gu, '_');
  const prevPivotalIds = [];

  (matrix.timelines ?? []).forEach((tl, tlIdx) => {
    const sgId = `TL_${tlIdx}_${sanitize(tl.id)}`;
    lines.push(`  subgraph ${sgId}["${String(tl.name).replace(/"/gu, '\'')}"]`);
    let prevId = null;
    for (const ev of tl.events ?? []) {
      const nodeId = `EV_${tlIdx}_${ev.sequence}_${ev.step}_${sanitize(ev.event)}`;
      const badge = ev.pivotal ? '★ ' : '';
      const aggPrefix = ev.aggregate ? `${ev.aggregate}.` : '';
      const label = `${badge}${aggPrefix}${ev.event} (s${ev.sequence}:${ev.step})`.replace(/"/gu, '\'');
      if (ev.pivotal) {
        lines.push(`    ${nodeId}(("${label}"))`);
      } else {
        lines.push(`    ${nodeId}["${label}"]`);
      }
      if (prevId) lines.push(`    ${prevId} --> ${nodeId}`);
      prevId = nodeId;
    }
    lines.push('  end');
    if (prevId) prevPivotalIds.push({ first: tl.events[0] ? `EV_${tlIdx}_${tl.events[0].sequence}_${tl.events[0].step}_${sanitize(tl.events[0].event)}` : null, last: prevId });
  });

  for (let i = 1; i < prevPivotalIds.length; i += 1) {
    if (prevPivotalIds[i - 1].last && prevPivotalIds[i].first) {
      lines.push(`  ${prevPivotalIds[i - 1].last} -.-> ${prevPivotalIds[i].first}`);
    }
  }

  for (const hs of matrix.hotspots ?? []) {
    const hsId = `HS_${sanitize(hs.id)}`;
    const icon = hs.status === 'resolved' ? '✓' : '⚠';
    lines.push(`  ${hsId}{{"${icon} ${String(hs.question).slice(0, 36).replace(/"/gu, '\'')}"}}`);
    for (const evRef of hs.linkedEvents ?? []) {
      const evShort = evRef.includes('.') ? evRef.split('.').pop() : evRef;
      const match = (matrix.cells ?? []).find(c => c.event === evShort || `${c.aggregate}.${c.event}` === evRef);
      if (match) {
        const tlIdx = (matrix.timelines ?? []).findIndex(t => t.name === match.timeline);
        if (tlIdx >= 0) {
          const targetId = `EV_${tlIdx}_${match.sequence}_${match.step}_${sanitize(match.event)}`;
          lines.push(`  ${hsId} -.-> ${targetId}`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Renders the full Markdown 2D Event Matrix report (Grid + Mermaid + Hotspots ledger).
 */
export function renderEventMatrixMarkdown(matrix) {
  const s = matrix.stats ?? {};
  const lines = [
    `# EventStorming 2D Event Matrix (${matrix.system} / ${matrix.subdomain})`,
    '',
    `> Source: \`${matrix.sourceKind}\` · Timelines: **${s.timelineCount ?? 0}** · Events: **${s.eventCount ?? 0}** · Pivotal Milestones: **${s.pivotalCount ?? 0}** · Hotspots: **${s.hotspotCount ?? 0}** (Open: ${s.openHotspotCount ?? 0})${s.recoveredFromAggregates ? ` · Recovered from \`aggregates/*/notes/\`: **${s.recoveredFromAggregates}**` : ''}`,
    '',
  ];

  // 1. Canonical 2D Event Matrix: Rows = Space/Aggregate (ordered by earliest event occurrence), Cols = Timeline Phases
  if ((matrix.timelines ?? []).length > 0 && (matrix.spaceLanes ?? []).length > 0) {
    lines.push('## 1. 2D Event Matrix (Space/Aggregate × Timeline, Ordered by First Event)', '');
    const header = ['Space / Aggregate', ...matrix.timelines.map((tl, idx) => `${idx + 1}. ${tl.name}`)];
    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| :--- | ${matrix.timelines.map(() => ':---').join(' | ')} |`);
    for (const lane of matrix.spaceLanes) {
      const row = [`**${lane.name}**`];
      for (const tl of matrix.timelines) {
        const matches = lane.events.filter(c => c.timeline === tl.name);
        if (matches.length === 0) {
          row.push('—');
        } else {
          row.push(matches.map(cell => {
            const parts = [`${cell.pivotal ? '★ ' : ''}**${cell.event}**`];
            if (cell.producerCommands.length > 0) parts.push(`← ${cell.producerCommands.join(', ')}`);
            if (cell.consumerReadModels.length > 0) parts.push(`→ RM:${cell.consumerReadModels.join(', ')}`);
            if (cell.consumerPolicies.length > 0) parts.push(`⚡ ${cell.consumerPolicies.join(', ')}`);
            return parts.join('<br/>');
          }).join('<br/>↓<br/>'));
        }
      }
      lines.push(`| ${row.join(' | ')} |`);
    }
    lines.push('');
  }

  // 2. Timeline Backbone summary
  if ((matrix.timelines ?? []).length > 0) {
    lines.push('## 2. Timeline Backbone (Mermaid)', '');
    lines.push('```mermaid', renderEventMatrixMermaid(matrix), '```', '');
  }

  // 3. Hotspots Arbitration Ledger
  if ((matrix.hotspots ?? []).length > 0) {
    lines.push('## 3. EventStorming Hotspots (Questions & Arbitrations)', '');
    lines.push('| ID | Status | Blocking | Question | Linked Events | Resolution |');
    lines.push('| :--- | :---: | :---: | :--- | :--- | :--- |');
    for (const hs of matrix.hotspots) {
      lines.push(`| \`${hs.id}\` | \`${hs.status}\` | ${hs.blocking ? 'YES' : 'no'} | ${hs.question} | ${(hs.linkedEvents ?? []).join(', ') || '—'} | ${hs.resolution || '—'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

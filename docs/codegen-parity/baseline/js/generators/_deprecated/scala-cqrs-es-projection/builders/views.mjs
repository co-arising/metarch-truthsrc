// builders/views.mjs — per-view derivation for the projection face (V4-14).
// Ports the engine's assembly rules (AssemblyEngine.readStores + ProjectionRepositoryBuilder)
// onto the canonical's ①-layer projectionViews slot:
//   • storage dispatch: info.storage.kind = vector|graph|mongo, default table (readStoreStorage)
//   • keyNames = isKey field names SORTED (字典序固定 — OpenSession 键序漂移教训);
//     idNames = non-key `*Id` fields + composite-key `*Id` members, distinct, sorted
//     (AssemblyEngine:602-609 — 批6 A 桶 L2 复合键维度 finder)
//   • methods: table/mongo CRUD set (+findByTenantPaged/countByTenant for mongo), the graph
//     four-verb set (+mergeEdge only when a burnable edge exists), the vector fixed 4-set
//   • DTO fields sorted by name (readModelSchema order — the Table companion/impl column order)
import { scalaSig, parseType } from '../../scala-cqrs-es/builders/types.mjs';

// Type deps with the VO fallback the rules/eventhandler faces use (S2-98 precedent):
// unknown base → net.imadz.metarch.domain.values.<Base>.
export function depsOf(sig, fb = 'net.imadz.common', own = null) {
  const out = [];
  const walk = (t) => {
    const { base, params } = parseType(t);
    const pkg = base === own ? null
      : base === 'Id' || base === 'iMadzError' ? `${fb}.CommonTypes`
        : base === 'Instant' ? 'java.time'
          : ['List', 'Map', 'Seq', 'Set', 'Vector'].includes(base) ? 'scala.collection.immutable'
            : ['String', 'Int', 'Long', 'Boolean', 'Double', 'Float', 'BigDecimal', 'Option', 'Unit', 'Future', 'Array'].includes(base) ? null
              : 'net.imadz.metarch.domain.values';
    if (pkg) out.push({ fqn: `${pkg}.${base}`, key: t });
    params.forEach(walk);
  };
  walk(sig);
  return out;
}

// Scala keyword identifiers get backticks (type etc.) — gen_projection_handlers SCALA_KEYWORDS port.
const SCALA_KEYWORDS = new Set(['type', 'class', 'def', 'val', 'var', 'object', 'trait', 'package', 'import', 'case', 'match', 'else', 'then', 'yield', 'while', 'return', 'throw', 'new', 'extends', 'with', 'final', 'sealed', 'abstract', 'lazy', 'override', 'implicit', 'private', 'protected', 'this', 'super', 'try', 'catch', 'finally', 'for', 'do']);
export const id = (name) => (SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name);
export const decap = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
export const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Instant columns: nullable explicit-false stays bare; otherwise Option-wrapped
// (EP_Functional_Terminal_Form_Template_Batch S2 — 批④ 104/104 longOpt 证据).
export function dtoSigOf(dataType, nullable) {
  const sig = scalaSig(dataType);
  if (sig === 'Instant' && nullable !== false) return 'Option[Instant]';
  return sig;
}

const isListT = (t) => /^list[<[]/i.test(String(t));

// gen_projection_handlers defaultOf port (③层 enriched dataType in, stub value out).
export function defaultOf(dataType) {
  const t = String(dataType || 'String');
  if (/^instant$/i.test(t) || /^datetime$/i.test(t)) return 'null';
  if (isIdType(t)) return 'net.imadz.common.Id.of("00000000-0000-0000-0000-000000000000")';
  if (/^(integer|int)$/i.test(t)) return '0';
  if (/^long$/i.test(t)) return '0L';
  if (/^(boolean|bool)$/i.test(t)) return 'false';
  if (/^bigdecimal$/i.test(t) || /decimal/i.test(t)) return 'BigDecimal("0")';
  if (isListT(t)) return 'Nil';
  return '""';
}
export const isIdType = (t) => /^string\s*\(\s*uuid\s*\)$/i.test(String(t).trim());
export const isInstantType = (t) => /^instant$/i.test(String(t)) || /^datetime$/i.test(String(t));

// valueExpr port (gen_projection_handlers): po field access typed by the VIEW column.
// VO-list columns return null (no converter registry in truthsrc) → derived falls back to
// the manual-block sidecar (MERGE-preserved handwritten reality).
export function valueExpr(dataType, poField) {
  const access = poField.startsWith('po.') ? `po.${id(poField.slice(3))}` : poField;
  if (isInstantType(dataType)) return `java.time.Instant.ofEpochMilli(${access})`;
  if (isIdType(dataType)) return `net.imadz.common.Id.of(${access})`;
  if (/^list[<[]\s*string\s*\(\s*uuid\)/i.test(String(dataType))) return `${access}.toList.map(net.imadz.common.Id.of)`;
  if (/^list[<[]\s*string/i.test(String(dataType))) return `${access}.toList`;
  if (isListT(dataType)) return null; // List<VO>: converter registry not ported → sidecar fallback
  return access;
}

export function deriveView(v, canonical) {
  const eventAgg = canonical.eventAgg ?? {};
  const storageKind = v.storage?.kind === 'vector' || v.storage?.kind === 'graph' || v.storage?.kind === 'mongo'
    ? v.storage.kind : 'table';
  // ③-layer gated entry (table-channel rewriter input; decision views only)
  const gatedEntry = (canonical.gatedReadModels ?? []).find((m) => m.name === v.name) ?? null;
  // rewriter keys = the ③-layer gated field DECLARATION order (gen_projection_handlers v.fields)
  const rmFields = gatedEntry?.fields ?? [];
  const keysDecl = rmFields.filter((f) => f.isKey).map((f) => f.name);

  // DTO fields: sorted by name (readModelSchema order); Instant → Option[Instant]
  const dtoFields = [...v.fields]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f) => ({ ...f, id: id(f.name), sig: dtoSigOf(f.dataType, f.nullable) }));

  // assembly idNames rule (AssemblyEngine:605-609)
  const keyNames = dtoFields.filter((f) => f.isKey).map((f) => f.name);
  const idNames = [
    ...dtoFields.map((f) => f.name).filter((n) => !keyNames.includes(n) && n.endsWith('Id')),
    ...(keyNames.length > 1 ? keyNames.filter((n) => n.endsWith('Id')) : []),
  ].filter((n, i, arr) => arr.indexOf(n) === i).sort();

  // events in LINK order with their owning aggregates (eventAgg: roster ∪ metarch links).
  // Duplicate links dedupe first-wins (ParkConcept carries ConceptEstablished twice — the
  // engine's handler registry is per (view, event) and the def wiring lists it once).
  const eventNoteIds = canonical.eventNoteIds ?? {};
  const seenEvents = new Set();
  const events = v.events.filter((ev) => (seenEvents.has(ev) ? false : (seenEvents.add(ev), true))).map((ev) => {
    const agg = eventAgg[ev];
    if (!agg) throw new Error(`projection view ${v.name}: event ${ev} has no owning aggregate (eventAgg)`);
    return { name: ev, agg, noteId: eventNoteIds[ev] ?? null, handler: `${v.name}On${ev}Handler`, poObj: `${agg}EventPO`, poPkg: `net.imadz.metarch.infrastructure.proto.${snake(agg)}` };
  });
  // primary/source aggregate: the ③-layer sourceAggregate (OpenSession links list Stage
  // first but its sourceAggregate is Session) — links order only as fallback (vector/graph
  // views have no ③-layer entry; their first aggregate link is the primary).
  const primaryAgg = gatedEntry?.sourceAggregate ?? v.aggregates[0] ?? events[0]?.agg;
  // per-aggregate groups, primary first, then first-appearance in link order. Plurality of
  // the note's `aggregate:` links switches the def to the multi-aggregate FORM (per-source
  // sourceProvider/createProjectionFor/composite), but only event-bearing groups emit
  // anything (OpenSessionDecisionView: sourceAggregates [Session, Stage], Stage has zero
  // handlers → one Session section, no StageAggregate/StageEventPO imports).
  const aggOrder = [primaryAgg, ...v.aggregates.slice(1), ...events.map((e) => e.agg)]
    .filter((a, i, arr) => arr.indexOf(a) === i);
  const aggGroups = aggOrder.map((agg) => ({
    agg,
    poObj: `${agg}EventPO`,
    poPkg: `net.imadz.metarch.infrastructure.proto.${snake(agg)}`,
    events: events.filter((e) => e.agg === agg),
  }));
  const activeGroups = aggGroups.filter((g) => g.events.length > 0);

  // storage facts
  const storage = v.storage ?? {};
  const burnableEdges = (storage.edgeMappings ?? []).filter((e) => e.relationKey === storage.nodeKey && (e.toKeyId ?? '').trim() !== '');

  return {
    name: v.name,
    noteId: v.noteId ?? null,
    storageKind,
    storage,
    burnableEdges,
    refCodes: v.refCodes ?? {},
    updateOnlyEvents: v.updateOnlyEvents ?? [],
    consumesEvents: gatedEntry?.consumesEvents ?? null,
    fieldsMeta: v.fields,                       // ①-layer declaration order (vector/graph channels)
    rmFields, keysDecl,                         // ③-layer gated (table channel)
    dtoFields, keyNames, idNames,
    events, primaryAgg, aggGroups, activeGroups,
    isComposite: events.length > 1,
    isMultiAgg: v.aggregates.length > 1,
    families: gatedEntry?.sourceAggregates ?? [],
    repoParam: decap(v.name) + 'Repository',
    projectionId: v.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
  };
}

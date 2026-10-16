// protos.mjs — the persistence-contract proto face (V4-16 inc-b), ported from
// AggregateRootProtoBuilder + ProtoTypeMapper: per-aggregate <Agg>.proto (event POs + oneof
// event union + StatePO, tenant-stamped) + the cross-aggregate shared_value_objects.proto.
// VO message ownership = union-find over VO composition components (AggregateRootProtoBuilder
//.voOwnerMap verbatim): a component referenced by exactly one aggregate is local to it (its
// message rides that aggregate's proto); ≥2 referencing aggregates (or zero) → the shared
// file. Input: canonical.aggregates (stateFields/events payloads with noteId) + canonical.
// voCatalog (RAW fieldTree form).
import { scalaSig } from './types.mjs';

const PROTO_PKG = 'net.imadz.metarch.infrastructure.proto';
const PRIMITIVES = new Set(['String', 'Int', 'Long', 'Double', 'Boolean', 'BigDecimal', 'Date', 'DateTime', 'UUID', 'Id', 'Currency']);

export const toSnakeCase = (name) => {
  if (!name) return name;
  let out = name[0].toLowerCase();
  for (let i = 1; i < name.length; i++) {
    const c = name[i];
    out += c >= 'A' && c <= 'Z' ? `_${c.toLowerCase()}` : c;
  }
  return out;
};
const protoFileName = (agg) => `${toSnakeCase(agg)}.proto`;
const lowerCamel = (s) => (s ? s[0].toLowerCase() + s.slice(1) : '');

// dataType → { name, params } — the TypeRef face the builder walks (params nested one level).
function typeRefOf(sig) {
  const m = sig.match(/^(List|Option|Seq|Map)\[(.+)\]$/);
  if (!m) return { name: sig, params: [] };
  if (m[1] === 'Map') {
    const [k, v] = splitTop(m[2]);
    return { name: 'Map', params: [{ name: k, params: [] }, { name: v, params: [] }] };
  }
  return { name: m[1], params: [typeRefOf(m[2])] };
}
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// scalaSig + optional wrap (TypeResolver.resolveField) — the VO/event branch; the state branch
// resolves WITHOUT the optional wrap (builder line 302 resolve, not resolveField).
const sigOf = (f, wrapOptional) => (wrapOptional && f.optional ? `Option[${scalaSig(f.dataType)}]` : scalaSig(f.dataType));

// ProtoTypeMapper.toProtoTypeString — Option/List/Map handled by toProtoField; this maps the leaf.
const protoTypeOf = (t) => {
  switch (t.name) {
    case 'String': case 'Id': case 'UUID': case 'Currency': return 'string';
    case 'Int': return 'int32';
    case 'Long': case 'Instant': return 'int64';
    case 'Double': case 'BigDecimal': return 'double';
    case 'Boolean': return 'bool';
    default: return `${PROTO_PKG}.${t.name}PO`;
  }
};

// toProtoField: Map → map<k,v>; Option[List[X]] → repeated (proto3 forbids optional repeated);
// Option[X] → optional; List/Seq → repeated; else plain. comment (introducedIn) + noteId fuse
// into the one-line `//` suffix.
function toProtoField(name, t, index, { comment, noteId, anchor }) {
  const suffixParts = [];
  if (comment) suffixParts.push(comment);
  if (noteId) suffixParts.push(`@knowledge ${noteId}${anchor(noteId)}`);
  const suffix = suffixParts.length ? ` // ${suffixParts.join(' ')}` : '';
  const field = (type, { repeated = false, optional = false } = {}) =>
    ({ decl: `  ${repeated ? 'repeated ' : optional ? 'optional ' : ''}${type} ${name} = ${index};${suffix}`, name });
  if (t.name === 'Map' && t.params.length === 2) {
    return { decl: `  map<${protoTypeOf(t.params[0])}, ${protoTypeOf(t.params[1])}> ${name} = ${index};${suffix}`, name };
  }
  if (t.name === 'Option' && t.params.length === 1) {
    const inner = t.params[0];
    if (inner.name === 'List' || inner.name === 'Seq') return field(protoTypeOf(inner.params[0]), { repeated: true });
    return field(protoTypeOf(inner), { optional: true });
  }
  if (t.name === 'List' || t.name === 'Seq') return field(protoTypeOf(t.params[0]), { repeated: true });
  return field(protoTypeOf(t));
}

// Scala 2.13 element hashing + CHAMP set order — VERIFIED against the real scala-library
// 2.13.5 runner (the engine's `referencedTypes.toSet.toSeq` order for the do_r/rmd/fsm local
// VO sets). TypeRef is a 3-field product: case-class hashCode = MurmurHash3.productHash over
// anyHash of (name, packageName, typeParams); String anyHash = Java hashCode; Seq anyHash =
// MurmurHash3.seqHash (Nil = "Seq".hashCode); finalize = avalanche(h ^ arity). HashSet
// iterates ascending 5-bit chunks of Hashing.improve(hash).
const i32 = (x) => x | 0;
const rotl = (h, n) => i32((h << n) | (h >>> (32 - n)));
const mix = (h, data) => {
  let k = Math.imul(data, 0xcc9e2d51);
  k = rotl(k, 15);
  k = Math.imul(k, 0x1b873593);
  h = i32(h ^ k);
  return i32(Math.imul(rotl(h, 13), 5) + 0xe6546b64);
};
const avalanche = (h) => {
  h = i32(h ^ (h >>> 16));
  h = Math.imul(h, 0x85ebca6b);
  h = i32(h ^ (h >>> 13));
  h = Math.imul(h, 0xc2b2ae35);
  h = i32(h ^ (h >>> 16));
  return h;
};
const javaStringHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = i32(Math.imul(h, 31) + s.charCodeAt(i));
  return h;
};
const seqHash = (elems) => {
  let h = javaStringHash('Seq');
  for (const e of elems) h = mix(h, e);
  return avalanche(i32(h ^ elems.length));
};
const VO_PKG = 'net.imadz.metarch.domain.values';
const typeRefHash = (t) => {
  // ScalaRunTime._hashCode → MurmurHash3.productHash WITH the productPrefix mixed in first
  let h = i32(0xcafebabe);
  h = mix(h, javaStringHash('TypeRef'));
  h = mix(h, javaStringHash(t.name));
  h = mix(h, javaStringHash(t.packageName ?? ''));
  h = mix(h, seqHash((t.params ?? []).map(typeRefHash)));
  return avalanche(i32(h ^ 3));
};
// scala.collection.mutable.HashSet (the engine's `vos.toSet` source) is a FLAT TABLE, not a
// CHAMP trie: bucket = (h ^ h >>> 16) & (table.length - 1) — java.util.HashMap-style improve —
// buckets iterate ascending, within a bucket entries are kept ascending by full improved hash.
// Table length = power of two from 16, resized when n exceeds 0.75 * length (verified against
// scala-library 2.13.5 for the do_r / fsm_definition / read_model_definition local sets).
const spreadHash = (h) => i32(h ^ (h >>> 16));
const tableLenFor = (n) => {
  let len = 16;
  while (n > Math.floor(len * 0.75)) len *= 2;
  return len;
};
const tableOrderCompare = (hashA, hashB, len) => {
  const ia = spreadHash(hashA), ib = spreadHash(hashB);
  const ba = ia & (len - 1), bb = ib & (len - 1);
  if (ba !== bb) return ba - bb;
  return ia < ib ? -1 : ia > ib ? 1 : 0;
};
function collectReferencedVos(typeRefs, voNames, voByName, out) {
  const scan = (t) => {
    if (t.params.length) t.params.forEach(scan);
    if (PRIMITIVES.has(t.name) || t.name.startsWith('java.') || t.name.startsWith('scala.')) return;
    if (voNames.has(t.name) && !out.has(t.name)) {
      out.add(t.name);
      for (const f of voByName.get(t.name).fields ?? []) scan(typeRefOf(scalaSig(f.dataType)));
    }
  };
  typeRefs.forEach(scan);
  return [...out];
}

const voRefsIn = (types, voNames) => {
  const found = new Set();
  for (const t of types) for (const n of voNames) if (new RegExp(`\\b${n}\\b`).test(t)) found.add(n);
  return found;
};

// voOwnerMap: union-find over composition edges; owner = single referencing aggregate, else ''
// (shared/cold). Aggregate reference face = state + event payload types (state counts).
export function voOwnerMap(canonical) {
  const voNames = new Set((canonical.voCatalog ?? []).map((v) => v.name));
  const voByName = new Map((canonical.voCatalog ?? []).map((v) => [v.name, v]));
  // The engine's voMetas = fm VOs ∪ the assembler's per-entity state VOs (`<Agg>State`,
  // ValueObjectMetadata(stateName, ident +: state fields)) — the state VOs join the union-find
  // and their composition edges (state field → VO) move whole components.
  const stateVoOf = (a) => `${a.name}State`;
  const parent = new Map([...voNames].map((n) => [n, n]));
  const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const vo of canonical.voCatalog ?? []) {
    for (const f of vo.fields ?? []) {
      const t = typeRefOf(scalaSig(f.dataType));
      const refs = new Set();
      collectReferencedVos([t], voNames, voByName, refs);
      for (const r of refs) if (r !== vo.name) union(vo.name, r);
    }
  }
  // register the state-VO nodes FIRST (getOrElseUpdate semantics — a late registration would
  // let union() chase an unregistered key into a corrupted shared root and weld every
  // component together)
  for (const a of canonical.aggregates ?? []) {
    if (!parent.has(stateVoOf(a))) parent.set(stateVoOf(a), stateVoOf(a));
  }
  for (const a of canonical.aggregates ?? []) {
    for (const f of a.stateFields ?? []) {
      const refs = new Set();
      collectReferencedVos([typeRefOf(scalaSig(f.dataType))], voNames, voByName, refs);
      for (const r of refs) union(stateVoOf(a), r);
    }
  }
  const refAggs = new Map();
  for (const a of canonical.aggregates ?? []) {
    const types = [
      ...(a.stateFields ?? []).map((f) => scalaSig(f.dataType)),
      ...(a.events ?? []).flatMap((e) => (e.payloads ?? []).map((f) => scalaSig(f.dataType))),
    ];
    for (const n of voRefsIn(types, voNames)) {
      const root = find(n);
      if (!refAggs.has(root)) refAggs.set(root, new Set());
      refAggs.get(root).add(a.name);
    }
  }
  const owners = new Map();
  for (const n of voNames) {
    const aggs = refAggs.get(find(n));
    owners.set(n, aggs && aggs.size === 1 ? [...aggs][0] : '');
  }
  return owners;
}

const voMessageFields = (vo, env) => (vo.fields ?? []).map((f, i) =>
  toProtoField(f.name, typeRefOf(sigOf(f, true)), i + 1, { comment: f.introducedIn?.trim() || null, noteId: f.noteId ?? null, anchor: env.anchor }).decl);

// Per-aggregate proto model + the shared file model. Event order = canonical events order;
// state fields = nature-excluded, name-deduped first-wins (assembly-defense port).
export function protoModels(canonical, env) {
  const voNames = new Set((canonical.voCatalog ?? []).map((v) => v.name));
  const voByName = new Map((canonical.voCatalog ?? []).map((v) => [v.name, v]));
  const owners = voOwnerMap(canonical);
  const stateVoNames = new Set((canonical.aggregates ?? []).map((a) => `${a.name}State`));
  const excluded = new Set(env.excludedStateFieldNatures ?? []);
  const sharedVos = [...owners.entries()].filter(([n, o]) => o === '' && !stateVoNames.has(n)).map(([n]) => n).sort();
  const sharedMessageNames = new Set(sharedVos.map((n) => `${n}PO`));

  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    const stateFields = [];
    const seen = new Set();
    for (const f of a.stateFields ?? []) {
      if (f.nature && excluded.has(f.nature)) continue;
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      stateFields.push(f);
    }
    const stateRefSet = new Set();
    collectReferencedVos(stateFields.map((f) => typeRefOf(scalaSig(f.dataType))), voNames, voByName, stateRefSet);
    const evts = (a.events ?? []).map((e) => ({
      name: e.name,
      fields: (e.payloads ?? []).map((f) => ({ f, t: typeRefOf(sigOf(f, true)) })),
    }));
    const evtRefSet = new Set();
    collectReferencedVos(evts.flatMap((e) => e.fields.map(({ t }) => t)), voNames, voByName, evtRefSet);
    const referenced = [...stateRefSet, ...[...evtRefSet].filter((n) => !stateRefSet.has(n))];

    // engine: referencedTypes.toSeq iterates the mutable HashSet flat-table order — local
    // message order follows it (the builder keeps the Set order verbatim)
    const voTypeRef = (n) => ({ name: n, packageName: VO_PKG, params: [] });
    const referencedTypes = referenced.map(voTypeRef);
    const len = tableLenFor(referencedTypes.length);
    const localVoNames = referencedTypes
      .filter((t) => owners.get(t.name) === a.name && !sharedMessageNames.has(`${t.name}PO`))
      .sort((x, y) => tableOrderCompare(typeRefHash(x), typeRefHash(y), len))
      .map((t) => t.name);
    const localMessages = localVoNames.map((n) => ({ name: `${n}PO`, fields: voMessageFields(voByName.get(n), env) }));

    const tenantStamp = a.name !== 'User';
    const eventMsgs = evts.map((e) => {
      let fields = e.fields.map(({ f, t }, i) => toProtoField(f.name, t, i + 1, { comment: f.introducedIn?.trim() || null, noteId: f.noteId ?? null, anchor: env.anchor }));
      if (tenantStamp && !e.fields.some(({ f }) => f.name === 'tenantId')) {
        fields = [...fields, { decl: `  string tenantId = ${e.fields.length + 1};`, name: 'tenantId', bare: true }];
      }
      return { name: `${e.name}PO`, fields: fields.map((x) => x.decl) };
    });

    const unionName = `${a.name}EventPO`;
    const oneofFields = eventMsgs.map((m, i) => `    ${m.name} ${lowerCamel(m.name.slice(0, -2))} = ${i + 1};`);

    const voImports = referenced
      .filter((n) => !localVoNames.includes(n))
      .map((n) => (owners.get(n) === '' ? 'shared_value_objects.proto' : protoFileName(owners.get(n))))
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort();

    entries.push({
      path: `app/protobuf/${protoFileName(a.name)}`,
      kind: 'proto',
      families: [a.name],
      noteIds: a.noteId ? [a.noteId] : [],
      schemaNode: a.name,
      deps: [],
      imports: voImports,
      messages: [
        ...localMessages.map((m) => ({ ...m, oneof: null })),
        ...eventMsgs.map((m) => ({ ...m, oneof: null })),
        { name: unionName, fields: [], oneof: { name: 'event', fields: oneofFields } },
        { name: `${a.name}StatePO`, fields: stateFields.map((f, i) => toProtoField(f.name, typeRefOf(scalaSig(f.dataType)), i + 1, { comment: f.introducedIn?.trim() || null, noteId: f.noteId ?? null, anchor: env.anchor }).decl), oneof: null },
      ],
    });
  }

  if (sharedVos.length) {
    entries.push({
      path: 'app/protobuf/shared_value_objects.proto',
      kind: 'proto-shared',
      families: [],
      noteIds: [],
      schemaNode: 'shared_value_objects',
      deps: [],
      imports: [],
      messages: sharedVos.map((n) => ({ name: `${n}PO`, fields: voMessageFields(voByName.get(n), env), oneof: null })),
    });
  }
  return entries;
}

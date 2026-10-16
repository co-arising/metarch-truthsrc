// persistence.mjs — the persistence face (V4-17): per-aggregate Event/SnapshotAdapter
// (AggregateAdapterBuilder) + the <Agg>ProtoConverters trait (AggregateConverterBuilder).
// Adapters: the dependency set → sorted-distinct FQN import lines; the snapshot adapter's
// framework import is emitted TWICE (baseImports ++ additionalImports without a second dedup —
// the live tree carries the duplicate line, kept verbatim). Converters: dependent VOs = the
// deep VO closure over state + event payload types minus the aggregate's own state (sorted by
// VO name), then events in canonical order, then the state converter (nature fields excluded);
// per-field conversion logic follows AggregateConverterTemplate.resolveConversion; PO types
// resolve through the proto face's voOwnerMap/shared set (a VO's PO lives in its host
// aggregate's proto package, shared VOs in shared_value_objects).
import { scalaSig, parseType } from './types.mjs';
import { PROTO_PKG, toSnakeCase, typeRefOf, collectReferencedVos, voOwnerMap } from './protos.mjs';

const PERSIST_PKG = 'net.imadz.metarch.infrastructure.persistence';
const CONVERTERS_PKG = `${PERSIST_PKG}.converters`;
const ENTITIES_ROOT = 'net.imadz.metarch.domain.entities';
const DOMAIN_VALUES = 'net.imadz.metarch.domain.values';
const PRIMITIVE_CONVERTER = 'net.imadz.common.serialization.PrimitiveConverter';
const eventPackageOf = (agg) => `${PROTO_PKG}.${toSnakeCase(agg)}`;
const entityObjectPath = (agg) => `${ENTITIES_ROOT}.${agg}Entity`;

// SCALA_KEYWORDS (NamingConventions) — scalaIdentifier backtick-escapes these.
const SCALA_KEYWORDS = new Set([
  'type', 'object', 'class', 'trait', 'def', 'val', 'var', 'for', 'while', 'if', 'else',
  'match', 'case', 'import', 'package', 'extends', 'with', 'new', 'return', 'throw',
  'try', 'catch', 'finally', 'null', 'true', 'false', 'this', 'super', 'sealed',
  'implicit', 'lazy', 'override', 'private', 'protected', 'abstract', 'final', 'yield', 'do',
]);
const scalaIdentifier = (name) => (SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name);

// TypeResolver.resolveField: scalaSig + the optional wrap; the resolved tree (packages) feeds
// the import set, the same name tree feeds the conversion switch.
const sigOf = (f) => (f.optional ? `Option[${scalaSig(f.dataType)}]` : scalaSig(f.dataType));
function resolveTree(sig) {
  const { base, params } = parseType(sig);
  const rp = params.map(resolveTree);
  switch (base) {
    case 'String': case 'Int': case 'Long': case 'Boolean': case 'Double': return { name: base, pkg: '', params: rp };
    case 'BigDecimal': return { name: 'BigDecimal', pkg: 'scala.math', params: rp };
    case 'Id': return { name: 'Id', pkg: 'net.imadz.common.CommonTypes', params: rp };
    case 'Instant': return { name: 'Instant', pkg: 'java.time', params: rp };
    case 'Option': return { name: 'Option', pkg: 'scala', params: rp };
    case 'List': case 'Seq': case 'Set': case 'Map': return { name: base, pkg: 'scala.collection.immutable', params: rp };
    default: return { name: base, pkg: DOMAIN_VALUES, params: rp };
  }
}
const fqnOf = (t) => (t.pkg ? `${t.pkg}.${t.name}` : t.name);
function collectDeps(t, out = []) {
  out.push(fqnOf(t));
  t.params.forEach((p) => collectDeps(p, out));
  return out;
}

// AggregateConverterTemplate.resolveConversion — per-field conversion logic.
const convObjOf = (t) =>
  t.name === 'String' ? 'StringConv' : t.name === 'Id' ? 'IdConv' : t.name === 'Currency' ? 'CurrencyConv' : `${t.name}Conv`;
function resolveConversion(t, fieldName, isToProto) {
  const safe = scalaIdentifier(fieldName);
  const v = `${isToProto ? 'd' : 'p'}.${safe}`;
  switch (t.name) {
    case 'String': case 'Long': case 'Int': case 'Double': case 'Boolean': return v;
    case 'BigDecimal': return isToProto ? `${v}.doubleValue` : `BigDecimal(${v})`;
    case 'Id': return isToProto ? `IdConv.toProto(${v})` : `IdConv.fromProto(${v})`;
    case 'Currency': return isToProto ? `CurrencyConv.toProto(${v})` : `CurrencyConv.fromProto(${v})`;
    case 'Instant': return isToProto ? `InstantConv.toProto(${v})` : `InstantConv.fromProto(${v})`;
    case 'Option': {
      const inner = t.params[0];
      if (inner.name === 'Boolean') return v;
      if (inner.name === 'List' || inner.name === 'Seq') {
        const elemConv = convObjOf(inner.params[0]);
        return isToProto ? `${v}.getOrElse(Nil).map(${elemConv}.toProto)` : `Some(${v}.map(${elemConv}.fromProto).toList)`;
      }
      const innerConv = convObjOf(inner);
      return isToProto ? `${v}.map(${innerConv}.toProto)` : `${v}.map(${innerConv}.fromProto)`;
    }
    case 'List': case 'Seq': case 'Set': {
      const innerConv = convObjOf(t.params[0]);
      return isToProto ? `${v}.map(${innerConv}.toProto)` : `${v}.map(${innerConv}.fromProto).toList`;
    }
    case 'Map': {
      const kConv = convObjOf(t.params[0]);
      const vConv = convObjOf(t.params[1]);
      return isToProto ? `toProtoMap(${v}, ${kConv}, ${vConv})` : `fromProtoMap(${v}, ${kConv}, ${vConv})`;
    }
    default: {
      const conv = convObjOf(t);
      return isToProto
        ? `Some(${conv}.toProto(${v}))`
        : `${conv}.fromProto(${v}.getOrElse(throw new IllegalArgumentException(s"Missing required field: ${fieldName}")))`;
    }
  }
}

// S4 converter field anchor: the `// @knowledge <id>@<hash>` comment line directly above the
// named-arg line; un-anchored (synthetic) fields emit no comment. annotateKnowledge appends the
// hash suffix (empty when the element hash is missing) — the comment line itself always rides
// a present noteId.
const argOf = (f, isToProto, env) => {
  const argLine = `${scalaIdentifier(f.name)} = ${resolveConversion(resolveTree(sigOf(f)), f.name, isToProto)}`;
  return f.noteId
    ? `// @knowledge ${f.noteId}${env.anchor(f.noteId)}\n      ${argLine}`
    : argLine;
};

// AggregateConverterBuilder: converters = VOs (sorted by name) ++ events ++ state.
export function converterModel(a, canonical, env) {
  const protoPackage = eventPackageOf(a.name);
  const entityPkg = entityObjectPath(a.name);
  const stateName = `${a.name}State`;
  const voNames = new Set((canonical.voCatalog ?? []).map((v) => v.name));
  const voByName = new Map((canonical.voCatalog ?? []).map((v) => [v.name, v]));
  const owners = voOwnerMap(canonical);
  const stateVoNames = new Set((canonical.aggregates ?? []).map((x) => `${x.name}State`));
  const sharedVoNames = new Set([...owners.entries()].filter(([n, o]) => o === '' && !stateVoNames.has(n)).map(([n]) => n));
  const excluded = new Set(env.excludedStateFieldNatures ?? []);

  // dependent VOs: deep closure over state (unfiltered roots) + event payload types, minus the
  // aggregate's own state (Id/Currency never enter the catalog).
  const roots = [
    ...(a.stateFields ?? []).map((f) => resolveTree(sigOf(f))),
    ...(a.events ?? []).flatMap((e) => (e.payloads ?? []).map((f) => resolveTree(sigOf(f)))),
  ];
  const depSet = new Set();
  collectReferencedVos(roots, voNames, voByName, depSet);
  depSet.delete(stateName);
  const dependentVos = [...depSet].sort();

  const fieldsOf = (fields) => (fields ?? []).map((f) => ({
    f,
    toArg: argOf(f, true, env),
    fromArg: argOf(f, false, env),
    deps: collectDeps(resolveTree(sigOf(f)), []),
  }));
  const converters = [];
  const deps = new Set([PRIMITIVE_CONVERTER]);

  for (const voName of dependentVos) {
    const vo = voByName.get(voName);
    const hostPkg = sharedVoNames.has(voName)
      ? `${PROTO_PKG}.shared_value_objects`
      : owners.get(voName)
        ? eventPackageOf(owners.get(voName))
        : protoPackage;
    converters.push({ objectName: `${voName}Conv`, participantName: voName, poName: `${voName}PO`, participantFqn: `${DOMAIN_VALUES}.${voName}`, poFqn: `${hostPkg}.${voName}PO`, fields: fieldsOf(vo.fields) });
  }
  for (const e of a.events ?? []) {
    converters.push({ objectName: `${e.name}Conv`, participantName: e.name, poName: `${e.name}PO`, participantFqn: `${entityPkg}.${e.name}`, poFqn: `${protoPackage}.${e.name}PO`, fields: fieldsOf(e.payloads) });
  }
  const stateFields = (a.stateFields ?? []).filter((f) => !(f.nature && excluded.has(f.nature)));
  converters.push({ objectName: `${stateName}Conv`, participantName: stateName, poName: `${stateName}PO`, participantFqn: `${entityPkg}.${stateName}`, poFqn: `${protoPackage}.${stateName}PO`, fields: fieldsOf(stateFields) });

  for (const c of converters) {
    deps.add(c.participantFqn);
    deps.add(c.poFqn);
    for (const { deps: fd } of c.fields) fd.forEach((d) => deps.add(d));
  }
  // filterDependencies: drop empty/java.lang/scala packages and the primitive names — note
  // scala.collection.immutable (List/Map) is NOT the `scala` package and survives.
  const imports = [...deps]
    .filter((d) => {
      const pkg = d.slice(0, d.lastIndexOf('.'));
      const name = d.slice(d.lastIndexOf('.') + 1);
      return pkg !== 'java.lang' && pkg !== 'scala' && pkg !== ''
        && !['String', 'Long', 'Int', 'Double', 'Boolean', 'Unit', 'Any'].includes(name);
    })
    .sort()
    .filter((v, i, arr) => arr.indexOf(v) === i);

  return { name: `${a.name}ProtoConverters`, pkg: CONVERTERS_PKG, imports, converters, noteIds: a.noteId ? [a.noteId] : [] };
}

// AggregateAdapterBuilder.buildEventAdapter — the import set is sorted-distinct FQNs.
export function eventAdapterModel(a, env) {
  const entityPkg = entityObjectPath(a.name);
  const protoPkg = eventPackageOf(a.name);
  const convTrait = `${CONVERTERS_PKG}.${a.name}ProtoConverters`;
  const deps = new Set([
    'akka.persistence.typed.EventAdapter',
    'akka.persistence.typed.EventSeq',
    `${entityPkg}.${a.name}Event`,
    `${protoPkg}.${a.name}EventPO`,
    `${protoPkg}.${a.name}EventPO.Event`,
    convTrait,
    ...(a.events ?? []).map((e) => `${entityPkg}.${e.name}`),
  ]);
  return {
    name: `${a.name}EventAdapter`, pkg: PERSIST_PKG, imports: [...deps].sort(),
    scalaRoot: `${a.name}Event`, protoRoot: `${a.name}EventPO.Event`, oneOfParent: `${a.name}EventPO.Event`,
    convTrait: `${a.name}ProtoConverters`,
    mappings: (a.events ?? []).map((e) => e.name),
    noteIds: a.noteId ? [a.noteId] : [],
  };
}

// AggregateAdapterBuilder.buildSnapshotAdapter — the framework import rides the dependency set
// AND the template's additionalImports (no second dedup) → the live file's duplicate line.
export function snapshotAdapterModel(a) {
  const entityPkg = entityObjectPath(a.name);
  const protoPkg = eventPackageOf(a.name);
  const stateName = `${a.name}State`;
  const deps = new Set([
    'akka.persistence.typed.SnapshotAdapter',
    `${entityPkg}.${stateName}`,
    `${protoPkg}.${a.name}StatePO`,
    `${CONVERTERS_PKG}.${a.name}ProtoConverters`,
  ]);
  return {
    name: `${a.name}SnapshotAdapter`, pkg: PERSIST_PKG,
    // ImportDeclaration.code re-sorts the WHOLE list (DSL line 21) — the appended additional
    // import lands adjacent to its twin from the dependency set.
    imports: [...deps, 'akka.persistence.typed.SnapshotAdapter'].sort(),
    scalaRoot: stateName, protoRoot: `${a.name}StatePO`, convObj: `${stateName}Conv`,
    convTrait: `${a.name}ProtoConverters`,
    noteIds: a.noteId ? [a.noteId] : [],
  };
}

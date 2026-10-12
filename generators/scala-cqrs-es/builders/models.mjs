// builders/ — model builders: canonical atom → pure model object (no strings).
// Mirrors the internal Builder→Model→Template triad; templates render, builders decide.
import { kebab, scalaType } from './naming.mjs';

export function protocolModel(a) {
  const pkg = a.pkg ?? 'net.imadz';
  const base = `${pkg}.${a.ctxPackage ?? ''}.`;
  const name = a.name;
  const paramImports = [];
  for (const c of a.commands ?? [])
    for (const p of c.parameters ?? [])
      if (p.typeImport && !paramImports.includes(p.typeImport)) paramImports.push(p.typeImport);
  const replyName = (c) => (c.reply === 'aggregate' ? a.aggregateReply?.name : c.reply?.name ?? `${c.name}Confirmation`);
  const commands = (a.commands ?? []).map((c) => ({
    name: c.name,
    params: [...(c.parameters ?? []).map((p) => ({ name: p.name, type: scalaType(p.dataType) })),
      { name: 'replyTo', type: `ActorRef[${replyName(c)}]` }],
  }));
  const seen = new Set(); const replies = [];
  for (const c of a.commands ?? []) {
    const rn = replyName(c);
    if (seen.has(rn)) continue;
    seen.add(rn);
    replies.push({ name: rn, fields: (c.reply === 'aggregate' ? a.aggregateReply?.fields : c.reply?.fields) ?? [{ name: 'error', type: 'Option[iMadzError]' }] });
  }
  return { base, name, paramImports, commands, replies };
}

export function rootModel(a) {
  return {
    base: `${a.pkg ?? 'net.imadz'}.${a.ctxPackage ?? ''}.`,
    name: a.name,
    typeKey: a.persistence?.typeKey ?? a.name,
    tagCount: a.persistence?.tagCount ?? 5,
    tagPrefix: kebab(a.name),
  };
}

export function entityModel(a) {
  const base = `${a.pkg ?? 'net.imadz'}.${a.ctxPackage ?? ''}.`;
  const name = a.name;
  const voImports = [];                                  // first-appearance VO type imports (state fields + payloads)
  const see = (t) => { if (t && !voImports.includes(t)) voImports.push(t); };
  const fields = (a.stateFields ?? []).map((f) => {
    see(f.typeImport);
    return { name: f.name, type: scalaType(f.dataType), defaultValue: f.defaultValue };
  });
  const events = (a.events ?? []).map((e) => {
    for (const p of e.payloads ?? []) if (p.typeImport) see(p.typeImport);
    return { name: e.name, params: (e.payloads ?? []).map((p) => ({ name: p.name, type: scalaType(p.dataType) })) };
  });
  const idType = scalaType(a.identifierType ?? 'string (uuid)');
  const collectionImports = fields.some((f) => f.type.startsWith('Map[')) ? ['scala.collection.immutable.Map'] : [];
  const defaults = fields.some((f) => f.defaultValue) ? [...collectionImports] : [];
  const identifier = (a.stateFields ?? []).find((f) => f.name === a.identifier)?.name ?? a.identifier;
  return { base, name, voImports, fields, events, idType, collectionImports, defaults, identifier };
}

// Ruling A (2026-10-12): fold exprs beyond the state./param./literal: vocabulary are
// emitted verbatim as Scala expressions (fail-open — the generator never decides
// business semantics); cross-field helper calls get an AI_PROMPT stub synthesized
// from the aggregate's declared stateHelpers.
export function eventHandlerModel(a) {
  const base = `${a.pkg ?? 'net.imadz'}.${a.ctxPackage ?? ''}.`;
  const name = a.name;
  const javaImports = [], valueNames = new Set([`${name}Event`]);
  for (const h of a.stateHelpers ?? [])
    for (const p of h.params ?? []) {
      if (!p.typeImport) continue;
      if (p.typeImport.startsWith('java.')) { if (!javaImports.includes(p.typeImport)) javaImports.push(p.typeImport); }
      else valueNames.add(p.typeImport.replaceAll('"', ''));
    }
  for (const e of a.events ?? []) if (e.name) valueNames.add(e.name);
  // value imports: dotted refs pass through verbatim; simple names resolve into the aggregate values package; sorted
  const valueImports = [...valueNames]
    .map((n) => `import ${n.includes('.') ? n : `${base}domain.values.${n}`}`)
    .sort();
  const events = (a.events ?? [])
    .filter((e) => (e.foldAssignments ?? []).length)
    .map((e) => ({ name: e.name, folds: e.foldAssignments }));
  return { base, name, javaImports, valueImports, events, helpers: a.stateHelpers ?? [] };
}

export function repositoryModel(a) {
  const base = `${a.pkg ?? 'net.imadz'}.${a.ctxPackage ?? ''}.`;
  const name = a.name;
  return {
    base, name,
    implName: `${name}RepositoryImpl`,
    entityRefMethod: `  def entityRef(id: String): EntityRef[${name}AggregateCommandFamily]
  // Logic: sharding 实体引用（聚合隐式契约——对齐 gen_api_layer entityRef，2026-08-28 终局原则）`,
    finders: (a.repository?.finders ?? []).map((f) => ({
      name: f.name,
      param: `${f.param.name}: ${scalaType(f.param.dataType)}`,
      logic: f.logic ?? '通过 Sharding 获取聚合根引用',
    })),
  };
}

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

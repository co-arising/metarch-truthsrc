// scala-cqrs-es — reference generator (V4-2 increment 1: protocol + aggregate-root).
// Ported from the production CodegenMain template pair AggregateProtocolTemplate /
// AggregateRootTemplate (string-interpolation templates; golden master byte-verified).
// Canonical input slots consumed (beyond v0.3 vocabulary, all payload-pass-through):
//   aggregate.pkg, aggregate.ctxPackage, aggregate.entity, aggregate.identifier,
//   aggregate.aggregateReply { name, fields[{name,type}] }, aggregate.persistence { typeKey, tagCount },
//   command.reply { name?, fields[{name,type}] }   ("aggregate" → shared aggregateReply)
//   command.parameters[].typeImport (optional, feeds the import block)
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase();

function scalaType(dt) {
  if (dt === 'string (uuid)' || dt === 'uuid') return 'Id';
  return dt;
}

function protocol(a) {
  const pkg = a.pkg ?? 'net.imadz';
  const ctx = a.ctxPackage ?? '';
  const base = `${pkg}.${ctx}.`; // internal template interpolates the empty ctx segment verbatim (golden: net.imadz..application)
  const name = a.name;
  const paramImports = [];
  for (const c of a.commands ?? [])
    for (const p of c.parameters ?? [])
      if (p.typeImport && !paramImports.includes(p.typeImport)) paramImports.push(p.typeImport);
  const paramList = (c) =>
    [...(c.parameters ?? []).map((p) => `${p.name}: ${scalaType(p.dataType)}`), 'replyTo: ActorRef[' + (c.reply === 'aggregate' ? a.aggregateReply?.name : c.reply?.name ?? `${c.name}Confirmation`) + ']'].join(', ');
  const replyFields = (c) =>
    (c.reply === 'aggregate' ? a.aggregateReply?.fields : c.reply?.fields) ?? [{ name: 'error', type: 'Option[iMadzError]' }];
  const replyName = (c) => (c.reply === 'aggregate' ? a.aggregateReply?.name : c.reply?.name ?? `${c.name}Confirmation`);
  const commands = (a.commands ?? [])
    .map((c) => `  case class ${c.name}(${paramList(c)}) extends ${name}Command`).join('\n');
  // replies in first-appearance order, deduped
  const seen = new Set(); const replies = [];
  for (const c of a.commands ?? []) {
    const rn = replyName(c);
    if (seen.has(rn)) continue;
    seen.add(rn);
    replies.push(`  case class ${rn}(${replyFields(c).map((f) => `${f.name}: ${f.type}`).join(', ')}) extends CborSerializable`);
  }
  return `package ${base}application.aggregates

import akka.actor.typed.ActorRef
import ${base}domain.entities.${name}Entity.${name}State
import ${base}domain.values.${name}Event
${paramImports.map((i) => `import ${i}`).join('\n')}
import net.imadz.framework.common.CborSerializable
import net.imadz.framework.common.CommonTypes.Id
import net.imadz.framework.common.CommonTypes.iMadzError
import scala.collection.immutable.List

object ${name}Protocol {

  // Commands
  sealed trait ${name}Command extends CborSerializable
${commands}

  // Replies
${replies.join('\n')}



  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${name}CommandHandler = (${name}State, ${name}Command) => akka.persistence.typed.scaladsl.Effect[${name}Event, ${name}State]


}
`;
}

function root(a) {
  const pkg = a.pkg ?? 'net.imadz';
  const ctx = a.ctxPackage ?? '';
  const base = `${pkg}.${ctx}.`; // internal template interpolates the empty ctx segment verbatim (golden: net.imadz..application)
  const name = a.name;
  const typeKey = a.persistence?.typeKey ?? name;
  const tagCount = a.persistence?.tagCount ?? 5;
  return `package ${base}application.aggregates

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.scaladsl.Effect
import ${base}application.aggregates.behaviors.${name}Behaviors
import ${base}domain.entities.${name}Entity.${name}State
import ${base}domain.values.${name}Event

object ${name}Aggregate {

// Commands are defined in Protocol
// Replies are defined in Protocol




  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: ${base}application.aggregates.${name}CommandHandler = ${name}Behaviors.apply



  val entityTypeKey: EntityTypeKey[${name}Command] = EntityTypeKey("${typeKey}")
  val tags: Vector[String] = Vector.tabulate(${tagCount})(i => s"${kebab(name)}-$i")


}
`;
}

export function generate({ canonical }) {
  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    entries.push({
      path: `${(a.pkg ?? 'net.imadz').replaceAll('.', '/')}/application/aggregates/${a.name}Protocol.scala`,
      content: protocol(a), kind: 'protocol', schemaCategory: 'aggregate', families: [a.name], deps: [],
    });
    entries.push({
      path: `${(a.pkg ?? 'net.imadz').replaceAll('.', '/')}/application/aggregates/${a.name}Aggregate.scala`,
      content: root(a), kind: 'aggregate-root', schemaCategory: 'aggregate', families: [a.name], deps: [],
    });
  }
  return entries;
}

#!/usr/bin/env node
// ═══ aggregate-dsl emitter v4 — ingested-app 1:1 ═══
// Matches ingested-app / golden scala-cqrs-es-metarch pattern:
//
//   application/aggregates/<Name>Protocol.scala
//     — imports State/Event from domain.entities.<Name>Entity
//     — sealed trait <Name>CommandFamily + per-command case classes (replyTo: ActorRef[<Cmd>Reply])
//     — per-command <Cmd>Reply case classes
//     — type <Name>CommandHandlerFamily
//   application/aggregates/<Name>Aggregate.scala
//     — object with entityTypeKey + tags + commandHandler wiring
//   application/aggregates/behaviors/<Name>Behaviors.scala
//   application/aggregates/factories/<Name>AggregateFactory.scala
//   domain/entities/<Name>Entity.scala            (NEW v4)
//     — object <Name>Entity { case class <Name>State; def empty; sealed trait <Name>Event; event case classes; type <Name>EventHandler }
//   domain/entities/behaviors/<Name>EventHandler.scala  (NEW v4)
//     — object <Name>EventHandler { def apply ... event match ... }
//
// Spec: {package, name, objectName, stateType, eventType, stateFields,
//        commands: [{name, fields}], events: [{name, fields}],
//        commandHandlers: [{command}],
//        entityDir (abs path for domain/entities), entityPackage,
//        invariantPackage (for Behaviors rule import)}
// Usage: node emit.mjs <spec.json> <out-dir>
//   (out-dir = application/aggregates dir; entity files go to spec.entityDir)

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const [specPath, outPathArg] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
// outPath may be a marker file (run-all dir mode) — resolve to its directory
const outDir = outPathArg.endsWith(".scala") ? dirname(outPathArg) : outPathArg;

// dataType → Scala type signature — port of the old codegen's DataTypeMapper
// (generators/_deprecated/scala-cqrs-es/builders/types.mjs `scalaSig`, itself
//  ported from AssemblyEngine.scala:1035-1058). Case-insensitive match; the raw
//  spelling rides through for the custom/VO fallback so VO names survive.
// The spec carries RAW tree dataTypes ("List<CodeAnchorDelta>", "Instant",
// "String (UUID)", ...) — run-all passes them through raw for this generator.
// Legacy lowercase vocabulary ('string','number','integer','long','boolean',
// 'timestamp') also resolves, so standalone specs still work.
const scalaSig = (dataType) => {
  const raw = String(dataType ?? "").trim();
  const s = raw.toLowerCase();
  if (s === "string (uuid)" || s === "uuid") return "Id";
  if (s === "string") return "String";
  if (s === "int" || s === "integer") return "Int";
  if (s === "long" || s === "timestamp") return "Long";
  if (s === "double") return "Double";
  if (s === "boolean" || s === "bool") return "Boolean";
  if (s === "decimal" || s === "bigdecimal" || s === "number") return "BigDecimal";
  if (s === "instant" || s === "datetime") return "Instant";
  if (s === "string (enum)" || s === "enum") return "String"; // 枚举值以字符串承载
  if (s === "string (json)" || s === "json") return "String";
  if ((s.startsWith("list[") || s.startsWith("list<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSig(raw.slice(5, raw.length - 1))}]`; // recurse on raw slice (case preserved)
  if ((s.startsWith("array[") || s.startsWith("array<")) && (s.endsWith("]") || s.endsWith(">")))
    return `List[${scalaSig(raw.slice(6, raw.length - 1))}]`;
  return raw !== "" ? raw : "String"; // VO / custom type name verbatim; empty → String
};

// Field → "name: Type" (optional fields wrap in Option + "= None", ingested-app 1:1).
// NOTE: dataType is authoritative. The old name heuristic ("ends with Id → Id")
// misfires on 32 tree fields (e.g. tenantId with dataType "String" renders String
// in ingested-app; conceptIds with dataType "List<String>" renders List[String]).
const fieldDecl = (f) => {
  const sig = scalaSig(f.dataType);
  return f.optional ? `${f.name}: Option[${sig}] = None` : `${f.name}: ${sig}`;
};

const fieldsOf = (fields) =>
  (fields ?? []).map(fieldDecl).join(", ");

// Parse a Scala type signature into {base, params[]} — port of types.mjs parseType.
// e.g. "Map[String, Money]" → {base:'Map', params:['String','Money']}.
const parseType = (t) => {
  const s = t.trim();
  const lb = s.indexOf("[");
  if (lb === -1) return { base: s, params: [] };
  const base = s.slice(0, lb);
  const inner = s.slice(lb + 1, s.lastIndexOf("]"));
  const params = [];
  let depth = 0, cur = "";
  for (const ch of inner) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (ch === "," && depth === 0) { params.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) params.push(cur.trim());
  return { base, params };
};

const pascal = (s) =>
  String(s).split(/[-_ ]/).map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : "")).join("");

const objName = spec.objectName || pascal(spec.name || "Aggregate");
const pkg = spec.package || "generated.aggregate";
const entityPkg = spec.entityPackage || pkg.replace(/\.application\.aggregates$/, ".domain.entities");
const stateType = spec.stateType || `${objName}State`;
const eventType = spec.eventType || `${objName}Event`;
const commandFamily = `${objName}CommandFamily`;
const handlerFamily = `${objName}CommandHandlerFamily`;

const handled = new Set((spec.commandHandlers ?? []).map((h) => h.command));
const commands = spec.commands ?? [];
const events = spec.events ?? [];

// Protocol/Behaviors emission order (ingested-app 1:1, verified across all 27
// golden Protocols): non-Get commands alphabetical (codepoint), then the
// synthetic Get<Name>State query command last (alphabetical among themselves).
// Replies follow the same order. Golden Factory methods are NOT per-command
// (createXWithoutBalance/WithInitialValue), so factory order is moot there.
const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const orderedCommands = [
  ...commands.filter((c) => !c.name.startsWith("Get")).sort(byName),
  ...commands.filter((c) => c.name.startsWith("Get")).sort(byName),
];

// Value-object package. Golden: net.imadz.metarch.domain.values.<VO>.
// Derived from entityPkg, overridable via spec.valuesPackage.
const valuesPkg = spec.valuesPackage || entityPkg.replace(/\.domain\.entities$/, ".domain.values");

// Type-reference import computation — port of the old codegen's pkgOf + typeDeps
// (types.mjs): a field's Scala signature is walked; each base name maps to its
// owning package. Unknown base names are domain value objects (e.g.
// CodeAnchorDelta, GuardSpec) → imported from domain.values. Primitives/collections
// root (String, Int, Option, ...) import nothing. Golden's rule: one import per
// referenced VO (alphabetical with the rest of the block); java.time.Instant and
// scala.collection.immutable.List likewise data-driven.
// NOTE: golden's Entity repeats `scala.collection.immutable.List` once per DISTINCT
// List[X] TypeRef (an old-codegen multiset artifact). We intentionally emit it ONCE.
const typeImports = (fields) => {
  const fqns = [];
  const walk = (sig) => {
    const { base, params } = parseType(sig);
    let owner;
    if (base === "Id" || base === "iMadzError") owner = "net.imadz.common.CommonTypes";
    else if (base === "Instant") owner = "java.time";
    else if (["List", "Map", "Seq", "Set", "Vector"].includes(base)) owner = "scala.collection.immutable";
    else if (["String", "Int", "Long", "Double", "Float", "Boolean", "BigDecimal", "Option", "Unit"].includes(base)) owner = "";
    else owner = valuesPkg; // VO: caller never supplies typeImport, so bare type names are VOs
    if (owner) fqns.push(`${owner}.${base}`);
    params.forEach(walk);
  };
  for (const f of fields ?? []) {
    const sig = scalaSig(f.dataType);
    walk(f.optional ? `Option[${sig}]` : sig);
  }
  return [...new Set(fqns)];
};

const sortedImportBlock = (fqns) =>
  [...new Set(fqns)].sort().map((i) => `import ${i}`).join("\n");

// ═══ 1. Entity (domain/entities/<Name>Entity.scala) ═══
// Canonical home of State + Events. Protocol imports from here.

// State field → "name: Type"; List-typed state fields get `= List.empty`
// (ingested-app 1:1: 46 occurrences, all on *State case classes; events and
// commands carry no List defaults). Optional state fields keep `Option[T] = None`.
const stateFieldDecl = (f) => {
  const sig = scalaSig(f.dataType);
  if (f.optional) return `${f.name}: Option[${sig}] = None`;
  return sig.startsWith("List[") ? `${f.name}: ${sig} = List.empty` : `${f.name}: ${sig}`;
};
const fieldsOfState = (fields) => (fields ?? []).map(stateFieldDecl).join(", ");
const entityStateDef = `  case class ${stateType}(${fieldsOfState(spec.stateFields)})`;

// empty(): identity param (first state field, the aggregate's own Id) passed
// through; remaining fields get old-codegen type defaults. ingested-app 1:1
// over all 27 golden Entities (fully-qualified Id.of, never imported).
const ZERO_ID = `net.imadz.common.Id.of("00000000-0000-0000-0000-000000000001")`;
const emptyDefault = (f) => {
  if (f.optional) return "None";
  const sig = scalaSig(f.dataType);
  const base = sig.includes("[") ? sig.slice(0, sig.indexOf("[")) : sig;
  switch (base) {
    case "Id": return ZERO_ID;
    case "String": return '""';
    case "Int": return f.name === "order" ? "1" : "0"; // order is 1-based in golden (2/2); version → 0
    case "Long": return "0L";
    case "Double": return "0.0";
    case "BigDecimal": return 'BigDecimal("0")';
    case "Boolean": return "false";
    case "List": case "Seq": case "Set": case "Vector": return "Nil";
    case "Instant": return "null";
    default: return "null";
  }
};
const emptyDef = (() => {
  const sfs = spec.stateFields ?? [];
  if (sfs.length === 0) return `  def empty: ${stateType} = ???`;
  const [first, ...rest] = sfs;
  const firstSig = scalaSig(first.dataType);
  const args = [first.name, ...rest.map(emptyDefault)].join(", ");
  return `  def empty(${first.name}: ${firstSig}): ${stateType} = ${stateType}(${args})`;
})();

const entityEventDefs = events
  .map((e) => `  case class ${e.name}(${fieldsOf(e.fields)}) extends ${eventType}`)
  .join("\n");

// Entity imports: CborSerializable + data-driven Id/Instant/List/VO imports,
// alphabetical (ingested-app 1:1 modulo golden's duplicated List lines — see above).
const entityImportBlock = sortedImportBlock([
  "net.imadz.common.CborSerializable",
  ...typeImports([
    ...(spec.stateFields ?? []),
    ...events.flatMap((e) => e.fields ?? []),
  ]),
]);

const entity = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${entityPkg}

${entityImportBlock}

object ${objName}Entity {

${entityStateDef}

${emptyDef}

  sealed trait ${eventType} extends CborSerializable
${entityEventDefs}

  type ${objName}EventHandler = (${stateType}, ${eventType}) => ${stateType}

}
`;

// ═══ 2. EventHandler (domain/entities/behaviors/<Name>EventHandler.scala) ═══
const handlerCases = events
  .map(
    (e) => `    case event: ${e.name} =>
      /*
      >>> AI_PROMPT_START
      Context: Event Handler (state fold)
      Task: Fold event '${e.name}' into state
      State: ${stateType}
      Expected Result: Return updated state via state.copy(...)
      <<< AI_PROMPT_END
      */
      // ==== BEGIN MANUAL ====
      ???
      // ==== END MANUAL ====
`
  )
  .join("\n");

const eventHandler = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${entityPkg}.behaviors

import ${entityPkg}.${objName}Entity._
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${objName}EventHandler
import ${entityPkg}.${objName}Entity.${stateType}

object ${objName}EventHandler {
  def apply: ${objName}EventHandler = (state, event) => event match {
${handlerCases}
    case _ => state
  }
}
`;

// ═══ 3. Protocol (application/aggregates/<Name>Protocol.scala) ═══
// Commands + per-command Replies. State/Event imported from Entity.
// ingested-app 1:1: headers, Id import, nested type imports (alphabetical order)
const commandDefs = orderedCommands
  .map((c) => {
    const fields = fieldsOf(c.fields);
    const allFields = fields ? `${fields}, replyTo: ActorRef[${c.name}Reply]` : `replyTo: ActorRef[${c.name}Reply]`;
    return `  case class ${c.name}(${allFields}) extends ${commandFamily}`;
  })
  .join("\n");

const replyDefs = orderedCommands
  .map((c) => `  case class ${c.name}Reply(error: Option[iMadzError]) extends CborSerializable`)
  .join("\n");

// Protocol imports: fully alphabetical single block (ingested-app 1:1) —
// framework refs, nested Protocol types, Entity types, then data-driven
// Id / Instant / scala.collection.immutable.List / domain.values.* imports.
const protocolImportBlock = sortedImportBlock([
  "akka.actor.typed.ActorRef",
  "net.imadz.common.CborSerializable",
  "net.imadz.common.CommonTypes.iMadzError",
  `${pkg}.${objName}Protocol.${commandFamily}`,
  ...commands.map((c) => `${pkg}.${objName}Protocol.${c.name}Reply`),
  `${entityPkg}.${objName}Entity.${eventType}`,
  `${entityPkg}.${objName}Entity.${stateType}`,
  ...typeImports(commands.flatMap((c) => c.fields ?? [])),
]);

const protocol = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}

${protocolImportBlock}

object ${objName}Protocol {

  // Commands
  sealed trait ${commandFamily} extends CborSerializable
${commandDefs}

  // Replies
${replyDefs}

  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${handlerFamily} = (${stateType}, ${commandFamily}) => akka.persistence.typed.scaladsl.Effect[${eventType}, ${stateType}]

}
`;

// ═══ 4. Aggregate ═══
// ingested-app 1:1: headers, alphabetical imports, comments, tags = tabulate(1) "XxxTag$i"
const aggregate = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}

import akka.cluster.sharding.typed.scaladsl.EntityTypeKey
import akka.persistence.typed.scaladsl.Effect
import ${pkg}.${objName}Protocol.${commandFamily}
import ${pkg}.behaviors.${objName}Behaviors
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}

object ${objName}Aggregate {

// Commands are defined in Protocol
// Replies are defined in Protocol




  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: ${pkg}.${objName}Protocol.${handlerFamily} = ${objName}Behaviors.apply



  val entityTypeKey: EntityTypeKey[${commandFamily}] = EntityTypeKey("${objName}")
  val tags: Vector[String] = Vector.tabulate(1)(i => s"${objName}Tag$i")


}
`;

// ═══ 5. Behaviors ═══
const invariantPkg = spec.invariantPackage || `${pkg}.invariant`;
const hasHandled = commands.some((c) => handled.has(c.name));
const ruleImport = hasHandled ? `import ${invariantPkg}.${objName}Rules` : "";

const behaviorCases = orderedCommands
  .map((c) => {
    if (handled.has(c.name)) {
      const rule = `${objName}Rules.${c.name}Rule`;
      const helper = `${c.name}Helper`;
      return `    case cmd: ${c.name} => runReplyingPolicy(${rule}, ${helper})(state, cmd).replyWith(cmd.replyTo)`;
    } else {
      return `    case ${c.name}(replyTo) =>
      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '${c.name}'
      State: ${stateType}
      Available: repo
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */
      ???`;
    }
  })
  .join("\n");

const behaviors = `// @generated by rules_domain_gen:2026-08-23
// @knowledge-release 1.0.0
package ${pkg}.behaviors

import akka.persistence.typed.scaladsl.Effect
import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy
import ${pkg}.${objName}Protocol._
import ${entityPkg}.${objName}Entity.${eventType}
import ${entityPkg}.${objName}Entity.${stateType}
${ruleImport ? `${ruleImport}\n` : ""}
/**
 * ${objName} 命令流接线（rules_domain_gen.mjs 生成，2026-08-22）：
 * 每个命令 → runReplyingPolicy(规则, Helper)(state, cmd).replyWith(replyTo)；
 * 事件后置校验（EVENT_POSTCONDITION）经 withPost 挂点（persist 前校验事件载荷，失败 → 失败 reply）。
 */
object ${objName}Behaviors extends ${objName}CommandHelpers {

  type ${objName}AggregateCommandHandler = (${stateType}, ${commandFamily}) => Effect[${eventType}, ${stateType}]
  def apply: ${objName}AggregateCommandHandler = (state, command) => defaultBehaviors(state).apply(command)

  private def defaultBehaviors(state: ${stateType}): PartialFunction[${commandFamily}, Effect[${eventType}, ${stateType}]] = {
${behaviorCases}
  }

}
`;

// ═══ 6. Factory ═══
const factoryMethods = orderedCommands
  .map(
    (c) => `  def create${objName}For${c.name}(id: String): EntityRef[${commandFamily}] = {
    clusterSharding.entityRefFor(${objName}Aggregate.entityTypeKey, id)
  }`
  )
  .join("\n\n");

const factory = `// @generated by CodegenMain:225ed28b
// @knowledge-release 1.0.0
package ${pkg}.factories

import akka.cluster.sharding.typed.scaladsl.ClusterSharding
import akka.cluster.sharding.typed.scaladsl.EntityRef
import akka.util.Timeout
import javax.inject.Inject
import ${pkg}.${objName}Aggregate
import ${pkg}.${commandFamily}
import scala.concurrent.ExecutionContext
import scala.concurrent.duration._

/**
 * ${objName}AggregateFactory: creates ${objName} aggregate instances via cluster sharding
 */
class ${objName}AggregateFactory @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

${factoryMethods}

}
`;

// ═══ Write ═══
const behaviorsDir = join(outDir, "behaviors");
const factoriesDir = join(outDir, "factories");
mkdirSync(behaviorsDir, { recursive: true });
mkdirSync(factoriesDir, { recursive: true });

writeFileSync(join(outDir, `${objName}Protocol.scala`), protocol);
writeFileSync(join(outDir, `${objName}Aggregate.scala`), aggregate);
writeFileSync(join(behaviorsDir, `${objName}Behaviors.scala`), behaviors);
writeFileSync(join(factoriesDir, `${objName}AggregateFactory.scala`), factory);

// Entity files go to spec.entityDir (domain/entities tree)
if (spec.entityDir) {
  const entityBehDir = join(spec.entityDir, "behaviors");
  mkdirSync(spec.entityDir, { recursive: true });
  mkdirSync(entityBehDir, { recursive: true });
  writeFileSync(join(spec.entityDir, `${objName}Entity.scala`), entity);
  writeFileSync(join(entityBehDir, `${objName}EventHandler.scala`), eventHandler);
}

console.log(
  `aggregate-dsl: wrote ${objName}Protocol.scala, ${objName}Aggregate.scala, behaviors/${objName}Behaviors.scala, factories/${objName}AggregateFactory.scala` +
    (spec.entityDir ? `, entities/${objName}Entity.scala, entities/behaviors/${objName}EventHandler.scala` : "")
);

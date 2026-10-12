// templates/ — renderers: model → byte-exact Scala text. No decisions here.
import { kebab } from '../builders/naming.mjs';

export function renderProtocol(m) {
  const { base, name } = m;
  const commands = m.commands
    .map((c) => `  case class ${c.name}(${c.params.map((p) => `${p.name}: ${p.type}`).join(', ')}) extends ${name}Command`)
    .join('\n');
  const replies = m.replies
    .map((r) => `  case class ${r.name}(${r.fields.map((f) => `${f.name}: ${f.type}`).join(', ')}) extends CborSerializable`)
    .join('\n');
  return `package ${base}application.aggregates

import akka.actor.typed.ActorRef
import ${base}domain.entities.${name}Entity.${name}State
import ${base}domain.values.${name}Event
${m.paramImports.map((i) => `import ${i}`).join('\n')}
import net.imadz.framework.common.CborSerializable
import net.imadz.framework.common.CommonTypes.Id
import net.imadz.framework.common.CommonTypes.iMadzError
import scala.collection.immutable.List

object ${name}Protocol {

  // Commands
  sealed trait ${name}Command extends CborSerializable
${commands}

  // Replies
${replies}



  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${name}CommandHandler = (${name}State, ${name}Command) => akka.persistence.typed.scaladsl.Effect[${name}Event, ${name}State]


}
`;
}

export function renderRoot(m) {
  const { base, name } = m;
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



  val entityTypeKey: EntityTypeKey[${name}Command] = EntityTypeKey("${m.typeKey}")
  val tags: Vector[String] = Vector.tabulate(${m.tagCount})(i => s"${m.tagPrefix}-$i")


}
`;
}

export function renderEntity(m) {
  const { base, name, idType } = m;
  const state = `  case class ${name}State(${m.fields.map((f) => `${f.name}: ${f.type}${f.defaultValue ? ` = ${f.defaultValue}` : ''}`).join(', ')})`;
  const empty = `  def empty(${m.identifier}: ${idType}): ${name}State = ${name}State(${m.identifier}, ${m.fields.filter((f) => f.defaultValue).map((f) => f.defaultValue).join(', ')})`;
  const eventCases = m.events
    .map((e) => `  case class ${e.name}(${e.params.map((p) => `${p.name}: ${p.type}`).join(', ')}) extends ${name}Event`)
    .join('\n');
  const imports = [
    ...m.voImports.map((i) => `import ${i}`),
    'import net.imadz.framework.common.CborSerializable',
    `import net.imadz.framework.common.CommonTypes.Id`,
    ...m.collectionImports.map((i) => `import ${i}`),
    ...m.defaults.map((i) => `import ${i}`),
  ].join('\n');
  return `package ${base}domain.entities

${imports}

object ${name}Entity {
${state}

${empty}

  sealed trait ${name}Event extends CborSerializable

${eventCases}

  type ${name}EventHandler = (${name}State, ${name}Event) => ${name}State
}
`;
}

export function renderEventHandler(m) {
  const { base, name } = m;
  const cases = m.events
    .map((e) => `    case event: ${e.name} =>\n      state.copy(${e.folds.map((f) => `${f.slot} = ${f.expr}`).join(', ')})`)
    .join('\n\n');
  const helpers = m.helpers
    .map((h) => `  private def ${h.name}(${h.params.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${h.returnType} = {
    /*
    >>> AI_PROMPT_START
    Context: Domain Entity Helper Method
    Task: Implement logic for ${h.name}
    Description: ${h.description}
    Input Params: ${h.params.map((p) => `${p.name}: ${p.type}`).join(', ')}
    Return: ${h.returnType}
    <<< AI_PROMPT_END
    */
    ???
  }`)
    .join('\n\n');
  const imports = [
    ...m.javaImports.map((i) => `import ${i}`),
    `import ${base}domain.entities.${name}Entity.${name}EventHandler`,
    `import ${base}domain.entities.${name}Entity.${name}EventHandler`,
    `import ${base}domain.entities.${name}Entity.${name}State`,
    ...m.valueImports,
    'import scala.collection.immutable.Map',
  ].join('\n');
  return `package ${base}domain.entities.behaviors

${imports}

object ${name}EventHandler {
  def apply: ${name}EventHandler = (state, event) => event match {
${cases}
    case _ => state // 默认兜底，或者抛异常
  }

${helpers}
}
`;
}

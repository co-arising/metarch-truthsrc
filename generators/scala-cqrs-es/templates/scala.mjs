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

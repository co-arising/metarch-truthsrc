export function bootstrapTemplate(model) {
  if (model.persistenceIdentity !== 'unique-id') throw new TypeError('unsupported aggregate persistence identity');
  const { name, package: pkg, protocol, bootstrap } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  const argument = model.authority ? ', authority' : '';
  return `package ${pkg}.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import ${pkg}.application.aggregates.{${name}Aggregate, ${name}AggregateFactory}
import ${pkg}.application.aggregates.${protocol}.${model.authority ? '_' : 'Command'}
import ${pkg}.domain.${name}Computations
import ${pkg}.domain.entities.${name}Entity.{Event, State}
import ${pkg}.domain.entities.behaviors.${name}EventHandler
import ${pkg}.infrastructure.serialization.{${name}EventAdapter, ${name}SnapshotAdapter}

object ${bootstrap} extends ${name}AggregateFactory {

  override def create(persistenceId: String, initial: State, hosts: ${name}Computations${authority}): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null${model.authority ? ' && authority != null' : ''}, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = ${name}Aggregate.commandHandler(hosts${argument}),
      eventHandler = ${name}EventHandler.apply
    )
      .eventAdapter(${name}EventAdapter)
      .snapshotAdapter(${name}SnapshotAdapter)
  }
}
`;
}

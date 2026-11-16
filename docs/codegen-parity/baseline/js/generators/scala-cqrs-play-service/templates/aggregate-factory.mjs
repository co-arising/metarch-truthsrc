export function aggregateTemplate(model) {
  const { name, package: pkg, protocol } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  const argument = model.authority ? ', authority' : '';
  return `package ${pkg}.application.aggregates

import ${pkg}.application.aggregates.${protocol}.${model.authority ? '_' : 'CommandHandler'}
import ${pkg}.domain.${name}Computations

object ${name}Aggregate {

  def commandHandler(hosts: ${name}Computations${authority}): CommandHandler =
    behaviors.${name}Behaviors(hosts${argument})
}
`;
}

export function factoryTemplate(model) {
  const { name, package: pkg, protocol } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  return `package ${pkg}.application.aggregates

import akka.actor.typed.Behavior
import ${pkg}.application.aggregates.${protocol}.${model.authority ? '_' : 'Command'}
import ${pkg}.domain.${name}Computations
import ${pkg}.domain.entities.${name}Entity.State

trait ${name}AggregateFactory {

  def create(persistenceId: String, initial: State, hosts: ${name}Computations${authority}): Behavior[Command]
}
`;
}

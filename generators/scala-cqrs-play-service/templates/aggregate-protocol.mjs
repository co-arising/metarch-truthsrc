import { typeName } from '../../scala-cqrs-domain/naming.mjs';

export function legacyTemplate(model, options) {
  const { name, package: pkg, bootstrap } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  const argument = model.authority ? ', authority' : '';
  const messages = model.external.map(p => '  final case class ' + p.names.ingress + '(output: ' + typeName(p.outputType, options) + ', authorization: String, replyTo: ActorRef[Reply]) extends Request\n').join('');
  return 'package ' + pkg + '.domain\n\nimport akka.actor.typed.{ActorRef, Behavior}\nimport ' + name + 'Protocol._\n\nobject ' + name + 'Aggregate {\n' +
    '  sealed trait Request\n  final case class Execute(command: Command, replyTo: ActorRef[Reply]) extends Request\n  final case class GetState(replyTo: ActorRef[' + name + 'State]) extends Request\n' +
    '  sealed trait Reply\n  final case class Accepted(events: Vector[Event]) extends Reply\n  final case class Refused(code: String) extends Reply\n' + messages +
    (model.authority ? '  trait ExternalAuthority { def authorize(producer: String, authorization: String, identity: Vector[String]): Boolean }\n' : '') +
    '  def apply(persistenceId: String, initial: ' + name + 'State, hosts: ' + name + 'Computations' + authority + '): Behavior[Request] =\n' +
    '    ' + pkg + '.infrastructure.bootstrap.' + bootstrap + '.create(persistenceId, initial, hosts' + argument + ')\n}\n' +
    'object ' + name + 'AggregateFactory {\n' +
    '  def create(persistenceId: String, initial: ' + name + 'State, hosts: ' + name + 'Computations' + (model.authority ? ', authority: ' + name + 'Aggregate.ExternalAuthority' : '') + '): Behavior[' + name + 'Aggregate.Request] = ' +
    name + 'Aggregate(persistenceId, initial, hosts' + argument + ')\n}\n';
}

export function protocolTemplate(model) {
  const { name, package: pkg, protocol, legacy } = model.names;
  let content = `package ${pkg}.application.aggregates

import akka.persistence.typed.scaladsl.Effect
import ${pkg}.domain.entities.${name}Entity.{Event, State}

object ${protocol} {

  type Command = ${legacy}.Request
  type Reply = ${legacy}.Reply
  type CommandPayload = ${pkg}.domain.${name}Protocol.Command
  type CommandHandler = (State, Command) => Effect[Event, State]
`;
  for (const id of model.aliases) content += `
  type ${id} = ${legacy}.${id}
  val ${id}: ${legacy}.${id}.type =
    ${legacy}.${id}
`;
  if (model.authority) content += `\n  type ExternalAuthority = ${legacy}.ExternalAuthority\n`;
  return content + '}\n';
}

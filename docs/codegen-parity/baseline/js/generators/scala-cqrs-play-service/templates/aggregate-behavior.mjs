import { symbol } from '../../scala-cqrs-domain/naming.mjs';

export function behaviorTemplate(model) {
  const { name, package: pkg, protocol } = model.names;
  const authority = model.authority ? ', authority: ExternalAuthority' : '';
  const calls = model.groups.map(group => ({ external: 'externalBehavior(authority)', query: 'queryBehavior', execution: 'executionBehavior(state, hosts)' })[group.kind]);
  let content = `package ${pkg}.application.aggregates.behaviors

import akka.persistence.typed.scaladsl.Effect
import ${pkg}.application.aggregates.${protocol}._
import ${pkg}.domain.entities.${name}Entity.{Event, State}
import ${pkg}.domain.{${name}Computations, ${name}Protocol => Payload, ${name}Rules${model.authority ? ', ' + name + 'ExternalEvents' : ''}}

object ${name}Behaviors {

  def apply(hosts: ${name}Computations${authority}): CommandHandler = (state, command) =>
    ${calls[0]}${calls.slice(1).map(call => '\n      .orElse(' + call + ')').join('')}
      .apply(command)
`;
  const codeMappings = [];
  for (const group of model.groups) {
    if (group.kind === 'external') {
      content += `
  private def externalBehavior(authority: ExternalAuthority): PartialFunction[Command, Effect[Event, State]] = {
`;
      for (const producer of group.producers) {
        const start = content.length;
        content += `    case ${producer.names.ingress}(output, authorization, reply) =>
      if (!authority.authorize(${JSON.stringify(producer.id)}, authorization, ${name}ExternalEvents.${producer.names.identity}(output)))
        Effect.none.thenRun((_: State) => reply ! Refused("external-authority-denied"))
      else
        Effect.persist(${name}ExternalEvents.${producer.names.method}(output)).thenRun((_: State) => reply ! Accepted(Vector(${name}ExternalEvents.${producer.names.method}(output))))
`;
        const span = { start, end: content.length };
        codeMappings.push({ source: producer.source, span, scope: span });
      }
      content += '  }\n';
    } else if (group.kind === 'query') {
      content += `
  private def queryBehavior: PartialFunction[Command, Effect[Event, State]] = {
    case GetState(reply) =>
      Effect.none.thenRun((s: State) => reply ! s)
  }
`;
    } else if (group.kind === 'execution') {
      content += `
  private def executionBehavior(state: State, hosts: ${name}Computations): PartialFunction[Command, Effect[Event, State]] = {
    case Execute(command, reply) =>
      val decision = command match {
`;
      for (const command of group.commands) {
        const start = content.length;
        content += `        case p: Payload.${symbol(command.ref.id)} =>
          ${name}Rules.${symbol(command.ref.id)}(state, p, hosts)
`;
        const span = { start, end: content.length };
        codeMappings.push({ source: command.source, span, scope: span });
      }
      content += `      }

      decision match {
        case Left(code) =>
          Effect.none.thenRun((_: State) => reply ! Refused(code))
        case Right(events) =>
          Effect.persist(events).thenRun((_: State) => reply ! Accepted(events))
      }
  }
`;
    } else throw new TypeError('unsupported aggregate behavior group');
  }
  return { content: content + '}\n', codeMappings };
}

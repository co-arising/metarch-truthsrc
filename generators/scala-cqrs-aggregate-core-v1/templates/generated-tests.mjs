import { resolveArtifactPath } from '../../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../../lib/scala-target/profiles.mjs';
import { importsFor, named, library } from './imports.mjs';

export function generatedBehaviorArtifacts(model) {
  return model.aggregates.map(aggregate => {
    const name = aggregate.aggregate.name + 'ReplaySpec';
    const pkg = aggregate.rules.package;
    return { path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: 'glue', packageName: pkg, typeName: name }).replace('/src/main/', '/src/test/'),
      kind: 'generated-test', name, identifier: name, package: pkg, aggregate,
      sources: [aggregate.source, ...aggregate.base.state.sources],
      directDeps: [aggregate.base.state.path, aggregate.base.protocol.path, aggregate.eventHandler.path] };
  });
}

// This is a generated replay baseline, not a generated business oracle. Concrete
// commands/events and their expected results are supplied by the independent tests.
export function generatedBehaviorTemplate(artifact, out) {
  const a = artifact.aggregate;
  const { names: n, text } = importsFor(artifact, [
    [named('state', a.base.state)], [named('protocol', a.base.protocol)], [named('handler', a.eventHandler)],
    [library('suite', 'org.scalatest.funsuite.AnyFunSuite')],
  ]);
  out.append(`package ${artifact.package}\n\n${text}\n\nfinal class ${artifact.identifier} extends ${n.suite} {\n  test("empty event history preserves the explicitly declared initial state") {\n    val initial = ${n.state}.empty\n    val events = Vector.empty[${n.protocol}.Event]\n    val recovered = events.foldLeft(initial)(${n.handler}.apply)\n    assert(recovered == initial)\n  }\n}\n`, artifact.sources);
}

import { refKey } from '../../../lib/domain-products/references.mjs';

export function generatedTestArtifacts(model, serialization) {
  return model.aggregates.map(aggregate => {
    const context = model.contexts.find(row => row.context === aggregate.ref.context);
    const root = serialization.roots.find(row => row.role === 'state' && refKey(row.ref) === refKey(aggregate.ref));
    const node = serialization.nodes.find(row => row.id === root?.nodeId);
    if (!node) throw new TypeError('generated state test requires the actual protobuf root');
    const name = aggregate.state.name + 'RoundTripSpec';
    const sameName = aggregate.state.name === node.name || ['DomainConverters', 'ExactValueCodecs', 'AnyWordSpec'].includes(aggregate.state.name) ||
      ['DomainConverters', 'ExactValueCodecs', 'AnyWordSpec'].includes(node.name);
    const stateName = sameName ? '_root_.' + aggregate.state.fqn : aggregate.state.identifier;
    const messageName = sameName ? '_root_.' + node.fqn : node.name;
    return {
      path: 'modules/glue/src/test/scala/' + context.package.replaceAll('.', '/') + '/infrastructure/serialization/' + name + '.scala',
      kind: 'generated-test', sources: [...new Map([...aggregate.state.sources, ...node.sources].map(source => [JSON.stringify(source), source])).values()],
      directDeps: [aggregate.state.path, context.converter.path, context.protoPath, 'build.sbt'],
      body: 'package ' + context.package + '.infrastructure.serialization\n\n' +
        (sameName ? '' : 'import ' + aggregate.state.fqn + '\n' + 'import ' + node.fqn + '\n') +
        'import org.scalatest.wordspec.AnyWordSpec\n\n' +
        'final class ' + name + ' extends AnyWordSpec {\n' +
        '  "' + aggregate.state.name + ' serialization" should {\n' +
        '    "round-trip the declared empty state through protobuf bytes" in {\n' +
        '      val state = ' + stateName + '.empty\n' +
        '      val bytes = DomainConverters.encode' + aggregate.state.name + '(state).toByteArray\n' +
        '      val decoded = DomainConverters.decode' + aggregate.state.name + '(' + messageName + '.parseFrom(bytes))\n' +
        '      assert(decoded == state)\n    }\n  }\n}\n',
    };
  });
}

export function generatedTestsTemplate(artifact, out) { out.append(artifact.body, artifact.sources); }

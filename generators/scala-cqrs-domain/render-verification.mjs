import { array, at, equal, object, unique } from '../../lib/products/request.mjs';
import { declaration, validateValue } from '../../lib/domain-products/values.mjs';
import { packageFor, symbol } from './naming.mjs';
import { literal } from './render-expressions.mjs';

/** Explicit target test vectors; expected outcomes do not become production semantics. */
export function verificationTests({ products, options }) {
  const layout = products['reference-layout'], exact = products['exact-value-types'], dependencies = products['domain-dependencies'], folds = products['domain-folds'];
  const cases = array(options.verificationCases, at('options', '/verificationCases'));
  unique(cases.map(c => c.id), 'PRODUCT_VERIFICATION', at('options'));
  return cases.map(c => {
    const source = at('options', '/verificationCases');
    object(c, ['id', 'aggregate', 'command', 'state', 'parameters', 'expected'], source);
    const aggregate = declaration(c.aggregate, layout, source), command = dependencies.commands.find(x => equal(x.command, c.command));
    if (aggregate.ref.kind !== 'aggregate' || !command || command.command.context !== aggregate.ref.context || command.command.owner[0] !== aggregate.ref.id) throw new TypeError('verification command must belong to declared aggregate');
    const defaults = folds.defaults.filter(d => d.target.context === aggregate.ref.context && d.target.owner[0] === aggregate.ref.id);
    const state = values => {
      object(values, defaults.map(d => d.target.id), source);
      return defaults.map(d => { validateValue(values[d.target.id], d.valueType, layout, exact, source); return literal(values[d.target.id], d.valueType, layout, exact, options); }).join(', ');
    };
    object(c.parameters, command.declaredSignature.map(d => d.ref.id), source);
    const args = command.declaredSignature.map(d => { validateValue(c.parameters[d.ref.id], d.valueType, layout, exact, source); return literal(c.parameters[d.ref.id], d.valueType, layout, exact, options); }).join(', ');
    const pkg = packageFor(aggregate.ref.context, options), name = symbol(aggregate.ref.id), full = pkg + '.domain.';
    if (dependencies.hosts.some(h => equal(h.command, c.command))) throw new TypeError('effect vectors with host computations require explicit implementations');
    let expected;
    if (c.expected.kind === 'refused') { object(c.expected, ['kind', 'code', 'state'], source); expected = full + name + 'Aggregate.Refused(' + JSON.stringify(c.expected.code) + ')'; }
    else {
      object(c.expected, ['kind', 'events', 'state'], source);
      if (c.expected.kind !== 'accepted') throw new TypeError('explicit accepted/refused effect expected');
      const events = array(c.expected.events, source).map(e => {
        object(e, ['event', 'slots'], source);
        const event = dependencies.events.find(x => equal(x.event, e.event));
        if (!event || event.event.owner[0] !== aggregate.ref.id) throw new TypeError('expected event belongs to a different aggregate');
        object(e.slots, event.declaredSlots.map(d => d.ref.id), source);
        return full + name + 'Protocol.' + symbol(event.event.id) + '(' + event.declaredSlots.map(d => { validateValue(e.slots[d.ref.id], d.valueType, layout, exact, source); return literal(e.slots[d.ref.id], d.valueType, layout, exact, options); }).join(', ') + ')';
      });
      expected = full + name + 'Aggregate.Accepted(Vector(' + events.join(', ') + '))';
    }
    const initial = full + name + 'State(' + state(c.state) + ')', after = full + name + 'State(' + state(c.expected.state) + ')';
    return '  test(' + JSON.stringify(c.id + ': actual command persistence and same-identity actor replay') + ') {\n' +
      '    val config = ConfigFactory.parseString("akka.actor.provider = local").withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load())\n    val kit = ActorTestKit(config)\n' +
      '    try {\n      val pid = ' + JSON.stringify('case/' + c.id) + '\n      val hosts = new ' + full + name + 'Computations {}\n' +
      '      val initial = ' + initial + '\n      val ref = kit.spawn(' + full + name + 'Aggregate(pid, initial, hosts))\n' +
      '      val reply = kit.createTestProbe[' + full + name + 'Aggregate.Reply]()\n      ref ! ' + full + name + 'Aggregate.Execute(' + full + name + 'Protocol.' + symbol(command.command.id) + '(' + args + '), reply.ref)\n' +
      '      reply.expectMessage(' + expected + ')\n      val probe = kit.createTestProbe[' + full + name + 'State]()\n      ref ! ' + full + name + 'Aggregate.GetState(probe.ref)\n      probe.expectMessage(' + after + ')\n' +
      '      kit.stop(ref)\n      val recovered = kit.spawn(' + full + name + 'Aggregate(pid, initial, hosts))\n      recovered ! ' + full + name + 'Aggregate.GetState(probe.ref)\n      probe.expectMessage(' + after + ')\n' +
      '    } finally kit.shutdownTestKit()\n  }\n';
  }).join('');
}

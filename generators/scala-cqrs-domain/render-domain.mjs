import { entry, key, packageFor, pathFor, symbol, typeName } from './naming.mjs';
import { decision, literal, valueExpression } from './render-expressions.mjs';

const owner = (ref, aggregate) => ref.context === aggregate.context && ref.owner[0] === aggregate.id;
const fields = (rows, options) => rows.map(r => symbol((r.ref ?? r.target).id) + ': ' + typeName(r.valueType, options)).join(', ');
const valuesPath = (type, options) => {
  if (type.form === 'nominal') return [pathFor(packageFor(type.ref.context, options), 'domain/values/' + type.ref.id + '.scala')];
  if (type.form === 'optional' || type.form === 'sequence') return valuesPath(type.element, options);
  if (type.form === 'map') return [...valuesPath(type.key, options), ...valuesPath(type.value, options)];
  return [];
};
function aggregateRows(products) {
  return products['reference-layout'].declarations.filter(d => d.ref.kind === 'aggregate');
}
export function renderAggregate({ products, options }, footprint) {
  const layout = products['reference-layout'], folds = products['domain-folds'], exact = products['exact-value-types'];
  return aggregateRows(products).map(a => {
    const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id), defaults = folds.defaults.filter(d => owner(d.target, a.ref));
    const parameters = fields(defaults, options), initial = defaults.map(d => literal(d.value, d.valueType, layout, exact, options)).join(', ');
    return entry(pathFor(pkg, 'domain/' + a.ref.id + 'State.scala'), 'package ' + pkg + '.domain\n\nfinal case class ' + name + 'State(' + parameters + ')\nobject ' + name + 'State {\n  def empty: ' + name + 'State = ' + name + 'State(' + initial + ')\n}\n',
      'state', [a.source, ...defaults.map(d => d.source)], footprint, [...new Set(defaults.flatMap(d => valuesPath(d.valueType, options)))]);
  });
}
export function renderCommand({ products, options }, footprint) {
  const dependencies = products['domain-dependencies'], layout = products['reference-layout'], exact = products['exact-value-types'];
  return aggregateRows(products).flatMap(a => {
    const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id), commands = dependencies.commands.filter(c => owner(c.command, a.ref)), events = dependencies.events.filter(e => owner(e.event, a.ref));
    const protocol = pathFor(pkg, 'domain/' + a.ref.id + 'Protocol.scala'), statePath = pathFor(pkg, 'domain/' + a.ref.id + 'State.scala');
    let body = 'package ' + pkg + '.domain\n\nobject ' + name + 'Protocol {\n  sealed trait Command\n  sealed trait Event\n';
    for (const c of commands) body += '  final case class ' + symbol(c.command.id) + '(' + fields(c.declaredSignature, options) + ') extends Command\n';
    for (const e of events) body += '  final case class ' + symbol(e.event.id) + '(' + fields(e.declaredSlots, options) + ') extends Event\n';
    body += '}\n';
    const types = [...commands.flatMap(c => c.declaredSignature), ...events.flatMap(e => e.declaredSlots)];
    const results = [entry(protocol, body, 'protocol', [a.source, ...commands.map(c => c.source), ...events.map(e => e.source)], footprint, [...new Set(types.flatMap(r => valuesPath(r.valueType, options)))])];
    const hosts = dependencies.hosts.filter(h => commands.some(c => key(c.command) === key(h.command)));
    let helper = 'package ' + pkg + '.domain\n\nimport ' + name + 'Protocol._\n\ntrait ' + name + 'Computations {\n';
    for (const h of hosts) helper += '  def ' + symbol(h.id.id) + '(state: ' + name + 'State, p: ' + symbol(h.command.id) + '): ' + typeName(h.outputType, options) + '\n';
    helper += '}\nobject ' + name + 'Computations {\n';
    if (!hosts.length) helper += '  val none: ' + name + 'Computations = new ' + name + 'Computations {}\n';
    helper += '}\nobject ' + name + 'CommandHelpers {\n';
    for (const c of commands) {
      helper += '  def emit' + c.command.id + '(state: ' + name + 'State, p: ' + symbol(c.command.id) + ', hosts: ' + name + 'Computations): Vector[Event] = Vector(' +
        c.events.map(e => symbol(e.event.id) + '(' + e.slots.map(s => valueExpression(s.producer, layout, exact, options)).join(', ') + ')').join(', ') + ')\n';
    }
    helper += '}\n';
    results.push(entry(pathFor(pkg, 'domain/' + a.ref.id + 'CommandHelpers.scala'), helper, 'command-helpers', [a.source, ...commands.map(c => c.source), ...hosts.map(h => h.source)], footprint, [protocol, statePath]));
    const external = dependencies.externalProducers.filter(p => owner(p.event, a.ref));
    if (external.length) {
      let bridge = 'package ' + pkg + '.domain\n\nimport ' + name + 'Protocol._\n\nobject ' + name + 'ExternalEvents {\n';
      const textual = (value, type) => type.form === 'nominal' ? textual(value + '.value', layout.declarations.find(d => key(d.ref) === key(type.ref)).valueType) : value;
      for (const p of external) {
        bridge += '  def ' + symbol(p.id.replaceAll('-', '_')) + '(output: ' + typeName(p.outputType, options) + '): ' + symbol(p.event.id) + ' = ' + symbol(p.event.id) + '(' + p.slots.map(s => 'output.' + symbol(s.member.id)).join(', ') + ')\n';
        bridge += '  def ' + symbol(p.id.replaceAll('-', '_') + '_identity') + '(output: ' + typeName(p.outputType, options) + '): Vector[String] = Vector(' + p.stableIdentityContract.keys.map(r => textual('output.' + symbol(r.id), layout.declarations.find(d => key(d.ref) === key(r)).valueType)).join(', ') + ')\n';
      }
      bridge += '}\n';
      results.push(entry(pathFor(pkg, 'domain/' + a.ref.id + 'ExternalEvents.scala'), bridge, 'external-event-bridge', external.map(p => p.source), footprint, [protocol, ...new Set(external.flatMap(p => valuesPath(p.outputType, options)))]));
    }
    return results;
  });
}
export function renderInvariant({ products, options }, footprint, layered = false) {
  const layout = products['reference-layout'], decisions = products['domain-decision'], folds = products['domain-folds'], exact = products['exact-value-types'];
  return aggregateRows(products).flatMap(a => {
    const pkg = packageFor(a.ref.context, options), name = symbol(a.ref.id), commands = decisions.commands.filter(c => owner(c.command, a.ref)), events = folds.events.filter(e => owner(e.event, a.ref));
    const protocol = pathFor(pkg, 'domain/' + a.ref.id + 'Protocol.scala'), statePath = pathFor(pkg, 'domain/' + a.ref.id + 'State.scala'), helperPath = pathFor(pkg, 'domain/' + a.ref.id + 'CommandHelpers.scala');
    const rulePackage = layered ? pkg + '.domain.invariant' : pkg + '.domain';
    const paramsPath = pathFor(pkg, 'domain/invariant/params/' + a.ref.id + 'RuleParams.scala');
    const coreRulesPath = pathFor(pkg, 'domain/invariant/' + a.ref.id + 'Rules.scala');
    let params = 'package ' + pkg + '.domain.invariant.params\n\nimport ' + pkg + '.domain._\n\nobject ' + name + 'RuleParams {\n';
    let rules = 'package ' + rulePackage + '\n\nimport ' + (layered ? pkg + '.domain._\nimport ' + pkg + '.domain.invariant.params.' + name + 'RuleParams._\nimport ' : '') + (layered ? pkg + '.domain.' : '') + name + 'Protocol._\n\nobject ' + name + 'Rules {\n';
    const ruleMappings = [], foldMappings = [], wrapperMappings = [];
    let wrapper = 'package ' + pkg + '.domain\n\nimport ' + name + 'Protocol._\n\nobject ' + name + 'Rules {\n';
    for (const c of commands) {
      const start = rules.length, guards = [];
      const signature = '(state: ' + name + 'State, p: ' + symbol(c.command.id) + ', hosts: ' + name + 'Computations)';
      if (layered) {
        const parameterName = symbol(c.command.id + 'Params');
        params += '  final case class ' + parameterName + '(state: ' + name + 'State, command: ' + name + 'Protocol.' + symbol(c.command.id) + ', hosts: ' + name + 'Computations)\n';
        rules += '  def ' + symbol(c.command.id) + '(input: ' + parameterName + '): Either[String, Vector[Event]] = {\n' +
          '    val state = input.state\n    val p = input.command\n    val hosts = input.hosts\n';
        const wrapperStart = wrapper.length;
        wrapper += '  def ' + symbol(c.command.id) + signature + ': Either[String, Vector[Event]] =\n' +
          '    ' + pkg + '.domain.invariant.' + name + 'Rules.' + symbol(c.command.id) + '(' + pkg + '.domain.invariant.params.' + name + 'RuleParams.' + parameterName + '(state, p, hosts))\n';
        const span = { start: wrapperStart, end: wrapper.length };
        wrapperMappings.push({ source: c.source, span, scope: span });
      } else rules += '  def ' + symbol(c.command.id) + signature + ': Either[String, Vector[Event]] = {\n';
      for (const d of c.decisions) {
        const guardStart = rules.length;
        rules += '    if (!(' + decision(d.predicate, layout, exact, options) + ')) return ' + (d.onFalse.kind === 'reject' ? 'Left(' + JSON.stringify(d.onFalse.errCode) + ')' : 'Right(Vector.empty)') + '\n';
        guards.push({ source: d.source, span: { start: guardStart, end: rules.length } });
      }
      rules += '    Right(' + name + 'CommandHelpers.emit' + c.command.id + '(state, p, hosts))\n  }\n';
      const scope = { start, end: rules.length };
      ruleMappings.push({ source: c.source, span: scope, scope }, ...guards.map(m => ({ ...m, scope })));
    }
    rules += '}\n';
    let replay = 'package ' + pkg + '.domain\n\nimport ' + name + 'Protocol._\n\nobject ' + name + 'EventHandler {\n  def apply(state: ' + name + 'State, input: Event): ' + name + 'State = input match {\n';
    for (const e of events) {
      const eventStart = replay.length, assignments = [];
      replay += '    case event: ' + symbol(e.event.id) + ' =>\n';
      e.assignments.forEach((a, i) => {
        const u = a.update, base = 'state.' + symbol(a.target.id), render = n => valueExpression(n, layout, exact, options);
        let value;
        if (u.op === 'set') value = render(u.value);
        else if (u.op === 'put') value = base + '.updated(' + render(u.key) + ', ' + render(u.value) + ')';
        else if (u.op === 'remove') value = base + ' - ' + render(u.key);
        else if (u.op === 'put-all') value = '{ val keys = ' + render(u.key) + '; val item = ' + render(u.value) + '; ' + base + ' ++ keys.map(_ -> item) }';
        else if (u.op === 'remove-all') value = base + ' -- ' + render(u.key);
        else if (u.op === 'integer-apply') value = 'java.lang.Math.' + (u.sign === 1 ? 'addExact' : 'subtractExact') + '(' + base + ', ' + render(u.delta) + ')';
        else if (u.op === 'money-apply') value = base + '.' + (u.sign === 1 ? 'plus' : 'minus') + '(' + render(u.delta) + ')';
        else throw new TypeError('unsupported admitted fold target operation');
        const start = replay.length;
        replay += '      val next' + i + ': ' + typeName(a.valueType, options) + ' = ' + value + '\n';
        assignments.push({ source: a.source, span: { start, end: replay.length } });
      });
      replay += e.assignments.length ? '      state.copy(' + e.assignments.map((a, i) => symbol(a.target.id) + ' = next' + i).join(', ') + ')\n' : '      state\n';
      const scope = { start: eventStart, end: replay.length };
      foldMappings.push({ source: e.source, span: scope, scope }, ...assignments.map(m => ({ ...m, scope })));
    }
    replay += '  }\n}\n';
    params += '}\n'; wrapper += '}\n';
    const ruleSources = [a.source, ...commands.flatMap(c => [c.source, ...c.decisions.map(d => d.source)])];
    const ruleEntries = layered ? [
      entry(coreRulesPath, rules, 'rules', ruleSources, footprint, [protocol, statePath, helperPath, paramsPath], ruleMappings),
      entry(paramsPath, params, 'rules', [a.source, ...commands.map(c=>c.source)], footprint, [protocol, statePath, helperPath]),
      entry(pathFor(pkg, 'domain/' + a.ref.id + 'Rules.scala'), wrapper, 'rules', [a.source, ...commands.map(c=>c.source)], footprint, [protocol, statePath, helperPath, coreRulesPath, paramsPath], wrapperMappings),
    ] : [entry(pathFor(pkg, 'domain/' + a.ref.id + 'Rules.scala'), rules, 'rules', ruleSources, footprint, [protocol, statePath, helperPath], ruleMappings)];
    return [...ruleEntries,
      entry(pathFor(pkg, 'domain/' + a.ref.id + 'EventHandler.scala'), replay, 'event-handler', [a.source, ...events.flatMap(e => [e.source, ...e.assignments.map(a => a.source)])], footprint, [protocol, statePath], foldMappings)];
  });
}

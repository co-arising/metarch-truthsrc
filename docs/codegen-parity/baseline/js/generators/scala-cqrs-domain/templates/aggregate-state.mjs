import { entry, symbol, typeName } from '../naming.mjs';
import { literal } from '../render-expressions.mjs';

export function stateEntries(model, options, footprint) {
  const name = symbol(model.aggregate.ref.id), pkg = model.package;
  const parameters = model.fields.map(d => symbol(d.target.id) + ': ' + typeName(d.valueType, options)).join(', ');
  const initial = model.fields.map(d => literal(d.value, d.valueType, model.literalTypes, model.exactTypes, options)).join(', ');
  const state = entry(model.paths.state, 'package ' + pkg + '.domain\n\nfinal case class ' + name + 'State(' + parameters + ')' + (model.layered ? '\n\n' : '\n') + 'object ' + name + 'State {\n  def empty: ' + name + 'State = ' +
    (model.layered ? pkg + '.domain.entities.' + name + 'Entity.empty' : name + 'State(' + initial + ')') + '\n}\n', 'state', model.sources, footprint,
    [...model.dependencies, ...(model.layered ? [model.paths.entity] : [])]);
  if (!model.layered) return [state];
  let entity = 'package ' + pkg + '.domain.entities\n\nobject ' + name + 'Entity {\n' +
    '  type State = ' + pkg + '.domain.' + name + 'State\n' +
    '  val State: ' + pkg + '.domain.' + name + 'State.type = ' + pkg + '.domain.' + name + 'State\n\n' +
    '  type Event = ' + pkg + '.domain.' + name + 'Protocol.Event\n\n  object Events {\n';
  for (const [index, event] of model.events.entries()) entity += (index ? '\n' : '') + '    type ' + symbol(event.ref.id) + ' = ' + pkg + '.domain.' + name + 'Protocol.' + symbol(event.ref.id) + '\n' +
    '    val ' + symbol(event.ref.id) + ': ' + pkg + '.domain.' + name + 'Protocol.' + symbol(event.ref.id) + '.type =\n      ' + pkg + '.domain.' + name + 'Protocol.' + symbol(event.ref.id) + '\n';
  entity += '  }\n\n';
  const start = entity.length;
  entity += '  def empty: State = State(' + initial + ')\n';
  const span = { start, end: entity.length };
  entity += '}\n';
  return [state, entry(model.paths.entity, entity, 'entity', [...model.sources, ...model.events.map(e => e.source)], footprint,
    [model.paths.state, model.paths.protocol, ...model.dependencies], [{ source: model.aggregate.source, span, scope: span }])];
}

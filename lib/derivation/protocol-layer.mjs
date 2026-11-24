// Knowledge → contract derivation for the protocol-layer family (#7):
// derives truthsrc.protocol-layer-input/v1 for:
//   1. `<pkg>.domain.services.<Name>Computations` (pure domain computation port)
//   2. `<pkg>.application.aggregates.<Name>Protocol` (Commands with replyTo, Replies, ExternalAuthority, CommandHandler)
//   3. `<pkg>.application.aggregates.behaviors.<Name>CommandHelpers` (Command ↔ RuleParams ↔ Reply glue)
// Pure and fail-closed (PL_DERIVATION).
const fail = message => { throw new Error('PL_DERIVATION: ' + message); };

const SCHEMA = 'truthsrc.protocol-layer-input/v1';
const PRIMITIVE_FORMS = new Set(['string', 'integer', 'boolean', 'decimal']);

const key = ref => JSON.stringify([ref.context, ref.kind, ref.owner, ref.id]);

const requireArray = (value, what) => {
  if (!Array.isArray(value)) fail(what + ' must be an array');
  return value;
};

function checkSource(source, what) {
  if (!source || typeof source !== 'object' || typeof source.document !== 'string' || !source.document ||
    typeof source.pointer !== 'string' || !source.pointer.startsWith('/'))
    {fail(what + ' must carry a {document, pointer} knowledge source');}
  return { document: source.document, pointer: source.pointer };
}

function typeTree(type, what) {
  if (!type || typeof type !== 'object') fail(what + ' must be a type tree');
  if (type.form === 'primitive') {
    if (!PRIMITIVE_FORMS.has(type.name)) fail(what + ' unsupported primitive type name: ' + JSON.stringify(type.name));
    return { form: 'primitive', name: type.name };
  }
  if (type.form === 'nominal') {
    if (!type.ref || typeof type.ref !== 'object') fail(what + ' nominal type must carry a ref');
    return { form: 'nominal', context: type.ref.context, name: type.ref.id };
  }
  if (type.form === 'optional') return { form: 'optional', element: typeTree(type.element, what + '.element') };
  if (type.form === 'sequence') return { form: 'sequence', element: typeTree(type.element, what + '.element') };
  if (type.form === 'map') return { form: 'map', key: typeTree(type.key, what + '.key'), value: typeTree(type.value, what + '.value') };
  fail(what + ' unsupported type form: ' + JSON.stringify(type.form));
}

export function deriveProtocolLayers(products, options) {
  const layout = requireArray(products['reference-layout']?.declarations, 'reference-layout declarations');
  const dependencies = products['domain-dependencies'];
  if (!dependencies || typeof dependencies !== 'object') fail('domain-dependencies product required');
  const allCommands = requireArray(dependencies.commands, 'domain-dependencies commands');
  const allHosts = requireArray(dependencies.hosts, 'domain-dependencies hosts');
  const allExternal = requireArray(dependencies.externalProducers, 'domain-dependencies externalProducers');
  const packages = requireArray(options?.packages, 'explicit context package bindings');

  const boundContexts = new Set();
  for (const p of packages) {
    if (!p || typeof p !== 'object' || typeof p.context !== 'string' || !p.context || typeof p.package !== 'string' || !p.package)
      {fail('each package binding must carry nonempty context and package');}
    if (boundContexts.has(p.context)) fail('duplicate package binding for context ' + p.context);
    boundContexts.add(p.context);
  }

  const aggregateDecls = layout.filter(d => d?.ref?.kind === 'aggregate');
  if (aggregateDecls.length === 0) fail('no aggregate declarations in reference-layout');

  const aggregates = [];
  const seenAggs = new Set();
  for (const declaration of aggregateDecls) {
    const ref = declaration.ref;
    if (!boundContexts.has(ref.context)) fail('context ' + ref.context + ' has no package binding');
    const aggKey = ref.context + '/' + ref.id;
    if (seenAggs.has(aggKey)) fail('duplicate aggregate declaration ' + aggKey);
    seenAggs.add(aggKey);

    const owns = target => target?.context === ref.context && Array.isArray(target.owner) && target.owner[0] === ref.id;

    const rawCommands = allCommands.filter(c => owns(c?.command));
    if (rawCommands.length === 0) fail('aggregate ' + aggKey + ' has no commands in domain-dependencies');

    const commands = rawCommands.map(c => {
      const cname = c.command.id;
      const parameters = requireArray(c.declaredSignature, 'command ' + cname + ' declaredSignature').map(r => ({
        name: (r.ref ?? r.target).id,
        valueType: typeTree(r.valueType, 'command ' + cname + ' param ' + (r.ref ?? r.target).id),
      }));
      return {
        name: cname,
        source: checkSource(c.source, 'command ' + ref.id + '.' + cname),
        parameters,
      };
    });

    const commandKeys = new Set(rawCommands.map(c => key(c.command)));
    const hosts = allHosts
      .filter(h => h?.command && commandKeys.has(key(h.command)))
      .map(h => ({
        name: h.id.id,
        command: h.command.id,
        outputType: typeTree(h.outputType, 'host ' + h.id.id + ' outputType'),
        source: checkSource(h.source, 'host ' + h.id.id),
      }));

    const externalProducers = allExternal
      .filter(p => owns(p?.event))
      .map(p => ({
        id: p.id,
        outputType: typeTree(p.outputType, 'external producer ' + p.id + ' outputType'),
      }));

    aggregates.push({
      context: ref.context,
      name: ref.id,
      source: checkSource(declaration.source, 'aggregate ' + aggKey),
      commands,
      hosts,
      externalProducers,
    });
  }

  return {
    schemaVersion: SCHEMA,
    packages: packages.map(p => ({ context: p.context, package: p.package })),
    aggregates,
  };
}

import { fqn } from '../../../lib/classic-architecture/types.mjs';

function requireOrdinaryModel(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model) ||
      typeof model.selfType?.name !== 'string') {
    throw new TypeError('Classic aggregate root renderer requires a ClassicAggregateRootModel');
  }
  if (model.selfType.name.endsWith('SagaTransactor')) {
    throw new TypeError('Unsupported classic aggregate root branch: SagaTransactor');
  }
  if (!Array.isArray(model.inlineEvents) || model.inlineEvents.length !== 0) {
    throw new TypeError('Unsupported classic aggregate root branch: inlineEvents');
  }
  for (const field of ['inlineState', 'stepsFactory', 'contextType']) {
    if (model[field] != null) {
      throw new TypeError(`Unsupported classic aggregate root branch: ${field}`);
    }
  }
  if (!Array.isArray(model.dependencies)) {
    throw new TypeError('Classic aggregate root dependencies must be an array of TypeRefs');
  }
  if (model.sharding !== null &&
      (!model.sharding || typeof model.sharding !== 'object' || Array.isArray(model.sharding) ||
       !['typeKeyName', 'taggingBaseName', 'shardCount'].every(field => Object.hasOwn(model.sharding, field)))) {
    throw new TypeError('Classic aggregate root sharding must be a ShardingModel or null');
  }
}

/** Complete, unstamped SourceFile text; retain the pinned DSL's literal LFs. */
export function renderClassicAggregateRoot(model) {
  requireOrdinaryModel(model);
  const packageDecl = `package ${model.selfType.packageName}`;
  const importDecl = [...new Set(model.dependencies.map(fqn))].sort()
    .map(name => `import ${name}`).join('\n');

  const commandsCode = '// Commands are defined in Protocol';
  const repliesCode = '// Replies are defined in Protocol';
  const inlineCode = '';
  const factoryCode = '';
  const protocolFqn = model.commandFamilyType.packageName;
  const handlerTypeName = model.commandFamilyType.name.replaceAll('Command', 'CommandHandler');
  const wiringCode = `
  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: ${protocolFqn}.${handlerTypeName} = ${model.behaviorObject.name}.apply
`;

  // The builder always supplies ShardedTags. Retain the known ordinary
  // template fallback for null sharding or a null typeKeyName as well.
  const shardingCode = model.sharding !== null && model.sharding.typeKeyName !== null
    ? `
  val entityTypeKey: EntityTypeKey[${model.commandFamilyType.name}] = EntityTypeKey("${model.sharding.typeKeyName}")
  val tags: Vector[String] = Vector.tabulate(${model.sharding.shardCount})(i => s"${model.sharding.taggingBaseName}$i")
`
    : `  val entityTypeKey: EntityTypeKey[${model.commandFamilyType.name}] = EntityTypeKey("${model.commandFamilyType.name}")`;

  const body = `
${commandsCode}
${repliesCode}
${inlineCode}
${factoryCode}

${wiringCode}

${shardingCode}
`;
  const objectDef = `object ${model.selfType.name} {\n${body}\n}`;
  return [packageDecl, importDecl, objectDef].join('\n\n') + '\n';
}

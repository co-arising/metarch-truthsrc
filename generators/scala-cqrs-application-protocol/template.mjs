import { fqn, signature } from '../../lib/classic-architecture/types.mjs';

// Exactly NamingConventions.SCALA_KEYWORDS, not a broader Scala lexer.
const scalaKeywords = new Set([
  'type', 'object', 'class', 'trait', 'def', 'val', 'var', 'for', 'while', 'if', 'else',
  'match', 'case', 'import', 'package', 'extends', 'with', 'new', 'return', 'throw',
  'try', 'catch', 'finally', 'null', 'true', 'false', 'this', 'super', 'sealed',
  'implicit', 'lazy', 'override', 'private', 'protected', 'abstract', 'final', 'yield', 'do'
]);

function scalaIdentifier(name) {
  return scalaKeywords.has(name) ? `\`${name}\`` : name;
}

function renderFields(fields) {
  return fields.map(field => {
    const defaultValue = field.defaultValue === null ? '' : ` = ${field.defaultValue}`;
    return `${scalaIdentifier(field.name)}: ${signature(field.typeRef)}${defaultValue}`;
  }).join(', ');
}

function fieldDoc(fields) {
  // KnowledgeAnchorDoc.fieldDoc(fields, "  ") with the classic profile's
  // empty elementHashById. Keep original note IDs (including an empty Some),
  // descriptions and whitespace; do not add concept/command/reply docs.
  const lines = fields.filter(field => field.noteId !== null).map(field => {
    const description = field.description.length === 0 ? '' : ` ${field.description}`;
    return `@param ${scalaIdentifier(field.name)}${description}  @knowledge ${field.noteId}`;
  });
  if (lines.length === 0) return '';
  return ['  /**', ...lines.map(line => `   * ${line}`), '   */'].join('\n') + '\n';
}

function renderInlineState(state) {
  if (state === null) return '';
  // This template-only branch is suppressed by AggregateProtocolBuilder.
  // Preserve the original placeholders and its unconditional comma/status/id.
  return `
  // --- Inline State & Events ---
  sealed trait TransactionEvent extends CborSerializable

  sealed trait Status extends CborSerializable
  object Status { case object New extends Status; case object Initiated extends Status; case object Prepared extends Status; case object Completed extends Status; case class Failed(reason: String) extends Status }

  case class ${state.name}(${renderFields(state.fields)}, status: Status = Status.New) extends CborSerializable {
    def applyEvent(event: TransactionEvent): ${state.name} = ???
  }

  object ${state.name} {
     def empty(id: String): ${state.name} = ${state.name}(id = Some(id))
  }
`;
}

function renderHandler(model) {
  // Option.zip: either missing side suppresses the whole alias.
  if (model.stateType === null || model.eventType === null) return '';
  const handlerTypeName = model.commandFamily.name.replaceAll('Command', 'CommandHandler');
  return `
  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${handlerTypeName} = (${model.stateType.name}, ${model.commandFamily.name}) => akka.persistence.typed.scaladsl.Effect[${model.eventType.name}, ${model.stateType.name}]
`;
}

/**
 * Fixed AggregateProtocolTemplate.generate, including CodeGenerationDSL's
 * ObjectDefinition and SourceFile framing. Return template text only: no entry(),
 * generated stamp, knowledge-release line, trim, formatter or import rewriting.
 */
export function renderAggregateProtocol(model) {
  const packageDecl = `package ${model.selfType.packageName}`;
  const importList = [...new Set(model.dependencies.map(fqn).sort())];
  const importDecl = importList.sort().map(name => `import ${name}`).join('\n');
  const commandFamilyDef = `  sealed trait ${model.commandFamily.name} extends ${model.commandFamily.superTypes.map(ref => ref.name).join(' with ')}`;
  // The original computes a command extendsClause and never uses it. Emit the
  // family name only, even when CommandModel.superTypes says something else.
  const commandsCode = model.commandFamily.commands.map(command =>
    `${fieldDoc(command.fields)}  case class ${command.name}(${renderFields(command.fields)}) extends ${model.commandFamily.name}`
  ).join('\n');
  const repliesCode = model.replies.map(reply =>
    `  case class ${reply.name}(${renderFields(reply.fields)}) extends ${reply.superTypes.map(ref => ref.name).join(' with ')}`
  ).join('\n');
  const stateCode = renderInlineState(model.state);
  const handlerCode = renderHandler(model);

  // Every blank slot below belongs to the raw interpolated Scala string.
  const body = `
  // Commands
${commandFamilyDef}
${commandsCode}

  // Replies
${repliesCode}

${stateCode}
${handlerCode}
`;
  const objectDef = `object ${model.selfType.name} {\n${body}\n}`;
  return [packageDecl, importDecl, objectDef].join('\n\n') + '\n';
}

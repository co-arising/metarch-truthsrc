import { fqn, shouldImport, signature } from '../../../lib/classic-architecture/types.mjs';
import { neutralValueFor } from '../builders/domain-entity.mjs';
import { assertUnhashedKnowledge } from '../models/domain-entity.mjs';

// Exact NamingConventions.scalaIdentifier vocabulary, not a broader Scala linter.
const scalaKeywords = new Set([
  'type', 'object', 'class', 'trait', 'def', 'val', 'var', 'for', 'while', 'if', 'else',
  'match', 'case', 'import', 'package', 'extends', 'with', 'new', 'return', 'throw',
  'try', 'catch', 'finally', 'null', 'true', 'false', 'this', 'super', 'sealed',
  'implicit', 'lazy', 'override', 'private', 'protected', 'abstract', 'final', 'yield', 'do',
]);

function scalaIdentifier(name) {
  return scalaKeywords.has(name) ? `\`${name}\`` : name;
}

function renderField(field) {
  const defaultPart = field.defaultValue === null ? '' : ` = ${field.defaultValue}`;
  return `${scalaIdentifier(field.name)}: ${signature(field.typeRef)}${defaultPart}`;
}

function commentBlock(lines, indent = '') {
  if (lines.length === 0) return '';
  return [`${indent}/**`, ...lines.map(line => `${indent} * ${line}`), `${indent} */`].join('\n') + '\n';
}

// KnowledgeAnchorDoc under classic generate's default empty elementHashById.
// This profile/API has no knowledge-release hash attachment; note IDs (including
// any literal suffix already in the input) and descriptions are not rewritten.
function fieldDoc(fields, indent) {
  const lines = fields.filter(field => field.noteId !== null).map(field => {
    const description = field.description.length === 0 ? '' : ` ${field.description}`;
    return `@param ${scalaIdentifier(field.name)}${description}  @knowledge ${field.noteId}`;
  });
  return commentBlock(lines, indent);
}

function emptyArgument(field, idField) {
  // Intentionally compare names, not positions; raw empty also does NOT escape
  // the identifier parameter, unlike case-class fields and @param anchors.
  if (field.name === idField.name) return field.name;
  if (field.name === 'version' && ['Int', 'Integer', 'Long'].includes(field.typeRef.name)) {
    return field.typeRef.name === 'Long' ? '0L' : '0';
  }
  return neutralValueFor(field.typeRef);
}

function emptyMethod(state) {
  if (state.fields.length === 0) return '';
  const idField = state.fields[0];
  const args = state.fields.map(field => emptyArgument(field, idField)).join(', ');
  return `  def empty(${idField.name}: ${signature(idField.typeRef)}): ${state.name} = ${state.name}(${args})`;
}

function extendsClause(superTypes) {
  return superTypes.length === 0 ? '' : ` extends ${superTypes.map(signature).join(' with ')}`;
}

function renderEvent(event) {
  const fields = event.fields.map(renderField).join(', ');
  return `${fieldDoc(event.fields, '  ')}  case class ${event.name}(${fields})${extendsClause(event.superTypes)}`;
}

function familyCode(family) {
  const trait = `  sealed trait ${family.name}${extendsClause(family.superTypes)}`;
  return `${trait}\n\n${family.events.map(renderEvent).join('\n')}`;
}

function eventHandlerCode(state, family) {
  const base = family.name.endsWith('Event') ? family.name.slice(0, -5) : family.name;
  return `  type ${base}EventHandler = (${state.name}, ${family.name}) => ${state.name}`;
}

export function renderDomainEntity(model) {
  assertUnhashedKnowledge(model);
  const pkg = `package ${model.selfType.packageName}`;
  // Keep structurally distinct generic dependencies with identical import FQNs.
  const imports = model.dependencies
    .filter(ref => shouldImport(ref, model.selfType.packageName))
    .map(fqn)
    .sort()
    .map(name => `import ${name}`)
    .join('\n');
  const state = model.state;
  const stateCode = `${fieldDoc(state.fields, '  ')}  case class ${state.name}(${state.fields.map(renderField).join(', ')})`;
  const body = [stateCode, emptyMethod(state), familyCode(model.eventFamily), eventHandlerCode(state, model.eventFamily)].join('\n\n');
  const entity = `object ${model.selfType.name} {\n${body}\n}`;
  const definitions = model.noteId === null
    ? [entity]
    : [commentBlock([`@knowledge ${model.noteId}`]).slice(0, -1), entity];
  // CodeGenerationDSL.SourceFile does not filter empty parts or trim. Even an
  // empty import declaration occupies its slot. No writer stamp belongs here.
  return [pkg, imports, ...definitions].join('\n\n') + '\n';
}

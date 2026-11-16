import { collectDependencies, typeRef } from '../../../lib/classic-architecture/types.mjs';
import { assertUnhashedKnowledge, FieldDef } from '../models/domain-entity.mjs';
import { ValueObjectModel } from '../models/value-object.mjs';

// ValueObjectBuilder.scala:45-71. Keep the implementation's name/type tests,
// rather than strengthening them to match the surrounding prose.
const completionStems = Object.freeze({
  resolvedAt: 'Resolved',
  appliedAt: 'Applied',
  confirmedAt: 'Confirmed',
  recordedAt: 'Recorded',
});

function deriveLogicMethods(fields, conventions) {
  const byName = new Set(fields.map(field => field.name));
  const completion = fields
    .filter(field => Object.hasOwn(completionStems, field.name))
    .map(field => `  def is${completionStems[field.name]}: Boolean = Option(${field.name}).isDefined`);
  // Scala 2.13.16 StringOps.scala:723-729 capitalizes only the first lower-case
  // Char; the tail is unchanged. firstUpper is equivalent on classic's admitted
  // ASCII casing surface, and fails closed outside that shared surface.
  const collections = fields
    .filter(field => field.typeRef.name === 'List')
    .map(field => `  def has${conventions.firstUpper(field.name)}: Boolean = Option(${field.name}).exists(_.nonEmpty)`);
  const selfLoop = byName.has('source') && byName.has('target')
    ? ['  def isSelfLoop: Boolean = source == target'] : [];
  const details = fields
    .filter(field => field.name === 'description' || field.name === 'details')
    .map(field => `  def has${conventions.firstUpper(field.name)}: Boolean = Option(${field.name}).exists(_.nonEmpty)`);
  // Seq.distinct keeps the first encounter across these four ordered groups.
  return [...new Set([...completion, ...collections, ...selfLoop, ...details])];
}

function buildField(field, ctx) {
  const base = ctx.typeResolver.resolve(field.fieldType);
  // TypeResolver.resolveField: always add scala.Option when optional, including
  // an already-optional base. Do not synthesize a default such as None.
  const resolved = field.optional ? typeRef('Option', 'scala', [base]) : base;
  return FieldDef(field.name, resolved, field.defaultValue, null, field.noteId, field.description);
}

export function buildValueObject(meta, ctx) {
  assertUnhashedKnowledge(meta);
  assertUnhashedKnowledge(ctx);
  if (meta._type !== 'ValueObjectMetadata') {
    throw new TypeError('buildValueObject requires raw ValueObjectMetadata');
  }
  // Preserve State names via the existing resolver. The main context owns the
  // valueObject(name) operation; there is no local resolver or naming fallback.
  const selfType = meta.name.endsWith('State')
    ? ctx.typeResolver.entityState(meta.name)
    : ctx.typeResolver.valueObject(meta.name);
  const fields = meta.fields.map(field => buildField(field, ctx));
  // ValueObjectBuilder.scala:112-122 retains ALL recursive dependencies for
  // graph ordering. Only the template filters same-package/built-in imports.
  const dependencies = collectDependencies(fields.map(field => field.typeRef));
  return ValueObjectModel(
    selfType,
    fields,
    dependencies,
    deriveLogicMethods(fields, ctx.conventions),
    meta.noteIds,
    meta.ownNoteId,
  );
}

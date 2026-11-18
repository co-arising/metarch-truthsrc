import { ProductError } from '../../../../lib/products/request.mjs';
import { typeRef } from '../../../../lib/classic-architecture/types.mjs';
import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { DurationModel } from './models.mjs';

export function refuse(message, code = 'CLASSIC_SAGA_UNSUPPORTED') {
  throw new ProductError(code, message, { document: 'classic-architecture', pointer: '/system/application/sagas' });
}

export function product(value, kind) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value._type !== kind)
    refuse(`Expected original ${kind}`, 'CLASSIC_SAGA_METADATA');
  return value;
}

export function sequence(value, label) {
  if (!Array.isArray(value)) refuse(`${label} must be a declared sequence`, 'CLASSIC_SAGA_METADATA');
  return value;
}

export function string(value, label) {
  if (typeof value !== 'string') refuse(`${label} must be a declared string`, 'CLASSIC_SAGA_METADATA');
  return value;
}

export function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647)
    refuse(`${label} must be an original Scala Int`, 'CLASSIC_SAGA_METADATA');
  return value;
}

export function mapping(mappings, name) {
  if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings))
    refuse('A declared string-keyed mapping is required', 'CLASSIC_SAGA_METADATA');
  return Object.hasOwn(mappings, name) ? string(mappings[name], 'mapping value') : name;
}

export function distinct(values) {
  const seen = new Set();
  return values.filter(value => {
    const key = JSON.stringify(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Unlike collectDependencies, this retains only the original Set's roots.
// SagaDefinitionBuilder.participantValueDeps does NOT recurse into typeParams.
export function distinctTypes(refs) {
  return distinct(refs.map(ref => typeRef(ref.name, ref.packageName, ref.typeParams)));
}

export function fields(meta, ctx) {
  return sequence(meta.fields, `${meta._type}.fields`).map(field => {
    product(field, 'FieldMetadata');
    return FieldDef(string(field.name, 'field name'), ctx.typeResolver.resolve(field.fieldType));
  });
}

export function contextType(meta, ctx) {
  const name = meta.context === null ? meta.name : product(meta.context, 'SagaContextMetadata').name;
  return ctx.typeResolver.sagaContext(name);
}

export function stepsFor(participant, saga) {
  return sequence(saga.steps, 'SagaTransactorMetadata.steps')
    .filter(step => step.participantName === participant.name)
    .map(step => product(step, 'SagaStepMetadata'));
}

export function isMoney(metaType) {
  return metaType._type === 'StructRef' && metaType.targetName === 'Money';
}

export function isId(metaType) {
  return metaType._type === 'CustomType' && metaType.typeName === 'Id';
}

// Exactly the original trim / Java regex split / lower / takeWhile / alias
// algorithm on the admitted ASCII-unit surface. Non-two-part raw code is
// retained unchanged, not parsed as a duration or silently defaulted.
export function duration(raw) {
  string(raw, 'duration');
  const parts = raw.replace(/^[\x00-\x20]+|[\x00-\x20]+$/gu, '').split(/[ \t\n\x0b\f\r]+/u);
  if (parts.length !== 2) return DurationModel(raw);
  if (/[^\x00-\x7f]/u.test(parts[1]))
    refuse('Non-ASCII duration units require a pinned Scala character/locale contract');
  const unit = parts[1].toLowerCase().match(/^[a-z]*/u)[0];
  const aliases = {
    milli: 'millis', millis: 'millis', millisecond: 'millis', milliseconds: 'millis',
    second: 'seconds', seconds: 'seconds', minute: 'minutes', minutes: 'minutes',
    hour: 'hours', hours: 'hours',
  };
  return DurationModel(raw, parts[0], Object.hasOwn(aliases, unit) ? aliases[unit] : unit);
}

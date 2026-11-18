import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

export function AdapterModel({
  selfType, scalaRootType, protoRootType, mappings, converterTrait,
  converters = [], isSnapshot = false, dependencies, noteIds = [],
}) {
  return copyImmutableData({
    selfType, scalaRootType, protoRootType, mappings, converterTrait,
    converters, isSnapshot, dependencies, noteIds,
  });
}

export function AdapterMapping(scalaCaseName, protoOneOfName, protoMessageName, fields = []) {
  return copyImmutableData({ scalaCaseName, protoOneOfName, protoMessageName, fields });
}

export function FieldMapping(scalaName, protoName, conversion, scalaType) {
  return copyImmutableData({ scalaName, protoName, conversion, scalaType });
}

// These are original dormant structured slots; the aggregate builder emits Nil.
export function ConverterMethodModel(
  methodNameBase, scalaType, protoType, toJournalBody, fromJournalBody,
) {
  return copyImmutableData({ methodNameBase, scalaType, protoType, toJournalBody, fromJournalBody });
}

export const Direct = Object.freeze({ kind: 'direct' });
export const EnumMapping = Object.freeze({ kind: 'enum-mapping' });
export const OptionWrap = Object.freeze({ kind: 'option-wrap' });
export function CustomConversion(methodNameBase) {
  return copyImmutableData({ kind: 'custom', methodNameBase });
}

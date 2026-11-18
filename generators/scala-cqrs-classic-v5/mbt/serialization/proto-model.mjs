import { copyImmutableData } from '../../../../lib/immutable-data.mjs';

// ProtoFileModel.scala: optional values are null, sequences/sets are frozen data.
export function ProtoFileModel({
  fileName, packageName, selfType, javaPackage = null, imports = [],
  enums = [], messages = [], noteIds = [],
}) {
  return copyImmutableData({
    fileName, packageName, javaPackage, imports, enums, messages,
    noteIds, dependencies: [], selfType,
  });
}

export function ProtoEnumModel(name, values) {
  return copyImmutableData({ name, values });
}

export function ProtoMessageModel(name, fields, nestedEnums = [], nestedMessages = [], oneOfs = []) {
  return copyImmutableData({ name, fields, nestedEnums, nestedMessages, oneOfs });
}

export function NormalField(
  name, fieldType, index, isRepeated = false, isOptional = false, comment = null, noteId = null,
) {
  return copyImmutableData({
    kind: 'normal', name, fieldType, index, isRepeated, isOptional, comment, noteId,
  });
}

export function MapField(name, keyType, valueType, index, noteId = null) {
  return copyImmutableData({ kind: 'map', name, keyType, valueType, index, noteId });
}

export function ProtoOneOfModel(name, fields) {
  return copyImmutableData({ name, fields });
}

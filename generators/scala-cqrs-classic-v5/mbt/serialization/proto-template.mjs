import { conceptLine } from '../../../../lib/classic-architecture/knowledge.mjs';

function renderEnum(model) {
  const values = model.values.map(([name, index]) => `  ${name} = ${index};`).join('\n');
  return `enum ${model.name} {\n${values}\n}`;
}

function renderField(field) {
  if (field.kind === 'map') {
    const knowledge = conceptLine(field.noteId);
    const suffix = knowledge.length === 0 ? '' : ` // ${knowledge.join(' ')}`;
    return `  map<${field.keyType}, ${field.valueType}> ${field.name} = ${field.index};${suffix}`;
  }
  const prefix = field.isRepeated ? 'repeated ' : field.isOptional ? 'optional ' : '';
  const parts = [...(field.comment === null ? [] : [field.comment]), ...conceptLine(field.noteId)];
  const suffix = parts.length === 0 ? '' : ` // ${parts.join(' ')}`;
  return `  ${prefix}${field.fieldType} ${field.name} = ${field.index};${suffix}`;
}

function renderOneOf(model) {
  const fields = model.fields.map(field => `    ${field.fieldType} ${field.name} = ${field.index};`).join('\n');
  return `\n  oneof ${model.name} {\n${fields}\n  }`;
}

function renderMessage(model) {
  const fields = model.fields.map(renderField).join('\n');
  const oneOfs = model.oneOfs.map(renderOneOf).join('\n');
  // ProtoTemplate intentionally ignores nestedEnums/nestedMessages. Do not
  // recurse or flatten further, and preserve the blank line before each close.
  return `message ${model.name} {\n${fields}\n${oneOfs}\n}`;
}

export function renderClassicProto(model) {
  const imports = model.imports.map(name => `import "${name}";`).join('\n');
  const javaPackage = model.javaPackage === null ? '' : `option java_package = "${model.javaPackage}";`;
  const enums = model.enums.map(renderEnum).join('\n\n');
  const messages = model.messages.map(renderMessage).join('\n\n');
  // The two sealed .proto files use proto3; no protocol/serializer migration.
  // File stamps belong exclusively to Main's classicProtoArtifact assembly.
  return `syntax = "proto3";

package ${model.packageName};

${imports}

option java_multiple_files = true;
${javaPackage}

${enums}

${messages}
`;
}

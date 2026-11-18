function dependencyImports(model) {
  const names = model.dependencies.map(ref => `${ref.packageName}.${ref.name}`);
  return [...new Set(names)].sort().map(name => `import ${name}`).join('\n');
}

function toJournalCase(mapping, model) {
  if (mapping.protoOneOfName === null) throw new Error('Event adapter requires a proto oneof case');
  return `
      case evt: ${mapping.scalaCaseName} =>
        ${model.protoRootType.name}.${mapping.protoOneOfName}(${mapping.scalaCaseName}Conv.toProto(evt))
`;
}

function fromJournalCase(mapping, model) {
  if (mapping.protoOneOfName === null) throw new Error('Event adapter requires a proto oneof case');
  return `
      case ${model.protoRootType.name}.${mapping.protoOneOfName}(po) =>
        EventSeq.single(${mapping.scalaCaseName}Conv.fromProto(po))
`;
}

export function renderClassicEventAdapter(model) {
  const imports = dependencyImports(model);
  const toCases = model.mappings.map(mapping => toJournalCase(mapping, model)).join('\n');
  const fromCases = model.mappings.map(mapping => fromJournalCase(mapping, model)).join('\n');
  const manifest = `  override def manifest(event: ${model.scalaRootType.name}): String = event.getClass.getName`;
  const toJournal = `
  override def toJournal(e: ${model.scalaRootType.name}): ${model.protoRootType.name} = {
    val eventUnion = e match {
${toCases}
    }
    eventUnion
  }
`;
  const fromJournal = `
  override def fromJournal(p: ${model.protoRootType.name}, manifest: String): EventSeq[${model.scalaRootType.name}] = {
    p match {
${fromCases}

      case ${model.protoRootType.name}.Empty =>
        EventSeq.empty
    }
  }
`;
  const body = `\n${manifest}\n\n${toJournal}\n\n${fromJournal}\n`;
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: 事件适配器，负责在领域事件和protobuf事件之间进行转换
 */
class ${model.selfType.name} extends EventAdapter[${model.scalaRootType.name}, ${model.protoRootType.name}] with ${model.converterTrait.name} {

${body}

}
`;
}

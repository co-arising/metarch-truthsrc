export function renderClassicSnapshotAdapter(model) {
  const base = [...new Set(model.dependencies.map(ref => `${ref.packageName}.${ref.name}`))].sort();
  // Frozen SnapshotAdapterTemplate appends this literal, then the shared Scala
  // imports DSL sorts again WITHOUT deduplication. Keep the repeated import.
  const imports = [...base, 'akka.persistence.typed.SnapshotAdapter'].sort()
    .map(name => `import ${name}`).join('\n');
  const mapping = model.mappings[0]; // Original .head, not an empty fallback.
  const converter = `${mapping.scalaCaseName}Conv`;
  const toJournal = `
  override def toJournal(state: ${model.scalaRootType.name}): Any = {
    ${converter}.toProto(state)
  }
`;
  const fromJournal = `
  override def fromJournal(from: Any): ${model.scalaRootType.name} = {
    val proto = from.asInstanceOf[${model.protoRootType.name}]
    ${converter}.fromProto(proto)
  }
`;
  const body = `\n${toJournal}\n\n${fromJournal}\n`;
  return `package ${model.selfType.packageName}

${imports}

/**
 * ${model.selfType.name}: 快照适配器，负责在领域快照和protobuf快照之间进行转换
 */
class ${model.selfType.name} extends SnapshotAdapter[${model.scalaRootType.name}] with ${model.converterTrait.name} {

${body}

}
`;
}

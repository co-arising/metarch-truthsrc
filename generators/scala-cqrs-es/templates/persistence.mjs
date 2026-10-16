// persistence.mjs — Event/SnapshotAdapter + ProtoConverters rendering, byte-mirrors of
// EventAdapterTemplate / SnapshotAdapterTemplate / AggregateConverterTemplate (the s""
// interpolations reproduced literally: case blocks joined with "\n" each carrying leading and
// trailing newlines, classBody framed by single newlines, the converter trait's S2-82-B3
// self-companion tail, and the snapshot adapter's duplicated framework import line).
import { headerOf } from '../builders/models.mjs';

const importLines = (imports) => imports.map((i) => `import ${i}`).join('\n');

export function renderEventAdapter(m, env) {
  const toJournalCases = m.mappings
    .map((n) => `\n      case evt: ${n} =>\n        ${m.protoRoot}.${n}(${n}Conv.toProto(evt))\n`)
    .join('\n');
  const fromJournalCases = m.mappings
    .map((n) => `\n      case ${m.protoRoot}.${n}(po) =>\n        EventSeq.single(${n}Conv.fromProto(po))\n`)
    .join('\n');
  const manifestMethod = `  override def manifest(event: ${m.scalaRoot}): String = event.getClass.getName`;
  const toJournalMethod = `\n  override def toJournal(e: ${m.scalaRoot}): ${m.protoRoot} = {\n    val eventUnion = e match {\n${toJournalCases}\n    }\n    eventUnion\n  }\n`;
  const fromJournalMethod = `\n  override def fromJournal(p: ${m.protoRoot}, manifest: String): EventSeq[${m.scalaRoot}] = {\n    p match {\n${fromJournalCases}\n\n      case ${m.oneOfParent}.Empty =>\n        EventSeq.empty\n    }\n  }\n`;
  const classBody = `\n${manifestMethod}\n\n${toJournalMethod}\n\n${fromJournalMethod}\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: 事件适配器，负责在领域事件和protobuf事件之间进行转换\n */\nclass ${m.name} extends EventAdapter[${m.scalaRoot}, ${m.protoRoot}] with ${m.convTrait} {\n\n${classBody}\n\n}\n`;
}

export function renderSnapshotAdapter(m, env) {
  const toJournalMethod = `\n  override def toJournal(state: ${m.scalaRoot}): Any = {\n    ${m.convObj}.toProto(state)\n  }\n`;
  const fromJournalMethod = `\n  override def fromJournal(from: Any): ${m.scalaRoot} = {\n    val proto = from.asInstanceOf[${m.protoRoot}]\n    ${m.convObj}.fromProto(proto)\n  }\n`;
  const classBody = `\n${toJournalMethod}\n\n${fromJournalMethod}\n`;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\n/**\n * ${m.name}: 快照适配器，负责在领域快照和protobuf快照之间进行转换\n */\nclass ${m.name} extends SnapshotAdapter[${m.scalaRoot}] with ${m.convTrait} {\n\n${classBody}\n\n}\n`;
}

const helperConverters = '\n  object ListConv {\n    def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)\n    def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList\n  }\n\n  object InstantConv {\n    def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)\n    def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)\n  }\n';

export function renderConverters(m, env) {
  const renderConverter = (c) => {
    const toArgs = c.fields.map(({ toArg }) => toArg).join(',\n      ');
    const fromArgs = c.fields.map(({ fromArg }) => fromArg).join(',\n      ');
    return `\n  object ${c.objectName} extends ProtoConverter[${c.participantName}, ${c.poName}] {\n    override def toProto(d: ${c.participantName}): ${c.poName} = ${c.poName}(\n      ${toArgs}\n    )\n\n    override def fromProto(p: ${c.poName}): ${c.participantName} = ${c.participantName}(\n      ${fromArgs}\n    )\n  }\n`;
  };
  const convertersCode = m.converters.map(renderConverter).join('\n') + '\n' + helperConverters;
  return `${headerOf(env)}package ${m.pkg}\n\n${importLines(m.imports)}\n\ntrait ${m.name} extends PrimitiveConverter {\n${convertersCode}\n}\n\n/** S2-82-B3（2026-09-11）：self-companion——trait 嵌套 Conv object 的静态寻址口。\n  * Scala trait 无 term（TraitName.NestedObject 编译红「no companion object」）——\n  * 投影 handler/读端经 ${m.name}.XxxConv.fromProto 静态调用需要本伴生；\n  * EventAdapter/SnapshotAdapter 等 mixin 消费方不受影响（trait 本体原样）。 */\nobject ${m.name} extends ${m.name}\n`;
}

import { conventions as naming } from '../../../../lib/classic-architecture/naming.mjs';
import { conceptLine } from '../../../../lib/classic-architecture/knowledge.mjs';

function converterObject(t) {
  switch (t.name) {
    case 'String': return 'StringConv';
    case 'Id': return 'IdConv';
    case 'Currency': return 'CurrencyConv';
    default: return `${t.name}Conv`;
  }
}

function mapped(value, converter, toProto) {
  return `${value}.map(${converter}.${toProto ? 'toProto' : 'fromProto'})`;
}

function optionConversion(t, value, toProto) {
  const inner = t.typeParams[0];
  if (inner.name === 'Boolean') return value;
  if (inner.name === 'List' || inner.name === 'Seq') {
    const converter = converterObject(inner.typeParams[0]);
    return toProto ? mapped(`${value}.getOrElse(Nil)`, converter, true)
      : `Some(${mapped(value, converter, false)}.toList)`;
  }
  return mapped(value, converterObject(inner), toProto);
}

function nestedConversion(t, value, fieldName, toProto) {
  const converter = converterObject(t);
  return toProto ? `Some(${converter}.toProto(${value}))`
    : `${converter}.fromProto(${value}.getOrElse(throw new IllegalArgumentException(s"Missing required field: ${fieldName}")))`;
}

// AggregateConverterTemplate.resolveConversion: keep unsupported/raw primitive
// converter names, Option[Map] mapping and Set -> List behavior, not repairs.
function conversion(t, fieldName, toProto) {
  const value = `${toProto ? 'd' : 'p'}.${naming.scalaIdentifier(fieldName)}`;
  const direction = toProto ? 'toProto' : 'fromProto';
  switch (t.name) {
    case 'String': case 'Long': case 'Int': case 'Double': case 'Boolean': return value;
    case 'BigDecimal': return toProto ? `${value}.doubleValue` : `BigDecimal(${value})`;
    case 'Id': case 'Currency': case 'Instant': return `${converterObject(t)}.${direction}(${value})`;
    case 'Option': return optionConversion(t, value, toProto);
    case 'List': case 'Seq': case 'Set': {
      const expression = mapped(value, converterObject(t.typeParams[0]), toProto);
      return toProto ? expression : `${expression}.toList`;
    }
    case 'Vector': {
      const expression = mapped(value, converterObject(t.typeParams[0]), toProto);
      return toProto ? expression : `${expression}.toVector`;
    }
    case 'Map': {
      const key = converterObject(t.typeParams[0]), item = converterObject(t.typeParams[1]);
      return `${direction}Map(${value}, ${key}, ${item})`;
    }
    default: return nestedConversion(t, value, fieldName, toProto);
  }
}

function argument(field, toProto) {
  const line = `${naming.scalaIdentifier(field.name)} = ${conversion(field.typeRef, field.name, toProto)}`;
  const knowledge = conceptLine(field.noteId);
  return knowledge.length === 0 ? line : `// ${knowledge[0]}\n      ${line}`;
}

function converterDefinition(model) {
  const toArgs = model.fields.map(field => argument(field, true)).join(',\n      ');
  const fromArgs = model.fields.map(field => argument(field, false)).join(',\n      ');
  return `
  object ${model.objectName} extends ProtoConverter[${model.participantType.name}, ${model.poType.name}] {
    override def toProto(d: ${model.participantType.name}): ${model.poType.name} = ${model.poType.name}(
      ${toArgs}
    )

    override def fromProto(p: ${model.poType.name}): ${model.participantType.name} = ${model.participantType.name}(
      ${fromArgs}
    )
  }
`;
}

function helperConverters() {
  return `
  object ListConv {
    def toProto[D, P](domain: List[D])(implicit c: ProtoConverter[D, P]): Seq[P] = domain.map(c.toProto)
    def fromProto[D, P](proto: Seq[P])(implicit c: ProtoConverter[D, P]): List[D] = proto.map(c.fromProto).toList
  }

  object InstantConv {
    def toProto(domain: java.time.Instant): Long = Option(domain).fold(0L)(_.toEpochMilli)
    def fromProto(proto: Long): java.time.Instant = java.time.Instant.ofEpochMilli(proto)
  }
`;
}

export function renderClassicAggregateConverter(model) {
  const importNames = model.dependencies
    .filter(ref => ref.packageName !== '' && ref.packageName !== 'java.lang' && ref.packageName !== 'scala')
    .map(ref => `${ref.packageName}.${ref.name}`);
  const imports = [...new Set(importNames)].sort().map(name => `import ${name}`).join('\n');
  const definitions = [...model.valueObjects, ...model.events, ...(model.state === null ? [] : [model.state])];
  const converters = definitions.map(converterDefinition).join('\n') + '\n' + helperConverters();
  return `package ${model.selfType.packageName}

${imports}

trait ${model.selfType.name} extends ${model.parentType.name} {
${converters}
}

/** S2-82-B3（2026-09-11）：self-companion——trait 嵌套 Conv object 的静态寻址口。
  * Scala trait 无 term（TraitName.NestedObject 编译红「no companion object」）——
  * 投影 handler/读端经 ${model.selfType.name}.XxxConv.fromProto 静态调用需要本伴生；
  * EventAdapter/SnapshotAdapter 等 mixin 消费方不受影响（trait 本体原样）。 */
object ${model.selfType.name} extends ${model.selfType.name}
`;
}

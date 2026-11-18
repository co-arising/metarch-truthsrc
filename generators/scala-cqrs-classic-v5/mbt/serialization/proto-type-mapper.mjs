import { NormalField, MapField } from './proto-model.mjs';

// ProtoTypeMapper.scala. In particular, BigDecimal -> double is intentionally
// lossy, and Set is NOT an admitted repeated container in the original mapper.
export function toProtoTypeString(t, ctx) {
  switch (t.name) {
    case 'String': case 'Id': case 'UUID': case 'Currency': return 'string';
    case 'Int': return 'int32';
    case 'Long': case 'Instant': return 'int64';
    case 'Double': case 'BigDecimal': return 'double';
    case 'Boolean': return 'bool';
    case 'Option':
      if (t.typeParams.length > 0) return `optional ${toProtoTypeString(t.typeParams[0], ctx)}`;
      break;
  }
  return `${ctx.layout.infrastructure.proto.root}.${t.name}PO`;
}

const isRepeatedContainer = t => ['List', 'Seq', 'Vector'].includes(t.name);

function repeatedField(name, t, index, ctx, comment, noteId) {
  return NormalField(name, toProtoTypeString(t.typeParams[0], ctx), index, true, false, comment, noteId);
}

// AggregateRootProtoBuilder.toProtoField, not the mapper's tuple wrapper.
export function toProtoField(name, t, index, ctx, comment = null, noteId = null) {
  if (t.name === 'Map' && t.typeParams.length === 2) {
    return MapField(name,
      toProtoTypeString(t.typeParams[0], ctx), toProtoTypeString(t.typeParams[1], ctx), index, noteId);
  }
  if (t.name === 'Option' && t.typeParams.length === 1) {
    const inner = t.typeParams[0];
    return isRepeatedContainer(inner) ? repeatedField(name, inner, index, ctx, comment, noteId)
      : NormalField(name, toProtoTypeString(inner, ctx), index, false, true, comment, noteId);
  }
  if (isRepeatedContainer(t)) return repeatedField(name, t, index, ctx, comment, noteId);
  return NormalField(name, toProtoTypeString(t, ctx), index, false, false, comment, noteId);
}

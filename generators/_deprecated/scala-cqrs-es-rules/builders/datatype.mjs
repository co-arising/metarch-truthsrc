// datatype.mjs — dataType → Scala type mapping for the rules face. Full port of the live
// authority DataTypeMapper.map (AssemblyEngine.scala:1035-1058, lowercase-matched, raw form
// preserved for the VO fallback). The live rules_domain_gen sources its Params/Entity types
// from the skeleton's on-disk protocol/entity (two-pass pipeline inheritance); truthsrc
// re-derives the identical mapping statically — same table, same result, zero repo reads.
export function scalaSig(dataType) {
  const raw = String(dataType ?? '').trim();
  const s = raw.toLowerCase();
  if (s === 'string (uuid)' || s === 'uuid') return 'Id';
  if (s === 'string') return 'String';
  if (s === 'int' || s === 'integer') return 'Int';
  if (s === 'long') return 'Long';
  if (s === 'double') return 'Double';
  if (s === 'boolean' || s === 'bool') return 'Boolean';
  if (s === 'decimal' || s === 'bigdecimal') return 'BigDecimal';
  if (s === 'instant' || s === 'datetime') return 'Instant';
  if (s === 'string (enum)') return 'String';       // 枚举值以字符串承载
  if (s === 'string (json)' || s === 'json') return 'String';
  if ((s.startsWith('list[') || s.startsWith('list<')) && (s.endsWith(']') || s.endsWith('>')))
    return `List[${scalaSig(raw.slice(5, raw.length - 1))}]`;  // 递归切片用原始名（保大小写）
  if (s === 'array<string>') return 'List[String]';
  return raw !== '' ? raw : 'String';                // live `case _ => StringType` for empty; VO fallback verbatim
}

// optionality (AssemblyEngine paramMeta optional → Option[T]; RuleParams VOs carry NO default)
export const sigOf = (p) => (p?.optional ? `Option[${scalaSig(p.dataType)}]` : scalaSig(p.dataType));

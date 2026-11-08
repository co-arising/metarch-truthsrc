/** Finite JDBC column mechanics shared by the legacy and H2 readside models. */
export function jdbcScalaType(column) {
  const base = { text: 'String', digest: 'String', long: 'Long', boolean: 'Boolean', bytes: 'Array[Byte]' }[column.type];
  if (!base) throw new TypeError('unsupported journal index column type');
  return column.nullable ? `Option[${base}]` : base;
}
export function jdbcSqlType(column, dialect = 'mysql') {
  if (column.type === 'text') return `VARCHAR(${column.size})`;
  const name = { digest: 'CHAR(64)', long: 'BIGINT', boolean: 'BOOLEAN', bytes: dialect === 'h2-2' ? 'BLOB' : 'LONGBLOB' }[column.type];
  if (!name) throw new TypeError('unsupported journal index column type');
  return name;
}
export function jdbcIndexReader(column) {
  const getter = { text: 'getString', digest: 'getString', long: 'getLong', boolean: 'getBoolean', bytes: 'getBytes' }[column.type];
  if (!getter) throw new TypeError('unsupported JDBC result type');
  const value = `result.${getter}(${JSON.stringify(column.name)})`;
  return !column.nullable ? value : ['long', 'boolean'].includes(column.type)
    ? `{ val value = ${value}; if (result.wasNull()) None else Some(value) }` : `Option(${value})`;
}

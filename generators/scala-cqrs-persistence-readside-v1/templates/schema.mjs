import { jdbcSqlType } from '../../shared-jdbc/model.mjs';
const q = JSON.stringify;
const sql = table => `CREATE TABLE ${table.name} (\n${table.columns.map(c => '  ' + c.name + ' ' + jdbcSqlType(c, 'h2-2') + ' NOT NULL,').join('\n')}\n  PRIMARY KEY (${table.key.join(', ')})\n)`;

export function sqlTemplate(m, out) {
  for (const table of m.schema.tables) out.append(sql(table) + ';\n\n', [m.product.store.bindingSource, ...(table.name.endsWith('_' + m.index.table) ? [m.index.source, m.index.fieldSource] : [])]);
}

export function schemaTemplate(m, out) {
  const n = m.names.schema;
  out.append(`package ${n.package}

import java.sql.{Connection, DatabaseMetaData, Types}
import java.util.Locale

object ${n.identifier} {
  val compatibilityKey: String = ${q(m.compatibilityKey)}
  private final case class Column(name: String, jdbcType: Int, size: Int)
  private final case class Table(name: String, columns: Vector[Column], key: Vector[String])
  val statements: Vector[String] = Vector(
`, m.sources);
  m.schema.tables.forEach((t, i) => out.append(`    ${q(sql(t))}${i + 1 < m.schema.tables.length ? ',' : ''}
`, [m.product.store.bindingSource, ...(t.name.endsWith('_' + m.index.table) ? [m.index.source, m.index.fieldSource] : [])]));
  out.append(`  )
  private val tables = Vector(
`, [m.product.store.bindingSource]);
  m.schema.tables.forEach((t, i) => out.append(`    Table(${q(t.name)}, Vector(${t.columns.map(c => `Column(${q(c.name)}, Types.${{ text: 'VARCHAR', digest: 'CHAR', long: 'BIGINT', bytes: 'BLOB' }[c.type]}, ${c.type === 'text' ? c.size : c.type === 'digest' ? 64 : 0})`).join(', ')}), Vector(${t.key.map(q).join(', ')}))${i + 1 < m.schema.tables.length ? ',' : ''}
`, [m.product.store.bindingSource, ...(t.name.endsWith('_' + m.index.table) ? [m.index.source, m.index.fieldSource] : [])]));
  out.append(`  )
  private def upper(value: String): String = value.toUpperCase(Locale.ROOT)
  private def nativeH2(connection: Connection): Unit = {
    require(connection != null, "schema connection required")
    val metadata = connection.getMetaData
    require(metadata.getDatabaseProductName == "H2" && metadata.getDatabaseMajorVersion == 2, "native H2 2 required")
    val statement = connection.prepareStatement("SELECT SETTING_VALUE FROM INFORMATION_SCHEMA.SETTINGS WHERE SETTING_NAME='MODE'")
    try {
      val result = statement.executeQuery()
      try require(result.next() && result.getString(1) == "REGULAR" && !result.next(), "native H2 REGULAR mode required")
      finally result.close()
    } finally statement.close()
    val comparison = connection.prepareStatement("SELECT SETTING_VALUE FROM INFORMATION_SCHEMA.SETTINGS WHERE SETTING_NAME='IGNORECASE'")
    try {
      val result = comparison.executeQuery()
      // H2 2.2 stores explicit FALSE as 0; the unset default has no settings row.
      try require(!result.next() || (result.getString(1) == "0" && !result.next()), "case-sensitive H2 comparison required")
      finally result.close()
    } finally comparison.close()
  }
  private def existing(connection: Connection): Set[String] = {
    val result = connection.getMetaData.getTables(connection.getCatalog, connection.getSchema, null, null)
    val found = Set.newBuilder[String]
    try while (result.next()) {
      val name = result.getString("TABLE_NAME")
      if (name.startsWith(${q(m.product.store.tablePrefix.toUpperCase() + '_')})) {
        require(result.getString("TABLE_TYPE") == "BASE TABLE" || result.getString("TABLE_TYPE") == "TABLE", "readside table replaced by a view")
        found += name
      }
    } finally result.close()
    found.result()
  }
  def install(connection: Connection): Unit = {
    nativeH2(connection)
    val present = existing(connection)
    val expected = tables.map(t => upper(t.name)).toSet
    require(present.isEmpty || present == expected, "incomplete or incompatible readside schema; migrations are not supported")
    if (present.isEmpty) statements.foreach { sql =>
      val statement = connection.createStatement()
      try statement.execute(sql) finally statement.close()
    }
    validate(connection)
  }
  def validate(connection: Connection): Unit = {
    nativeH2(connection)
    require(existing(connection) == tables.map(t => upper(t.name)).toSet, "readside schema not installed or incompatible")
    val metadata = connection.getMetaData
    tables.foreach { table =>
      val columns = metadata.getColumns(connection.getCatalog, connection.getSchema, upper(table.name), null)
      val actual = Vector.newBuilder[(Int, String, Int, Int)]
      try while (columns.next()) {
        if (columns.getString("TABLE_NAME") == upper(table.name) && columns.getString("TABLE_SCHEM") == connection.getSchema && columns.getString("TABLE_CAT") == connection.getCatalog) {
          require(!columns.getString("TYPE_NAME").equalsIgnoreCase("VARCHAR_IGNORECASE"), "case-sensitive text columns required")
          require(columns.getInt("NULLABLE") == DatabaseMetaData.columnNoNulls && columns.getString("COLUMN_DEF") == null && columns.getString("IS_AUTOINCREMENT") == "NO",
            "incompatible column nullability/default/identity")
          actual += ((columns.getInt("ORDINAL_POSITION"), columns.getString("COLUMN_NAME"), columns.getInt("DATA_TYPE"), columns.getInt("COLUMN_SIZE")))
        }
      } finally columns.close()
      val ordered = actual.result().sortBy(_._1)
      require(ordered.size == table.columns.size, "incompatible column count")
      table.columns.zip(ordered).foreach { case (expected, (position, name, jdbcType, size)) =>
        require(name == upper(expected.name) && jdbcType == expected.jdbcType && (expected.size == 0 || size == expected.size),
          "incompatible readside column: " + table.name + "." + expected.name)
      }
      val keys = metadata.getPrimaryKeys(connection.getCatalog, connection.getSchema, upper(table.name))
      val primary = Vector.newBuilder[(Int, String)]
      try while (keys.next()) primary += ((keys.getInt("KEY_SEQ"), keys.getString("COLUMN_NAME"))) finally keys.close()
      require(primary.result().sortBy(_._1).map(_._2) == table.key.map(upper), "incompatible primary key")
    }
  }
}
`, [m.product.store.bindingSource, m.index.source]);
}

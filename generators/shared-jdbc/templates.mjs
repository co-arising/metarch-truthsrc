/** Literal shared parameter binding and resource-safe JDBC query/update mechanics.
 * The legacy caller consumes the exact original bytes; no rendered-text rewriting.
 */
export function jdbcPrimitivesTemplate() {
  return `  private def bindOne(statement: PreparedStatement, position: Int, value: Any): Unit = value match {
    case None => statement.setNull(position, java.sql.Types.NULL)
    case Some(item) => bindOne(statement, position, item)
    case bytes: Array[Byte] => statement.setBytes(position, bytes)
    case number: Long => statement.setLong(position, number)
    case number: Int => statement.setInt(position, number)
    case flag: Boolean => statement.setBoolean(position, flag)
    case text: String => statement.setString(position, text)
    case _ => throw new IllegalArgumentException("unsupported JDBC parameter")
  }
  private def bind(statement: PreparedStatement, values: Seq[Any]): Unit =
    values.zipWithIndex.foreach { case (value, index) => bindOne(statement, index + 1, value) }
  private def execute(connection: Connection, sql: String, values: Seq[Any]): Int = {
    val statement = connection.prepareStatement(sql)
    try { bind(statement, values); statement.executeUpdate() } finally statement.close()
  }
  private def query[A](connection: Connection, sql: String, values: Seq[Any])(decode: ResultSet => A): Vector[A] = {
    val statement = connection.prepareStatement(sql)
    try {
      bind(statement, values)
      val result = statement.executeQuery()
      try { val rows = Vector.newBuilder[A]; while (result.next()) rows += decode(result); rows.result() }
      finally result.close()
    } finally statement.close()
  }
`;
}

/** One transaction/session engine. Hooks are template fragments, never user SQL.
 * v2 distinguishes an attempted commit from a proven precommit failure; legacy
 * keeps its old catch/rollback bytes and behavior exactly.
 */
export function jdbcTransactionTemplate({ signature, session, beforeBody, invoke = 'f(session)', unknownCommit = false, finishBeforeCommit = false }) {
  return `  ${signature} = blocking {
    val connection = dataSource.getConnection
    try {
      connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ)
      connection.setAutoCommit(false)
      val session = ${session}
${unknownCommit ? '      var committing = false\n' : ''}      try {
${beforeBody}        val result = ${finishBeforeCommit ? 'try ' + invoke + ' finally session.finish()' : invoke}
${unknownCommit ? '        committing = true\n' : ''}        connection.commit()
        result
      } catch {
        case NonFatal(error) =>
          ${unknownCommit ? 'if (!committing) ' : ''}try connection.rollback() catch { case NonFatal(rollback) => error.addSuppressed(rollback) }
          throw error
      } finally session.finish()
    } finally connection.close()
  }
`;
}

/** Session lifetime and thread ownership are parameters, not a second engine. */
export function jdbcSessionTemplate({ owner, threadConfined = false }) {
  return `    private var active = true
${threadConfined ? '    private val ownerThread = Thread.currentThread()\n' : ''}    private[${owner}] def finish(): Unit = { active = false }
    private def requireActive(): Unit = require(active${threadConfined ? ' && (Thread.currentThread() eq ownerThread)' : ''}, "transaction session is closed${threadConfined ? ' or used by another thread' : ''}")
    private def requireWrite(): Unit = { requireActive(); require(writable, "write transaction required") }
    private def update(sql: String, values: Any*): Int = { requireWrite(); execute(connection, sql, values) }
    private def select[A](sql: String, values: Seq[Any])(decode: ResultSet => A): Vector[A] = {
      requireActive(); query(connection, sql, values)(decode)
    }
`;
}

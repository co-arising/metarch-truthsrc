import { symbol } from '../scala-cqrs-domain/naming.mjs';

const q = JSON.stringify;
const scalaType = column => {
  const base = { text: 'String', digest: 'String', long: 'Long', boolean: 'Boolean', bytes: 'Array[Byte]' }[column.type];
  if (!base) throw new TypeError('unsupported journal index column type');
  return column.nullable ? `Option[${base}]` : base;
};
const sqlType = column => {
  if (column.type === 'text') return `VARCHAR(${column.size})`;
  const name = { digest: 'CHAR(64)', long: 'BIGINT', boolean: 'BOOLEAN', bytes: 'LONGBLOB' }[column.type];
  if (!name) throw new TypeError('unsupported journal index column type');
  return name;
};

export function journalStatements(store) {
  const prefix = store.tablePrefix;
  return [
    `CREATE TABLE IF NOT EXISTS ${prefix}_namespace (
  namespace VARCHAR(64) NOT NULL PRIMARY KEY, schema_version VARCHAR(64) NOT NULL
)`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_stream (
  namespace VARCHAR(64) NOT NULL, pid_key CHAR(64) NOT NULL,
  persistence_id VARCHAR(2048) NOT NULL, kind VARCHAR(32) NOT NULL,
  resource_id VARCHAR(2048) NOT NULL, owner_account VARCHAR(1024), owner_principal VARCHAR(256),
  last_sequence BIGINT NOT NULL, observed_sequence BIGINT, state_payload LONGBLOB,
  PRIMARY KEY (namespace, pid_key)
)`,
    `CREATE TABLE IF NOT EXISTS ${prefix}_event (
  namespace VARCHAR(64) NOT NULL, pid_key CHAR(64) NOT NULL, sequence_nr BIGINT NOT NULL,
  payload_type VARCHAR(512) NOT NULL, payload_manifest VARCHAR(1024) NOT NULL,
  payload LONGBLOB NOT NULL, PRIMARY KEY (namespace, pid_key, sequence_nr)
)`,
    ...store.indexes.map(index => `CREATE TABLE IF NOT EXISTS ${prefix}_${index.table} (
  namespace VARCHAR(64) NOT NULL,
${index.columns.map(c => `  ${c.name} ${sqlType(c)}${c.nullable ? '' : ' NOT NULL'},`).join('\n')}
  PRIMARY KEY (namespace, ${index.key.join(', ')})
)`)
  ];
}

function indexReader(column) {
  const getter = { text: 'getString', digest: 'getString', long: 'getLong', boolean: 'getBoolean', bytes: 'getBytes' }[column.type];
  const value = `result.${getter}(${q(column.name)})`;
  return !column.nullable ? value : ['long', 'boolean'].includes(column.type)
    ? `{ val value = ${value}; if (result.wasNull()) None else Some(value) }` : `Option(${value})`;
}

function indexMethods(store, index) {
  const name = `${symbol(store.id)}Repository.${symbol(index.id)}`, table = `${store.tablePrefix}_${index.table}`;
  const column = name => index.columns.find(c => c.name === name);
  const args = names => names.map(n => `${symbol(n)}: ${scalaType(column(n))}`).join(', ');
  const values = (names, prefix = '') => names.map(n => prefix + symbol(n)).join(', ');
  // Nullable equality needs two parameters so that None means SQL NULL, not '= NULL'.
  const predicate = names => names.map(n => column(n).nullable ? `(${n}=? OR (${n} IS NULL AND ? IS NULL))` : `${n}=?`).join(' AND ');
  const parameters = names => names.flatMap(n => column(n).nullable ? [n, n] : [n]);
  return `    def put${index.id}(record: ${name}): Unit = {
      requireWrite()
      delete${index.id}(${values(index.key, 'record.')})
      update(${q(`INSERT INTO ${table}(namespace,${index.columns.map(c => c.name).join(',')}) VALUES (${Array(index.columns.length + 1).fill('?').join(',')})`)}, namespace, ${values(index.columns.map(c => c.name), 'record.')})
      ()
    }
    def delete${index.id}(${args(index.key)}): Unit = {
      requireWrite()
      update(${q(`DELETE FROM ${table} WHERE namespace=? AND ${predicate(index.key)}`)}, namespace, ${values(parameters(index.key))})
      ()
    }
${index.queries.map(query => `    def query${index.id}${query.id}(${args(query.where)}${query.where.length ? ', ' : ''}limit: Long, after: Long): Vector[${name}] = {
      requirePage(limit, after)
      select(${q(`SELECT ${index.columns.map(c => c.name).join(',')} FROM ${table} WHERE namespace=?${query.where.length ? ' AND ' + predicate(query.where) : ''} ORDER BY ${query.orderBy.join(',')} LIMIT ? OFFSET ?`)}, Seq(namespace, ${query.where.length ? values(parameters(query.where)) + ', ' : ''}limit, after)) { result =>
        ${name}(${index.columns.map(indexReader).join(', ')})
      }
    }
`).join('')}`;
}

/** Render only transaction mechanics. Index ownership and business rules are caller ports. */
export function renderJournalRepository(pkg, store) {
  const name = symbol(store.id), prefix = store.tablePrefix;
  return `package ${pkg}.infrastructure.projection

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.sql.{Connection, PreparedStatement, ResultSet}
import javax.sql.DataSource
import scala.concurrent.blocking
import scala.util.control.NonFatal

object ${name}Repository {
  final case class Row(pid: String, kind: String, resource: String, account: Option[String], principal: Option[String], last: Long, observed: Option[Long], payload: Option[Array[Byte]])
  final case class Payload(kind: String, manifest: String, bytes: Array[Byte])
  final case class State(payload: Option[Array[Byte]], account: Option[String], principal: Option[String])
  final case class Owner(pid: String, account: Option[String], principal: Option[String])
${store.indexes.map(index => `  final case class ${symbol(index.id)}(${index.columns.map(c => `${symbol(c.name)}: ${scalaType(c)}`).join(', ')})`).join('\n')}
  def hash(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.getBytes(StandardCharsets.UTF_8)).map(b => f"\$\{b & 0xff\}%02x").mkString
}

final class ${name}Repository(namespace: String, dataSource: DataSource) {
  import ${name}Repository.{Row, Payload, State, Owner, hash}
  require(namespace != null && namespace.nonEmpty && namespace.length <= 64, "bounded journal namespace required")
  require(dataSource != null, "JDBC data source required")

  private def bindOne(statement: PreparedStatement, position: Int, value: Any): Unit = value match {
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
  def initialize(): Unit = blocking {
    val connection = dataSource.getConnection
    try {
      connection.setAutoCommit(true)
      ${name}Schema.statements.foreach { sql =>
        val statement = connection.createStatement()
        try statement.execute(sql) finally statement.close()
      }
      def versions(): Vector[String] = query(connection, "SELECT schema_version FROM ${prefix}_namespace WHERE namespace=?", Seq(namespace))(_.getString(1))
      if (versions().isEmpty) {
        try execute(connection, "INSERT INTO ${prefix}_namespace(namespace,schema_version) VALUES (?,?)", Seq(namespace, ${name}Schema.version))
        catch { case error: java.sql.SQLException if Option(error.getSQLState).exists(_.startsWith("23")) => () }
      }
      require(versions() == Vector(${name}Schema.version), "incompatible read schema")
    } finally connection.close()
  }
  def read[A](f: Session => A): A = transaction(writable = false)(f)
  def write[A](f: Session => A): A = transaction(writable = true)(f)
  private def transaction[A](writable: Boolean)(f: Session => A): A = blocking {
    val connection = dataSource.getConnection
    try {
      connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ)
      connection.setAutoCommit(false)
      val session = new Session(connection, writable)
      try {
        if (writable) {
          val versions = query(connection, "SELECT schema_version FROM ${prefix}_namespace WHERE namespace=? FOR UPDATE", Seq(namespace))(_.getString(1))
          require(versions == Vector(${name}Schema.version), "read schema namespace is not installed")
        }
        val result = f(session)
        connection.commit()
        result
      } catch {
        case NonFatal(error) =>
          try connection.rollback() catch { case NonFatal(rollback) => error.addSuppressed(rollback) }
          throw error
      } finally session.finish()
    } finally connection.close()
  }

  final class Session private[${name}Repository] (connection: Connection, writable: Boolean) {
    private var active = true
    private[${name}Repository] def finish(): Unit = { active = false }
    private def requireActive(): Unit = require(active, "transaction session is closed")
    private def requireWrite(): Unit = { requireActive(); require(writable, "write transaction required") }
    private def update(sql: String, values: Any*): Int = { requireWrite(); execute(connection, sql, values) }
    private def select[A](sql: String, values: Seq[Any])(decode: ResultSet => A): Vector[A] = {
      requireActive(); query(connection, sql, values)(decode)
    }
    private def requirePage(limit: Long, after: Long): Unit =
      require(limit > 0L && limit <= Int.MaxValue.toLong && after >= 0L && after <= Int.MaxValue.toLong, "bounded page required")
    private def decodeRow(result: ResultSet): Row = {
      val observed = result.getLong("observed_sequence")
      val high = if (result.wasNull()) None else Some(observed)
      Row(result.getString("persistence_id"), result.getString("kind"), result.getString("resource_id"),
        Option(result.getString("owner_account")), Option(result.getString("owner_principal")),
        result.getLong("last_sequence"), high, Option(result.getBytes("state_payload")))
    }
    def row(pid: String): Option[Row] = {
      val found = select("SELECT * FROM ${prefix}_stream WHERE namespace=? AND pid_key=?", Seq(namespace, hash(pid)))(decodeRow).headOption
      found.foreach(value => require(value.pid == pid, "PID digest collision"))
      found
    }
    def owners(pid: String): Option[Owner] = {
      val found = select("SELECT persistence_id,owner_account,owner_principal FROM ${prefix}_stream WHERE namespace=? AND pid_key=?", Seq(namespace, hash(pid))) { result =>
        Owner(result.getString(1), Option(result.getString(2)), Option(result.getString(3)))
      }.headOption
      found.foreach(value => require(value.pid == pid, "PID digest collision"))
      found
    }
    def ensureRow(pid: String, kind: String, resource: String): Row = {
      requireWrite()
      row(pid) match {
        case Some(value) =>
          require(value.kind == kind && value.resource == resource, "persistence identity mismatch")
          value
        case None =>
          update("INSERT INTO ${prefix}_stream(namespace,pid_key,persistence_id,kind,resource_id,last_sequence) VALUES (?,?,?,?,?,0)", namespace, hash(pid), pid, kind, resource)
          Row(pid, kind, resource, None, None, 0L, None, None)
      }
    }
    def event(pid: String, sequence: Long): Option[Payload] = {
      row(pid) // verify unhashed identity before accessing the digest-keyed event
      select("SELECT payload_type,payload_manifest,payload FROM ${prefix}_event WHERE namespace=? AND pid_key=? AND sequence_nr=?", Seq(namespace, hash(pid), sequence)) { result =>
        Payload(result.getString(1), result.getString(2), result.getBytes(3))
      }.headOption
    }
    def append(row: Row, sequence: Long, payload: Payload, state: State): Row = {
      requireWrite()
      val current = this.row(row.pid).getOrElse(throw new IllegalArgumentException("stream must exist"))
      require(current.kind == row.kind && current.resource == row.resource && current.last == row.last, "stale stream row")
      require(sequence == Math.addExact(current.last, 1L), "noncontiguous journal sequence")
      update("INSERT INTO ${prefix}_event(namespace,pid_key,sequence_nr,payload_type,payload_manifest,payload) VALUES (?,?,?,?,?,?)", namespace, hash(row.pid), sequence, payload.kind, payload.manifest, payload.bytes)
      require(update("UPDATE ${prefix}_stream SET state_payload=?,owner_account=?,owner_principal=?,last_sequence=?,observed_sequence=NULL WHERE namespace=? AND pid_key=?", state.payload, state.account, state.principal, sequence, namespace, hash(row.pid)) == 1, "stream checkpoint missing")
      current.copy(account = state.account, principal = state.principal, last = sequence, observed = None, payload = state.payload)
    }
    def observe(pid: String, high: Long): Unit = {
      requireWrite()
      val current = row(pid).getOrElse(throw new IllegalArgumentException("stream must exist"))
      require(high >= 0L && high <= current.last, "frontier cannot jump checkpoint")
      update("UPDATE ${prefix}_stream SET observed_sequence=? WHERE namespace=? AND pid_key=?", if (current.last == high) Some(high) else None, namespace, hash(pid))
      ()
    }
    def invalidate(pid: String): Unit = {
      requireWrite()
      row(pid)
      update("UPDATE ${prefix}_stream SET observed_sequence=NULL WHERE namespace=? AND pid_key=?", namespace, hash(pid))
      ()
    }
    def invalidateAll(): Unit = {
      requireWrite()
      update("UPDATE ${prefix}_stream SET observed_sequence=NULL WHERE namespace=?", namespace)
      ()
    }
    def streamPage(kind: String, account: String, principal: String, limit: Long, after: Long): Vector[Row] = {
      requirePage(limit, after)
      select("SELECT * FROM ${prefix}_stream WHERE namespace=? AND kind=? AND owner_account=? AND (owner_principal IS NULL OR owner_principal=?) ORDER BY resource_id,pid_key LIMIT ? OFFSET ?", Seq(namespace, kind, account, principal, limit, after))(decodeRow)
    }
${store.indexes.map(index => indexMethods(store, index)).join('\n')}  }
}
`;
}

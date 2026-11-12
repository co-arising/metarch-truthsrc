import { symbol } from '../scala-cqrs-domain/naming.mjs';
import { jdbcScalaType as scalaType, jdbcSqlType as sqlType, jdbcIndexReader as indexReader } from '../shared-jdbc/model.mjs';
import { jdbcPrimitivesTemplate, jdbcTransactionTemplate, jdbcSessionTemplate } from '../shared-jdbc/templates.mjs';

const q = JSON.stringify;

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

${jdbcPrimitivesTemplate()}  def initialize(): Unit = blocking {
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
${jdbcTransactionTemplate({ signature: 'private def transaction[A](writable: Boolean)(f: Session => A): A', session: 'new Session(connection, writable)', beforeBody: `        if (writable) {
          val versions = query(connection, "SELECT schema_version FROM ${prefix}_namespace WHERE namespace=? FOR UPDATE", Seq(namespace))(_.getString(1))
          require(versions == Vector(${name}Schema.version), "read schema namespace is not installed")
        }
` })}
  final class Session private[${name}Repository] (connection: Connection, writable: Boolean) {
${jdbcSessionTemplate({ owner: name + 'Repository' })}    private def requirePage(limit: Long, after: Long): Unit =
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
      // An older successful sample cannot revoke a newer observation. Appends and
      // explicit invalidation still clear freshness independently of this sample.
      if (current.last == high)
        update("UPDATE ${prefix}_stream SET observed_sequence=? WHERE namespace=? AND pid_key=?", Some(high), namespace, hash(pid))
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

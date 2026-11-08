import { jdbcPrimitivesTemplate, jdbcTransactionTemplate, jdbcSessionTemplate } from '../../shared-jdbc/templates.mjs';
import { carrierType, carrierRead, carrierWrite } from './envelope.mjs';
const q = JSON.stringify;

export function repositoryTemplate(m, out) {
  const n = m.names, p = m.product.store, prefix = p.tablePrefix, state = m.aggregate.base.state.fqn;
  const repo = n.repository.identifier, env = n.envelope.identifier, persist = n.persistence.identifier;
  const table = prefix + '_' + m.index.table;
  const keyType = carrierType(m.index.keyCarrier), valueType = carrierType(m.index.valueCarrier);
  out.append(`package ${n.repository.package}

import java.sql.{Connection, PreparedStatement, ResultSet}
import javax.sql.DataSource
import scala.concurrent.blocking
import scala.util.{Try, Success, Failure}
import scala.util.control.NonFatal
import ${n.persistence.fqn}

object ${repo} {
  trait Session {
    def event(pid: String, sequenceNr: Long): Option[${env}]
    def state(pid: String): Option[${n.storedState.identifier}]
    def lastSequenceNr(pid: String): Long
    def append(envelope: ${env}): Unit
    def replaceState(pid: String, resource: String, sequenceNr: Long, state: ${state}): Unit
    def ${m.index.replaceMethod}(pid: String, resource: String, receipts: Map[${keyType}, ${valueType}]): Unit
    def checkpoint(pid: String, resource: String, sequenceNr: Long): Unit
  }
}

final class ${repo}(dataSource: DataSource, val namespace: String) {
  require(dataSource != null, "JDBC data source required")
  ${env}.identity(namespace)
  private val entered = new ThreadLocal[java.lang.Boolean]()
  private var installation: Option[Try[Unit]] = None
  private def identity(pid: String): Unit = ${env}.identity(pid)
  private def hash(pid: String): String = ${env}.hash(pid)
  private def page(limit: Int): Unit = require(limit > 0 && limit <= ${p.pageSize}, "bounded page required")
${jdbcPrimitivesTemplate()}  private def compatibility(connection: Connection, lock: Boolean): Unit = {
    ${n.schema.identifier}.validate(connection)
    val keys = query(connection, "SELECT compatibility_key FROM ${prefix}_namespace WHERE namespace_id=?" + (if (lock) " FOR UPDATE" else ""), Seq(namespace))(_.getString(1))
    require(keys == Vector(${n.schema.identifier}.compatibilityKey), "namespace source/store/frame/index compatibility mismatch or absent namespace")
  }
  def initialize(): Unit = synchronized {
    require(entered.get() != java.lang.Boolean.TRUE, "reentrant initialization")
    if (installation.isEmpty) installation = Some(Try(blocking {
      val connection = dataSource.getConnection
      try {
        connection.setAutoCommit(true)
        ${n.schema.identifier}.install(connection)
        val keys = query(connection, "SELECT compatibility_key FROM ${prefix}_namespace WHERE namespace_id=?", Seq(namespace))(_.getString(1))
        if (keys.isEmpty) {
          try execute(connection, "INSERT INTO ${prefix}_namespace(namespace_id,compatibility_key) VALUES (?,?)", Seq(namespace, ${n.schema.identifier}.compatibilityKey))
          catch { case error: java.sql.SQLException if Option(error.getSQLState).exists(_.startsWith("23")) => () }
        }
        compatibility(connection, lock = false)
      } finally connection.close()
    }))
    else installation.get.foreach { _ => blocking {
      val connection = dataSource.getConnection
      try compatibility(connection, lock = false) finally connection.close()
    } }
    installation.get.get
  }
  private def access[A](f: LiveSession => A): A = {
    require(f != null, "transaction callback required")
    require(entered.get() != java.lang.Boolean.TRUE, "nested/reentrant transaction rejected")
    entered.set(java.lang.Boolean.TRUE)
    try runTransaction(f) finally entered.remove()
  }
  def transaction[A](body: ${repo}.Session => A): A = {
    require(body != null, "transaction callback required")
    access(session => body(session))
  }
${jdbcTransactionTemplate({ signature: 'private def runTransaction[A](f: LiveSession => A): A', session: 'new LiveSession(connection)', beforeBody: '        compatibility(connection, lock = true)\n', unknownCommit: true, finishBeforeCommit: true })}
  def state(pid: String): Option[${n.storedState.identifier}] = access(_.state(pid))
  def lastSequenceNr(pid: String): Long = access(_.lastSequenceNr(pid))
  def byResource(resource: String, after: Option[${n.cursor.identifier}], limit: Int): ${n.page.identifier} = {
    identity(resource); page(limit)
    require(after != null && after.forall(_ != null), "cursor option required")
    access(_.byResource(resource, after, limit))
  }
  def persistenceIds(after: Option[String], limit: Int): Vector[String] = {
    page(limit); require(after != null, "PID cursor option required"); after.foreach(identity)
    access(_.persistenceIds(after, limit))
  }
  def currentEvents(pid: String, after: Long, limit: Int): Vector[${env}] = {
    identity(pid); page(limit); require(after >= 0L, "nonnegative event cursor required")
    access(_.currentEvents(pid, after, limit))
  }

  private final class LiveSession(connection: Connection) extends ${repo}.Session {
    private val writable = true
${jdbcSessionTemplate({ owner: repo, threadConfined: true })}    private def offset(pid: String): Option[(String, Long)] = {
      requireActive(); identity(pid)
      val rows = select("SELECT persistence_id,resource_id,sequence_nr FROM ${prefix}_offset WHERE namespace_id=? AND pid_key=?", Seq(namespace, hash(pid))) { r =>
        require(r.getString(1) == pid, "PID digest collision")
        val resource = r.getString(2); identity(resource)
        val sequence = r.getLong(3); require(sequence > 0L, "invalid stored offset")
        resource -> sequence
      }
      rows.headOption
    }
    private def association(pid: String, resource: String): Unit = {
      requireActive(); identity(pid); identity(resource)
      offset(pid).foreach { case (existing, _) => require(existing == resource, "PID/resource association conflict") }
    }
    private def decodeEnvelope(r: ResultSet, expectedPid: Option[String]): ${env} = {
      val pid = r.getString("persistence_id")
      require(expectedPid.forall(_ == pid) && r.getString("pid_key") == hash(pid), "PID digest collision")
      require(r.getString("stream_kind") == ${q(p.streamKind)}, "stream kind mismatch")
      ${env}.capture(pid, r.getString("resource_id"), r.getLong("sequence_nr"), r.getString("manifest"), r.getBytes("payload"))
    }
    override def event(pid: String, sequenceNr: Long): Option[${env}] = {
      requireActive(); identity(pid); require(sequenceNr > 0L, "positive event sequence required")
      select("SELECT * FROM ${prefix}_event WHERE namespace_id=? AND pid_key=? AND sequence_nr=?", Seq(namespace, hash(pid), sequenceNr))(r => decodeEnvelope(r, Some(pid))).headOption
    }
    override def state(pid: String): Option[${n.storedState.identifier}] = {
      requireActive(); identity(pid)
      select("SELECT * FROM ${prefix}_state WHERE namespace_id=? AND pid_key=?", Seq(namespace, hash(pid))) { r =>
        require(r.getString("persistence_id") == pid, "PID digest collision")
        val frame = ${persist}.parse(r.getBytes("payload"), r.getString("manifest"))
        ${n.storedState.identifier}(r.getString("resource_id"), r.getLong("sequence_nr"), ${persist}.decodeState(frame))
      }.headOption
    }
    override def lastSequenceNr(pid: String): Long = { requireActive(); offset(pid).map(_._2).getOrElse(0L) }
    override def append(envelope: ${env}): Unit = {
      requireWrite(); require(envelope != null, "envelope required")
      association(envelope.pid, envelope.resource)
      require(envelope.sequenceNr == Math.addExact(lastSequenceNr(envelope.pid), 1L), "noncontiguous append")
      require(event(envelope.pid, envelope.sequenceNr).isEmpty, "event already exists")
      update("INSERT INTO ${prefix}_event(namespace_id,pid_key,persistence_id,resource_id,stream_kind,sequence_nr,manifest,payload) VALUES (?,?,?,?,?,?,?,?)",
        namespace, hash(envelope.pid), envelope.pid, envelope.resource, ${q(p.streamKind)}, envelope.sequenceNr, envelope.manifest, envelope.bytes)
      ()
    }
    override def replaceState(pid: String, resource: String, sequenceNr: Long, state: ${state}): Unit = {
      requireWrite(); association(pid, resource)
      require(state != null && sequenceNr > 0L, "state and positive sequence required")
      require(event(pid, sequenceNr).exists(_.resource == resource), "state must follow the matching persisted event")
      val frame = ${persist}.encodeState(state)
      update("DELETE FROM ${prefix}_state WHERE namespace_id=? AND pid_key=?", namespace, hash(pid))
      update("INSERT INTO ${prefix}_state(namespace_id,pid_key,persistence_id,resource_id,sequence_nr,manifest,payload) VALUES (?,?,?,?,?,?,?)",
        namespace, hash(pid), pid, resource, sequenceNr, ${persist}.manifest(frame), frame.toByteArray)
      ()
    }
`, [m.product.store.bindingSource, ...m.registrations.flatMap(r => r.sources)]);
  out.append(`    override def ${m.index.replaceMethod}(pid: String, resource: String, receipts: Map[${keyType}, ${valueType}]): Unit = {
      requireWrite(); association(pid, resource)
      require(receipts != null && state(pid).exists(_.resource == resource), "state-map partition requires matching state")
      val rows = receipts.toVector.map { case (key, value) =>
        require(key != null && value != null, "index key/value required")
${[...m.index.keyCarrier.chain.map((c, i) => '        require(' + 'key' + m.index.keyCarrier.chain.slice(0, i + 1).map(c => '.' + c.accessor).join('') + ' != null, "key carrier required")'), ...m.index.valueCarrier.chain.map((c, i) => '        require(' + 'value' + m.index.valueCarrier.chain.slice(0, i + 1).map(c => '.' + c.accessor).join('') + ' != null, "value carrier required")')].join('\n')}
        val mapKey = ${carrierWrite(m.index.keyCarrier, 'key')}
        val mapValue = ${carrierWrite(m.index.valueCarrier, 'value')}
        require(mapKey.length <= ${m.index.keySize} && mapValue.length <= ${m.index.valueSize}, "index carrier exceeds column capacity")
        mapKey -> mapValue
      }
      require(rows.map(_._1).distinct.size == rows.size, "ambiguous index map key")
      update("DELETE FROM ${table} WHERE namespace_id=? AND pid_key=?", namespace, hash(pid))
      rows.sortBy(_._1).foreach { case (key, value) =>
        update("INSERT INTO ${table}(namespace_id,pid_key,persistence_id,resource_id,map_key,map_value) VALUES (?,?,?,?,?,?)", namespace, hash(pid), pid, resource, key, value)
      }
    }
    def byResource(resource: String, after: Option[${n.cursor.identifier}], limit: Int): ${n.page.identifier} = {
      requireActive()
      val predicate = if (after.isDefined) " AND (map_key>? OR (map_key=? AND pid_key>?))" else ""
      val params: Seq[Any] = Seq(namespace, resource) ++ after.toVector.flatMap(c => Vector(c.mapKey, c.mapKey, c.pidKey)) ++ Seq(limit + 1)
      val found = select("SELECT * FROM ${table} WHERE namespace_id=? AND resource_id=?" + predicate + " ORDER BY map_key,pid_key LIMIT ?", params) { r =>
        ${n.row.identifier}(r.getString("pid_key"), r.getString("persistence_id"), r.getString("resource_id"),
          ${carrierRead(m.index.keyCarrier, 'r.getString("map_key")')}, ${carrierRead(m.index.valueCarrier, 'r.getString("map_value")')})
      }
      val rows = found.take(limit)
      val next = if (found.size > limit) rows.lastOption.map(r => ${n.cursor.identifier}(${carrierWrite(m.index.keyCarrier, 'r.' + m.index.keyMember)}, r.pidKey)) else None
      ${n.page.identifier}(rows, next)
    }
`, [m.index.source, m.index.fieldSource, ...m.index.keyCarriers.map(c => c.source), ...m.index.valueCarriers.map(c => c.source)]);
  out.append(`    override def checkpoint(pid: String, resource: String, sequenceNr: Long): Unit = {
      requireWrite(); association(pid, resource)
      require(sequenceNr == Math.addExact(lastSequenceNr(pid), 1L), "noncontiguous checkpoint")
      require(event(pid, sequenceNr).exists(_.resource == resource) && state(pid).exists(s => s.resource == resource && s.sequenceNr == sequenceNr), "event/state must precede checkpoint")
      update("DELETE FROM ${prefix}_offset WHERE namespace_id=? AND pid_key=?", namespace, hash(pid))
      update("INSERT INTO ${prefix}_offset(namespace_id,pid_key,persistence_id,resource_id,sequence_nr) VALUES (?,?,?,?,?)", namespace, hash(pid), pid, resource, sequenceNr)
      ()
    }
    def persistenceIds(after: Option[String], limit: Int): Vector[String] = {
      requireActive()
      val predicate = if (after.isDefined) " AND persistence_id>?" else ""
      select("SELECT persistence_id,pid_key FROM ${prefix}_offset WHERE namespace_id=?" + predicate + " ORDER BY persistence_id LIMIT ?",
        Seq(namespace) ++ after.toVector ++ Seq(limit)) { r =>
        val pid = r.getString(1); require(r.getString(2) == hash(pid), "PID digest collision"); pid
      }
    }
    def currentEvents(pid: String, after: Long, limit: Int): Vector[${env}] = {
      requireActive(); offset(pid)
      select("SELECT * FROM ${prefix}_event WHERE namespace_id=? AND pid_key=? AND sequence_nr>? ORDER BY sequence_nr LIMIT ?",
        Seq(namespace, hash(pid), after, limit))(r => decodeEnvelope(r, Some(pid)))
    }
  }
}
`, [m.product.store.bindingSource]);
}

export function handlerTemplate(m, out) {
  const n = m.names, state = m.aggregate.base.state.fqn;
  out.append(`package ${n.handler.package}

import ${n.persistence.fqn}

final class ${n.handler.identifier}(repository: ${n.repository.identifier}, initial: ${state}) {
  require(repository != null && initial != null, "repository and initial state required")
  def project(envelope: ${n.envelope.identifier}): ${n.projectResult.identifier} = {
    require(envelope != null, "envelope required")
    val fixed = ${n.envelope.identifier}.capture(envelope.pid, envelope.resource, envelope.sequenceNr, envelope.manifest, envelope.bytes)
    val frame = ${n.persistence.identifier}.parse(fixed.bytes, fixed.manifest)
    require(frame.role == "event", "event frame required")
    repository.transaction { session =>
      val last = session.lastSequenceNr(fixed.pid)
      if (fixed.sequenceNr <= last) {
        val prior = session.event(fixed.pid, fixed.sequenceNr).getOrElse(throw new IllegalArgumentException("missing prior sequence"))
        require(prior.pid == fixed.pid && prior.resource == fixed.resource && prior.manifest == fixed.manifest &&
          java.util.Arrays.equals(prior.bytes, fixed.bytes), "conflicting duplicate")
        ${n.projectResult.identifier}(fixed.sequenceNr, duplicate = true)
      } else {
        require(fixed.sequenceNr == Math.addExact(last, 1L), "projection sequence gap")
        val stored = session.state(fixed.pid)
        require(stored.isDefined == (last > 0L) && stored.forall(s => s.resource == fixed.resource && s.sequenceNr == last), "state/offset/resource mismatch")
        val event = ${n.persistence.identifier}.decodeEvent(frame)
        val next = ${m.aggregate.eventHandler.fqn}.apply(stored.map(_.state).getOrElse(initial), event)
        session.append(fixed)
        session.replaceState(fixed.pid, fixed.resource, fixed.sequenceNr, next)
`, [m.product.store.bindingSource, ...m.registrations.flatMap(r => r.sources)]);
  out.append(`        session.${m.index.replaceMethod}(fixed.pid, fixed.resource, next.${m.index.field.accessor})
`, [m.index.source, m.index.fieldSource]);
  out.append(`        session.checkpoint(fixed.pid, fixed.resource, fixed.sequenceNr)
        ${n.projectResult.identifier}(fixed.sequenceNr, duplicate = false)
      }
    }
  }
}
`, [m.product.store.bindingSource]);
}

package example.inventory.infrastructure.persistence

import akka.actor.ExtendedActorSystem
import akka.persistence.typed.{EventAdapter, EventSeq, SnapshotAdapter, PersistenceId}
import akka.serialization.SerializerWithStringManifest
import com.google.protobuf.ByteString
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations
import example.inventory.application.aggregates.WarehouseActorProtocol
import example.inventory.infrastructure.bootstrap.WarehouseBootstrap
import example.inventory.infrastructure.serialization.DomainConverters
import example.inventory.persistence.protobuf.Frame
import example.inventory.{protobuf => pb}
import scala.util.control.NonFatal

final case class WarehouseWireRegistration(role: String, typeId: String, version: Int, layoutSha256: String)
object WarehousePersistence {
  val serializerId = 736401
  val envelopeVersion = 1
  val maxPayloadBytes = 1048576
  val registrations = Vector(
    WarehouseWireRegistration("event", "warehouse.reserved", 1, WarehouseWirePins.reserved),
    WarehouseWireRegistration("event", "warehouse.committed", 1, WarehouseWirePins.committed),
    WarehouseWireRegistration("state", "warehouse.state", 1, WarehouseWirePins.state))
  private def frame(r: WarehouseWireRegistration, bytes: Array[Byte]): Frame = {
    val f = Frame(envelopeVersion, r.role, r.typeId, r.version, r.layoutSha256, ByteString.copyFrom(bytes))
    validate(f); f
  }
  def validate(f: Frame): Unit = {
    require(f != null, "null frame")
    require(f.envelopeVersion == envelopeVersion && f.unknownFields.asMap.isEmpty, "frame version/unknown fields")
    require(f.payload != null && !f.payload.isEmpty && f.payload.size <= maxPayloadBytes && f.serializedSize <= maxPayloadBytes, "frame bound")
    require(registrations.exists(r => r.role == f.role && r.typeId == f.typeId && r.version == f.wireVersion && r.layoutSha256 == f.layoutSha256), "unregistered wire identity")
  }
  private def decode[A](f: Frame, role: String)(body: => A): A = {
    validate(f); require(f.role == role, "wrong frame role")
    try body catch { case e: IllegalArgumentException => throw e; case NonFatal(e) => throw new IllegalArgumentException("bad domain payload", e) }
  }
  def encodeEvent(e: Event): Frame = { require(e != null, "null event"); e match {
    case v: SkuQuantityReserved => frame(registrations(0), DomainConverters.encodeWarehouseSkuQuantityReserved(v).toByteArray)
    case v: SkuReservationCommitted => frame(registrations(1), DomainConverters.encodeWarehouseSkuReservationCommitted(v).toByteArray)
  }}
  def decodeEvent(f: Frame): Event = decode(f,"event") {
    f.typeId match {
      case "warehouse.reserved" => DomainConverters.decodeWarehouseSkuQuantityReserved(pb.WarehouseSkuQuantityReserved.parseFrom(f.payload.toByteArray))
      case "warehouse.committed" => DomainConverters.decodeWarehouseSkuReservationCommitted(pb.WarehouseSkuReservationCommitted.parseFrom(f.payload.toByteArray))
      case _ => throw new IllegalArgumentException("wrong event registration")
    }
  }
  def encodeState(s: WarehouseState): Frame = { require(s != null, "null state"); frame(registrations(2), DomainConverters.encodeWarehouseState(s).toByteArray) }
  def decodeState(f: Frame): WarehouseState = decode(f,"state") { DomainConverters.decodeWarehouseState(pb.WarehouseSnapshot.parseFrom(f.payload.toByteArray)) }
  def manifest(f: Frame): String = { validate(f); s"warehouse-frame/1/${f.role}/${f.typeId}/${f.wireVersion}/${f.layoutSha256}" }
  def parse(bytes: Array[Byte], m: String): Frame = {
    require(bytes != null && bytes.nonEmpty && bytes.length <= maxPayloadBytes && m != null, "invalid bytes/manifest")
    val f = try Frame.parseFrom(bytes) catch { case NonFatal(e) => throw new IllegalArgumentException("bad frame",e) }
    require(manifest(f) == m,"manifest mismatch")
    if(f.role == "event") decodeEvent(f) else decodeState(f)
    f
  }
}
final class WarehouseSerializer(system: ExtendedActorSystem) extends SerializerWithStringManifest {
  require(system != null,"null system")
  def identifier: Int = WarehousePersistence.serializerId
  private def frame(value: AnyRef): Frame = value match { case f: Frame => WarehousePersistence.validate(f); f; case _ => throw new IllegalArgumentException("only Frame") }
  def manifest(value: AnyRef): String = WarehousePersistence.manifest(frame(value))
  def toBinary(value: AnyRef): Array[Byte] = { val f=frame(value); WarehousePersistence.parse(f.toByteArray,manifest(f)); f.toByteArray }
  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = WarehousePersistence.parse(bytes,manifest)
}
final class WarehouseEventAdapter extends EventAdapter[Event,Frame] {
  def toJournal(e: Event): Frame = WarehousePersistence.encodeEvent(e)
  def manifest(e: Event): String = WarehousePersistence.manifest(toJournal(e))
  def fromJournal(f: Frame, m: String): EventSeq[Event] = {
    require(m != null && WarehousePersistence.manifest(f) == m,"manifest mismatch")
    EventSeq.single(WarehousePersistence.decodeEvent(f))
  }
}
final class WarehouseSnapshotAdapter extends SnapshotAdapter[WarehouseState] {
  def toJournal(s: WarehouseState): Any = WarehousePersistence.encodeState(s)
  def fromJournal(value: Any): WarehouseState = value match { case f: Frame => WarehousePersistence.decodeState(f); case _ => throw new IllegalArgumentException("only state Frame") }
}
object WarehousePersistenceFactory {
  def create(pid: PersistenceId, initial: WarehouseState, hosts: WarehouseComputations): akka.actor.typed.Behavior[WarehouseActorProtocol.Command] =
    WarehouseBootstrap.create[Frame](pid, initial, hosts, new WarehouseEventAdapter, new WarehouseSnapshotAdapter)
}

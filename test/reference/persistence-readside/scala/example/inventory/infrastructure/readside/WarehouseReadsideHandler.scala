package example.inventory.infrastructure.readside

import example.inventory.domain.WarehouseState
import example.inventory.domain.entities.behaviors.WarehouseEventHandler
import example.inventory.infrastructure.persistence.WarehousePersistence
import example.inventory.persistence.protobuf.Frame
import scala.util.control.NonFatal

final class WarehouseReadsideHandler(repository: WarehouseReadsideRepository, initial: WarehouseState) {
  require(repository!=null && initial!=null,"null handler dependency")
  def project(envelope: WarehouseEnvelope): ProjectResult = {
    require(envelope!=null,"null envelope")
    val bytes=envelope.bytes
    val frame=try Frame.parseFrom(bytes) catch {case NonFatal(e)=>throw new IllegalArgumentException("bad frame",e)}
    WarehousePersistence.validate(frame)
    require(frame.role=="event" && WarehousePersistence.manifest(frame)==envelope.manifest,"event manifest/role")
    repository.transaction {s=>
      val previous=s.lastSequenceNr(envelope.pid)
      if(envelope.sequenceNr<=previous) {
        val stored=s.event(envelope.pid,envelope.sequenceNr).getOrElse(throw new IllegalArgumentException("missing duplicate event"))
        require(stored.resource==envelope.resource && stored.manifest==envelope.manifest && java.util.Arrays.equals(stored.bytes,bytes),"conflicting duplicate")
        ProjectResult(envelope.sequenceNr,true)
      } else {
        require(envelope.sequenceNr==previous+1,"sequence gap")
        val old=s.state(envelope.pid)
        require(old.forall(x=>x.resource==envelope.resource && x.sequenceNr==previous),"state/resource/checkpoint conflict")
        require(previous==0 || old.isDefined,"missing checkpoint state")
        val event=WarehousePersistence.decodeEvent(frame)
        val next=WarehouseEventHandler(old.map(_.state).getOrElse(initial),event)
        s.append(envelope)
        s.replaceState(envelope.pid,envelope.resource,envelope.sequenceNr,next)
        s.replaceReceipts(envelope.pid,envelope.resource,next.receipts)
        s.checkpoint(envelope.pid,envelope.resource,envelope.sequenceNr)
        ProjectResult(envelope.sequenceNr,false)
      }
    }
  }
}

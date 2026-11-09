package reference.inventory.oracle

import reference.inventory.kernel._
import scala.concurrent.Future

/** Oracle-side fault decorators preserve the real durable external implementation. */
class ParticipantDelegate(delegate: WarehouseParticipant) extends WarehouseParticipant {
  def prepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = delegate.prepare(c)
  def queryPrepare(c: PrepareCommand): Future[ParticipantObservation[PrepareReceipt]] = delegate.queryPrepare(c)
  def commit(c: CommitCommand): Future[ParticipantObservation[CommitReceipt]] = delegate.commit(c)
  def queryCommit(c: CommitCommand): Future[ParticipantObservation[CommitReceipt]] = delegate.queryCommit(c)
  def compensate(c: CompensateCommand): Future[ParticipantObservation[CompensateReceipt]] = delegate.compensate(c)
  def queryCompensate(c: CompensateCommand): Future[ParticipantObservation[CompensateReceipt]] = delegate.queryCompensate(c)
}

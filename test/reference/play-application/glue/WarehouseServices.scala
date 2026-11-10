package example.inventory.infrastructure.web

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.AskPattern._
import java.util.concurrent.TimeoutException
import akka.util.Timeout
import example.inventory.application.aggregates.{WarehouseActorProtocol, WarehouseActorRepository}
import example.inventory.application.api.{WarehouseCommands, WarehouseQueries}
import example.inventory.application.api.WarehouseApi._
import example.inventory.domain.WarehouseProtocol
import example.inventory.domain.values._
import example.inventory.infrastructure.readside.{WarehouseReadsideRepository, ReceiptCursor}
import scala.concurrent.{ExecutionContext, Future, blocking}
import scala.concurrent.duration._
import scala.util.control.NonFatal

final class WarehouseCommandService(repository: WarehouseActorRepository[String], directory: WarehouseDirectory,
    system: ActorSystem[_], askMillis: Int) extends WarehouseCommands {
  require(repository != null && directory != null && system != null && askMillis > 0 && askMillis <= 5000)
  private implicit val ec: ExecutionContext = system.executionContext
  private implicit val scheduler = system.scheduler
  private implicit val timeout: Timeout = Timeout(askMillis.millis)
  private def execute[A <: WarehouseProtocol.Event](warehouse: WarehouseId, command: WarehouseProtocol.Command)
      (select: PartialFunction[WarehouseProtocol.Event, A]): Future[Outcome[CommandResult[A]]] = {
    if (directory.find(warehouse.value).isEmpty) return Future.successful(Left(MissingResource))
    try repository.get(warehouse.value).ref.ask[WarehouseActorProtocol.Reply](WarehouseActorProtocol.Execute(command, _)).map {
      case WarehouseActorProtocol.Accepted(events) if events.isEmpty => Right(NoChange)
      case WarehouseActorProtocol.Accepted(Vector(event)) if select.isDefinedAt(event) => Right(Applied(select(event)))
      case WarehouseActorProtocol.Rejected(code) => Left(DomainRejected(code))
      case _ => Left(InternalFailure)
    }.recover {
      case _: TimeoutException => Left(OutcomeUnknown)
      case NonFatal(_) => Left(InternalFailure)
    } catch { case _: IllegalStateException => Future.successful(Left(Unavailable)) }
  }
  override def reserve(request: ReserveRequest): Future[Outcome[CommandResult[WarehouseProtocol.SkuQuantityReserved]]] =
    execute(request.warehouseId, WarehouseProtocol.ReserveSkuQuantity(request.txid, request.warehouseId, request.skuId, request.quantity)) {
      case event: WarehouseProtocol.SkuQuantityReserved => event
    }
  override def commit(request: CommitRequest): Future[Outcome[CommandResult[WarehouseProtocol.SkuReservationCommitted]]] =
    execute(request.warehouseId, WarehouseProtocol.CommitSkuReservation(request.txid, request.warehouseId, request.skuId, request.reservationId)) {
      case event: WarehouseProtocol.SkuReservationCommitted => event
    }
}
final class WarehouseQueryService(repository: WarehouseReadsideRepository, directory: WarehouseDirectory,
    blockingEc: ExecutionContext) extends WarehouseQueries {
  require(repository != null && directory != null && blockingEc != null)
  override def receipts(warehouse: WarehouseId, after: Option[ReceiptPosition], limit: Int): Future[Outcome[ReceiptPage]] = {
    if (limit < 1 || limit > 64) return Future.successful(Left(InvalidRequest))
    directory.find(warehouse.value) match {
      case None => Future.successful(Left(MissingResource))
      case Some(binding) => Future(blocking {
        val page = repository.byResource(binding.resource, after.map(c => ReceiptCursor(c.mapKey, c.pidKey)), limit)
        Right(ReceiptPage(page.rows.map(r => ReceiptItem(r.txid, r.receipt)), page.next.map(c => ReceiptPosition(c.mapKey, c.pidKey))))
      })(blockingEc).recover { case NonFatal(_) => Left(Unavailable) }(blockingEc)
    }
  }
}

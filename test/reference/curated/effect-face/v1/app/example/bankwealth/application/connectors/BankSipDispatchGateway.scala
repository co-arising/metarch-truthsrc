package example.bankwealth.application.connectors

import scala.concurrent.Future

import BankSipDispatchProtocol._

/** Outbound external-effect gateway port for `BankSipDispatchExecution`. */
trait BankSipDispatchGateway {
  def execute(input: BankSipDispatchOperation): Future[BankSipDispatchObservation]
  def query(input: BankSipDispatchOperation): Future[Option[BankSipDispatchObservation]]
  def reconcile(input: BankSipDispatchReconcile): Future[Boolean]
}

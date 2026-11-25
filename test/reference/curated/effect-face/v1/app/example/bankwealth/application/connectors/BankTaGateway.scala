package example.bankwealth.application.connectors

import scala.concurrent.Future

import BankTaEffectProtocol.{BankTaEffectObservation, BankTaEffectOperation, BankTaEffectReconcile}

/** Outbound external-effect gateway port for `BankTaSubmissionExecution`. */
trait BankTaGateway {
  def execute(input: BankTaEffectOperation): Future[BankTaEffectObservation]
  def query(input: BankTaEffectOperation): Future[Option[BankTaEffectObservation]]
  def reconcile(input: BankTaEffectReconcile): Future[Boolean]
}

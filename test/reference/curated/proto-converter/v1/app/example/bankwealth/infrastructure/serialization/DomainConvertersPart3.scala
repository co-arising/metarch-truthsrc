package example.bankwealth.infrastructure.serialization

import example.bankwealth.domain._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.proto._
trait DomainConvertersPart3 { self: DomainConverters.type =>
  def encodeSipPlanSipInstallmentFailedPB(value: SipPlanProtocol.SipInstallmentFailed): SipPlanSipInstallmentFailedPB = SipPlanSipInstallmentFailedPB(
    Some(encodeSipOccurrencePB(value.occurrence)),
    value.evidence,
    value.receiptId,
    value.receiptBody,
    value.outcome
  )
  def decodeSipPlanSipInstallmentFailedPB(value: SipPlanSipInstallmentFailedPB): SipPlanProtocol.SipInstallmentFailed = SipPlanProtocol.SipInstallmentFailed(
    decodeSipOccurrencePB(req(value.f0)),
    value.f1,
    value.f2,
    value.f3,
    value.f4
  )
  def encodeSipPlanSipCreateIntentRecordedPBField1(value: Option[BankSipCreateIntent]): SipPlanSipCreateIntentRecordedPBField1 = value match { case None => SipPlanSipCreateIntentRecordedPBField1(present = false); case Some(item) => SipPlanSipCreateIntentRecordedPBField1(present = true, f0 = Some(encodeBankSipCreateIntentPB(item))) }
  def decodeSipPlanSipCreateIntentRecordedPBField1(value: SipPlanSipCreateIntentRecordedPBField1): Option[BankSipCreateIntent] = if (!value.present) { require(value.f0.isEmpty, "absent optional contains a value"); None } else Some(decodeBankSipCreateIntentPB(req(value.f0)))
  def encodeSipPlanSipCreateIntentRecordedPB(value: SipPlanProtocol.SipCreateIntentRecorded): SipPlanSipCreateIntentRecordedPB = SipPlanSipCreateIntentRecordedPB(Some(encodeBankSipCreateIntentPB(value.intent)), Some(encodeSipPlanSipCreateIntentRecordedPBField1(value.source)))
  def decodeSipPlanSipCreateIntentRecordedPB(value: SipPlanSipCreateIntentRecordedPB): SipPlanProtocol.SipCreateIntentRecorded = SipPlanProtocol.SipCreateIntentRecorded(decodeBankSipCreateIntentPB(req(value.f0)), decodeSipPlanSipCreateIntentRecordedPBField1(req(value.f1)))
}

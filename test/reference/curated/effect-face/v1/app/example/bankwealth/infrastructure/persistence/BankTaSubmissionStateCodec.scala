package example.bankwealth.infrastructure.persistence

import com.google.protobuf.ByteString
import example.bankwealth.application.process.BankTaSubmissionExecution
import example.bankwealth.application.connectors.BankTaEffectProtocol.BankTaEffectObservation
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import net.imadz.monarch.persistence.StateCodec

/** Persistence-layer protobuf codecs for `BankTaSubmissionExecution` and `BankTaEffectHost`. */
object BankTaSubmissionStateCodec {

  val codec: StateCodec[BankTaSubmissionExecution.State] = StateCodec[BankTaSubmissionExecution.State](
    state =>
      example.bankwealth.infrastructure.executionproto.banktasubmissionv1ExecutionStatePB(
        planversion = BankTaSubmissionExecution.PlanVersion,
        input0 = Some(DomainConverters.encodeTaRequestIdPO(state.inputs.taRequestId)),
        input1 = Some(DomainConverters.encodeFundOrderIdPO(state.inputs.fundOrderId)),
        input2 = Some(DomainConverters.encodeTxIdPO(state.inputs.paymentTxId)),
        output0 = state.taRequestId.map(DomainConverters.encodeTaRequestIdPO),
      ).toByteArray,
    bytes => {
      val pb = example.bankwealth.infrastructure.executionproto.banktasubmissionv1ExecutionStatePB.parseFrom(bytes)
      require(pb.planversion == BankTaSubmissionExecution.PlanVersion, "exact finite plan version required")
      def durable[A](slot: Option[A], name: String): A =
        slot.getOrElse(throw new IllegalArgumentException(s"missing durable input $name"))
      BankTaSubmissionExecution.State(
        BankTaSubmissionExecution.Inputs(
          taRequestId = DomainConverters.decodeTaRequestIdPO(durable(pb.input0, "input0")),
          fundOrderId = DomainConverters.decodeFundOrderIdPO(durable(pb.input1, "input1")),
          paymentTxId = DomainConverters.decodeTxIdPO(durable(pb.input2, "input2")),
        ),
        pb.output0.map(DomainConverters.decodeTaRequestIdPO),
      )
    },
  )

  def decodeObservation(bytes: ByteString): Option[BankTaEffectObservation] =
    if (bytes.isEmpty) None
    else Some(DomainConverters.decodeBankTaEffectObservationPO(
      example.bankwealth.infrastructure.proto.BankTaEffectObservationPO.parseFrom(bytes.toByteArray)))

  def encodeObservation(value: BankTaEffectObservation): ByteString =
    DomainConverters.encodeBankTaEffectObservationPO(value).toByteString
}

package example.bankwealth.infrastructure.persistence

import com.google.protobuf.ByteString
import example.bankwealth.application.process.BankSipDispatchExecution
import example.bankwealth.application.connectors.BankSipDispatchProtocol.BankSipDispatchObservation
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import net.imadz.monarch.persistence.StateCodec

/** Persistence-layer protobuf codecs for `BankSipDispatchExecution` and `BankSipDispatchEffectHost`. */
object BankSipDispatchStateCodec {

  val codec: StateCodec[BankSipDispatchExecution.State] = StateCodec[BankSipDispatchExecution.State](
    state =>
      example.bankwealth.infrastructure.executionproto.banksipdispatchv1ExecutionStatePB(
        planversion = BankSipDispatchExecution.PlanVersion,
        input0 = Some(DomainConverters.encodeOccurrenceIdPO(state.inputs.occurrenceId)),
        input1 = Some(DomainConverters.encodeSipOccurrencePO(state.inputs.occurrence)),
        output0 = state.operationId.map(DomainConverters.encodeOperationIdPO),
      ).toByteArray,
    bytes => {
      val pb = example.bankwealth.infrastructure.executionproto.banksipdispatchv1ExecutionStatePB.parseFrom(bytes)
      require(pb.planversion == BankSipDispatchExecution.PlanVersion, "exact finite plan version required")
      def durable[A](slot: Option[A], name: String): A =
        slot.getOrElse(throw new IllegalArgumentException(s"missing durable input $name"))
      BankSipDispatchExecution.State(
        BankSipDispatchExecution.Inputs(
          occurrenceId = DomainConverters.decodeOccurrenceIdPO(durable(pb.input0, "input0")),
          occurrence = DomainConverters.decodeSipOccurrencePO(durable(pb.input1, "input1")),
        ),
        pb.output0.map(DomainConverters.decodeOperationIdPO),
      )
    },
  )

  def decodeObservation(bytes: ByteString): Option[BankSipDispatchObservation] =
    if (bytes.isEmpty) None
    else Some(DomainConverters.decodeBankSipDispatchObservationPO(
      example.bankwealth.infrastructure.proto.BankSipDispatchObservationPO.parseFrom(bytes.toByteArray)))

  def encodeObservation(value: BankSipDispatchObservation): ByteString =
    DomainConverters.encodeBankSipDispatchObservationPO(value).toByteString
}

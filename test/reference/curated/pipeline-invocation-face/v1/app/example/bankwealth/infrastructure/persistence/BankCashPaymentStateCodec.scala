package example.bankwealth.infrastructure.persistence

import example.bankwealth.application.process.cash_payment.BankCashPaymentExecution
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import net.imadz.monarch.persistence.StateCodec

/** Exact finite plan state codec: owns protobuf slot encoding/decoding for
  * `BankCashPaymentExecution.State` in the persistence layer. */
object BankCashPaymentStateCodec {

  val codec: StateCodec[BankCashPaymentExecution.State] = StateCodec[BankCashPaymentExecution.State](
    state =>
      example.bankwealth.infrastructure.executionproto.bankcashpaymentv1ExecutionStatePB(
        planversion = BankCashPaymentExecution.PlanVersion,
        input0 = Some(DomainConverters.encodeOperationIdPO(state.inputs.operation)),
        input1 = Some(DomainConverters.encodeOperationIdPO(state.inputs.occurrence)),
        input2 = Some(DomainConverters.encodeAccountIdPO(state.inputs.investorAccountId)),
        input3 = Some(DomainConverters.encodeFundOrderIdPO(state.inputs.fundOrderId)),
        input4 = Some(DomainConverters.encodeAccountIdPO(state.inputs.fundCollectionAccountId)),
        input5 = Some(DomainConverters.encodeMoneyPO(state.inputs.amount)),
        input6 = Some(identity[String](state.inputs.fundCode)),
        output0 = state.paymentTxid.map(DomainConverters.encodeTxIdPO),
      ).toByteArray,
    bytes => {
      val pb = example.bankwealth.infrastructure.executionproto.bankcashpaymentv1ExecutionStatePB.parseFrom(bytes)
      require(pb.planversion == BankCashPaymentExecution.PlanVersion, "exact finite plan version required")
      def durable[A](slot: Option[A], name: String): A =
        slot.getOrElse(throw new IllegalArgumentException(s"missing durable input $name"))
      BankCashPaymentExecution.State(
        BankCashPaymentExecution.Inputs(
          operation = DomainConverters.decodeOperationIdPO(durable(pb.input0, "input0")),
          occurrence = DomainConverters.decodeOperationIdPO(durable(pb.input1, "input1")),
          investorAccountId = DomainConverters.decodeAccountIdPO(durable(pb.input2, "input2")),
          fundOrderId = DomainConverters.decodeFundOrderIdPO(durable(pb.input3, "input3")),
          fundCollectionAccountId = DomainConverters.decodeAccountIdPO(durable(pb.input4, "input4")),
          amount = DomainConverters.decodeMoneyPO(durable(pb.input5, "input5")),
          fundCode = identity[String](durable(pb.input6, "input6")),
        ),
        pb.output0.map(DomainConverters.decodeTxIdPO),
      )
    },
  )
}

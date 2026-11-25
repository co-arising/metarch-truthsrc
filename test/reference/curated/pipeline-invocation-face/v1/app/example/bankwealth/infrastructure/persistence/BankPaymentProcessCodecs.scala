package example.bankwealth.infrastructure.persistence

import scala.util.Try

import com.google.protobuf.ByteString
import example.bankwealth.application.process._
import example.bankwealth.application.process.BankPaymentMessages._
import example.bankwealth.application.process.CreditFundCollectionStep._
import example.bankwealth.application.process.ReserveCashFundOrderStep._
import example.bankwealth.application.process.ReserveInvestorFundsStep._
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import net.imadz.infra.saga.strict.{CodecPin, PayloadCodec}

/** Persistence-layer protobuf payload codecs for `BankPaymentSagaDefinition`. */
object BankPaymentProcessCodecs extends BankPaymentSagaDefinition.Codecs {

  val argsCodec: PayloadCodec[BankPaymentSagaDefinition.Args] = new PayloadCodec[BankPaymentSagaDefinition.Args] {
    val pin: CodecPin = BankPaymentSagaDefinition.ArgsCodecPin
    def encode(value: BankPaymentSagaDefinition.Args): ByteString =
      DomainConverters.encodeBankPaymentArgsPO(value).toByteString
    def decode(bytes: ByteString): Try[BankPaymentSagaDefinition.Args] =
      Try(DomainConverters.decodeBankPaymentArgsPO(
        example.bankwealth.infrastructure.proto.BankPaymentArgsPO.parseFrom(bytes.toByteArray)))
  }

  private def payloadCodec[Receipt](
    codecPin: CodecPin,
    encodeReceipt: Receipt => ByteString,
    decodeBytes: ByteString => Try[Receipt],
  ): PayloadCodec[Receipt] = new PayloadCodec[Receipt] {
    val pin: CodecPin = codecPin
    def encode(value: Receipt): ByteString = encodeReceipt(value)
    def decode(bytes: ByteString): Try[Receipt] = decodeBytes(bytes)
  }

  val ReserveInvestorFundsPrepareCodec: PayloadCodec[ReserveInvestorFundsPrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-prepare", 1),
    receipt =>
      DomainConverters.encodeReserveInvestorFundsPrepareReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveInvestorFundsPrepareReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveInvestorFundsPrepareReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val ReserveInvestorFundsCommitCodec: PayloadCodec[ReserveInvestorFundsCommitReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-commit", 1),
    receipt =>
      DomainConverters.encodeReserveInvestorFundsCommitReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveInvestorFundsCommitReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveInvestorFundsCommitReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val ReserveInvestorFundsCompensateCodec: PayloadCodec[ReserveInvestorFundsCompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-compensate", 1),
    receipt =>
      DomainConverters.encodeReserveInvestorFundsCompensateReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveInvestorFundsCompensateReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveInvestorFundsCompensateReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val CreditFundCollectionPrepareCodec: PayloadCodec[CreditFundCollectionPrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-prepare", 1),
    receipt =>
      DomainConverters.encodeCreditFundCollectionPrepareReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeCreditFundCollectionPrepareReceiptPO(
      example.bankwealth.infrastructure.proto.CreditFundCollectionPrepareReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val CreditFundCollectionCommitCodec: PayloadCodec[CreditFundCollectionCommitReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-commit", 1),
    receipt =>
      DomainConverters.encodeCreditFundCollectionCommitReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeCreditFundCollectionCommitReceiptPO(
      example.bankwealth.infrastructure.proto.CreditFundCollectionCommitReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val CreditFundCollectionCompensateCodec: PayloadCodec[CreditFundCollectionCompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-compensate", 1),
    receipt =>
      DomainConverters.encodeCreditFundCollectionCompensateReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeCreditFundCollectionCompensateReceiptPO(
      example.bankwealth.infrastructure.proto.CreditFundCollectionCompensateReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val ReserveCashFundOrderPrepareCodec: PayloadCodec[ReserveCashFundOrderPrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-prepare", 1),
    receipt =>
      DomainConverters.encodeReserveCashFundOrderPrepareReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveCashFundOrderPrepareReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveCashFundOrderPrepareReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val ReserveCashFundOrderCommitCodec: PayloadCodec[ReserveCashFundOrderCommitReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-commit", 1),
    receipt =>
      DomainConverters.encodeReserveCashFundOrderCommitReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveCashFundOrderCommitReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveCashFundOrderCommitReceiptPO.parseFrom(bytes.toByteArray))),
  )

  val ReserveCashFundOrderCompensateCodec: PayloadCodec[ReserveCashFundOrderCompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-compensate", 1),
    receipt =>
      DomainConverters.encodeReserveCashFundOrderCompensateReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveCashFundOrderCompensateReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveCashFundOrderCompensateReceiptPO.parseFrom(bytes.toByteArray))),
  )

}

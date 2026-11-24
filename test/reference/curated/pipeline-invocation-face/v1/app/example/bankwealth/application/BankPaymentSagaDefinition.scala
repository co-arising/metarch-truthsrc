package example.bankwealth.application

import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import com.google.protobuf.ByteString
import example.bankwealth.domain.invariants.params.{CreditBalanceRuleParams, FundOrderRuleParams}
import example.bankwealth.application.saga._
import example.bankwealth.domain.values._
import example.bankwealth.infrastructure.persistence.converters.DomainConverters
import BankPaymentPorts.OperationNotExecuted
import net.imadz.infra.saga.strict._

/** Strict-saga definition of the cash purchase payment: the args codec, the
  * three participants' phase ports and the coordinator assembly.
  *
  * The per-phase business content — which domain command each phase issues,
  * which receipt each phase accepts — is knowledge and stays explicit. The
  * mechanics (codec records, receipt-identity checks, port wrapping) are
  * written once as generic helpers below. Phase names compose from the
  * participant step ids of the saga payload
  * (reserve-investor-funds / credit-fund-collection / reserve-cash-fund-order). */
object BankPaymentSagaDefinition {

  type Args = BankPaymentArgs

  val argsCodec: PayloadCodec[Args] = new PayloadCodec[Args] {
    val pin = CodecPin("BankPaymentArgs", 1)
    def encode(value: Args): ByteString =
      DomainConverters.encodeBankPaymentArgsPO(value).toByteString
    def decode(bytes: ByteString): Try[Args] =
      Try(DomainConverters.decodeBankPaymentArgsPO(
        example.bankwealth.infrastructure.proto.BankPaymentArgsPO.parseFrom(bytes.toByteArray)))
  }

  /** The port view the strict runtime consumes: the bound declarations
    * (evidence) plus one checked phase port per participant phase. */
  trait Ports {
    def declarations: Map[String, (String, String)]
    def reserveInvestorFundsPrepare: PhasePort[Args, ReserveInvestorFundsPrepareReceipt]
    def reserveInvestorFundsCommit: PhasePort[Args, ReserveInvestorFundsCommitReceipt]
    def reserveInvestorFundsCompensate: PhasePort[Args, ReserveInvestorFundsCompensateReceipt]
    def creditFundCollectionPrepare: PhasePort[Args, CreditFundCollectionPrepareReceipt]
    def creditFundCollectionCommit: PhasePort[Args, CreditFundCollectionCommitReceipt]
    def creditFundCollectionCompensate: PhasePort[Args, CreditFundCollectionCompensateReceipt]
    def reserveCashFundOrderPrepare: PhasePort[Args, ReserveCashFundOrderPrepareReceipt]
    def reserveCashFundOrderCommit: PhasePort[Args, ReserveCashFundOrderCommitReceipt]
    def reserveCashFundOrderCompensate: PhasePort[Args, ReserveCashFundOrderCompensateReceipt]
  }

  // ---------------------------------------------------------------- knowledge
  private val SagaId = "bank-cash-payment-v1"
  private val SagaDefinitionVersion = 1
  private val SagaDefinitionDigest = "sha256:c13f703e76eaee9bfceeff701ecc5f41dd011d6db6890c6820a7faa944538f64"

  // Coordinator assembly slots (judged): the coordinator's ask window and its
  // in-flight participant capacity.
  private val CoordinatorAskMillis = 1000L
  private val CoordinatorCapacity = 32

  private def payloadCodec[Receipt](
    codecPin: CodecPin,
    encodeReceipt: Receipt => ByteString,
    decodeBytes: ByteString => Try[Receipt],
  ): PayloadCodec[Receipt] = new PayloadCodec[Receipt] {
    val pin: CodecPin = codecPin
    def encode(value: Receipt): ByteString = encodeReceipt(value)
    def decode(bytes: ByteString): Try[Receipt] = decodeBytes(bytes)
  }

  /** Every receipt must re-state exactly the durable operation it answers. */
  private def requireReceiptIdentity(
    request: OperationRequest[Args],
    txid: String,
    definitionVersion: String,
    argsDigest: String,
    participant: String,
    resource: String,
    step: String,
    phase: String,
  ): Unit = {
    require(txid == request.identity.transaction.transactionId, "receipt txid differs from durable operation")
    require(definitionVersion == request.identity.transaction.definitionVersion.toString,
        "receipt definition-version differs from durable operation")
    require(argsDigest == request.identity.transaction.argsDigest, "receipt args-digest differs from durable operation")
    require(participant == request.identity.participantId, "receipt participant differs from durable operation")
    require(resource == request.identity.resource, "receipt resource differs from durable operation")
    require(step == request.identity.stepId, "receipt step differs from durable operation")
    require(phase == request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT),
        "receipt phase differs from durable operation")
  }

  private def phaseLower(request: OperationRequest[Args]): String =
    request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)

  // ---- reserve-investor-funds (investorCreditBalance, CreditBalance) --------

  val ReserveInvestorFundsPrepareCodec: PayloadCodec[ReserveInvestorFundsPrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-prepare", 1),
    receipt =>
      DomainConverters.encodeReserveInvestorFundsPrepareReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveInvestorFundsPrepareReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveInvestorFundsPrepareReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveInvestorFundsPrepare(request: OperationRequest[Args],
      receipt: ReserveInvestorFundsPrepareReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsPrepareCommand(request: OperationRequest[Args]): CreditBalanceRuleParams.ReserveFundsParams =
    CreditBalanceRuleParams.ReserveFundsParams(TxId(request.identity.transaction.transactionId),
        request.args.investorAccountId, request.args.amount)

  val ReserveInvestorFundsCommitCodec: PayloadCodec[ReserveInvestorFundsCommitReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-commit", 1),
    receipt =>
      DomainConverters.encodeReserveInvestorFundsCommitReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveInvestorFundsCommitReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveInvestorFundsCommitReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveInvestorFundsCommit(request: OperationRequest[Args],
      receipt: ReserveInvestorFundsCommitReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsCommitCommand(request: OperationRequest[Args]): CreditBalanceRuleParams.DeductFundsParams =
    CreditBalanceRuleParams.DeductFundsParams(TxId(request.identity.transaction.transactionId),
        request.args.investorAccountId, request.args.amount)

  val ReserveInvestorFundsCompensateCodec: PayloadCodec[ReserveInvestorFundsCompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-compensate", 1),
    receipt =>
      DomainConverters.encodeReserveInvestorFundsCompensateReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveInvestorFundsCompensateReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveInvestorFundsCompensateReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveInvestorFundsCompensate(request: OperationRequest[Args],
      receipt: ReserveInvestorFundsCompensateReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsCompensateCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .ReleaseReservedFundsParams =
    CreditBalanceRuleParams.ReleaseReservedFundsParams(TxId(request.identity.transaction.transactionId),
        request.args.investorAccountId, request.args.amount)

  // ---- credit-fund-collection (collectionCreditBalance, CreditBalance) ------

  val CreditFundCollectionPrepareCodec: PayloadCodec[CreditFundCollectionPrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-prepare", 1),
    receipt =>
      DomainConverters.encodeCreditFundCollectionPrepareReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeCreditFundCollectionPrepareReceiptPO(
      example.bankwealth.infrastructure.proto.CreditFundCollectionPrepareReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkCreditFundCollectionPrepare(request: OperationRequest[Args],
      receipt: CreditFundCollectionPrepareReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionPrepareCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .RecordIncomingCreditsParams =
    CreditBalanceRuleParams.RecordIncomingCreditsParams(TxId(request.identity.transaction.transactionId),
        request.args.fundCollectionAccountId, request.args.amount)

  val CreditFundCollectionCommitCodec: PayloadCodec[CreditFundCollectionCommitReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-commit", 1),
    receipt =>
      DomainConverters.encodeCreditFundCollectionCommitReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeCreditFundCollectionCommitReceiptPO(
      example.bankwealth.infrastructure.proto.CreditFundCollectionCommitReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkCreditFundCollectionCommit(request: OperationRequest[Args],
      receipt: CreditFundCollectionCommitReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionCommitCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .CommitIncomingCreditsParams =
    CreditBalanceRuleParams.CommitIncomingCreditsParams(TxId(request.identity.transaction.transactionId),
        request.args.fundCollectionAccountId, request.args.amount)

  val CreditFundCollectionCompensateCodec: PayloadCodec[CreditFundCollectionCompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-compensate", 1),
    receipt =>
      DomainConverters.encodeCreditFundCollectionCompensateReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeCreditFundCollectionCompensateReceiptPO(
      example.bankwealth.infrastructure.proto.CreditFundCollectionCompensateReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkCreditFundCollectionCompensate(request: OperationRequest[Args],
      receipt: CreditFundCollectionCompensateReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionCompensateCommand(request: OperationRequest[Args]): CreditBalanceRuleParams
      .CancelIncomingCreditParams =
    CreditBalanceRuleParams.CancelIncomingCreditParams(TxId(request.identity.transaction.transactionId),
        request.args.fundCollectionAccountId, request.args.amount)

  // ---- reserve-cash-fund-order (orderFundOrderTCC, FundOrder) ---------------

  val ReserveCashFundOrderPrepareCodec: PayloadCodec[ReserveCashFundOrderPrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-prepare", 1),
    receipt =>
      DomainConverters.encodeReserveCashFundOrderPrepareReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveCashFundOrderPrepareReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveCashFundOrderPrepareReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveCashFundOrderPrepare(request: OperationRequest[Args],
      receipt: ReserveCashFundOrderPrepareReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderPrepareCommand(request: OperationRequest[Args]): FundOrderRuleParams
      .ReserveFundSubscriptionParams =
    FundOrderRuleParams.ReserveFundSubscriptionParams(TxId(request.identity.transaction.transactionId),
        request.args.fundOrderId, request.args.amount)

  val ReserveCashFundOrderCommitCodec: PayloadCodec[ReserveCashFundOrderCommitReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-commit", 1),
    receipt =>
      DomainConverters.encodeReserveCashFundOrderCommitReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveCashFundOrderCommitReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveCashFundOrderCommitReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveCashFundOrderCommit(request: OperationRequest[Args],
      receipt: ReserveCashFundOrderCommitReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderCommitCommand(request: OperationRequest[Args]): FundOrderRuleParams
      .ConfirmFundSubscriptionPaymentParams =
    FundOrderRuleParams.ConfirmFundSubscriptionPaymentParams(TxId(request.identity.transaction.transactionId),
        request.args.fundOrderId, request.args.amount)

  val ReserveCashFundOrderCompensateCodec: PayloadCodec[ReserveCashFundOrderCompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-compensate", 1),
    receipt =>
      DomainConverters.encodeReserveCashFundOrderCompensateReceiptPO(receipt).toByteString,
    bytes => Try(DomainConverters.decodeReserveCashFundOrderCompensateReceiptPO(
      example.bankwealth.infrastructure.proto.ReserveCashFundOrderCompensateReceiptPO.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveCashFundOrderCompensate(request: OperationRequest[Args],
      receipt: ReserveCashFundOrderCompensateReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderCompensateCommand(request: OperationRequest[Args]): FundOrderRuleParams
      .CancelCashFundSubscriptionParams =
    FundOrderRuleParams.CancelCashFundSubscriptionParams(TxId(request.identity.transaction.transactionId),
        request.args.fundOrderId, request.args.amount)

  // ------------------------------------------------------- once-written mechanics

  /** A technical failure surfaces as an unknown outcome with the cause —
    * never an implicit retry; only a provably-not-executed receipt folds into
    * the not-executed outcome. */
  private def safeOutcome[Receipt](
    result: Future[PhaseOutcome[Receipt]],
    request: OperationRequest[Args],
    face: String,
  )(implicit ec: ExecutionContext): Future[PhaseOutcome[Receipt]] =
    result.recover {
      case ex: OperationNotExecuted
          if ex.identity == request.identity && ex.evidence != null && ex.evidence.nonEmpty =>
        NotExecuted(request.identity, ex.evidence, ex.safeToRetry)
      case ex => Unknown(request.identity, s"technical $face failed: " + ex.getMessage)
    }

  /** Wrap a phase port so every confirmed receipt is checked against the
    * durable operation before the runtime sees it. */
  private def checkedPhasePort[Receipt](
    underlying: PhasePort[Args, Receipt],
    codec: PayloadCodec[Receipt],
    receiptCheck: (OperationRequest[Args], Receipt) => Unit,
  )(implicit ec: ExecutionContext): PhasePort[Args, Receipt] = {
    require(underlying != null && underlying.receiptCodec != null && underlying.receiptCodec.pin == codec.pin &&
      underlying.querySafety == QuerySafety
          .DeclaredReadOnly, "required read-only phase port and exact codec implementation")
    val checked = new PhasePort[Args, Receipt] {
      val receiptCodec = codec
      val querySafety = QuerySafety.DeclaredReadOnly
      private def validated(result: Future[PhaseOutcome[Receipt]],
          request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =
        result.map {
          case confirmed @ ConfirmedReceipt(identity, receipt) =>
            require(identity == request.identity, "operation identity mismatch")
            receiptCheck(request, receipt)
            confirmed
          case other =>
            require(other.identity == request.identity, "operation identity mismatch")
            other
        }
      def execute(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] = validated(underlying
          .execute(request), request)
      def query(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] = validated(underlying.query(request),
          request)
    }
    checked
  }

  private def phasePort[Receipt](
    ports: BankPaymentPorts,
    codec: PayloadCodec[Receipt],
  )(exec: (BankPaymentPorts, OperationRequest[Args]) => Future[PhaseOutcome[Receipt]])
   (probe: (BankPaymentPorts, OperationRequest[Args]) => Future[PhaseOutcome[Receipt]])
   (implicit ec: ExecutionContext): PhasePort[Args, Receipt] = new PhasePort[Args, Receipt] {
    val receiptCodec = codec
    val querySafety = QuerySafety.DeclaredReadOnly
    def execute(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =
      safeOutcome(exec(ports, request), request, "execute")
    def query(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =
      safeOutcome(probe(ports, request), request, "query")
  }

  // ------------------------------------------------------------------- wiring

  def fromTechnical(technical: BankPaymentPorts)(implicit ec: ExecutionContext): Ports = {
    require(technical != null, "bound technical ports required")
    new Ports {
      val declarations: Map[String, (String, String)] = technical.declarations

      val reserveInvestorFundsPrepare: PhasePort[Args, ReserveInvestorFundsPrepareReceipt] =
        checkedPhasePort(phasePort(technical, ReserveInvestorFundsPrepareCodec) { (ports, request) =>
          val command = reserveInvestorFundsPrepareCommand(request)
          ports.reserveInvestorFundsPrepareExecute(
            ReserveInvestorFundsPrepareInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveInvestorFundsPrepareQuery(
            ReserveInvestorFundsPrepareQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveInvestorFundsPrepareCodec, checkReserveInvestorFundsPrepare)

      val reserveInvestorFundsCommit: PhasePort[Args, ReserveInvestorFundsCommitReceipt] =
        checkedPhasePort(phasePort(technical, ReserveInvestorFundsCommitCodec) { (ports, request) =>
          val command = reserveInvestorFundsCommitCommand(request)
          ports.reserveInvestorFundsCommitExecute(
            ReserveInvestorFundsCommitInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveInvestorFundsCommitQuery(
            ReserveInvestorFundsCommitQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveInvestorFundsCommitCodec, checkReserveInvestorFundsCommit)

      val reserveInvestorFundsCompensate: PhasePort[Args, ReserveInvestorFundsCompensateReceipt] =
        checkedPhasePort(phasePort(technical, ReserveInvestorFundsCompensateCodec) { (ports, request) =>
          val command = reserveInvestorFundsCompensateCommand(request)
          ports.reserveInvestorFundsCompensateExecute(
            ReserveInvestorFundsCompensateInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveInvestorFundsCompensateQuery(
            ReserveInvestorFundsCompensateQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveInvestorFundsCompensateCodec, checkReserveInvestorFundsCompensate)

      val creditFundCollectionPrepare: PhasePort[Args, CreditFundCollectionPrepareReceipt] =
        checkedPhasePort(phasePort(technical, CreditFundCollectionPrepareCodec) { (ports, request) =>
          val command = creditFundCollectionPrepareCommand(request)
          ports.creditFundCollectionPrepareExecute(
            CreditFundCollectionPrepareInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.creditFundCollectionPrepareQuery(
            CreditFundCollectionPrepareQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, CreditFundCollectionPrepareCodec, checkCreditFundCollectionPrepare)

      val creditFundCollectionCommit: PhasePort[Args, CreditFundCollectionCommitReceipt] =
        checkedPhasePort(phasePort(technical, CreditFundCollectionCommitCodec) { (ports, request) =>
          val command = creditFundCollectionCommitCommand(request)
          ports.creditFundCollectionCommitExecute(
            CreditFundCollectionCommitInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.creditFundCollectionCommitQuery(
            CreditFundCollectionCommitQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, CreditFundCollectionCommitCodec, checkCreditFundCollectionCommit)

      val creditFundCollectionCompensate: PhasePort[Args, CreditFundCollectionCompensateReceipt] =
        checkedPhasePort(phasePort(technical, CreditFundCollectionCompensateCodec) { (ports, request) =>
          val command = creditFundCollectionCompensateCommand(request)
          ports.creditFundCollectionCompensateExecute(
            CreditFundCollectionCompensateInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.creditFundCollectionCompensateQuery(
            CreditFundCollectionCompensateQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, CreditFundCollectionCompensateCodec, checkCreditFundCollectionCompensate)

      val reserveCashFundOrderPrepare: PhasePort[Args, ReserveCashFundOrderPrepareReceipt] =
        checkedPhasePort(phasePort(technical, ReserveCashFundOrderPrepareCodec) { (ports, request) =>
          val command = reserveCashFundOrderPrepareCommand(request)
          ports.reserveCashFundOrderPrepareExecute(
            ReserveCashFundOrderPrepareInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveCashFundOrderPrepareQuery(
            ReserveCashFundOrderPrepareQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, FundOrderId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveCashFundOrderPrepareCodec, checkReserveCashFundOrderPrepare)

      val reserveCashFundOrderCommit: PhasePort[Args, ReserveCashFundOrderCommitReceipt] =
        checkedPhasePort(phasePort(technical, ReserveCashFundOrderCommitCodec) { (ports, request) =>
          val command = reserveCashFundOrderCommitCommand(request)
          ports.reserveCashFundOrderCommitExecute(
            ReserveCashFundOrderCommitInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveCashFundOrderCommitQuery(
            ReserveCashFundOrderCommitQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, FundOrderId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveCashFundOrderCommitCodec, checkReserveCashFundOrderCommit)

      val reserveCashFundOrderCompensate: PhasePort[Args, ReserveCashFundOrderCompensateReceipt] =
        checkedPhasePort(phasePort(technical, ReserveCashFundOrderCompensateCodec) { (ports, request) =>
          val command = reserveCashFundOrderCompensateCommand(request)
          ports.reserveCashFundOrderCompensateExecute(
            ReserveCashFundOrderCompensateInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveCashFundOrderCompensateQuery(
            ReserveCashFundOrderCompensateQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity
                  .participantId, FundOrderId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveCashFundOrderCompensateCodec, checkReserveCashFundOrderCompensate)
    }
  }

  /** The runtime consumes binding-wrapped phase ports; the definition site is
    * the single place the checked ports become runtime bindings. */
  private def phaseBindings(
    prepare: PhasePort[Args, _],
    commit: PhasePort[Args, _],
    compensate: PhasePort[Args, _],
  ): Map[Phase, PhaseBinding[Args]] = Map(
    Phase.Prepare -> PhaseBinding(prepare),
    Phase.Commit -> PhaseBinding(commit),
    Phase.Compensate -> PhaseBinding(compensate),
  )

  def definition(ports: Ports)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {
    require(ports != null, "bound phase ports required")
    StrictSagaDefinition(SagaId, SagaDefinitionVersion, SagaDefinitionDigest, argsCodec, args => Vector(
      StrictParticipant[Args]("reserve-investor-funds",
          "investorCreditBalance", args.investorAccountId.value, phaseBindings(ports.reserveInvestorFundsPrepare,
              ports.reserveInvestorFundsCommit, ports.reserveInvestorFundsCompensate)),
      StrictParticipant[Args]("credit-fund-collection",
          "collectionCreditBalance", args
              .fundCollectionAccountId.value, phaseBindings(ports.creditFundCollectionPrepare,
                  ports.creditFundCollectionCommit, ports.creditFundCollectionCompensate)),
      StrictParticipant[Args]("reserve-cash-fund-order",
          "orderFundOrderTCC", args.fundOrderId.value, phaseBindings(ports.reserveCashFundOrderPrepare,
              ports.reserveCashFundOrderCommit, ports.reserveCashFundOrderCompensate)),
    ))
  }

  def coordinator(
    persistenceId: String,
    ports: Ports,
    authorizer: ReconcileAuthorizer,
  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && authorizer != null,
        "explicit identity and reconciliation authorizer required")
    StrictSagaCoordinator(PersistenceId.ofUniqueId(persistenceId), definition(ports), authorizer,
      StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration(CoordinatorAskMillis,
          "millis"), CoordinatorCapacity))
  }
}

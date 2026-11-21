package example.bankwealth.application

import scala.concurrent.{ExecutionContext, Future}
import scala.util.Try

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import com.google.protobuf.ByteString
import example.bankwealth.domain.{CreditBalanceProtocol, FundOrderProtocol}
import example.bankwealth.domain.values.{AccountId, BankPaymentArgs, FundOrderId, TxId}
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
      example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPaymentArgsPB(value).toByteString
    def decode(bytes: ByteString): Try[Args] =
      Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPaymentArgsPB(
        example.bankwealth.infrastructure.proto.BankPaymentArgsPB.parseFrom(bytes.toByteArray)))
  }

  /** The port view the strict runtime consumes: the bound declarations
    * (evidence) plus one checked phase port per participant phase. */
  trait Ports {
    def declarations: Map[String, (String, String)]
    def reserveInvestorFundsPrepare: PhasePort[Args, BankPayment0PrepareReceipt]
    def reserveInvestorFundsCommit: PhasePort[Args, BankPayment0CommitReceipt]
    def reserveInvestorFundsCompensate: PhasePort[Args, BankPayment0CompensateReceipt]
    def creditFundCollectionPrepare: PhasePort[Args, BankPayment1PrepareReceipt]
    def creditFundCollectionCommit: PhasePort[Args, BankPayment1CommitReceipt]
    def creditFundCollectionCompensate: PhasePort[Args, BankPayment1CompensateReceipt]
    def reserveCashFundOrderPrepare: PhasePort[Args, BankPayment2PrepareReceipt]
    def reserveCashFundOrderCommit: PhasePort[Args, BankPayment2CommitReceipt]
    def reserveCashFundOrderCompensate: PhasePort[Args, BankPayment2CompensateReceipt]
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
    require(definitionVersion == request.identity.transaction.definitionVersion.toString, "receipt definition-version differs from durable operation")
    require(argsDigest == request.identity.transaction.argsDigest, "receipt args-digest differs from durable operation")
    require(participant == request.identity.participantId, "receipt participant differs from durable operation")
    require(resource == request.identity.resource, "receipt resource differs from durable operation")
    require(step == request.identity.stepId, "receipt step differs from durable operation")
    require(phase == request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT), "receipt phase differs from durable operation")
  }

  private def phaseLower(request: OperationRequest[Args]): String =
    request.identity.phase.toString.toLowerCase(java.util.Locale.ROOT)

  // ---- reserve-investor-funds (investorCreditBalance, CreditBalance) --------

  val ReserveInvestorFundsPrepareCodec: PayloadCodec[BankPayment0PrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-prepare", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment0PrepareReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment0PrepareReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment0PrepareReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveInvestorFundsPrepare(request: OperationRequest[Args], receipt: BankPayment0PrepareReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsPrepareCommand(request: OperationRequest[Args]): CreditBalanceProtocol.ReserveFunds =
    CreditBalanceProtocol.ReserveFunds(TxId(request.identity.transaction.transactionId), request.args.investorAccountId, request.args.amount)

  val ReserveInvestorFundsCommitCodec: PayloadCodec[BankPayment0CommitReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-commit", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment0CommitReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment0CommitReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment0CommitReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveInvestorFundsCommit(request: OperationRequest[Args], receipt: BankPayment0CommitReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsCommitCommand(request: OperationRequest[Args]): CreditBalanceProtocol.DeductFunds =
    CreditBalanceProtocol.DeductFunds(TxId(request.identity.transaction.transactionId), request.args.investorAccountId, request.args.amount)

  val ReserveInvestorFundsCompensateCodec: PayloadCodec[BankPayment0CompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-investor-funds-compensate", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment0CompensateReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment0CompensateReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment0CompensateReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveInvestorFundsCompensate(request: OperationRequest[Args], receipt: BankPayment0CompensateReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveInvestorFundsCompensateCommand(request: OperationRequest[Args]): CreditBalanceProtocol.ReleaseReservedFunds =
    CreditBalanceProtocol.ReleaseReservedFunds(TxId(request.identity.transaction.transactionId), request.args.investorAccountId, request.args.amount)

  // ---- credit-fund-collection (collectionCreditBalance, CreditBalance) ------

  val CreditFundCollectionPrepareCodec: PayloadCodec[BankPayment1PrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-prepare", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment1PrepareReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment1PrepareReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment1PrepareReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkCreditFundCollectionPrepare(request: OperationRequest[Args], receipt: BankPayment1PrepareReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionPrepareCommand(request: OperationRequest[Args]): CreditBalanceProtocol.RecordIncomingCredits =
    CreditBalanceProtocol.RecordIncomingCredits(TxId(request.identity.transaction.transactionId), request.args.fundCollectionAccountId, request.args.amount)

  val CreditFundCollectionCommitCodec: PayloadCodec[BankPayment1CommitReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-commit", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment1CommitReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment1CommitReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment1CommitReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkCreditFundCollectionCommit(request: OperationRequest[Args], receipt: BankPayment1CommitReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionCommitCommand(request: OperationRequest[Args]): CreditBalanceProtocol.CommitIncomingCredits =
    CreditBalanceProtocol.CommitIncomingCredits(TxId(request.identity.transaction.transactionId), request.args.fundCollectionAccountId, request.args.amount)

  val CreditFundCollectionCompensateCodec: PayloadCodec[BankPayment1CompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-credit-fund-collection-compensate", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment1CompensateReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment1CompensateReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment1CompensateReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkCreditFundCollectionCompensate(request: OperationRequest[Args], receipt: BankPayment1CompensateReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def creditFundCollectionCompensateCommand(request: OperationRequest[Args]): CreditBalanceProtocol.CancelIncomingCredit =
    CreditBalanceProtocol.CancelIncomingCredit(TxId(request.identity.transaction.transactionId), request.args.fundCollectionAccountId, request.args.amount)

  // ---- reserve-cash-fund-order (orderFundOrderTCC, FundOrder) ---------------

  val ReserveCashFundOrderPrepareCodec: PayloadCodec[BankPayment2PrepareReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-prepare", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment2PrepareReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment2PrepareReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment2PrepareReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveCashFundOrderPrepare(request: OperationRequest[Args], receipt: BankPayment2PrepareReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderPrepareCommand(request: OperationRequest[Args]): FundOrderProtocol.ReserveFundSubscription =
    FundOrderProtocol.ReserveFundSubscription(TxId(request.identity.transaction.transactionId), request.args.fundOrderId, request.args.amount)

  val ReserveCashFundOrderCommitCodec: PayloadCodec[BankPayment2CommitReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-commit", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment2CommitReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment2CommitReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment2CommitReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveCashFundOrderCommit(request: OperationRequest[Args], receipt: BankPayment2CommitReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderCommitCommand(request: OperationRequest[Args]): FundOrderProtocol.ConfirmFundSubscriptionPayment =
    FundOrderProtocol.ConfirmFundSubscriptionPayment(TxId(request.identity.transaction.transactionId), request.args.fundOrderId, request.args.amount)

  val ReserveCashFundOrderCompensateCodec: PayloadCodec[BankPayment2CompensateReceipt] = payloadCodec(
    CodecPin("bank-payment-reserve-cash-fund-order-compensate", 1),
    receipt => example.bankwealth.infrastructure.serialization.DomainConverters.encodeBankPayment2CompensateReceiptPB(receipt).toByteString,
    bytes => Try(example.bankwealth.infrastructure.serialization.DomainConverters.decodeBankPayment2CompensateReceiptPB(
      example.bankwealth.infrastructure.proto.BankPayment2CompensateReceiptPB.parseFrom(bytes.toByteArray))),
  )

  private def checkReserveCashFundOrderCompensate(request: OperationRequest[Args], receipt: BankPayment2CompensateReceipt): Unit =
    requireReceiptIdentity(request, receipt.transaction.value, receipt.definitionVersion, receipt.argsDigest,
      receipt.participant, receipt.resource.value, receipt.step, receipt.phase)

  def reserveCashFundOrderCompensateCommand(request: OperationRequest[Args]): FundOrderProtocol.CancelCashFundSubscription =
    FundOrderProtocol.CancelCashFundSubscription(TxId(request.identity.transaction.transactionId), request.args.fundOrderId, request.args.amount)

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
      case ex: BankPaymentPorts.OperationNotExecuted
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
  )(implicit ec: ExecutionContext): PhaseBinding[Args] = {
    require(underlying != null && underlying.receiptCodec != null && underlying.receiptCodec.pin == codec.pin &&
      underlying.querySafety == QuerySafety.DeclaredReadOnly, "required read-only phase port and exact codec implementation")
    val checked = new PhasePort[Args, Receipt] {
      val receiptCodec = codec
      val querySafety = QuerySafety.DeclaredReadOnly
      private def validated(result: Future[PhaseOutcome[Receipt]], request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =
        result.map {
          case confirmed @ ConfirmedReceipt(identity, receipt) =>
            require(identity == request.identity, "operation identity mismatch")
            receiptCheck(request, receipt)
            confirmed
          case other =>
            require(other.identity == request.identity, "operation identity mismatch")
            other
        }
      def execute(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] = validated(underlying.execute(request), request)
      def query(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] = validated(underlying.query(request), request)
    }
    PhaseBinding(checked)
  }

  private def phasePort[Receipt](
    ports: BankPaymentPorts,
    codec: PayloadCodec[Receipt],
  )(execute: (BankPaymentPorts, OperationRequest[Args]) => Future[PhaseOutcome[Receipt]])
   (query: (BankPaymentPorts, OperationRequest[Args]) => Future[PhaseOutcome[Receipt]])
   (implicit ec: ExecutionContext): PhasePort[Args, Receipt] = new PhasePort[Args, Receipt] {
    val receiptCodec = codec
    val querySafety = QuerySafety.DeclaredReadOnly
    def execute(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =
      safeOutcome(execute(ports, request), request, "execute")
    def query(request: OperationRequest[Args]): Future[PhaseOutcome[Receipt]] =
      safeOutcome(query(ports, request), request, "query")
  }

  // ------------------------------------------------------------------- wiring

  def fromTechnical(technical: BankPaymentPorts)(implicit ec: ExecutionContext): Ports = {
    require(technical != null, "bound technical ports required")
    new Ports {
      val declarations: Map[String, (String, String)] = technical.declarations

      val reserveInvestorFundsPrepare: PhasePort[Args, BankPayment0PrepareReceipt] =
        checkedPhasePort(phasePort(technical, ReserveInvestorFundsPrepareCodec) { (ports, request) =>
          val command = reserveInvestorFundsPrepareCommand(request)
          ports.reserveInvestorFundsPrepareExecute(
            BankPayment0PrepareInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveInvestorFundsPrepareQuery(
            BankPayment0PrepareQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveInvestorFundsPrepareCodec, checkReserveInvestorFundsPrepare)

      val reserveInvestorFundsCommit: PhasePort[Args, BankPayment0CommitReceipt] =
        checkedPhasePort(phasePort(technical, ReserveInvestorFundsCommitCodec) { (ports, request) =>
          val command = reserveInvestorFundsCommitCommand(request)
          ports.reserveInvestorFundsCommitExecute(
            BankPayment0CommitInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveInvestorFundsCommitQuery(
            BankPayment0CommitQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveInvestorFundsCommitCodec, checkReserveInvestorFundsCommit)

      val reserveInvestorFundsCompensate: PhasePort[Args, BankPayment0CompensateReceipt] =
        checkedPhasePort(phasePort(technical, ReserveInvestorFundsCompensateCodec) { (ports, request) =>
          val command = reserveInvestorFundsCompensateCommand(request)
          ports.reserveInvestorFundsCompensateExecute(
            BankPayment0CompensateInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveInvestorFundsCompensateQuery(
            BankPayment0CompensateQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveInvestorFundsCompensateCodec, checkReserveInvestorFundsCompensate)

      val creditFundCollectionPrepare: PhasePort[Args, BankPayment1PrepareReceipt] =
        checkedPhasePort(phasePort(technical, CreditFundCollectionPrepareCodec) { (ports, request) =>
          val command = creditFundCollectionPrepareCommand(request)
          ports.creditFundCollectionPrepareExecute(
            BankPayment1PrepareInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.creditFundCollectionPrepareQuery(
            BankPayment1PrepareQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, CreditFundCollectionPrepareCodec, checkCreditFundCollectionPrepare)

      val creditFundCollectionCommit: PhasePort[Args, BankPayment1CommitReceipt] =
        checkedPhasePort(phasePort(technical, CreditFundCollectionCommitCodec) { (ports, request) =>
          val command = creditFundCollectionCommitCommand(request)
          ports.creditFundCollectionCommitExecute(
            BankPayment1CommitInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.creditFundCollectionCommitQuery(
            BankPayment1CommitQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, CreditFundCollectionCommitCodec, checkCreditFundCollectionCommit)

      val creditFundCollectionCompensate: PhasePort[Args, BankPayment1CompensateReceipt] =
        checkedPhasePort(phasePort(technical, CreditFundCollectionCompensateCodec) { (ports, request) =>
          val command = creditFundCollectionCompensateCommand(request)
          ports.creditFundCollectionCompensateExecute(
            BankPayment1CompensateInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.creditFundCollectionCompensateQuery(
            BankPayment1CompensateQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, AccountId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, CreditFundCollectionCompensateCodec, checkCreditFundCollectionCompensate)

      val reserveCashFundOrderPrepare: PhasePort[Args, BankPayment2PrepareReceipt] =
        checkedPhasePort(phasePort(technical, ReserveCashFundOrderPrepareCodec) { (ports, request) =>
          val command = reserveCashFundOrderPrepareCommand(request)
          ports.reserveCashFundOrderPrepareExecute(
            BankPayment2PrepareInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveCashFundOrderPrepareQuery(
            BankPayment2PrepareQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, FundOrderId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveCashFundOrderPrepareCodec, checkReserveCashFundOrderPrepare)

      val reserveCashFundOrderCommit: PhasePort[Args, BankPayment2CommitReceipt] =
        checkedPhasePort(phasePort(technical, ReserveCashFundOrderCommitCodec) { (ports, request) =>
          val command = reserveCashFundOrderCommitCommand(request)
          ports.reserveCashFundOrderCommitExecute(
            BankPayment2CommitInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveCashFundOrderCommitQuery(
            BankPayment2CommitQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, FundOrderId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveCashFundOrderCommitCodec, checkReserveCashFundOrderCommit)

      val reserveCashFundOrderCompensate: PhasePort[Args, BankPayment2CompensateReceipt] =
        checkedPhasePort(phasePort(technical, ReserveCashFundOrderCompensateCodec) { (ports, request) =>
          val command = reserveCashFundOrderCompensateCommand(request)
          ports.reserveCashFundOrderCompensateExecute(
            BankPayment2CompensateInput(command.txid, command.resource, command.amount), request.identity)
            .map(r => ConfirmedReceipt(request.identity, r))
        } { (ports, request) =>
          ports.reserveCashFundOrderCompensateQuery(
            BankPayment2CompensateQuery(TxId(request.identity.transaction.transactionId),
              request.identity.transaction.definitionVersion.toString, request.identity.transaction.argsDigest,
              request.identity.participantId, FundOrderId(request.identity.resource), request.identity.stepId, phaseLower(request)),
            request.identity)
            .map { case Some(receipt) => ConfirmedReceipt(request.identity, receipt)
                   case None => Unknown(request.identity, "typed query returned no authoritative evidence") }
        }, ReserveCashFundOrderCompensateCodec, checkReserveCashFundOrderCompensate)
    }
  }

  def definition(ports: Ports)(implicit ec: ExecutionContext): StrictSagaDefinition[Args] = {
    require(ports != null, "bound phase ports required")
    StrictSagaDefinition(SagaId, SagaDefinitionVersion, SagaDefinitionDigest, argsCodec, args => Vector(
      StrictParticipant[Args]("reserve-investor-funds", "investorCreditBalance", args.investorAccountId.value, Map(
        Phase.Prepare -> ports.reserveInvestorFundsPrepare,
        Phase.Commit -> ports.reserveInvestorFundsCommit,
        Phase.Compensate -> ports.reserveInvestorFundsCompensate)),
      StrictParticipant[Args]("credit-fund-collection", "collectionCreditBalance", args.fundCollectionAccountId.value, Map(
        Phase.Prepare -> ports.creditFundCollectionPrepare,
        Phase.Commit -> ports.creditFundCollectionCommit,
        Phase.Compensate -> ports.creditFundCollectionCompensate)),
      StrictParticipant[Args]("reserve-cash-fund-order", "orderFundOrderTCC", args.fundOrderId.value, Map(
        Phase.Prepare -> ports.reserveCashFundOrderPrepare,
        Phase.Commit -> ports.reserveCashFundOrderCommit,
        Phase.Compensate -> ports.reserveCashFundOrderCompensate)),
    ))
  }

  def coordinator(
    persistenceId: String,
    ports: Ports,
    authorizer: ReconcileAuthorizer,
  )(implicit ec: ExecutionContext): Behavior[StrictSagaCoordinator.Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && authorizer != null, "explicit identity and reconciliation authorizer required")
    StrictSagaCoordinator(PersistenceId.ofUniqueId(persistenceId), definition(ports), authorizer,
      StrictSagaCoordinator.Settings(scala.concurrent.duration.Duration(CoordinatorAskMillis, "millis"), CoordinatorCapacity))
  }
}

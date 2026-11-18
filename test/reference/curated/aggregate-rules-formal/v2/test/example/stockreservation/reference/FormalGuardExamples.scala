package example.stockreservation.reference

import org.scalacheck.{Gen, Prop, Properties, Shrink}
import org.scalacheck.Prop.{collect, forAll}

import net.imadz.common.CommonTypes.{InvariantRule, iMadzError}

/** Two closed guard forms, not an inventory policy, a banking algorithm or the raw MoneyOps ABI. */
object FormalGuardExamples extends Properties("aggregate-rules-formal.technical-money.v1") {
  final case class Currency(value: String) {
    require(value != null && value.nonEmpty, "Currency must be nonempty")
  }
  final case class GuardMoney(minorUnits: BigInt, currency: Currency)
  final case class GuardBalanceState(balances: Map[Currency, BigInt]) {
    require(balances.values.forall(_ >= 0), "Technical example balances must be nonnegative")
  }
  final case class GuardAmountParams(amount: GuardMoney)
  sealed trait GuardEvent
  final case class AmountAdmitted() extends GuardEvent

  sealed abstract class GuardRejection(val code: String, val message: String) {
    final def toError: iMadzError = iMadzError(code, message)
  }
  case object AmountNotPositive extends GuardRejection(
    "GUARD_AMOUNT_NONPOSITIVE", "Technical example amount must be positive."
  )
  case object BalanceInsufficient extends GuardRejection(
    "GUARD_BALANCE_INSUFFICIENT", "Technical example requires a sufficient balance in the same currency."
  )

  object AdmitAmountRule extends InvariantRule[GuardEvent, GuardBalanceState, GuardAmountParams] {
    override def apply(
        state: GuardBalanceState,
        p: GuardAmountParams
    ): Either[iMadzError, List[GuardEvent]] =
      if (p.amount.minorUnits <= 0) Left(AmountNotPositive.toError)
      else if (!state.balances.get(p.amount.currency).exists(_ >= p.amount.minorUnits))
        Left(BalanceInsufficient.toError)
      else Right(List(AmountAdmitted()))
  }

  sealed trait MoneyBranch
  case object NonPositiveAmount extends MoneyBranch
  case object MissingCurrency extends MoneyBranch
  case object ShortBalance extends MoneyBranch
  case object SufficientBalance extends MoneyBranch

  final case class MoneyCase(branch: MoneyBranch, amount: BigInt, balance: BigInt) {
    val currency: Currency = Currency("XTS")
    val otherCurrency: Currency = Currency("ALT")
    val state: GuardBalanceState = GuardBalanceState(branch match {
      case MissingCurrency => Map(otherCurrency -> balance)
      case _ => Map(otherCurrency -> BigInt(3), currency -> balance)
    })
    val params: GuardAmountParams = GuardAmountParams(GuardMoney(amount, currency))
    def measure: BigInt = amount.abs + balance
  }

  private val enormous: BigInt = BigInt("100000000000000000000000000000000000001")
  private val magnitude: Gen[BigInt] = Gen.choose(1, 512).flatMap { size =>
    Gen.listOfN(size, Gen.oneOf(0, 1)).map(bits =>
      bits.foldLeft(BigInt(0))((value, bit) => value * 2 + bit) + 1)
  }
  private val positive: Gen[BigInt] = Gen.frequency(
    3 -> Gen.oneOf(BigInt(1), BigInt(Long.MaxValue), enormous), 7 -> magnitude
  )
  private val nonPositive: Gen[BigInt] = Gen.frequency(
    3 -> Gen.oneOf(BigInt(0), BigInt(-1), BigInt(Long.MinValue), -enormous), 7 -> magnitude.map(-_)
  )
  val branches: Vector[MoneyBranch] = Vector(NonPositiveAmount, MissingCurrency, ShortBalance, SufficientBalance)

  def moneyGen(branch: MoneyBranch): Gen[MoneyCase] = {
    val amounts = if (branch == NonPositiveAmount) nonPositive else positive
    for {
      amount <- amounts
      balance <- branch match {
        case ShortBalance => Gen.const(amount - 1)
        case SufficientBalance => Gen.oneOf(amount, amount + enormous)
        case _ => Gen.oneOf(BigInt(0), enormous)
      }
    } yield MoneyCase(branch, amount, balance)
  }

  val anyMoney: Gen[MoneyCase] = Gen.oneOf(branches).flatMap(moneyGen)
  implicit val shrinkMoney: Shrink[MoneyCase] = Shrink { sample =>
    val quantity = if (sample.branch == NonPositiveAmount) BigInt(0) else BigInt(1)
    val available = sample.branch match {
      case SufficientBalance => if (sample.balance == sample.amount) BigInt(1) else BigInt(2)
      case _ => BigInt(0)
    }
    Vector(sample.copy(amount = quantity, balance = available))
      .filter(_.measure < sample.measure).toStream
  }

  private def premise(sample: MoneyCase): Boolean = {
    val margin = sample.state.balances.get(sample.currency).map(_ - sample.amount)
    sample.balance >= 0 && (sample.branch match {
      case NonPositiveAmount => sample.amount <= 0
      case MissingCurrency => sample.amount > 0 && margin.isEmpty
      case ShortBalance => sample.amount > 0 && margin.exists(_ < 0)
      case SufficientBalance => sample.amount > 0 && margin.exists(_ >= 0)
    })
  }

  private def matches(sample: MoneyCase): Boolean = {
    val expected: Either[StockReservationOracle.ErrorRecord, List[GuardEvent]] = sample.branch match {
      case NonPositiveAmount => Left(StockReservationOracle.ErrorRecord(
        "GUARD_AMOUNT_NONPOSITIVE", "Technical example amount must be positive."
      ))
      case MissingCurrency | ShortBalance => Left(StockReservationOracle.ErrorRecord(
        "GUARD_BALANCE_INSUFFICIENT", "Technical example requires a sufficient balance in the same currency."
      ))
      case SufficientBalance => Right(List(AmountAdmitted()))
    }
    val actual = AdmitAmountRule(sample.state, sample.params)
      .left.map(error => StockReservationOracle.ErrorRecord(error.code, error.message))
    premise(sample) && actual == expected
  }

  property("money: exact value, matching currency and guard order") = forAll(anyMoney) { sample =>
    collect(sample.branch.toString)(Prop(matches(sample)))
  }
  branches.foreach { branch =>
    property(s"money: directed $branch") = forAll(moneyGen(branch)) { sample => matches(sample) }
  }
  private def sameMarginCategory(sample: MoneyCase, smaller: MoneyCase): Boolean =
    sample.branch != SufficientBalance || (smaller.balance == smaller.amount) == (sample.balance == sample.amount)

  private def smallerIsLegal(sample: MoneyCase, smaller: MoneyCase): Boolean =
    premise(smaller) && smaller.branch == sample.branch && smaller.measure < sample.measure

  property("money: shrink closure and strict decrease") = forAll(anyMoney) { sample =>
    premise(sample) && shrinkMoney.shrink(sample).forall { smaller =>
      smallerIsLegal(sample, smaller) && sameMarginCategory(sample, smaller)
    }
  }
  property("money: fixed arbitrary-precision endpoints and equality") = Prop.secure {
    Vector(
      MoneyCase(NonPositiveAmount, -enormous, 0),
      MoneyCase(NonPositiveAmount, 0, enormous),
      MoneyCase(ShortBalance, enormous, enormous - 1),
      MoneyCase(SufficientBalance, enormous, enormous),
      MoneyCase(MissingCurrency, enormous, enormous)
    ).forall(matches)
  }
  property("money: nonpositive guard precedes absent-currency rejection") = Prop.secure {
    val result = AdmitAmountRule(GuardBalanceState(Map.empty), GuardAmountParams(GuardMoney(0, Currency("XTS"))))
    result.left.map(error => (error.code, error.message)) ==
      Left(("GUARD_AMOUNT_NONPOSITIVE", "Technical example amount must be positive."))
  }
}

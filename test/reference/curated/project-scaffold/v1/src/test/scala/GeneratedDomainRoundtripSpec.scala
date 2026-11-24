import org.scalatest.funsuite.AnyFunSuite

final class GeneratedDomainRoundtripSpec extends AnyFunSuite {
  example.bankwealth.service.UnitConfigurationCheck.main(Array.empty)
  test("bankwealth/CreditBalance state survives actual protobuf bytes") {
    val state = example.bankwealth.domain.CreditBalanceState.empty
    val encoded = example.bankwealth.infrastructure.serialization.DomainConverters.encodeCreditBalanceStatePO(state)
    val parsed = example.bankwealth.infrastructure.proto.CreditBalanceStatePO.parseFrom(encoded.toByteArray)
    assert(example.bankwealth.infrastructure.serialization.DomainConverters.decodeCreditBalanceStatePO(parsed) == state)
  }
  test("bankwealth/FundOrder state survives actual protobuf bytes") {
    val state = example.bankwealth.domain.FundOrderState.empty
    val encoded = example.bankwealth.infrastructure.serialization.DomainConverters.encodeFundOrderStatePO(state)
    val parsed = example.bankwealth.infrastructure.proto.FundOrderStatePO.parseFrom(encoded.toByteArray)
    assert(example.bankwealth.infrastructure.serialization.DomainConverters.decodeFundOrderStatePO(parsed) == state)
  }
  test("bankwealth/SipPlan state survives actual protobuf bytes") {
    val state = example.bankwealth.domain.SipPlanState.empty
    val encoded = example.bankwealth.infrastructure.serialization.DomainConverters.encodeSipPlanStatePO(state)
    val parsed = example.bankwealth.infrastructure.proto.SipPlanStatePO.parseFrom(encoded.toByteArray)
    assert(example.bankwealth.infrastructure.serialization.DomainConverters.decodeSipPlanStatePO(parsed) == state)
  }
  test("bankwealth/Money exact domain wire PO and protobuf roundtrip") {
    val value = example.bankwealth.domain.values.Money(BigDecimal("0.01"), "CNY")
    val c = example.bankwealth.infrastructure.serialization.DomainConverters
    assert(c.MoneyFromWire(c.MoneyToWire(value)) == value)
    assert(c.MoneyFromPO(c.MoneyToPO(value)) == value)
    val encoded = c.encodeMoneyPO(value)
    assert(c.decodeMoneyPO(example.bankwealth.infrastructure.proto.MoneyPO.parseFrom(encoded.toByteArray)) == value)
    intercept[IllegalArgumentException](c.decodeMoneyPO(encoded.copy(amount = "1e2")))
  }
  test("bankwealth/AmountDecimal exact domain wire PO and protobuf roundtrip") {
    val value = example.bankwealth.domain.values.AmountDecimal(BigDecimal("0.01"))
    val c = example.bankwealth.infrastructure.serialization.DomainConverters
    assert(c.AmountDecimalFromWire(c.AmountDecimalToWire(value)) == value)
    assert(c.AmountDecimalFromPO(c.AmountDecimalToPO(value)) == value)
    val encoded = c.encodeAmountDecimalPO(value)
    assert(c.decodeAmountDecimalPO(example.bankwealth.infrastructure.proto.AmountDecimalPO.parseFrom(encoded.toByteArray)) == value)
    intercept[IllegalArgumentException](c.decodeAmountDecimalPO(encoded.copy(value = "1e2")))
  }
}

import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.PersistenceTestKitPlugin
import akka.persistence.testkit.scaladsl.PersistenceTestKit
import com.typesafe.config.ConfigFactory
import example.tickets.domain._
import example.tickets.domain.BookingProtocol._
import example.tickets.domain.values._
import example.tickets.infrastructure.proto._
import example.tickets.infrastructure.serialization.DomainConverters
import org.scalatest.funsuite.AnyFunSuite

final class NominalTextRuntimeSpec extends AnyFunSuite {
  test("explicit nominal text guard rejects before host execution and real journal writes") {
    val kit = ActorTestKit(ConfigFactory.parseString("akka.actor.provider = local")
      .withFallback(PersistenceTestKitPlugin.config).withFallback(ConfigFactory.load()))
    try {
      val journal = PersistenceTestKit(kit.system)
      val calls = new java.util.concurrent.atomic.AtomicInteger(0)
      val hosts = new BookingComputations {
        def TicketIdentity(state: BookingState, p: Reserve): TicketId = {
          calls.incrementAndGet()
          p.`type`
        }
      }
      val id = "nominal-text-v4-guard-and-recovery"
      val actor = kit.spawn(BookingAggregateFactory.create(id, BookingState.empty, hosts))
      val reply = kit.createTestProbe[BookingAggregate.Reply]()
      val states = kit.createTestProbe[BookingState]()
      actor ! BookingAggregate.Execute(Reserve(TicketId(""), Distance(BigDecimal("12.345"))), reply.ref)
      reply.expectMessage(BookingAggregate.Refused("EMPTY_TICKET"))
      actor ! BookingAggregate.GetState(states.ref)
      states.expectMessage(BookingState.empty)
      assert(calls.get == 0)
      assert(journal.persistedInStorage(id).isEmpty)

      val exactIdentity = "票-0007 / type"
      val distance = Distance(BigDecimal("12.345"))
      actor ! BookingAggregate.Execute(Reserve(TicketId(exactIdentity), distance), reply.ref)
      reply.expectMessage(BookingAggregate.Accepted(Vector(Reserved(TicketId(exactIdentity), distance))))
      val expected = BookingState(TicketId(exactIdentity), true, distance)
      actor ! BookingAggregate.GetState(states.ref)
      states.expectMessage(expected)
      assert(calls.get == 1)
      val persisted = journal.persistedInStorage(id)
      assert(persisted.size == 1)
      assert(persisted.head.isInstanceOf[BookingReservedPB])
      val event = BookingReservedPB.parseFrom(persisted.head.asInstanceOf[BookingReservedPB].toByteArray)
      assert(DomainConverters.decodeBookingReservedPB(event) == Reserved(TicketId(exactIdentity), distance))
      assert(event.f1.get.f0 == "12345")

      kit.stop(actor)
      val recovered = kit.spawn(BookingAggregateFactory.create(id, BookingState.empty, hosts))
      recovered ! BookingAggregate.GetState(states.ref)
      states.expectMessage(expected)
      assert(calls.get == 1, "replay must not run command host computations")
      recovered ! BookingAggregate.Execute(Reserve(TicketId(""), Distance(BigDecimal("0.001"))), reply.ref)
      reply.expectMessage(BookingAggregate.Refused("EMPTY_TICKET"))
      recovered ! BookingAggregate.GetState(states.ref)
      states.expectMessage(expected)
      assert(journal.persistedInStorage(id) == persisted)
    } finally kit.shutdownTestKit()
  }

  test("exact Decimal uses independent minor-unit expectations and rejects overflow or rounding") {
    val value = Distance(BigDecimal("999999.999"))
    assert(DomainConverters.DistanceToWire(value).value == "999999999")
    assert(DomainConverters.DistanceToPO(value).value == "999999999")
    val bytes = DomainConverters.encodeDistancePB(value).toByteArray
    assert(DomainConverters.decodeDistancePB(DistancePB.parseFrom(bytes)) == value)
    assert(DomainConverters.DistanceFromWire(DistanceWire("12345")) == Distance(BigDecimal("12.345")))
    assert(DomainConverters.DistanceFromPO(DistancePO("-1")) == Distance(BigDecimal("-0.001")))
    intercept[IllegalArgumentException](Distance(BigDecimal("1000000.000")))
    intercept[ArithmeticException](Distance(BigDecimal("0.0001")))
    intercept[IllegalArgumentException](value.plus(Distance(BigDecimal("0.001"))))
    for (text <- Vector("01", "-0", "1.234", "1e3", " 1", "1000000000")) {
      intercept[IllegalArgumentException](DomainConverters.DistanceFromWire(DistanceWire(text)))
    }
  }
}

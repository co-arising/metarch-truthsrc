package example.stockreservation.controllers

import scala.concurrent.duration._

import org.scalacheck.Properties
import org.scalacheck.Prop.{forAll, secure}

import net.imadz.common.Id
import example.stockreservation.application.aggregates.{GetReservationState, GetStockState}
import akka.actor.testkit.typed.scaladsl.TestProbe

import play.api.libs.json.Json

/** 行为性质（真实提交源面，support 层）：全链真实 play Action 管线＋官方 TestEntityRef
  * 缝＋探针直答回执（expectMessageType 后经 cmd.replyTo.tell 回执）。401/400 分支证明
  * "拒绝不触 ask"（expectNoMessage）；ask 超时判例证明崩溃护栏真实折叠 future 内失败
  * （5 秒真实等待）；200 判例逐字节断言私有 writer 的 JSON 面（settledAt null-safe、
  * 平铺无信封）。 */
object ControllerProperties extends Properties("aggregate-state-controller.behavior.v1") {

  import ControllerFixture._

  private def noTouchAfter(probe: TestProbe[_]): Boolean = { probe.expectNoMessage(100.millis); true }

  property("negative: missing bearer token is rejected 401 and never reaches the entity") = secure {
    val result = await(controller.reservation(ControllerOracle.reservationId.toString)(request(None)))
    result.header.status == 401 && bodyOf(result) == ControllerOracle.missingTokenBody &&
      noTouchAfter(reservationProbe)
  }

  property("negative: malformed authorization header is rejected 401 and never reaches the entity") = secure {
    val result = await(controller.reservation(ControllerOracle.reservationId.toString)(
      rawRequest("Authorization" -> "Basic dXNlcjpwYXNz")))
    result.header.status == 401 && bodyOf(result) == ControllerOracle.missingTokenBody &&
      noTouchAfter(reservationProbe)
  }

  property("negative: invalid token is rejected 401 and never reaches the entity") = secure {
    val result = await(controller.reservation(ControllerOracle.reservationId.toString)(
      request(Some("unknown-token"))))
    result.header.status == 401 && bodyOf(result) == ControllerOracle.invalidTokenBody &&
      noTouchAfter(reservationProbe)
  }

  property("negative: expired token is rejected 401 and never reaches the entity") = secure {
    val result = await(controller.reservation(ControllerOracle.reservationId.toString)(
      request(Some("expired-token"))))
    result.header.status == 401 && bodyOf(result) == ControllerOracle.expiredTokenBody &&
      noTouchAfter(reservationProbe)
  }

  property("negative: a fixed invalid id is rejected 400 with the exact param shape and never reaches the entity") = secure {
    val result = await(controller.reservation(ControllerOracle.fixedInvalidId)(request(Some("good-token"))))
    result.header.status == 400 && bodyOf(result) == ControllerOracle.fixedInvalidIdBody &&
      noTouchAfter(reservationProbe)
  }

  property("negative: random invalid ids are rejected 400 with the echoed param shape and never reach the entity") =
    forAll(ControllerCases.invalidIds) { invalid =>
      val result = await(controller.reservation(invalid)(request(Some("good-token"))))
      result.header.status == 400 &&
        bodyOf(result).startsWith(ControllerOracle.paramInvalidPrefix)
    }

  property("negative: stock invalid id is rejected 400 and never reaches the stock entity") = secure {
    val result = await(controller.stock(ControllerOracle.fixedInvalidId)(request(Some("good-token"))))
    result.header.status == 400 &&
      bodyOf(result).startsWith(ControllerOracle.paramInvalidPrefix) && noTouchAfter(stockProbe)
  }

  property("negative: a silent entity folds the real ask timeout into 500 internal error") = secure {
    val future = controller.reservation(ControllerOracle.reservationId.toString)(request(Some("good-token")))
    reservationProbe.expectMessageType[GetReservationState](3.seconds)
    // 收到但不回执——让真实 ask 走满 5 秒超时，崩溃护栏把 future 内失败折叠成 500。
    val result = await(future)
    result.header.status == 500 && bodyOf(result) == ControllerOracle.internalErrorBody
  }

  property("state: reservation happy path records the parsed id and returns the flattened state json") =
    forAll(ControllerCases.validIds) { valid =>
      val future = controller.reservation(valid)(request(Some("good-token")))
      val recorded = reservationProbe.expectMessageType[GetReservationState](3.seconds)
      val parsedOk = recorded.idCid == Id.of(valid)
      recorded.replyTo.tell(ControllerOracle.unsettledReply)
      val result = await(future)
      parsedOk && result.header.status == 200 &&
        Json.parse(bodyOf(result)) == ControllerOracle.expectedUnsettledReservation
    }

  property("state: settled reservation happy path serializes the timestamp as an iso string") = secure {
    val future = controller.reservation(ControllerOracle.reservationId.toString)(request(Some("good-token")))
    val recorded = reservationProbe.expectMessageType[GetReservationState](3.seconds)
    recorded.replyTo.tell(ControllerOracle.settledReply)
    val result = await(future)
    result.header.status == 200 &&
      Json.parse(bodyOf(result)) == ControllerOracle.expectedSettledReservation
  }

  property("state: stock happy path returns its own flattened state json") = secure {
    val future = controller.stock(ControllerOracle.stockId.toString)(request(Some("good-token")))
    val recorded = stockProbe.expectMessageType[GetStockState](3.seconds)
    recorded.replyTo.tell(ControllerOracle.stockReply)
    val result = await(future)
    result.header.status == 200 && Json.parse(bodyOf(result)) == ControllerOracle.expectedStock
  }

  property("state: the response body carries no envelope key") = secure {
    val future = controller.reservation(ControllerOracle.reservationId.toString)(request(Some("good-token")))
    val recorded = reservationProbe.expectMessageType[GetReservationState](3.seconds)
    recorded.replyTo.tell(ControllerOracle.unsettledReply)
    val body = Json.parse(bodyOf(await(future)))
    (body match {
      case obj: play.api.libs.json.JsObject => obj.fields.forall(key => key != "state")
      case _ => false
    }) && body == ControllerOracle.expectedUnsettledReservation
  }

  property("determinism: repeated happy path bodies are byte identical") = secure {
    def once(): String = {
      val future = controller.reservation(ControllerOracle.reservationId.toString)(request(Some("good-token")))
      val recorded = reservationProbe.expectMessageType[GetReservationState](3.seconds)
      recorded.replyTo.tell(ControllerOracle.settledReply)
      bodyOf(await(future))
    }
    once() == once()
  }
}

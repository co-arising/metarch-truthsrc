import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.testkit.PersistenceTestKitPlugin
import com.typesafe.config.ConfigFactory
import net.imadz.infra.saga.strict._
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import akka.util.Timeout

final class GeneratedFiniteHostSpec extends AnyFunSuite {
  example.bankwealth.service.UnitConfigurationCheck.main(Array.empty)
}

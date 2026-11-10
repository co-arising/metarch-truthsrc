package reference.inventory.oracle

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.Behaviors
import akka.actor.typed.scaladsl.adapter._
import akka.serialization.{SerializationExtension, SerializerWithStringManifest}
import com.typesafe.config.{ConfigFactory, ConfigValueFactory}
import net.imadz.infra.saga.strict.{StrictSagaSerializer, StrictState}
import net.imadz.monarch.persistence.{RunProtocol, RunProtocolSerializer}
import org.scalatest.funsuite.AnyFunSuite
import scala.concurrent.Await
import scala.concurrent.duration._
import scala.util.Try

class RegistrationOracle extends AnyFunSuite {
  test("REGISTRATION_REQUIRED: explicit Saga and Run bindings select the frozen serializers") {
    val original = ConfigFactory.load()
    val config = sys.props.get("inventory.registration.missing") match {
      case Some(name) => original.withValue("akka.actor.serialization-bindings.\"" + name + "\"", ConfigValueFactory.fromAnyRef("none"))
      case None => original
    }
    val system = ActorSystem[Nothing](Behaviors.empty, "registration", config)
    try {
      val serialization = SerializationExtension(system.toClassic)
      val examples = Vector[(AnyRef, Class[_], Int)](
        (StrictState(), classOf[StrictSagaSerializer], 77102231),
        (RunProtocol.Unavailable(Some("original-run"), "cold query"), classOf[RunProtocolSerializer], 77102123))
      examples.foreach { case (value, expectedClass, expectedId) =>
        val selected = Try(serialization.findSerializerFor(value))
        assert(selected.toOption.exists(s => s.getClass == expectedClass && s.identifier == expectedId), "REGISTRATION_REQUIRED")
        val serializer = selected.get.asInstanceOf[SerializerWithStringManifest]
        val bytes = serializer.toBinary(value)
        assert(serialization.deserialize(bytes, serializer.identifier, serializer.manifest(value)).get == value)
      }
    } finally {
      system.terminate()
      Await.result(system.whenTerminated, 8.seconds)
    }
  }
}
